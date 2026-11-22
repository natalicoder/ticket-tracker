import type { UserDto } from '@ticketing/shared';
import { eq, sql } from 'drizzle-orm';
import type { FastifyBaseLogger } from 'fastify';
import type { Config } from '../config.js';
import type { Db } from '../db/client.js';
import { users } from '../db/schema.js';
import { AppError } from '../errors.js';
import type { Mailer } from '../mail/mailer.js';
import { verificationEmail } from '../mail/templates.js';
import { burnPasswordCheck, hashPassword, verifyPassword } from './passwords.js';
import { createSession } from './sessions.js';
import { consumeEmailToken, issueEmailToken, VERIFY_TOKEN_TTL_MS } from './tokens.js';

export interface AuthDeps {
  db: Db;
  mailer: Mailer;
  config: Config;
  log: FastifyBaseLogger;
}

function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code === '23505' || e?.cause?.code === '23505';
}

async function findUserByEmail(db: Db, email: string) {
  const [user] = await db.select().from(users).where(eq(sql`lower(${users.email})`, email.toLowerCase()));
  return user;
}

async function sendMail(deps: AuthDeps, to: string, content: { subject: string; text: string; html: string }) {
  try {
    await deps.mailer.send({ to, ...content });
  } catch (err) {
    // The account/token already exists; the user can ask for a new email. Surface the problem in the logs.
    deps.log.error({ err, to }, 'failed to send email');
  }
}

async function sendVerification(deps: AuthDeps, userId: string, email: string): Promise<void> {
  const token = await issueEmailToken(deps.db, userId, 'verify', VERIFY_TOKEN_TTL_MS);
  await sendMail(deps, email, verificationEmail(`${deps.config.appBaseUrl}/verify?token=${token}`));
}

export async function signup(deps: AuthDeps, email: string, password: string): Promise<{ email: string }> {
  const taken = () => new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists. Log in instead.');
  if (await findUserByEmail(deps.db, email)) throw taken();
  const passwordHash = await hashPassword(password);
  let userId: string;
  try {
    const [row] = await deps.db.insert(users).values({ email, passwordHash }).returning({ id: users.id });
    userId = row!.id;
  } catch (err) {
    if (isUniqueViolation(err)) throw taken();
    throw err;
  }
  await sendVerification(deps, userId, email);
  return { email };
}

export async function verifyEmail(deps: AuthDeps, token: string): Promise<void> {
  const userId = await consumeEmailToken(deps.db, token, 'verify');
  await deps.db
    .update(users)
    .set({ emailVerifiedAt: sql`coalesce(${users.emailVerifiedAt}, now())` })
    .where(eq(users.id, userId));
}

export async function resendVerification(deps: AuthDeps, email: string): Promise<void> {
  const user = await findUserByEmail(deps.db, email);
  if (!user || user.emailVerifiedAt) return;
  await sendVerification(deps, user.id, user.email);
}

export async function login(deps: AuthDeps, email: string, password: string): Promise<{ user: UserDto; sessionToken: string }> {
  const user = await findUserByEmail(deps.db, email);
  const invalid = () => new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
  if (!user) {
    await burnPasswordCheck(password);
    throw invalid();
  }
  if (!(await verifyPassword(user.passwordHash, password))) throw invalid();
  if (!user.emailVerifiedAt) {
    throw new AppError(403, 'EMAIL_NOT_VERIFIED', 'Please verify your email before logging in. Check your inbox or request a new link.');
  }
  const sessionToken = await createSession(deps.db, user.id);
  return { user: { id: user.id, email: user.email }, sessionToken };
}
