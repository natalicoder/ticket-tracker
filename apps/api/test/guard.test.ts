import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from './helpers.js';

const ID = '00000000-0000-4000-8000-000000000000';

/** Every private route. Extend this list whenever a route is added. */
export const PRIVATE_ROUTES: Array<[method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string]> = [
  ['GET', '/api/auth/me'],
  ['POST', '/api/auth/logout'],
  ['GET', '/api/teams'],
  ['POST', '/api/teams'],
  ['PATCH', `/api/teams/${ID}`],
  ['DELETE', `/api/teams/${ID}`],
  ['GET', '/api/epics'],
  ['GET', `/api/epics?teamId=${ID}`],
  ['POST', '/api/epics'],
  ['PATCH', `/api/epics/${ID}`],
  ['DELETE', `/api/epics/${ID}`],
  ['GET', `/api/teams/${ID}/tickets`],
  ['GET', `/api/teams/${ID}/tickets/similar?q=login`],
  ['GET', '/api/tickets/1'],
  ['POST', '/api/tickets'],
  ['PATCH', '/api/tickets/1'],
  ['PATCH', '/api/tickets/1/state'],
  ['DELETE', '/api/tickets/1'],
  ['GET', '/api/tickets/1/events'],
  ['GET', '/api/tickets/1/comments'],
  ['POST', '/api/tickets/1/comments'],
  ['PATCH', `/api/comments/${ID}`],
  ['DELETE', `/api/comments/${ID}`],
  ['GET', '/api/docs'],
  ['GET', '/api/docs/json'],
  ['GET', '/api/does-not-exist'],
];

const PUBLIC_ROUTES: Array<['GET' | 'POST', string]> = [
  ['GET', '/api/health'],
  ['GET', '/api/ready'],
  ['POST', '/api/auth/signup'],
  ['POST', '/api/auth/login'],
  ['POST', '/api/auth/verify'],
  ['POST', '/api/auth/resend-verification'],
  ['POST', '/api/auth/forgot-password'],
  ['POST', '/api/auth/reset-password'],
];

let t: TestApp;
beforeAll(async () => {
  t = await createTestApp();
});
afterAll(async () => {
  await t.close();
});

describe('auth guard', () => {
  it.each(PRIVATE_ROUTES)('%s %s → 401 without a session', async (method, url) => {
    const res = await t.app.inject({ method, url, ...(method === 'GET' || method === 'DELETE' ? {} : { payload: {} }) });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: { code: 'UNAUTHENTICATED', message: expect.any(String) } });
  });

  it.each(PRIVATE_ROUTES)('%s %s → 401 with a forged session cookie', async (method, url) => {
    const res = await t.app.inject({ method, url, headers: { cookie: 'sid=forged' } });
    expect(res.statusCode).toBe(401);
  });

  it.each(PUBLIC_ROUTES)('%s %s is reachable without a session', async (method, url) => {
    const res = await t.app.inject({ method, url, ...(method === 'POST' ? { payload: {} } : {}) });
    expect(res.statusCode).not.toBe(401);
  });
});
