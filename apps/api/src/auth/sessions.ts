import type { UserDto } from '@ticketing/shared';
import { and, eq, gt, sql } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { sessions, users } from '../db/schema.js';
import { generateToken, sha256 } from './tokens.js';

export const SESSION_COOKIE = 'sid';
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Creates a session and returns the raw token for the cookie. Only its sha256 is stored. */
export async function createSession(db: Db, userId: string): Promise<string> {
  const { raw, hash } = generateToken();
  await db.insert(sessions).values({ id: hash, userId, expiresAt: sql`now() + ${SESSION_TTL_MS} * interval '1 millisecond'` });
  return raw;
}

export async function getSessionUser(db: Db, raw: string): Promise<UserDto | null> {
  const [row] = await db
    .select({ id: users.id, email: users.email })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, sha256(raw)), gt(sessions.expiresAt, sql`now()`)));
  return row ?? null;
}

export async function deleteSession(db: Db, raw: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sha256(raw)));
}

export async function deleteUserSessions(db: Db, userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}
