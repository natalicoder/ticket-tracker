import { sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { loadConfig, type Config } from '../src/config.js';
import { createDb, type Db } from '../src/db/client.js';
import { runMigrations } from '../src/db/migrate.js';
import type { MailMessage, Mailer } from '../src/mail/mailer.js';

export const APP_TABLES = ['users', 'sessions', 'email_tokens', 'teams', 'epics', 'tickets', 'comments', 'ticket_events'] as const;

export class MemoryMailer implements Mailer {
  sent: MailMessage[] = [];

  async send(message: MailMessage): Promise<void> {
    this.sent.push(message);
  }

  /** The most recent link (http…) in a mail sent to `email`. */
  lastLinkTo(email: string): string {
    const mail = [...this.sent].reverse().find((m) => m.to === email);
    if (!mail) throw new Error(`no mail sent to ${email}`);
    const match = /https?:\/\/\S+/.exec(mail.text);
    if (!match) throw new Error(`no link in mail to ${email}`);
    return match[0];
  }

  /** The `token` query parameter of the most recent link sent to `email`. */
  lastTokenTo(email: string): string {
    const token = new URL(this.lastLinkTo(email)).searchParams.get('token');
    if (!token) throw new Error(`no token in link to ${email}`);
    return token;
  }
}

export interface TestApp {
  app: FastifyInstance;
  db: Db;
  mailer: MemoryMailer;
  close(): Promise<void>;
}

let migrated: Promise<void> | undefined;

export async function createTestApp(overrides: Partial<Config> = {}): Promise<TestApp> {
  const config: Config = { ...loadConfig(process.env), rateLimit: false, appBaseUrl: 'http://app.test', ...overrides };
  const { db, pool } = createDb(config.databaseUrl);
  migrated ??= runMigrations(db);
  await migrated;
  const mailer = new MemoryMailer();
  const app = await buildApp({ config, db, mailer });
  await app.ready();
  return {
    app,
    db,
    mailer,
    async close() {
      await app.close();
      await pool.end();
    },
  };
}

/** `sid=<value>` from a response's Set-Cookie header, ready for a `cookie` request header. */
export function cookieFrom(res: { headers: Record<string, unknown> }): string {
  const header = res.headers['set-cookie'];
  const all = Array.isArray(header) ? header : [String(header ?? '')];
  const sid = all.map((c) => /(?:^|\s)sid=([^;]*)/.exec(String(c))).find((m) => m && m[1]);
  if (!sid) throw new Error('no sid cookie in response');
  return `sid=${sid[1]}`;
}

/** Signs up, verifies and logs in; returns the session cookie. */
export async function signupVerified(t: TestApp, email: string, password = 'password123'): Promise<{ cookie: string; userId: string }> {
  const signup = await t.app.inject({ method: 'POST', url: '/api/auth/signup', payload: { email, password } });
  if (signup.statusCode !== 201) throw new Error(`signup failed: ${signup.body}`);
  const token = t.mailer.lastTokenTo(email.trim().toLowerCase());
  await t.app.inject({ method: 'POST', url: '/api/auth/verify', payload: { token } });
  const login = await t.app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password } });
  if (login.statusCode !== 200) throw new Error(`login failed: ${login.body}`);
  return { cookie: cookieFrom(login), userId: login.json().id };
}

export async function resetDb(db: Db): Promise<void> {
  await db.execute(sql.raw(`truncate table ${APP_TABLES.join(', ')} restart identity cascade`));
}
