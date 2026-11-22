import { describe, expect, it } from 'vitest';
import {
  CommentBody,
  EpicCreateBody,
  EpicUpdateBody,
  emailSchema,
  passwordSchema,
  SignupBody,
  TeamBody,
  TicketCreateBody,
  TicketUpdateBody,
} from './schemas.js';
import { STATE_LABELS, TICKET_STATES, TICKET_TYPES, TYPE_LABELS } from './enums.js';

const uuid = '3f1b1c8e-2a51-4c8a-9a63-0d6f7a1b2c3d';

describe('enums', () => {
  it('has the exact types and states in workflow order', () => {
    expect(TICKET_TYPES).toEqual(['bug', 'feature', 'fix']);
    expect(TICKET_STATES).toEqual(['new', 'ready_for_implementation', 'in_progress', 'ready_for_acceptance', 'done']);
    expect(STATE_LABELS).toEqual({
      new: 'New',
      ready_for_implementation: 'Ready for implementation',
      in_progress: 'In progress',
      ready_for_acceptance: 'Ready for acceptance',
      done: 'Done',
    });
    expect(TYPE_LABELS).toEqual({ bug: 'Bug', feature: 'Feature', fix: 'Fix' });
  });
});

describe('emailSchema', () => {
  it('trims and lowercases', () => {
    expect(emailSchema.parse('  Alice@Example.COM ')).toBe('alice@example.com');
  });
  it('rejects garbage', () => {
    expect(emailSchema.safeParse('not-an-email').success).toBe(false);
  });
});

describe('passwordSchema', () => {
  it('requires at least 8 characters', () => {
    const r = passwordSchema.safeParse('1234567');
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe('Password must be at least 8 characters');
    expect(passwordSchema.parse('12345678')).toBe('12345678');
  });
  it('is used by SignupBody', () => {
    expect(SignupBody.safeParse({ email: 'a@b.co', password: 'short' }).success).toBe(false);
  });
});

describe('TeamBody', () => {
  it('rejects whitespace-only names with a field message', () => {
    const r = TeamBody.safeParse({ name: '   ' });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(['name']);
    expect(r.error?.issues[0]?.message).toBe('Name must not be empty');
  });
  it('trims names', () => {
    expect(TeamBody.parse({ name: '  Core ' })).toEqual({ name: 'Core' });
  });
});

describe('Epic bodies', () => {
  it('create requires a uuid team and a title', () => {
    expect(EpicCreateBody.parse({ teamId: uuid, title: ' Auth ' })).toEqual({ teamId: uuid, title: 'Auth' });
    expect(EpicCreateBody.safeParse({ teamId: 'nope', title: 'x' }).success).toBe(false);
  });
  it('update rejects teamId', () => {
    expect(EpicUpdateBody.safeParse({ title: 'x', teamId: uuid }).success).toBe(false);
    expect(EpicUpdateBody.parse({ title: 'x', description: null })).toEqual({ title: 'x', description: null });
  });
});

describe('Ticket bodies', () => {
  const valid = { teamId: uuid, type: 'bug', title: 'T', body: 'B' };
  it('rejects an unknown type or state', () => {
    expect(TicketCreateBody.safeParse({ ...valid, type: 'task' }).success).toBe(false);
    expect(TicketCreateBody.safeParse({ ...valid, state: 'blocked' }).success).toBe(false);
  });
  it('defaults state to new and epic to null', () => {
    expect(TicketCreateBody.parse(valid)).toEqual({ ...valid, state: 'new', epicId: null });
  });
  it('rejects blank title and body', () => {
    expect(TicketCreateBody.safeParse({ ...valid, title: '  ' }).success).toBe(false);
    expect(TicketCreateBody.safeParse({ ...valid, body: '' }).success).toBe(false);
    expect(TicketCreateBody.safeParse({ ...valid, body: ' \n ' }).success).toBe(false);
  });
  it('trims the title and only trailing whitespace of the body', () => {
    const r = TicketCreateBody.parse({ ...valid, title: '  Hello ', body: '  - item\n\n' });
    expect(r.title).toBe('Hello');
    expect(r.body).toBe('  - item');
  });
  it('update is partial with no defaults', () => {
    expect(TicketUpdateBody.parse({})).toEqual({});
    expect(TicketUpdateBody.parse({ epicId: null })).toEqual({ epicId: null });
  });
});

describe('CommentBody', () => {
  it('rejects blank', () => {
    expect(CommentBody.safeParse({ body: '   ' }).success).toBe(false);
  });
});
