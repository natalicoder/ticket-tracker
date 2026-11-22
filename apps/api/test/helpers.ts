import { sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
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

export async function createTestApp(): Promise<TestApp> {
  const config = { ...loadConfig(process.env), rateLimit: false, appBaseUrl: 'http://app.test' };
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

export async function resetDb(db: Db): Promise<void> {
  await db.execute(sql.raw(`truncate table ${APP_TABLES.join(', ')} restart identity cascade`));
}
