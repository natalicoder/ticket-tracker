import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, resetDb, signupVerified, type TestApp } from './helpers.js';

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
let t: TestApp;
let cookie: string;
let userId: string;
let teamA: string;
let teamB: string;
let epicA: string;
let epicB: string;

beforeAll(async () => {
  t = await createTestApp();
});
afterAll(async () => {
  await t.close();
});

const req = (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, payload?: unknown) =>
  t.app.inject({ method, url, headers: { cookie }, ...(payload === undefined ? {} : { payload: payload as object }) });

const sleep = () => t.db.execute(sql`select pg_sleep(0.02)`);

async function create(fields: Record<string, unknown> = {}) {
  const res = await req('POST', '/api/tickets', { teamId: teamA, type: 'bug', title: 'Login fails', body: 'Steps:\n- [ ] repro\n- [x] triage', ...fields });
  expect(res.statusCode, res.body).toBe(201);
  return res.json();
}

beforeEach(async () => {
  await resetDb(t.db);
  ({ cookie, userId } = await signupVerified(t, 'tickets@example.com'));
  teamA = (await req('POST', '/api/teams', { name: 'Alpha' })).json().id;
  teamB = (await req('POST', '/api/teams', { name: 'Beta' })).json().id;
  epicA = (await req('POST', '/api/epics', { teamId: teamA, title: 'Auth' })).json().id;
  epicB = (await req('POST', '/api/epics', { teamId: teamB, title: 'Billing' })).json().id;
});

describe('create', () => {
  it('creates a ticket with defaults, author and ISO timestamps', async () => {
    const tk = await create({ epicId: epicA });
    expect(tk).toEqual({
      id: 1,
      teamId: teamA,
      type: 'bug',
      state: 'new',
      epicId: epicA,
      title: 'Login fails',
      body: 'Steps:\n- [ ] repro\n- [x] triage',
      createdAt: expect.stringMatching(ISO),
      modifiedAt: expect.stringMatching(ISO),
      stateSince: expect.stringMatching(ISO),
      createdBy: { id: userId, email: 'tickets@example.com' },
      checklist: { done: 1, total: 2 },
    });
    expect(tk.createdAt).toBe(tk.modifiedAt);
    expect(tk.stateSince).toBe(tk.createdAt);

    const got = await req('GET', '/api/tickets/1');
    expect(got.statusCode).toBe(200);
    expect(got.json()).toEqual(tk);
  });

  it.each([
    [{ type: 'task' }, 'type'],
    [{ state: 'blocked' }, 'state'],
    [{ title: '  ' }, 'title'],
    [{ body: '' }, 'body'],
    [{ body: '  \n ' }, 'body'],
  ])('rejects %j with a field error', async (fields, path) => {
    const res = await req('POST', '/api/tickets', { teamId: teamA, type: 'bug', title: 'x', body: 'y', ...fields });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
    expect(res.json().error.details.map((d: { path: string }) => d.path)).toContain(path);
  });

  it('rejects an unknown team or epic', async () => {
    const team = await req('POST', '/api/tickets', { teamId: '00000000-0000-4000-8000-000000000000', type: 'bug', title: 'x', body: 'y' });
    expect(team.statusCode).toBe(400);
    expect(team.json().error.code).toBe('TEAM_NOT_FOUND');
    const epic = await req('POST', '/api/tickets', { teamId: teamA, epicId: '00000000-0000-4000-8000-000000000000', type: 'bug', title: 'x', body: 'y' });
    expect(epic.statusCode).toBe(400);
    expect(epic.json().error.code).toBe('EPIC_NOT_FOUND');
  });

  it('rejects an epic from another team', async () => {
    const res = await req('POST', '/api/tickets', { teamId: teamA, epicId: epicB, type: 'bug', title: 'x', body: 'y' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toEqual({ code: 'EPIC_TEAM_MISMATCH', message: 'Epic belongs to a different team. Choose an epic from Alpha.' });
  });
});

describe('update', () => {
  it('refuses to move a ticket to another team while it keeps a foreign epic', async () => {
    const tk = await create({ epicId: epicA });
    const res = await req('PATCH', `/api/tickets/${tk.id}`, { teamId: teamB });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('EPIC_TEAM_MISMATCH');

    const ok = await req('PATCH', `/api/tickets/${tk.id}`, { teamId: teamB, epicId: null });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({ teamId: teamB, epicId: null });

    const withEpic = await req('PATCH', `/api/tickets/${tk.id}`, { epicId: epicB });
    expect(withEpic.statusCode).toBe(200);
    expect(withEpic.json().epicId).toBe(epicB);
  });

  it('keeps modifiedAt and records no events when nothing changes', async () => {
    const tk = await create();
    await sleep();
    const res = await req('PATCH', `/api/tickets/${tk.id}`, { teamId: teamA, type: 'bug', state: 'new', epicId: null, title: 'Login fails', body: tk.body });
    expect(res.statusCode).toBe(200);
    expect(res.json().modifiedAt).toBe(tk.modifiedAt);
    const events = (await req('GET', `/api/tickets/${tk.id}/events`)).json();
    expect(events.map((e: { kind: string }) => e.kind)).toEqual(['created']);
  });

  it('advances modifiedAt and records one event per changed field', async () => {
    const tk = await create();
    await sleep();
    const res = await req('PATCH', `/api/tickets/${tk.id}`, { title: 'Login fails on Safari' });
    expect(res.json().modifiedAt > tk.modifiedAt).toBe(true);
    expect(res.json().createdAt).toBe(tk.createdAt);

    await req('PATCH', `/api/tickets/${tk.id}`, { type: 'fix', epicId: epicA });
    const events = (await req('GET', `/api/tickets/${tk.id}/events`)).json();
    expect(events).toEqual([
      { id: expect.any(String), actor: { id: userId, email: 'tickets@example.com' }, kind: 'created', field: null, from: null, to: null, at: expect.stringMatching(ISO) },
      expect.objectContaining({ kind: 'updated', field: 'title', from: 'Login fails', to: 'Login fails on Safari' }),
      expect.objectContaining({ kind: 'updated', field: 'type', from: 'bug', to: 'fix' }),
      expect.objectContaining({ kind: 'updated', field: 'epicId', from: null, to: epicA }),
    ]);
  });

  it('validates PATCH fields like create', async () => {
    const tk = await create();
    expect((await req('PATCH', `/api/tickets/${tk.id}`, { title: ' ' })).statusCode).toBe(400);
    expect((await req('PATCH', `/api/tickets/${tk.id}`, { state: 'blocked' })).statusCode).toBe(400);
  });

  it('answers 404 for unknown and malformed ids', async () => {
    for (const id of ['999', 'abc', '1.5']) {
      const res = await req('PATCH', `/api/tickets/${id}`, { title: 'x' });
      expect(res.statusCode).toBe(404);
      expect(res.json().error.code).toBe('TICKET_NOT_FOUND');
      expect((await req('GET', `/api/tickets/${id}`)).statusCode).toBe(404);
    }
  });
});

describe('state changes and the board', () => {
  it('persists a state change and puts the ticket first on the board', async () => {
    const a = await create({ title: 'A' });
    await sleep();
    await create({ title: 'B' });
    await sleep();
    const res = await req('PATCH', `/api/tickets/${a.id}/state`, { state: 'in_progress' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id: a.id, state: 'in_progress' });
    expect(res.json().body).toBeUndefined();

    const board = (await req('GET', `/api/teams/${teamA}/tickets`)).json();
    expect(board[0]).toMatchObject({ id: a.id, state: 'in_progress' });
    expect((await req('GET', `/api/tickets/${a.id}`)).json().state).toBe('in_progress');
  });

  it('orders the board by most recently modified', async () => {
    const one = await create({ title: 'one' });
    await sleep();
    const two = await create({ title: 'two' });
    await sleep();
    const three = await create({ title: 'three' });
    await sleep();
    await req('PATCH', `/api/tickets/${one.id}`, { title: 'one!' });
    const board = (await req('GET', `/api/teams/${teamA}/tickets`)).json();
    expect(board.map((c: { id: number }) => c.id)).toEqual([one.id, three.id, two.id]);
    expect(Object.keys(board[0]).sort()).toEqual(['checklist', 'epicId', 'id', 'modifiedAt', 'state', 'stateSince', 'teamId', 'title', 'type']);
  });

  it('only shows the team’s own tickets and 404s for an unknown team', async () => {
    await create();
    expect((await req('GET', `/api/teams/${teamB}/tickets`)).json()).toEqual([]);
    const res = await req('GET', '/api/teams/00000000-0000-4000-8000-000000000000/tickets');
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('TEAM_NOT_FOUND');
  });

  it('moves stateSince only when the state changes', async () => {
    const tk = await create();
    await sleep();
    await req('PATCH', `/api/tickets/${tk.id}`, { title: 'renamed' });
    let card = (await req('GET', `/api/teams/${teamA}/tickets`)).json()[0];
    expect(card.stateSince).toBe(tk.createdAt);
    await req('PATCH', `/api/tickets/${tk.id}/state`, { state: 'done' });
    card = (await req('GET', `/api/teams/${teamA}/tickets`)).json()[0];
    expect(card.stateSince > tk.createdAt).toBe(true);
  });

  it('rejects an invalid state', async () => {
    const tk = await create();
    expect((await req('PATCH', `/api/tickets/${tk.id}/state`, { state: 'archived' })).statusCode).toBe(400);
  });
});

describe('delete', () => {
  it('deletes the ticket with its comments and events', async () => {
    const tk = await create();
    await t.db.execute(sql`insert into comments (ticket_id, author_id, body) values (${tk.id}, ${userId}, 'hi')`);
    expect((await req('DELETE', `/api/tickets/${tk.id}`)).statusCode).toBe(204);
    expect((await req('GET', `/api/tickets/${tk.id}`)).statusCode).toBe(404);
    const left = await t.db.execute(sql`select (select count(*) from comments)::int as c, (select count(*) from ticket_events)::int as e`);
    expect(left.rows[0]).toEqual({ c: 0, e: 0 });
    expect((await req('DELETE', `/api/tickets/${tk.id}`)).statusCode).toBe(404);
  });

  it('frees its epic and team for deletion', async () => {
    const tk = await create({ epicId: epicA });
    expect((await req('DELETE', `/api/epics/${epicA}`)).statusCode).toBe(409);
    await req('DELETE', `/api/tickets/${tk.id}`);
    expect((await req('DELETE', `/api/epics/${epicA}`)).statusCode).toBe(204);
    expect((await req('DELETE', `/api/teams/${teamA}`)).statusCode).toBe(204);
  });
});
