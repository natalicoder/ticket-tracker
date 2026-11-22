import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, resetDb, signupVerified, type TestApp } from './helpers.js';

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
let t: TestApp;
let cookie: string;
let userId: string;

beforeAll(async () => {
  t = await createTestApp();
});
afterAll(async () => {
  await t.close();
});
beforeEach(async () => {
  await resetDb(t.db);
  ({ cookie, userId } = await signupVerified(t, 'teams@example.com'));
});

const req = (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, payload?: unknown) =>
  t.app.inject({ method, url, headers: { cookie }, ...(payload === undefined ? {} : { payload: payload as object }) });

const createTeam = async (name: string) => {
  const res = await req('POST', '/api/teams', { name });
  expect(res.statusCode).toBe(201);
  return res.json();
};

describe('teams', () => {
  it('creates, lists, renames and deletes a team with ISO UTC timestamps', async () => {
    const team = await createTeam('  Core ');
    expect(team).toEqual({ id: expect.any(String), name: 'Core', createdAt: expect.stringMatching(ISO), modifiedAt: expect.stringMatching(ISO), ticketCount: 0, epicCount: 0 });
    expect(team.createdAt).toBe(team.modifiedAt);

    const list = await req('GET', '/api/teams');
    expect(list.statusCode).toBe(200);
    expect(list.json()).toEqual([team]);

    const renamed = await req('PATCH', `/api/teams/${team.id}`, { name: 'Platform' });
    expect(renamed.statusCode).toBe(200);
    expect(renamed.json().name).toBe('Platform');

    const del = await req('DELETE', `/api/teams/${team.id}`);
    expect(del.statusCode).toBe(204);
    expect((await req('GET', '/api/teams')).json()).toEqual([]);
  });

  it('sorts teams by name, case-insensitive', async () => {
    await createTeam('beta');
    await createTeam('Alpha');
    await createTeam('gamma');
    expect((await req('GET', '/api/teams')).json().map((x: { name: string }) => x.name)).toEqual(['Alpha', 'beta', 'gamma']);
  });

  it('only advances modifiedAt on a real rename', async () => {
    const team = await createTeam('Core');
    await t.db.execute(sql`select pg_sleep(0.02)`);
    const same = (await req('PATCH', `/api/teams/${team.id}`, { name: 'Core' })).json();
    expect(same.modifiedAt).toBe(team.modifiedAt);
    const changed = (await req('PATCH', `/api/teams/${team.id}`, { name: 'Core 2' })).json();
    expect(changed.modifiedAt > team.modifiedAt).toBe(true);
    expect(changed.createdAt).toBe(team.createdAt);
  });

  it('rejects a whitespace-only name', async () => {
    const res = await req('POST', '/api/teams', { name: '   ' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.details).toContainEqual({ path: 'name', message: 'Name must not be empty' });
  });

  it('rejects duplicate names that differ only by case or surrounding spaces', async () => {
    await createTeam('Core');
    const res = await req('POST', '/api/teams', { name: 'core ' });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toEqual({ code: 'TEAM_NAME_TAKEN', message: 'A team named "core" already exists' });

    const other = await createTeam('Other');
    const rename = await req('PATCH', `/api/teams/${other.id}`, { name: 'CORE' });
    expect(rename.statusCode).toBe(409);
    expect(rename.json().error.code).toBe('TEAM_NAME_TAKEN');
  });

  it('lets a team change only the case of its own name', async () => {
    const team = await createTeam('core');
    const res = await req('PATCH', `/api/teams/${team.id}`, { name: 'Core' });
    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe('Core');
  });

  it('refuses to delete a team with epics or tickets and reports counts', async () => {
    const team = await createTeam('Core');
    const epic = await req('POST', '/api/epics', { teamId: team.id, title: 'Auth' });
    expect(epic.statusCode).toBe(201);
    await t.db.execute(sql`insert into tickets (team_id, type, title, body, created_by) values (${team.id}, 'bug', 't', 'b', ${userId})`);

    const list = (await req('GET', '/api/teams')).json();
    expect(list[0]).toMatchObject({ ticketCount: 1, epicCount: 1 });

    const del = await req('DELETE', `/api/teams/${team.id}`);
    expect(del.statusCode).toBe(409);
    expect(del.json().error).toEqual({
      code: 'TEAM_NOT_EMPTY',
      message: 'Team has 1 ticket and 1 epic. Move or delete them first.',
      details: { ticketCount: 1, epicCount: 1 },
    });
  });

  it('answers 404 for unknown and malformed ids', async () => {
    const unknown = '00000000-0000-4000-8000-000000000000';
    for (const id of [unknown, 'not-a-uuid']) {
      expect((await req('PATCH', `/api/teams/${id}`, { name: 'x' })).json().error.code).toBe('TEAM_NOT_FOUND');
      const del = await req('DELETE', `/api/teams/${id}`);
      expect(del.statusCode).toBe(404);
      expect(del.json().error.code).toBe('TEAM_NOT_FOUND');
    }
  });
});
