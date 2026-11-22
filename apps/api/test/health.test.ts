import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

describe('GET /api/health', () => {
  it('returns 200 {status:"ok"}', async () => {
    const app = await buildApp({ config: loadConfig({ DATABASE_URL: 'postgres://x@y/z' }), db: null, mailer: null });
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
    await app.close();
  });
});
