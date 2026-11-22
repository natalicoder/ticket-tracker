import { createHash, randomBytes } from 'node:crypto';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { emailTokens } from '../db/schema.js';
import { AppError } from '../errors.js';

export type TokenPurpose = 'verify' | 'reset';

export const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function generateToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString('base64url');
  return { raw, hash: sha256(raw) };
}

/** Issues a single-use token and retires every earlier unused token of the same purpose. Returns the raw token. */
export async function issueEmailToken(db: Db, userId: string, purpose: TokenPurpose, ttlMs: number): Promise<string> {
  const { raw, hash } = generateToken();
  await db.transaction(async (tx) => {
    await tx
      .update(emailTokens)
      .set({ usedAt: sql`now()` })
      .where(and(eq(emailTokens.userId, userId), eq(emailTokens.purpose, purpose), isNull(emailTokens.usedAt)));
    await tx.insert(emailTokens).values({
      userId,
      tokenHash: hash,
      purpose,
      expiresAt: sql`now() + ${ttlMs} * interval '1 millisecond'`,
    });
  });
  return raw;
}

const TOKEN_MESSAGES = {
  TOKEN_INVALID: 'This link is invalid. Request a new one.',
  TOKEN_USED: 'This link has already been used or was replaced by a newer one.',
  TOKEN_EXPIRED: 'This link has expired. Request a new one.',
} as const;

/** Marks a token used and returns its user id, or throws 400 TOKEN_INVALID | TOKEN_USED | TOKEN_EXPIRED. */
export async function consumeEmailToken(db: Db, raw: string, purpose: TokenPurpose): Promise<string> {
  const [row] = await db
    .select({
      id: emailTokens.id,
      userId: emailTokens.userId,
      purpose: emailTokens.purpose,
      usedAt: emailTokens.usedAt,
      expired: sql<boolean>`${emailTokens.expiresAt} <= now()`,
    })
    .from(emailTokens)
    .where(eq(emailTokens.tokenHash, sha256(raw)));

  const fail = (code: keyof typeof TOKEN_MESSAGES) => new AppError(400, code, TOKEN_MESSAGES[code]);
  if (!row || row.purpose !== purpose) throw fail('TOKEN_INVALID');
  if (row.usedAt) throw fail('TOKEN_USED');
  if (row.expired) throw fail('TOKEN_EXPIRED');

  const claimed = await db
    .update(emailTokens)
    .set({ usedAt: sql`now()` })
    .where(and(eq(emailTokens.id, row.id), isNull(emailTokens.usedAt)))
    .returning({ id: emailTokens.id });
  if (claimed.length === 0) throw fail('TOKEN_USED');
  return row.userId;
}
