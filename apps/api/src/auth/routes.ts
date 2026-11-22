import { EmailBody, LoginBody, SignupBody, TokenBody } from '@ticketing/shared';
import type { FastifyContextConfig, FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { SESSION_COOKIE, SESSION_TTL_MS, deleteSession } from './sessions.js';
import * as auth from './service.js';
import type { AuthDeps } from './service.js';

export function authRoutes(deps: Omit<AuthDeps, 'log'>, rateLimit: boolean) {
  return async function (app: FastifyInstance) {
    const r = app.withTypeProvider<ZodTypeProvider>();
    const d: AuthDeps = { ...deps, log: app.log };
    const limited: FastifyContextConfig = rateLimit ? { rateLimit: { max: 20, timeWindow: '1 minute' } } : {};
    const tags = ['auth'];

    r.post('/auth/signup', { schema: { tags, summary: 'Create an account and send a verification email', body: SignupBody }, config: limited }, async (req, reply) => {
      const result = await auth.signup(d, req.body.email, req.body.password);
      return reply.status(201).send(result);
    });

    r.post('/auth/verify', { schema: { tags, summary: 'Verify an email address with the token from the email link', body: TokenBody }, config: limited }, async (req) => {
      await auth.verifyEmail(d, req.body.token);
      return { status: 'verified' as const };
    });

    r.post(
      '/auth/resend-verification',
      { schema: { tags, summary: 'Send a new verification link (always 202)', body: EmailBody }, config: limited },
      async (req, reply) => {
        await auth.resendVerification(d, req.body.email);
        return reply.status(202).send({ status: 'sent' as const });
      },
    );

    r.post('/auth/login', { schema: { tags, summary: 'Log in; sets the httpOnly session cookie', body: LoginBody }, config: limited }, async (req, reply) => {
      const { user, sessionToken } = await auth.login(d, req.body.email, req.body.password);
      reply.setCookie(SESSION_COOKIE, sessionToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure: deps.config.cookieSecure,
        path: '/',
        maxAge: Math.floor(SESSION_TTL_MS / 1000),
      });
      return user;
    });

    r.post('/auth/logout', { schema: { tags, summary: 'Log out and clear the session cookie' } }, async (req, reply) => {
      const raw = req.cookies[SESSION_COOKIE];
      if (raw) await deleteSession(deps.db, raw);
      reply.clearCookie(SESSION_COOKIE, { path: '/', httpOnly: true, sameSite: 'lax', secure: deps.config.cookieSecure });
      return reply.status(204).send();
    });

    r.get('/auth/me', { schema: { tags, summary: 'The logged-in user' } }, async (req) => req.user);
  };
}
