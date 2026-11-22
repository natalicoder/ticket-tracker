import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, resetDb, signupVerified, type TestApp } from './helpers.js';

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
let t: TestApp;
let cookie: string;
let userId: string;
let teamA: string;
let teamB: string;

beforeAll(async () => {
  t = await createTestApp();
});
afterAll(async () => {
  await t.close();
});

const req = (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, payload?: unknown) =>
  t.app.inject({ method, url, headers: { cookie }, ...(payload === undefined ? {} : { payload: payload as object }) });

beforeEach(async () => {
  await resetDb(t.db);
  ({ cookie, userId } = await signupVerified(t, 'epics@example.com'));
  teamA = (await req('POST', '/api/teams', { name: 'A' })).json().id;
  teamB = (await req('POST', '/api/teams', { name: 'B' })).json().id;
});

describe('epics', () => {
  it('creates, lists, updates and deletes an epic', async () => {
    const created = await req('POST', '/api/epics', { teamId: teamA, title: ' Auth revamp ', description: 'Move to sessions' });
    expect(created.statusCode).toBe(201);
    const epic = created.json();
    expect(epic).toEqual({
      id: expect.any(String),
      teamId: teamA,
      title: 'Auth revamp',
      description: 'Move to sessions',
      createdAt: expect.stringMatching(ISO),
      modifiedAt: expect.stringMatching(ISO),
      ticketCount: 0,
    });

    const updated = await req('PATCH', `/api/epics/${epic.id}`, { title: 'Auth', description: null });
    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toMatchObject({ title: 'Auth', description: null, teamId: teamA });

    expect((await req('GET', `/api/epics?teamId=${teamA}`)).json()).toHaveLength(1);
    expect((await req('GET', `/api/epics?teamId=${teamB}`)).json()).toHaveLength(0);
    expect((await req('GET', '/api/epics')).json()).toHaveLength(1);

    expect((await req('DELETE', `/api/epics/${epic.id}`)).statusCode).toBe(204);
    expect((await req('GET', '/api/epics')).json()).toEqual([]);
  });

  it('sorts by title, case-insensitive', async () => {
    for (const title of ['beta', 'Alpha', 'gamma']) await req('POST', '/api/epics', { teamId: teamA, title });
    expect((await req('GET', `/api/epics?teamId=${teamA}`)).json().map((e: { title: string }) => e.title)).toEqual(['Alpha', 'beta', 'gamma']);
  });

  it('rejects an unknown team, a blank title and a team change', async () => {
    const unknownTeam = await req('POST', '/api/epics', { teamId: '00000000-0000-4000-8000-000000000000', title: 'x' });
    expect(unknownTeam.statusCode).toBe(400);
    expect(unknownTeam.json().error.code).toBe('TEAM_NOT_FOUND');

    const blank = await req('POST', '/api/epics', { teamId: teamA, title: '  ' });
    expect(blank.statusCode).toBe(400);
    expect(blank.json().error.details).toContainEqual({ path: 'title', message: 'Title must not be empty' });

    const epic = (await req('POST', '/api/epics', { teamId: teamA, title: 'Auth' })).json();
    const move = await req('PATCH', `/api/epics/${epic.id}`, { title: 'Auth', teamId: teamB });
    expect(move.statusCode).toBe(400);
    expect(move.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('only advances modifiedAt on a real change', async () => {
    const epic = (await req('POST', '/api/epics', { teamId: teamA, title: 'Auth' })).json();
    await t.db.execute(sql`select pg_sleep(0.02)`);
    expect((await req('PATCH', `/api/epics/${epic.id}`, { title: 'Auth' })).json().modifiedAt).toBe(epic.modifiedAt);
    expect((await req('PATCH', `/api/epics/${epic.id}`, { title: 'Auth 2' })).json().modifiedAt > epic.modifiedAt).toBe(true);
  });

  it('refuses to delete an epic used by tickets', async () => {
    const epic = (await req('POST', '/api/epics', { teamId: teamA, title: 'Auth' })).json();
    await t.db.execute(sql`insert into tickets (team_id, type, epic_id, title, body, created_by) values (${teamA}, 'bug', ${epic.id}, 't', 'b', ${userId})`);
    await t.db.execute(sql`insert into tickets (team_id, type, epic_id, title, body, created_by) values (${teamA}, 'fix', ${epic.id}, 't2', 'b', ${userId})`);

    expect((await req('GET', `/api/epics?teamId=${teamA}`)).json()[0].ticketCount).toBe(2);
    const del = await req('DELETE', `/api/epics/${epic.id}`);
    expect(del.statusCode).toBe(409);
    expect(del.json().error).toEqual({ code: 'EPIC_IN_USE', message: 'Epic is used by 2 tickets.', details: { ticketCount: 2 } });
  });

  it('answers 404 for unknown and malformed ids', async () => {
    for (const id of ['00000000-0000-4000-8000-000000000000', 'nope']) {
      const patch = await req('PATCH', `/api/epics/${id}`, { title: 'x' });
      expect(patch.statusCode).toBe(404);
      expect(patch.json().error.code).toBe('EPIC_NOT_FOUND');
      expect((await req('DELETE', `/api/epics/${id}`)).statusCode).toBe(404);
    }
  });

  it('rejects a malformed teamId filter', async () => {
    const res = await req('GET', '/api/epics?teamId=nope');
    expect(res.statusCode).toBe(400);
  });
});
