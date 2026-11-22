import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, resetDb, signupVerified, type TestApp } from './helpers.js';

let t: TestApp;
beforeAll(async () => {
  t = await createTestApp();
});
afterAll(async () => {
  await t.close();
});
beforeEach(async () => {
  await resetDb(t.db);
  t.mailer.sent = [];
});

const post = (url: string, payload: unknown, cookie?: string) =>
  t.app.inject({ method: 'POST', url, payload: payload as object, headers: cookie ? { cookie } : {} });

describe('password reset', () => {
  it('sets a new password, ends old sessions and is single-use', async () => {
    const { cookie } = await signupVerified(t, 'reset@example.com', 'old-password');

    const forgot = await post('/api/auth/forgot-password', { email: ' Reset@Example.com' });
    expect(forgot.statusCode).toBe(202);
    expect(forgot.json()).toEqual({ status: 'sent' });
    const link = t.mailer.lastLinkTo('reset@example.com');
    expect(link).toMatch(/^http:\/\/app\.test\/reset-password\?token=/);
    expect(t.mailer.sent.at(-1)!.subject).toMatch(/reset/i);
    const token = t.mailer.lastTokenTo('reset@example.com');

    const reset = await post('/api/auth/reset-password', { token, password: 'new-password' });
    expect(reset.statusCode).toBe(200);
    expect(reset.json()).toEqual({ status: 'reset' });

    const oldSession = await t.app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
    expect(oldSession.statusCode).toBe(401);

    const oldLogin = await post('/api/auth/login', { email: 'reset@example.com', password: 'old-password' });
    expect(oldLogin.statusCode).toBe(401);
    const newLogin = await post('/api/auth/login', { email: 'reset@example.com', password: 'new-password' });
    expect(newLogin.statusCode).toBe(200);

    const reuse = await post('/api/auth/reset-password', { token, password: 'third-password' });
    expect(reuse.statusCode).toBe(400);
    expect(reuse.json().error.code).toBe('TOKEN_USED');
  });

  it('expires reset tokens after one hour', async () => {
    await signupVerified(t, 'hour@example.com');
    await post('/api/auth/forgot-password', { email: 'hour@example.com' });
    const r = await t.db.execute(sql`select extract(epoch from (expires_at - created_at))::int as s from email_tokens where purpose = 'reset'`);
    expect(Number(r.rows[0]!.s)).toBe(3600);

    await t.db.execute(sql`update email_tokens set expires_at = now() - interval '1 second' where purpose = 'reset'`);
    const res = await post('/api/auth/reset-password', { token: t.mailer.lastTokenTo('hour@example.com'), password: 'new-password' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('TOKEN_EXPIRED');
  });

  it('rejects a verification token used as a reset token', async () => {
    await post('/api/auth/signup', { email: 'mix@example.com', password: 'password1' });
    const verifyToken = t.mailer.lastTokenTo('mix@example.com');
    const res = await post('/api/auth/reset-password', { token: verifyToken, password: 'new-password' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('TOKEN_INVALID');
  });

  it('validates the new password', async () => {
    const res = await post('/api/auth/reset-password', { token: 'x', password: 'short' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.details).toContainEqual({ path: 'password', message: 'Password must be at least 8 characters' });
  });

  it('answers 202 for an unknown email and sends nothing', async () => {
    const res = await post('/api/auth/forgot-password', { email: 'ghost@example.com' });
    expect(res.statusCode).toBe(202);
    expect(t.mailer.sent).toHaveLength(0);
  });

  it('verifies an unverified account, since the reset proves inbox ownership', async () => {
    await post('/api/auth/signup', { email: 'unv@example.com', password: 'password1' });
    await post('/api/auth/forgot-password', { email: 'unv@example.com' });
    await post('/api/auth/reset-password', { token: t.mailer.lastTokenTo('unv@example.com'), password: 'new-password' });
    const login = await post('/api/auth/login', { email: 'unv@example.com', password: 'new-password' });
    expect(login.statusCode).toBe(200);
  });
});
