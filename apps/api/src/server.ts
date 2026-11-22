import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { createDb } from './db/client.js';
import { runMigrations } from './db/migrate.js';
import { createSmtpMailer, type Mailer } from './mail/mailer.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const { db, pool } = createDb(config.databaseUrl);
  await runMigrations(db);

  const mailer: Mailer = createSmtpMailer(config.smtp);
  const app = await buildApp({ config, db, mailer });
  app.log.info('migrations applied');

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'shutting down');
    await app.close();
    await pool.end();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  await app.listen({ host: '0.0.0.0', port: config.port });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
