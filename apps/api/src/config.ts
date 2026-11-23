import { readFileSync } from 'node:fs';

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  /** Never upgrade to TLS with STARTTLS, even when the server offers it. */
  ignoreTls: boolean;
  /** Verify the server certificate. Set false for a relay with an internal or mismatched certificate. */
  tlsRejectUnauthorized: boolean;
  user?: string;
  pass?: string;
  from: string;
}

export interface Config {
  port: number;
  databaseUrl: string;
  appBaseUrl: string;
  cookieSecure: boolean;
  smtp: SmtpConfig;
  rateLimit: boolean;
  exposeMailpitLink: boolean;
}

type Env = Record<string, string | undefined>;

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function int(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') return fallback;
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) throw new Error(`Expected an integer, got "${value}"`);
  return n;
}

function blankToUndefined(value: string | undefined): string | undefined {
  return value === undefined || value === '' ? undefined : value;
}

function buildDatabaseUrl(env: Env): string {
  if (env.DATABASE_URL) return env.DATABASE_URL;
  const host = env.DB_HOST ?? 'db';
  const port = int(env.DB_PORT, 5432);
  const user = env.DB_USER ?? 'ticketing';
  const name = env.DB_NAME ?? 'ticketing';
  let password = env.DB_PASSWORD ?? '';
  if (env.DB_PASSWORD_FILE) password = readFileSync(env.DB_PASSWORD_FILE, 'utf8').trim();
  const auth = password ? `${encodeURIComponent(user)}:${encodeURIComponent(password)}` : encodeURIComponent(user);
  return `postgres://${auth}@${host}:${port}/${encodeURIComponent(name)}`;
}

export function loadConfig(env: Env = process.env): Config {
  return {
    port: int(env.PORT, 3000),
    databaseUrl: buildDatabaseUrl(env),
    appBaseUrl: (env.APP_BASE_URL ?? 'http://localhost:8080').replace(/\/+$/, ''),
    cookieSecure: bool(env.COOKIE_SECURE, false),
    smtp: {
      host: env.SMTP_HOST || 'relay1.dataart.com',
      port: int(env.SMTP_PORT, 25),
      secure: bool(env.SMTP_SECURE, false),
      ignoreTls: bool(env.SMTP_IGNORE_TLS, false),
      tlsRejectUnauthorized: bool(env.SMTP_TLS_REJECT_UNAUTHORIZED, true),
      user: blankToUndefined(env.SMTP_USER),
      pass: blankToUndefined(env.SMTP_PASS),
      from: env.MAIL_FROM || 'Ticketing <no-reply@ticketing.local>',
    },
    rateLimit: bool(env.RATE_LIMIT, true),
    exposeMailpitLink: bool(env.EXPOSE_MAILPIT_LINK, true),
  };
}
