import type { TicketCardDto } from '@ticketing/shared';
import { describe, expect, it } from 'vitest';
import { filterTickets, filtersFromSearchParams, filtersToSearchParams, hasFilters } from './filterTickets';

const card = (id: number, over: Partial<TicketCardDto>): TicketCardDto => ({
  id,
  teamId: 't',
  type: 'bug',
  state: 'new',
  epicId: null,
  title: `Ticket ${id}`,
  modifiedAt: '2026-11-22T10:00:00.000Z',
  stateSince: '2026-11-22T10:00:00.000Z',
  checklist: { done: 0, total: 0 },
  ...over,
});

const cards = [
  card(1, { type: 'bug', epicId: 'e1', title: 'Fix login bug' }),
  card(2, { type: 'feature', epicId: 'e1', title: 'Login with SSO' }),
  card(3, { type: 'bug', epicId: null, title: 'Crash on logout' }),
  card(4, { type: 'fix', epicId: 'e2', title: 'Typo in footer' }),
];
const ids = (list: TicketCardDto[]) => list.map((c) => c.id);

describe('filterTickets', () => {
  it('returns everything without filters', () => {
    expect(ids(filterTickets(cards, {}))).toEqual([1, 2, 3, 4]);
  });
  it('combines type, epic and search with AND', () => {
    expect(ids(filterTickets(cards, { type: 'bug', epic: 'e1', q: 'login' }))).toEqual([1]);
    expect(ids(filterTickets(cards, { type: 'feature', q: 'crash' }))).toEqual([]);
  });
  it('searches titles case-insensitively as a substring', () => {
    expect(ids(filterTickets(cards, { q: 'LOGIN' }))).toEqual([1, 2]);
    expect(ids(filterTickets(cards, { q: 'out' }))).toEqual([3]);
  });
  it('"none" keeps only tickets without an epic', () => {
    expect(ids(filterTickets(cards, { epic: 'none' }))).toEqual([3]);
  });
  it('ignores a whitespace-only query and trims the query', () => {
    expect(ids(filterTickets(cards, { q: '   ' }))).toEqual([1, 2, 3, 4]);
    expect(ids(filterTickets(cards, { q: '  typo ' }))).toEqual([4]);
  });
  it('matches the ticket number with #', () => {
    expect(ids(filterTickets(cards, { q: '#3' }))).toEqual([3]);
  });
});

describe('URL round-trip', () => {
  it('reads and writes filters', () => {
    const f = { type: 'bug' as const, epic: 'none', q: 'login' };
    const sp = filtersToSearchParams(f);
    expect(sp.toString()).toBe('type=bug&epic=none&q=login');
    expect(filtersFromSearchParams(sp)).toEqual(f);
  });
  it('drops unknown types and empty values', () => {
    expect(filtersFromSearchParams(new URLSearchParams('type=task&epic=&q='))).toEqual({});
    expect(filtersToSearchParams({ q: '' }).toString()).toBe('');
  });
  it('keeps unrelated params', () => {
    const sp = filtersToSearchParams({ type: 'fix' }, new URLSearchParams('foo=1&type=bug'));
    expect(sp.get('foo')).toBe('1');
    expect(sp.get('type')).toBe('fix');
  });
  it('knows when any filter is active', () => {
    expect(hasFilters({})).toBe(false);
    expect(hasFilters({ q: '  ' })).toBe(false);
    expect(hasFilters({ epic: 'none' })).toBe(true);
  });
});
