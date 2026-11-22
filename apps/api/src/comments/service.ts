import type { CommentDto } from '@ticketing/shared';
import { asc, eq, sql } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { comments, users } from '../db/schema.js';
import { AppError } from '../errors.js';
import { ticketExists } from '../tickets/service.js';
import { isUuid, iso } from '../util.js';

const columns = {
  id: comments.id,
  ticketId: comments.ticketId,
  authorId: users.id,
  authorEmail: users.email,
  body: comments.body,
  createdAt: comments.createdAt,
  editedAt: comments.editedAt,
};

type Row = { id: string; ticketId: number; authorId: string; authorEmail: string; body: string; createdAt: Date; editedAt: Date | null };

function toDto(r: Row): CommentDto {
  return {
    id: r.id,
    ticketId: r.ticketId,
    author: { id: r.authorId, email: r.authorEmail },
    body: r.body,
    createdAt: iso(r.createdAt),
    editedAt: r.editedAt ? iso(r.editedAt) : null,
  };
}

const ticketNotFound = () => new AppError(404, 'TICKET_NOT_FOUND', 'Ticket not found');
const commentNotFound = () => new AppError(404, 'COMMENT_NOT_FOUND', 'Comment not found');

async function getComment(db: Db, id: string): Promise<CommentDto> {
  const [row] = await db.select(columns).from(comments).innerJoin(users, eq(users.id, comments.authorId)).where(eq(comments.id, id));
  if (!row) throw commentNotFound();
  return toDto(row);
}

export async function listComments(db: Db, ticketId: number): Promise<CommentDto[]> {
  if (!(await ticketExists(db, ticketId))) throw ticketNotFound();
  const rows = await db
    .select(columns)
    .from(comments)
    .innerJoin(users, eq(users.id, comments.authorId))
    .where(eq(comments.ticketId, ticketId))
    .orderBy(asc(comments.createdAt), asc(comments.id));
  return rows.map(toDto);
}

/** Comments never change the ticket's modified_at: they live in their own table. */
export async function addComment(db: Db, ticketId: number, body: string, authorId: string): Promise<CommentDto> {
  if (!(await ticketExists(db, ticketId))) throw ticketNotFound();
  const [row] = await db.insert(comments).values({ ticketId, body, authorId }).returning({ id: comments.id });
  return getComment(db, row!.id);
}

async function assertAuthor(db: Db, id: string, userId: string): Promise<void> {
  if (!isUuid(id)) throw commentNotFound();
  const [row] = await db.select({ authorId: comments.authorId }).from(comments).where(eq(comments.id, id));
  if (!row) throw commentNotFound();
  if (row.authorId !== userId) throw new AppError(403, 'NOT_COMMENT_AUTHOR', 'You can only change your own comments.');
}

export async function editComment(db: Db, id: string, body: string, userId: string): Promise<CommentDto> {
  await assertAuthor(db, id, userId);
  await db
    .update(comments)
    .set({ body, editedAt: sql`case when ${comments.body} is distinct from ${body} then now() else ${comments.editedAt} end` })
    .where(eq(comments.id, id));
  return getComment(db, id);
}

export async function deleteComment(db: Db, id: string, userId: string): Promise<void> {
  await assertAuthor(db, id, userId);
  await db.delete(comments).where(eq(comments.id, id));
}
