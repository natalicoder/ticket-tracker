import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, resetDb, signupVerified, type TestApp } from './helpers.js';

let t: TestApp;
let cookie: string;
let teamA: string;
let teamB: string;

beforeAll(async () => {
  t = await createTestApp();
});
afterAll(async () => {
  await t.close();
});

const req = (method: 'GET' | 'POST', url: string, payload?: unknown) =>
  t.app.inject({ method, url, headers: { cookie }, ...(payload === undefined ? {} : { payload: payload as object }) });

async function ticket(teamId: string, title: string): Promise<number> {
  return (await req('POST', '/api/tickets', { teamId, type: 'bug', title, body: 'b' })).json().id;
}

beforeEach(async () => {
  await resetDb(t.db);
  ({ cookie } = await signupVerified(t, 'similar@example.com'));
  teamA = (await req('POST', '/api/teams', { name: 'A' })).json().id;
  teamB = (await req('POST', '/api/teams', { name: 'B' })).json().id;
});

describe('similar tickets', () => {
  it('finds tickets with a similar title in the same team', async () => {
    const login = await ticket(teamA, 'Login fails on Safari');
    await ticket(teamA, 'Dark mode');
    await ticket(teamB, 'Login fails on Safari too');

    const res = await req('GET', `/api/teams/${teamA}/tickets/similar?q=${encodeURIComponent('login fail safari')}`);
    expect(res.statusCode).toBe(200);
    const hits = res.json();
    expect(hits).toHaveLength(1);
    expect(hits[0]).toEqual({ id: login, title: 'Login fails on Safari', state: 'new', score: expect.any(Number) });
    expect(hits[0].score).toBeGreaterThan(0.3);
    expect(hits[0].score).toBeLessThanOrEqual(1);
  });

  it('excludes the ticket being edited', async () => {
    const login = await ticket(teamA, 'Login fails on Safari');
    const res = await req('GET', `/api/teams/${teamA}/tickets/similar?q=Login%20fails%20on%20Safari&excludeId=${login}`);
    expect(res.json()).toEqual([]);
  });

  it('returns at most 5, best first', async () => {
    for (let i = 0; i < 7; i++) await ticket(teamA, `Checkout crash ${i}`);
    await ticket(teamA, 'Checkout crash');
    const hits = (await req('GET', `/api/teams/${teamA}/tickets/similar?q=checkout%20crash`)).json();
    expect(hits).toHaveLength(5);
    expect(hits[0].title).toBe('Checkout crash');
    const scores = hits.map((h: { score: number }) => h.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it('requires at least 3 characters', async () => {
    expect((await req('GET', `/api/teams/${teamA}/tickets/similar?q=ab`)).statusCode).toBe(400);
  });
});
