import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from './helpers.js';

let t: TestApp;
beforeAll(async () => {
  t = await createTestApp({ rateLimit: true });
});
afterAll(async () => {
  await t.close();
});

describe('auth rate limit', () => {
  it('answers 429 RATE_LIMITED after 20 login attempts a minute from one IP', async () => {
    const attempt = () => t.app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'x@example.com', password: 'whatever1' } });
    for (let i = 0; i < 20; i++) expect((await attempt()).statusCode).toBe(401);
    const blocked = await attempt();
    expect(blocked.statusCode).toBe(429);
    expect(blocked.json().error.code).toBe('RATE_LIMITED');
  });

  it('does not limit non-auth routes', async () => {
    for (let i = 0; i < 25; i++) expect((await t.app.inject({ method: 'GET', url: '/api/health' })).statusCode).toBe(200);
  });
});
