import {
  countChecklist,
  type SimilarTicketDto,
  type TicketCardDto,
  type TicketCreateInput,
  type TicketDto,
  type TicketState,
  type TicketType,
  type TicketUpdateInput,
} from '@ticketing/shared';
import { eq, sql } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { epics, teams, tickets } from '../db/schema.js';
import { AppError } from '../errors.js';
import { isUuid, iso } from '../util.js';
import { diffTicket, recordChanges, recordCreated, type TicketFields } from './events.js';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

type CardRow = {
  id: number;
  team_id: string;
  type: TicketType;
  state: TicketState;
  epic_id: string | null;
  title: string;
  body: string;
  modified_at: Date;
  state_since: Date;
};

type TicketRow = CardRow & {
  created_at: Date;
  created_by_id: string;
  created_by_email: string;
};

const MAX_INT = 2_147_483_647;

export function parseTicketId(raw: string): number {
  if (!/^\d{1,10}$/.test(raw) || Number(raw) < 1 || Number(raw) > MAX_INT) throw ticketNotFound();
  return Number(raw);
}

const ticketNotFound = () => new AppError(404, 'TICKET_NOT_FOUND', 'Ticket not found');
const teamNotFound404 = () => new AppError(404, 'TEAM_NOT_FOUND', 'Team not found');

const STATE_SINCE = sql.raw(
  `coalesce((select max(e.at) from ticket_events e where e.ticket_id = t.id and e.field = 'state'), t.created_at)`,
);

function toCard(r: CardRow): TicketCardDto {
  return {
    id: r.id,
    teamId: r.team_id,
    type: r.type,
    state: r.state,
    epicId: r.epic_id,
    title: r.title,
    modifiedAt: iso(r.modified_at),
    stateSince: iso(r.state_since),
    checklist: countChecklist(r.body),
  };
}

function toTicket(r: TicketRow): TicketDto {
  return { ...toCard(r), body: r.body, createdAt: iso(r.created_at), createdBy: { id: r.created_by_id, email: r.created_by_email } };
}

async function assertTeam(db: Db | Tx, teamId: string, notFound: () => AppError): Promise<{ id: string; name: string }> {
  if (!isUuid(teamId)) throw notFound();
  const [team] = await db.select({ id: teams.id, name: teams.name }).from(teams).where(eq(teams.id, teamId));
  if (!team) throw notFound();
  return team;
}

/** The epic must exist and belong to `teamId` (also enforced by the tickets_epic_same_team FK). */
async function assertEpic(db: Db | Tx, epicId: string | null, team: { id: string; name: string }): Promise<void> {
  if (epicId === null) return;
  const [epic] = await db.select({ teamId: epics.teamId }).from(epics).where(eq(epics.id, epicId));
  if (!epic) throw new AppError(400, 'EPIC_NOT_FOUND', 'The selected epic does not exist');
  if (epic.teamId !== team.id) {
    throw new AppError(400, 'EPIC_TEAM_MISMATCH', `Epic belongs to a different team. Choose an epic from ${team.name}.`);
  }
}

export async function listBoard(db: Db, teamId: string): Promise<TicketCardDto[]> {
  await assertTeam(db, teamId, teamNotFound404);
  const res = await db.execute<CardRow>(sql`
    select t.id, t.team_id, t.type, t.state, t.epic_id, t.title, t.body, t.modified_at, ${STATE_SINCE} as state_since
    from tickets t
    where t.team_id = ${teamId}
    order by t.modified_at desc, t.id desc`);
  return res.rows.map(toCard);
}

async function fetchTicket(db: Db | Tx, id: number): Promise<TicketRow | undefined> {
  const res = await db.execute<TicketRow>(sql`
    select t.id, t.team_id, t.type, t.state, t.epic_id, t.title, t.body, t.modified_at, t.created_at,
           ${STATE_SINCE} as state_since, u.id as created_by_id, u.email as created_by_email
    from tickets t join users u on u.id = t.created_by
    where t.id = ${id}`);
  return res.rows[0];
}

export async function getTicket(db: Db, id: number): Promise<TicketDto> {
  const row = await fetchTicket(db, id);
  if (!row) throw ticketNotFound();
  return toTicket(row);
}

export async function ticketExists(db: Db, id: number): Promise<boolean> {
  const [row] = await db.select({ id: tickets.id }).from(tickets).where(eq(tickets.id, id));
  return !!row;
}

export async function createTicket(db: Db, input: TicketCreateInput, actorId: string): Promise<TicketDto> {
  const id = await db.transaction(async (tx) => {
    const team = await assertTeam(tx, input.teamId, () => new AppError(400, 'TEAM_NOT_FOUND', 'The selected team does not exist'));
    await assertEpic(tx, input.epicId, team);
    const [row] = await tx
      .insert(tickets)
      .values({ teamId: input.teamId, type: input.type, state: input.state, epicId: input.epicId, title: input.title, body: input.body, createdBy: actorId })
      .returning({ id: tickets.id });
    await recordCreated(tx, row!.id, actorId);
    return row!.id;
  });
  return getTicket(db, id);
}

/** Merges `input` over the stored ticket, validates the epic against the resulting team, saves, and records events. */
export async function updateTicket(db: Db, id: number, input: TicketUpdateInput, actorId: string): Promise<TicketDto> {
  await db.transaction(async (tx) => {
    const [current] = await tx
      .select({ teamId: tickets.teamId, type: tickets.type, state: tickets.state, epicId: tickets.epicId, title: tickets.title, body: tickets.body })
      .from(tickets)
      .where(eq(tickets.id, id))
      .for('update');
    if (!current) throw ticketNotFound();

    const next: TicketFields = { ...current };
    for (const key of Object.keys(input) as Array<keyof TicketUpdateInput>) {
      const value = input[key];
      if (value !== undefined) (next as unknown as Record<string, unknown>)[key] = value;
    }

    const changes = diffTicket(current, next);
    if (changes.length === 0) return;

    const team = await assertTeam(tx, next.teamId, () => new AppError(400, 'TEAM_NOT_FOUND', 'The selected team does not exist'));
    await assertEpic(tx, next.epicId, team);

    await tx
      .update(tickets)
      .set({
        teamId: next.teamId,
        type: next.type as TicketType,
        state: next.state as TicketState,
        epicId: next.epicId,
        title: next.title,
        body: next.body,
      })
      .where(eq(tickets.id, id));
    await recordChanges(tx, id, changes, actorId);
  });
  return getTicket(db, id);
}

export async function changeState(db: Db, id: number, state: TicketState, actorId: string): Promise<TicketCardDto> {
  const { body: _body, createdAt: _c, createdBy: _u, ...card } = await updateTicket(db, id, { state }, actorId);
  return card;
}

export async function deleteTicket(db: Db, id: number): Promise<void> {
  const deleted = await db.delete(tickets).where(eq(tickets.id, id)).returning({ id: tickets.id });
  if (deleted.length === 0) throw ticketNotFound();
}

const SIMILARITY_THRESHOLD = 0.3;

export async function findSimilar(db: Db, teamId: string, q: string, excludeId?: number): Promise<SimilarTicketDto[]> {
  await assertTeam(db, teamId, teamNotFound404);
  const res = await db.execute<{ id: number; title: string; state: TicketState; score: number }>(sql`
    select id, title, state, similarity(lower(title), lower(${q}))::float8 as score
    from tickets
    where team_id = ${teamId}
      and (${excludeId ?? null}::int is null or id <> ${excludeId ?? null}::int)
      and similarity(lower(title), lower(${q})) >= ${SIMILARITY_THRESHOLD}
    order by score desc, id desc
    limit 5`);
  return res.rows.map((r) => ({ id: r.id, title: r.title, state: r.state, score: Math.round(Number(r.score) * 100) / 100 }));
}
