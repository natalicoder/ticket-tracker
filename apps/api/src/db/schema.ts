import { index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// Constraints drizzle-kit cannot express (case-insensitive unique indexes, the same-team
// composite FK, CHECKs, pg_trgm, modified_at triggers) live in drizzle/0001_constraints_triggers.sql.

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  passwordHash: text('password_hash').notNull(),
  emailVerifiedAt: ts('email_verified_at'),
  createdAt: ts('created_at').notNull().defaultNow(),
});

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: ts('expires_at').notNull(),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [index('sessions_user_id_idx').on(t.userId)],
);

export const emailTokens = pgTable(
  'email_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    purpose: text('purpose').$type<'verify' | 'reset'>().notNull(),
    expiresAt: ts('expires_at').notNull(),
    usedAt: ts('used_at'),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [index('email_tokens_user_purpose_idx').on(t.userId, t.purpose)],
);

export const teams = pgTable('teams', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  createdAt: ts('created_at').notNull().defaultNow(),
  modifiedAt: ts('modified_at').notNull().defaultNow(),
});

export const epics = pgTable(
  'epics',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'restrict' }),
    title: text('title').notNull(),
    description: text('description'),
    createdAt: ts('created_at').notNull().defaultNow(),
    modifiedAt: ts('modified_at').notNull().defaultNow(),
  },
  (t) => [index('epics_team_id_idx').on(t.teamId)],
);

export const tickets = pgTable(
  'tickets',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'restrict' }),
    type: text('type').$type<'bug' | 'feature' | 'fix'>().notNull(),
    state: text('state')
      .$type<'new' | 'ready_for_implementation' | 'in_progress' | 'ready_for_acceptance' | 'done'>()
      .notNull()
      .default('new'),
    epicId: uuid('epic_id'),
    title: text('title').notNull(),
    body: text('body').notNull(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: ts('created_at').notNull().defaultNow(),
    modifiedAt: ts('modified_at').notNull().defaultNow(),
  },
  (t) => [index('tickets_epic_id_idx').on(t.epicId)],
);

export const comments = pgTable(
  'comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ticketId: integer('ticket_id')
      .notNull()
      .references(() => tickets.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    body: text('body').notNull(),
    createdAt: ts('created_at').notNull().defaultNow(),
    editedAt: ts('edited_at'),
  },
  (t) => [index('comments_ticket_created_idx').on(t.ticketId, t.createdAt)],
);

export const ticketEvents = pgTable(
  'ticket_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ticketId: integer('ticket_id')
      .notNull()
      .references(() => tickets.id, { onDelete: 'cascade' }),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    kind: text('kind').$type<'created' | 'updated'>().notNull(),
    field: text('field'),
    fromValue: text('from_value'),
    toValue: text('to_value'),
    at: ts('at').notNull().defaultNow(),
  },
  (t) => [index('ticket_events_ticket_at_idx').on(t.ticketId, t.at)],
);
