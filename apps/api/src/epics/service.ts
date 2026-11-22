import type { EpicCreateInput, EpicDto, EpicUpdateInput } from '@ticketing/shared';
import { asc, eq, sql } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { epics, tickets } from '../db/schema.js';
import { AppError } from '../errors.js';
import { teamExists } from '../teams/service.js';
import { isUuid, iso, plural } from '../util.js';

const ticketCount = sql<number>`(select count(*)::int from tickets tk where tk.epic_id = "epics"."id")`;

const columns = {
  id: epics.id,
  teamId: epics.teamId,
  title: epics.title,
  description: epics.description,
  createdAt: epics.createdAt,
  modifiedAt: epics.modifiedAt,
  ticketCount,
};

type Row = { id: string; teamId: string; title: string; description: string | null; createdAt: Date; modifiedAt: Date; ticketCount: number };

function toDto(r: Row): EpicDto {
  return { ...r, createdAt: iso(r.createdAt), modifiedAt: iso(r.modifiedAt) };
}

const epicNotFound = () => new AppError(404, 'EPIC_NOT_FOUND', 'Epic not found');

export async function listEpics(db: Db, teamId?: string): Promise<EpicDto[]> {
  const rows = await db
    .select(columns)
    .from(epics)
    .where(teamId ? eq(epics.teamId, teamId) : undefined)
    .orderBy(sql`lower(${epics.title})`, asc(epics.id));
  return rows.map(toDto);
}

export async function getEpic(db: Db, id: string): Promise<EpicDto> {
  if (!isUuid(id)) throw epicNotFound();
  const [row] = await db.select(columns).from(epics).where(eq(epics.id, id));
  if (!row) throw epicNotFound();
  return toDto(row);
}

export async function createEpic(db: Db, input: EpicCreateInput): Promise<EpicDto> {
  if (!(await teamExists(db, input.teamId))) throw new AppError(400, 'TEAM_NOT_FOUND', 'The selected team does not exist');
  const [row] = await db
    .insert(epics)
    .values({ teamId: input.teamId, title: input.title, description: input.description ?? null })
    .returning({ id: epics.id });
  return getEpic(db, row!.id);
}

export async function updateEpic(db: Db, id: string, input: EpicUpdateInput): Promise<EpicDto> {
  if (!isUuid(id)) throw epicNotFound();
  const patch: Partial<typeof epics.$inferInsert> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.description !== undefined) patch.description = input.description;
  if (Object.keys(patch).length > 0) {
    const updated = await db.update(epics).set(patch).where(eq(epics.id, id)).returning({ id: epics.id });
    if (updated.length === 0) throw epicNotFound();
  }
  return getEpic(db, id);
}

export async function deleteEpic(db: Db, id: string): Promise<void> {
  if (!isUuid(id)) throw epicNotFound();
  await db.transaction(async (tx) => {
    const [epic] = await tx.select({ id: epics.id }).from(epics).where(eq(epics.id, id)).for('update');
    if (!epic) throw epicNotFound();
    const [{ n } = { n: 0 }] = await tx.select({ n: sql<number>`count(*)::int` }).from(tickets).where(eq(tickets.epicId, id));
    if (n > 0) throw new AppError(409, 'EPIC_IN_USE', `Epic is used by ${plural(n, 'ticket')}.`, { ticketCount: n });
    await tx.delete(epics).where(eq(epics.id, id));
  });
}
