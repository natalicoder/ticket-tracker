import type { TicketEventDto } from '@ticketing/shared';
import { asc, eq } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { ticketEvents, users } from '../db/schema.js';
import { iso } from '../util.js';

export interface TicketFields {
  teamId: string;
  type: string;
  state: string;
  epicId: string | null;
  title: string;
  body: string;
}

export interface FieldChange {
  field: keyof TicketFields;
  from: string | null;
  to: string | null;
}

const TRACKED: Array<keyof TicketFields> = ['teamId', 'type', 'state', 'epicId', 'title', 'body'];

/** Changed business fields in a stable order. Body changes are recorded without copying the text. */
export function diffTicket(before: TicketFields, after: TicketFields): FieldChange[] {
  return TRACKED.filter((f) => before[f] !== after[f]).map((field) =>
    field === 'body' ? { field, from: null, to: null } : { field, from: before[field], to: after[field] },
  );
}

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

export async function recordCreated(tx: Tx | Db, ticketId: number, actorId: string): Promise<void> {
  await tx.insert(ticketEvents).values({ ticketId, actorId, kind: 'created' });
}

export async function recordChanges(tx: Tx | Db, ticketId: number, changes: FieldChange[], actorId: string): Promise<void> {
  if (changes.length === 0) return;
  await tx.insert(ticketEvents).values(
    changes.map((c) => ({ ticketId, actorId, kind: 'updated' as const, field: c.field, fromValue: c.from, toValue: c.to })),
  );
}

export async function listEvents(db: Db, ticketId: number): Promise<TicketEventDto[]> {
  const rows = await db
    .select({
      id: ticketEvents.id,
      actorId: users.id,
      actorEmail: users.email,
      kind: ticketEvents.kind,
      field: ticketEvents.field,
      from: ticketEvents.fromValue,
      to: ticketEvents.toValue,
      at: ticketEvents.at,
    })
    .from(ticketEvents)
    .innerJoin(users, eq(users.id, ticketEvents.actorId))
    .where(eq(ticketEvents.ticketId, ticketId))
    .orderBy(asc(ticketEvents.seq));
  return rows.map((r) => ({
    id: r.id,
    actor: { id: r.actorId, email: r.actorEmail },
    kind: r.kind,
    field: r.field,
    from: r.from,
    to: r.to,
    at: iso(r.at),
  }));
}
