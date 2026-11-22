import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, resetDb, signupVerified, type TestApp } from './helpers.js';

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
let t: TestApp;
let alice: { cookie: string; userId: string };
let bob: { cookie: string; userId: string };
let teamId: string;
let ticket: { id: number; modifiedAt: string };

beforeAll(async () => {
  t = await createTestApp();
});
afterAll(async () => {
  await t.close();
});

const req = (who: { cookie: string }, method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, payload?: unknown) =>
  t.app.inject({ method, url, headers: { cookie: who.cookie }, ...(payload === undefined ? {} : { payload: payload as object }) });

beforeEach(async () => {
  await resetDb(t.db);
  alice = await signupVerified(t, 'alice@example.com');
  bob = await signupVerified(t, 'bob@example.com');
  teamId = (await req(alice, 'POST', '/api/teams', { name: 'Core' })).json().id;
  ticket = (await req(alice, 'POST', '/api/tickets', { teamId, type: 'bug', title: 'T', body: 'B' })).json();
});

describe('comments', () => {
  it('adds a comment without touching the ticket', async () => {
    await t.db.execute(sql`select pg_sleep(0.02)`);
    const res = await req(bob, 'POST', `/api/tickets/${ticket.id}/comments`, { body: '  Looks good  ' });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({
      id: expect.any(String),
      ticketId: ticket.id,
      author: { id: bob.userId, email: 'bob@example.com' },
      body: '  Looks good',
      createdAt: expect.stringMatching(ISO),
      editedAt: null,
    });
    const after = (await req(alice, 'GET', `/api/tickets/${ticket.id}`)).json();
    expect(after.modifiedAt).toBe(ticket.modifiedAt);
  });

  it('lists comments oldest first with author and time', async () => {
    for (const [who, body] of [[alice, 'one'], [bob, 'two'], [alice, 'three']] as const) {
      await req(who, 'POST', `/api/tickets/${ticket.id}/comments`, { body });
      await t.db.execute(sql`select pg_sleep(0.005)`);
    }
    const list = (await req(bob, 'GET', `/api/tickets/${ticket.id}/comments`)).json();
    expect(list.map((c: { body: string }) => c.body)).toEqual(['one', 'two', 'three']);
    expect(list.map((c: { author: { email: string } }) => c.author.email)).toEqual(['alice@example.com', 'bob@example.com', 'alice@example.com']);
    for (const c of list) expect(c.createdAt).toMatch(ISO);
  });

  it('rejects a blank comment', async () => {
    const res = await req(alice, 'POST', `/api/tickets/${ticket.id}/comments`, { body: ' \n ' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.details).toContainEqual({ path: 'body', message: 'Comment must not be empty' });
  });

  it('404s for a missing ticket', async () => {
    expect((await req(alice, 'GET', '/api/tickets/999/comments')).json().error.code).toBe('TICKET_NOT_FOUND');
    expect((await req(alice, 'POST', '/api/tickets/999/comments', { body: 'x' })).statusCode).toBe(404);
  });

  it('lets only the author edit or delete a comment', async () => {
    const comment = (await req(alice, 'POST', `/api/tickets/${ticket.id}/comments`, { body: 'mine' })).json();

    const bobEdit = await req(bob, 'PATCH', `/api/comments/${comment.id}`, { body: 'hijack' });
    expect(bobEdit.statusCode).toBe(403);
    expect(bobEdit.json().error.code).toBe('NOT_COMMENT_AUTHOR');
    expect((await req(bob, 'DELETE', `/api/comments/${comment.id}`)).statusCode).toBe(403);

    const edit = await req(alice, 'PATCH', `/api/comments/${comment.id}`, { body: 'mine, edited' });
    expect(edit.statusCode).toBe(200);
    expect(edit.json()).toMatchObject({ body: 'mine, edited', editedAt: expect.stringMatching(ISO), createdAt: comment.createdAt });
    expect((await req(alice, 'GET', `/api/tickets/${ticket.id}`)).json().modifiedAt).toBe(ticket.modifiedAt);

    expect((await req(alice, 'DELETE', `/api/comments/${comment.id}`)).statusCode).toBe(204);
    expect((await req(alice, 'GET', `/api/tickets/${ticket.id}/comments`)).json()).toEqual([]);
  });

  it('404s for unknown or malformed comment ids', async () => {
    for (const id of ['00000000-0000-4000-8000-000000000000', 'nope']) {
      const res = await req(alice, 'PATCH', `/api/comments/${id}`, { body: 'x' });
      expect(res.statusCode).toBe(404);
      expect(res.json().error.code).toBe('COMMENT_NOT_FOUND');
    }
  });
});
