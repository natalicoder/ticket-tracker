import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { APP_TABLES, createTestApp, resetDb, type TestApp } from './helpers.js';

let t: TestApp;

beforeAll(async () => {
  t = await createTestApp();
});
afterAll(async () => {
  await t.close();
});

async function rows<T>(query: ReturnType<typeof sql>): Promise<T[]> {
  const res = await t.db.execute(query);
  return res.rows as T[];
}

async function pgError(promise: Promise<unknown>): Promise<{ code?: string; constraint?: string; message: string }> {
  try {
    await promise;
  } catch (e) {
    const err = e as { code?: string; constraint?: string; message: string; cause?: { code?: string; constraint?: string } };
    return { code: err.code ?? err.cause?.code, constraint: err.constraint ?? err.cause?.constraint, message: err.message };
  }
  throw new Error('expected a database error');
}

async function seedUser(): Promise<string> {
  const [u] = await rows<{ id: string }>(sql`insert into users (email, password_hash) values ('u@example.com', 'x') returning id`);
  return u!.id;
}
async function seedTeam(name: string): Promise<string> {
  const [r] = await rows<{ id: string }>(sql`insert into teams (name) values (${name}) returning id`);
  return r!.id;
}
async function seedEpic(teamId: string): Promise<string> {
  const [r] = await rows<{ id: string }>(sql`insert into epics (team_id, title) values (${teamId}, 'Epic') returning id`);
  return r!.id;
}

describe('fresh database after migrations', () => {
  it('has every app table and no rows in any of them', async () => {
    // Run before resetDb so this checks the state migrations leave behind.
    for (const table of APP_TABLES) {
      const [r] = await rows<{ n: string }>(sql`select count(*)::text as n from ${sql.identifier(table)}`);
      expect(r!.n, table).toBe('0');
    }
  });
});

describe('constraints and triggers', () => {
  beforeEach(async () => {
    await resetDb(t.db);
  });

  it('rejects a ticket whose epic belongs to another team', async () => {
    const user = await seedUser();
    const teamA = await seedTeam('A');
    const teamB = await seedTeam('B');
    const epicB = await seedEpic(teamB);
    const err = await pgError(
      t.db.execute(sql`insert into tickets (team_id, type, state, epic_id, title, body, created_by)
        values (${teamA}, 'bug', 'new', ${epicB}, 't', 'b', ${user})`),
    );
    expect(err.code).toBe('23503');
    expect(`${err.constraint} ${err.message}`).toContain('tickets_epic_same_team');
  });

  it('rejects an unknown type or state', async () => {
    const user = await seedUser();
    const team = await seedTeam('A');
    const badType = await pgError(
      t.db.execute(sql`insert into tickets (team_id, type, state, title, body, created_by) values (${team}, 'task', 'new', 't', 'b', ${user})`),
    );
    expect(badType.code).toBe('23514');
    const badState = await pgError(
      t.db.execute(sql`insert into tickets (team_id, type, state, title, body, created_by) values (${team}, 'bug', 'blocked', 't', 'b', ${user})`),
    );
    expect(badState.code).toBe('23514');
  });

  it('advances modified_at only when a business field changes', async () => {
    const user = await seedUser();
    const team = await seedTeam('A');
    const [tk] = await rows<{ id: number; modified_at: Date }>(
      sql`insert into tickets (team_id, type, state, title, body, created_by) values (${team}, 'bug', 'new', 'old', 'b', ${user}) returning id, modified_at`,
    );
    await t.db.execute(sql`select pg_sleep(0.02)`);
    const [same] = await rows<{ modified_at: Date }>(sql`update tickets set title = title, state = state where id = ${tk!.id} returning modified_at`);
    expect(new Date(same!.modified_at).getTime()).toBe(new Date(tk!.modified_at).getTime());

    await t.db.execute(sql`select pg_sleep(0.02)`);
    const [changed] = await rows<{ modified_at: Date }>(sql`update tickets set title = 'new' where id = ${tk!.id} returning modified_at`);
    expect(new Date(changed!.modified_at).getTime()).toBeGreaterThan(new Date(tk!.modified_at).getTime());
  });

  it('does not let a client overwrite modified_at without a change', async () => {
    const team = await seedTeam('A');
    const [before] = await rows<{ modified_at: Date }>(sql`select modified_at from teams where id = ${team}`);
    const [after] = await rows<{ modified_at: Date }>(
      sql`update teams set modified_at = now() + interval '1 day' where id = ${team} returning modified_at`,
    );
    expect(new Date(after!.modified_at).getTime()).toBe(new Date(before!.modified_at).getTime());
  });

  it('refuses to delete a team that still has an epic', async () => {
    const team = await seedTeam('A');
    await seedEpic(team);
    const err = await pgError(t.db.execute(sql`delete from teams where id = ${team}`));
    expect(err.code).toBe('23503');
  });

  it('treats team names that differ only in case or surrounding spaces as duplicates', async () => {
    await seedTeam('Core');
    const err = await pgError(seedTeam(' core '));
    expect(err.code).toBe('23505');
  });

  it('treats emails case-insensitively as unique', async () => {
    await t.db.execute(sql`insert into users (email, password_hash) values ('a@b.co', 'x')`);
    const err = await pgError(t.db.execute(sql`insert into users (email, password_hash) values ('A@B.CO', 'x')`));
    expect(err.code).toBe('23505');
  });

  it('enables pg_trgm', async () => {
    const [r] = await rows<{ s: number }>(sql`select similarity('login fails', 'login fail') as s`);
    expect(Number(r!.s)).toBeGreaterThan(0.5);
  });
});
