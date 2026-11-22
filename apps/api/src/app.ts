import Fastify, { type FastifyInstance } from 'fastify';
import type { Config } from './config.js';

export interface AppDeps {
  config: Config;
  db: unknown;
  mailer: unknown;
}

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({
    logger: process.env.NODE_ENV === 'test' ? false : { level: process.env.LOG_LEVEL ?? 'info' },
    trustProxy: true,
  });

  app.get('/api/health', async () => ({ status: 'ok' }));

  void deps;
  return app;
}
