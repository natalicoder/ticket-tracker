import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { sql } from 'drizzle-orm';
import Fastify, { type FastifyInstance } from 'fastify';
import { jsonSchemaTransform, serializerCompiler } from 'fastify-type-provider-zod';
import type { ZodTypeAny } from 'zod';
import { registerAuthGuard } from './auth/guard.js';
import { authRoutes } from './auth/routes.js';
import type { Config } from './config.js';
import type { Db } from './db/client.js';
import { AppError, errorBody, errorHandler } from './errors.js';
import type { Mailer } from './mail/mailer.js';

export interface AppDeps {
  config: Config;
  db: Db;
  mailer: Mailer;
}

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const { db, config, mailer } = deps;
  const app = Fastify({
    logger: process.env.NODE_ENV === 'test' ? false : { level: process.env.LOG_LEVEL ?? 'info' },
    trustProxy: true,
    bodyLimit: 256 * 1024,
  });

  // Zod validates and transforms (trim, lowercase, defaults); a failure surfaces as a ZodError → 400 VALIDATION_ERROR.
  app.setValidatorCompiler<ZodTypeAny>(({ schema }) => (data) => {
    const result = schema.safeParse(data);
    return result.success ? { value: result.data } : { error: result.error };
  });
  app.setSerializerCompiler(serializerCompiler);
  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler((req, reply) => {
    reply.status(404).send(errorBody('NOT_FOUND', `Route ${req.method} ${req.url.split('?')[0]} not found`));
  });

  await app.register(cookie);
  if (config.rateLimit) {
    await app.register(rateLimit, {
      global: false,
      errorResponseBuilder: (_req, ctx) => new AppError(429, 'RATE_LIMITED', `Too many attempts. Try again in ${ctx.after}.`),
    });
  }

  await app.register(swagger, {
    openapi: {
      info: { title: 'Ticketing API', version: '1.0.0', description: 'Kanban ticketing system. Authenticate with POST /api/auth/login; the session travels in the httpOnly `sid` cookie.' },
      components: { securitySchemes: { session: { type: 'apiKey', in: 'cookie', name: 'sid' } } },
      security: [{ session: [] }],
    },
    transform: jsonSchemaTransform,
  });
  await app.register(swaggerUi, { routePrefix: '/api/docs' });

  registerAuthGuard(app, db);

  app.get('/api/health', { schema: { tags: ['system'], security: [] } }, async () => ({ status: 'ok' }));
  app.get('/api/ready', { schema: { tags: ['system'], security: [] } }, async (_req, reply) => {
    try {
      await db.execute(sql`select 1`);
      return { status: 'ready' };
    } catch {
      return reply.status(503).send(errorBody('NOT_READY', 'Database is not reachable'));
    }
  });

  await app.register(authRoutes({ db, mailer, config }, config.rateLimit), { prefix: '/api' });

  return app;
}
