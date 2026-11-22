import type { TeamDto } from '@ticketing/shared';
import { and, asc, eq, ne, sql } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { teams } from '../db/schema.js';
import { AppError } from '../errors.js';
import { isUuid, iso, plural } from '../util.js';

const ticketCount = sql<number>`(select count(*)::int from tickets tk where tk.team_id = "teams"."id")`;
const epicCount = sql<number>`(select count(*)::int from epics ep where ep.team_id = "teams"."id")`;

const columns = {
  id: teams.id,
  name: teams.name,
  createdAt: teams.createdAt,
  modifiedAt: teams.modifiedAt,
  ticketCount,
  epicCount,
};

type Row = { id: string; name: string; createdAt: Date; modifiedAt: Date; ticketCount: number; epicCount: number };

function toDto(r: Row): TeamDto {
  return { id: r.id, name: r.name, createdAt: iso(r.createdAt), modifiedAt: iso(r.modifiedAt), ticketCount: r.ticketCount, epicCount: r.epicCount };
}

const teamNotFound = () => new AppError(404, 'TEAM_NOT_FOUND', 'Team not found');
const nameTaken = (name: string) => new AppError(409, 'TEAM_NAME_TAKEN', `A team named "${name}" already exists`);
const sameName = (name: string) => sql`lower(btrim(${teams.name})) = lower(btrim(${name}))`;

function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code === '23505' || e?.cause?.code === '23505';
}

export async function listTeams(db: Db): Promise<TeamDto[]> {
  const rows = await db.select(columns).from(teams).orderBy(sql`lower(${teams.name})`, asc(teams.id));
  return rows.map(toDto);
}

export async function getTeam(db: Db, id: string): Promise<TeamDto> {
  if (!isUuid(id)) throw teamNotFound();
  const [row] = await db.select(columns).from(teams).where(eq(teams.id, id));
  if (!row) throw teamNotFound();
  return toDto(row);
}

export async function teamExists(db: Db, id: string): Promise<boolean> {
  const [row] = await db.select({ id: teams.id }).from(teams).where(eq(teams.id, id));
  return !!row;
}

export async function createTeam(db: Db, name: string): Promise<TeamDto> {
  const [dup] = await db.select({ id: teams.id }).from(teams).where(sameName(name));
  if (dup) throw nameTaken(name);
  try {
    const [row] = await db.insert(teams).values({ name }).returning({ id: teams.id });
    return getTeam(db, row!.id);
  } catch (err) {
    if (isUniqueViolation(err)) throw nameTaken(name);
    throw err;
  }
}

export async function renameTeam(db: Db, id: string, name: string): Promise<TeamDto> {
  if (!isUuid(id)) throw teamNotFound();
  const [dup] = await db
    .select({ id: teams.id })
    .from(teams)
    .where(and(sameName(name), ne(teams.id, id)));
  if (dup) throw nameTaken(name);
  try {
    const updated = await db.update(teams).set({ name }).where(eq(teams.id, id)).returning({ id: teams.id });
    if (updated.length === 0) throw teamNotFound();
  } catch (err) {
    if (isUniqueViolation(err)) throw nameTaken(name);
    throw err;
  }
  return getTeam(db, id);
}

export async function deleteTeam(db: Db, id: string): Promise<void> {
  if (!isUuid(id)) throw teamNotFound();
  await db.transaction(async (tx) => {
    const [team] = await tx.select({ id: teams.id }).from(teams).where(eq(teams.id, id)).for('update');
    if (!team) throw teamNotFound();
    const [counts] = await tx
      .select({ ticketCount, epicCount })
      .from(teams)
      .where(eq(teams.id, id));
    const { ticketCount: tc, epicCount: ec } = counts!;
    if (tc > 0 || ec > 0) {
      throw new AppError(409, 'TEAM_NOT_EMPTY', `Team has ${plural(tc, 'ticket')} and ${plural(ec, 'epic')}. Move or delete them first.`, {
        ticketCount: tc,
        epicCount: ec,
      });
    }
    await tx.delete(teams).where(eq(teams.id, id));
  });
}
