import { sql } from 'drizzle-orm';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Config } from './config.js';
import type { Db } from './db/client.js';
import type { Mailer } from './mail/mailer.js';

export interface AppDeps {
  config: Config;
  db: Db;
  mailer: Mailer;
}

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const { db } = deps;
  const app = Fastify({
    logger: process.env.NODE_ENV === 'test' ? false : { level: process.env.LOG_LEVEL ?? 'info' },
    trustProxy: true,
  });

  app.get('/api/health', async () => ({ status: 'ok' }));

  app.get('/api/ready', async (_req, reply) => {
    try {
      await db.execute(sql`select 1`);
      return { status: 'ready' };
    } catch {
      return reply.status(503).send({ error: { code: 'NOT_READY', message: 'Database is not reachable' } });
    }
  });

  return app;
}
