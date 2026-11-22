import type { UserDto } from '@ticketing/shared';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../db/client.js';
import { AppError } from '../errors.js';
import { getSessionUser, SESSION_COOKIE } from './sessions.js';

declare module 'fastify' {
  interface FastifyRequest {
    /** Set by the auth guard on every private route. */
    user: UserDto;
  }
}

const PUBLIC_ROUTES = new Set([
  'GET /api/health',
  'GET /api/ready',
  'POST /api/auth/signup',
  'POST /api/auth/login',
  'POST /api/auth/verify',
  'POST /api/auth/resend-verification',
  'POST /api/auth/forgot-password',
  'POST /api/auth/reset-password',
]);

export function isPublic(method: string, url: string): boolean {
  const path = url.split('?')[0]!.replace(/\/+$/, '') || '/';
  if (!path.startsWith('/api/') && path !== '/api') return true;
  if (path === '/api/docs' || path.startsWith('/api/docs/')) return true;
  return PUBLIC_ROUTES.has(`${method === 'HEAD' ? 'GET' : method} ${path}`);
}

export function registerAuthGuard(app: FastifyInstance, db: Db): void {
  app.decorateRequest('user', null as unknown as UserDto);
  app.addHook('onRequest', async (request) => {
    if (isPublic(request.method, request.url)) return;
    const raw = request.cookies[SESSION_COOKIE];
    const user = raw ? await getSessionUser(db, raw) : null;
    if (!user) throw new AppError(401, 'UNAUTHENTICATED', 'Please log in to continue.');
    request.user = user;
  });
}
