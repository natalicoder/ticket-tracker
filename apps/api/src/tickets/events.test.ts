import { describe, expect, it } from 'vitest';
import { diffTicket } from './events.js';

const base = { teamId: 't1', type: 'bug', state: 'new', epicId: null, title: 'A', body: 'x' } as const;

describe('diffTicket', () => {
  it('returns nothing when nothing changed', () => {
    expect(diffTicket(base, { ...base })).toEqual([]);
  });

  it('lists each changed field in a stable order', () => {
    expect(diffTicket(base, { ...base, state: 'done', title: 'B', epicId: 'e1' })).toEqual([
      { field: 'state', from: 'new', to: 'done' },
      { field: 'epicId', from: null, to: 'e1' },
      { field: 'title', from: 'A', to: 'B' },
    ]);
  });

  it('records a body change without copying the text', () => {
    expect(diffTicket(base, { ...base, body: 'y' })).toEqual([{ field: 'body', from: null, to: null }]);
  });
});
