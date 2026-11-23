import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';
import { smtpTransportOptions } from '../src/mail/mailer.js';

describe('loadConfig', () => {
  it('builds the database URL from parts and a password file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cfg-'));
    const file = join(dir, 'pw');
    writeFileSync(file, 's3cr/t\n');
    const cfg = loadConfig({ DB_PASSWORD_FILE: file });
    expect(cfg.databaseUrl).toBe('postgres://ticketing:s3cr%2Ft@db:5432/ticketing');
  });

  it('prefers DATABASE_URL and applies SMTP defaults', () => {
    const cfg = loadConfig({ DATABASE_URL: 'postgres://a:b@h:1/d' });
    expect(cfg.databaseUrl).toBe('postgres://a:b@h:1/d');
    expect(cfg.smtp).toEqual({ host: 'mailpit', port: 1025, secure: false, ignoreTls: false, tlsRejectUnauthorized: true, user: undefined, pass: undefined, from: 'Ticketing <no-reply@ticketing.local>' });
    expect(cfg.port).toBe(3000);
    expect(cfg.cookieSecure).toBe(false);
    expect(cfg.rateLimit).toBe(true);
  });

  it('reads SMTP settings from env', () => {
    const cfg = loadConfig({ DATABASE_URL: 'x', SMTP_HOST: 'relay1.dataart.com', SMTP_PORT: '25', SMTP_SECURE: 'true', SMTP_USER: 'u', SMTP_PASS: 'p', MAIL_FROM: 'A <a@b.c>' });
    expect(cfg.smtp).toEqual({ host: 'relay1.dataart.com', port: 25, secure: true, ignoreTls: false, tlsRejectUnauthorized: true, user: 'u', pass: 'p', from: 'A <a@b.c>' });
  });

  it('lets a relay with an internal certificate or no TLS be used (relay1.dataart.com)', () => {
    const cfg = loadConfig({ DATABASE_URL: 'x', SMTP_HOST: 'relay1.dataart.com', SMTP_PORT: '25', SMTP_IGNORE_TLS: 'true', SMTP_TLS_REJECT_UNAUTHORIZED: 'false' });
    expect(cfg.smtp).toMatchObject({ ignoreTls: true, tlsRejectUnauthorized: false });
    expect(smtpTransportOptions(cfg.smtp)).toMatchObject({ host: 'relay1.dataart.com', port: 25, secure: false, ignoreTLS: true, tls: { rejectUnauthorized: false } });
  });

  it('verifies certificates and upgrades with STARTTLS by default', () => {
    const opts = smtpTransportOptions(loadConfig({ DATABASE_URL: 'x' }).smtp);
    expect(opts).toMatchObject({ ignoreTLS: false, tls: { rejectUnauthorized: true } });
    expect(opts.auth).toBeUndefined();
  });
});
