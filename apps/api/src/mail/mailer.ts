import nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport/index.js';
import type { SmtpConfig } from '../config.js';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

/** Maps our SMTP settings to nodemailer options. STARTTLS is used when offered unless ignoreTls is set. */
export function smtpTransportOptions(cfg: SmtpConfig): SMTPTransport.Options {
  return {
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    ignoreTLS: cfg.ignoreTls,
    tls: { rejectUnauthorized: cfg.tlsRejectUnauthorized },
    auth: cfg.user ? { user: cfg.user, pass: cfg.pass ?? '' } : undefined,
  };
}

export function createSmtpMailer(cfg: SmtpConfig): Mailer {
  const transport = nodemailer.createTransport(smtpTransportOptions(cfg));
  return {
    async send(message) {
      await transport.sendMail({ from: cfg.from, ...message });
    },
  };
}
