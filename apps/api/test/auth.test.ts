import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cookieFrom, createTestApp, resetDb, type TestApp } from './helpers.js';

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

describe('signup → verify → login', () => {
  it('runs the full flow with email normalisation', async () => {
    const signup = await post('/api/auth/signup', { email: '  Alice@Example.COM ', password: 'correct horse' });
    expect(signup.statusCode).toBe(201);
    expect(signup.json()).toEqual({ email: 'alice@example.com' });

    expect(t.mailer.sent).toHaveLength(1);
    const mail = t.mailer.sent[0]!;
    expect(mail.to).toBe('alice@example.com');
    expect(mail.subject).toMatch(/verify/i);
    expect(mail.html).toContain('/verify?token=');
    const link = t.mailer.lastLinkTo('alice@example.com');
    expect(link).toMatch(/^http:\/\/app\.test\/verify\?token=[A-Za-z0-9_-]+$/);
    const token = t.mailer.lastTokenTo('alice@example.com');

    const early = await post('/api/auth/login', { email: 'alice@example.com', password: 'correct horse' });
    expect(early.statusCode).toBe(403);
    expect(early.json().error.code).toBe('EMAIL_NOT_VERIFIED');

    const verify = await post('/api/auth/verify', { token });
    expect(verify.statusCode).toBe(200);
    expect(verify.json()).toEqual({ status: 'verified' });

    const again = await post('/api/auth/verify', { token });
    expect(again.statusCode).toBe(400);
    expect(again.json().error.code).toBe('TOKEN_USED');

    const login = await post('/api/auth/login', { email: 'ALICE@example.com ', password: 'correct horse' });
    expect(login.statusCode).toBe(200);
    expect(login.json()).toEqual({ id: expect.any(String), email: 'alice@example.com' });
    const setCookie = String(login.headers['set-cookie']);
    expect(setCookie).toMatch(/sid=/);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
    expect(setCookie).toMatch(/Path=\//);
    const cookie = cookieFrom(login);

    const me = await t.app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
    expect(me.statusCode).toBe(200);
    expect(me.json().email).toBe('alice@example.com');

    const logout = await post('/api/auth/logout', undefined, cookie);
    expect(logout.statusCode).toBe(204);
    expect(String(logout.headers['set-cookie'])).toMatch(/sid=;/);

    const after = await t.app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
    expect(after.statusCode).toBe(401);
    expect(after.json().error.code).toBe('UNAUTHENTICATED');
  });
});

describe('signup validation', () => {
  it('rejects a duplicate email in any casing', async () => {
    await post('/api/auth/signup', { email: 'alice@example.com', password: 'password1' });
    const dup = await post('/api/auth/signup', { email: ' ALICE@example.com', password: 'password2' });
    expect(dup.statusCode).toBe(409);
    expect(dup.json().error.code).toBe('EMAIL_TAKEN');
  });

  it('rejects a short password with a field error', async () => {
    const res = await post('/api/auth/signup', { email: 'bob@example.com', password: 'short' });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details).toContainEqual({ path: 'password', message: 'Password must be at least 8 characters' });
  });

  it('rejects an invalid email', async () => {
    const res = await post('/api/auth/signup', { email: 'nope', password: 'password1' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.details[0].path).toBe('email');
  });

  it('stores an argon2id hash and never returns it', async () => {
    await post('/api/auth/signup', { email: 'carol@example.com', password: 'password1' });
    const r = await t.db.execute(sql`select password_hash from users`);
    expect(String(r.rows[0]!.password_hash)).toMatch(/^\$argon2id\$/);

    await post('/api/auth/verify', { token: t.mailer.lastTokenTo('carol@example.com') });
    const login = await post('/api/auth/login', { email: 'carol@example.com', password: 'password1' });
    expect(login.body).not.toMatch(/password|hash/i);
  });
});

describe('login failures', () => {
  it('returns the same 401 for a wrong password and an unknown email', async () => {
    await post('/api/auth/signup', { email: 'dave@example.com', password: 'password1' });
    const wrong = await post('/api/auth/login', { email: 'dave@example.com', password: 'password2' });
    const unknown = await post('/api/auth/login', { email: 'nobody@example.com', password: 'password1' });
    expect(wrong.statusCode).toBe(401);
    expect(unknown.statusCode).toBe(401);
    expect(wrong.json()).toEqual(unknown.json());
    expect(wrong.json().error.code).toBe('INVALID_CREDENTIALS');
  });

  it('does not reveal unverified status to a wrong password', async () => {
    await post('/api/auth/signup', { email: 'erin@example.com', password: 'password1' });
    const wrong = await post('/api/auth/login', { email: 'erin@example.com', password: 'nope-nope' });
    expect(wrong.statusCode).toBe(401);
  });
});

describe('verification tokens', () => {
  it('rejects an expired token', async () => {
    await post('/api/auth/signup', { email: 'frank@example.com', password: 'password1' });
    await t.db.execute(sql`update email_tokens set expires_at = now() - interval '1 second'`);
    const res = await post('/api/auth/verify', { token: t.mailer.lastTokenTo('frank@example.com') });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('TOKEN_EXPIRED');
  });

  it('issues tokens that expire 24 hours after issue', async () => {
    await post('/api/auth/signup', { email: 'gina@example.com', password: 'password1' });
    const r = await t.db.execute(sql`select extract(epoch from (expires_at - created_at))::int as s from email_tokens`);
    expect(Number(r.rows[0]!.s)).toBe(24 * 3600);
  });

  it('rejects an unknown token', async () => {
    const res = await post('/api/auth/verify', { token: 'definitely-not-a-token' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('TOKEN_INVALID');
  });

  it('resend invalidates the previous token', async () => {
    await post('/api/auth/signup', { email: 'hank@example.com', password: 'password1' });
    const first = t.mailer.lastTokenTo('hank@example.com');
    const resend = await post('/api/auth/resend-verification', { email: 'HANK@example.com' });
    expect(resend.statusCode).toBe(202);
    expect(t.mailer.sent).toHaveLength(2);
    const second = t.mailer.lastTokenTo('hank@example.com');
    expect(second).not.toBe(first);

    const old = await post('/api/auth/verify', { token: first });
    expect(old.statusCode).toBe(400);
    expect(old.json().error.code).toBe('TOKEN_USED');
    const ok = await post('/api/auth/verify', { token: second });
    expect(ok.statusCode).toBe(200);
  });

  it('resend for an unknown or already verified email answers 202 and sends nothing', async () => {
    const unknown = await post('/api/auth/resend-verification', { email: 'ghost@example.com' });
    expect(unknown.statusCode).toBe(202);
    expect(unknown.json()).toEqual({ status: 'sent' });
    expect(t.mailer.sent).toHaveLength(0);

    await post('/api/auth/signup', { email: 'ivy@example.com', password: 'password1' });
    await post('/api/auth/verify', { token: t.mailer.lastTokenTo('ivy@example.com') });
    const verified = await post('/api/auth/resend-verification', { email: 'ivy@example.com' });
    expect(verified.statusCode).toBe(202);
    expect(t.mailer.sent).toHaveLength(1);
  });
});

describe('sessions', () => {
  it('rejects an expired session', async () => {
    await post('/api/auth/signup', { email: 'jo@example.com', password: 'password1' });
    await post('/api/auth/verify', { token: t.mailer.lastTokenTo('jo@example.com') });
    const login = await post('/api/auth/login', { email: 'jo@example.com', password: 'password1' });
    await t.db.execute(sql`update sessions set expires_at = now() - interval '1 second'`);
    const me = await t.app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie: cookieFrom(login) } });
    expect(me.statusCode).toBe(401);
  });

  it('stores only a hash of the session token', async () => {
    await post('/api/auth/signup', { email: 'kim@example.com', password: 'password1' });
    await post('/api/auth/verify', { token: t.mailer.lastTokenTo('kim@example.com') });
    const login = await post('/api/auth/login', { email: 'kim@example.com', password: 'password1' });
    const raw = cookieFrom(login).replace(/^sid=/, '');
    const r = await t.db.execute(sql`select id from sessions`);
    expect(r.rows[0]!.id).not.toBe(raw);
    expect(String(r.rows[0]!.id)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('error format', () => {
  it('uses the common error envelope for malformed JSON', async () => {
    const res = await t.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: '{bad json',
      headers: { 'content-type': 'application/json' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBeTypeOf('string');
  });

  it('rejects form-encoded posts (CSRF hardening)', async () => {
    const res = await t.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: 'email=a@b.co&password=x',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    });
    expect(res.statusCode).toBe(415);
    expect(res.json().error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });
});
