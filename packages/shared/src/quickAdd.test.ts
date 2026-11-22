import { describe, expect, it } from 'vitest';
import { parseQuickAdd } from './quickAdd.js';

const epics = [
  { id: 'e1', title: 'Auth revamp' },
  { id: 'e2', title: 'Payments' },
  { id: 'e3', title: 'Mobile auth flow' },
];

describe('parseQuickAdd', () => {
  it('parses type prefix, epic and title', () => {
    expect(parseQuickAdd('bug: Login fails @auth', epics)).toEqual({ type: 'bug', epicId: 'e1', title: 'Login fails' });
  });
  it('type prefix is case-insensitive and tolerates extra spaces', () => {
    expect(parseQuickAdd('Feature:  Dark mode', epics)).toEqual({ type: 'feature', title: 'Dark mode' });
  });
  it('plain title', () => {
    expect(parseQuickAdd('Just a title', epics)).toEqual({ title: 'Just a title' });
  });
  it('reports an unmatched epic query', () => {
    expect(parseQuickAdd('fix: thing @nomatch', epics)).toEqual({ type: 'fix', epicQuery: 'nomatch', title: 'thing' });
  });
  it('epic token may come first', () => {
    expect(parseQuickAdd('@auth only epic', epics)).toEqual({ epicId: 'e1', title: 'only epic' });
  });
  it('matches a whole word inside the epic title', () => {
    expect(parseQuickAdd('Crash @flow', epics)).toEqual({ epicId: 'e3', title: 'Crash' });
    expect(parseQuickAdd('Crash @pay', epics)).toEqual({ epicId: 'e2', title: 'Crash' });
  });
  it('recognises the type only at the start', () => {
    expect(parseQuickAdd('Fix: a', epics)).toEqual({ type: 'fix', title: 'a' });
    expect(parseQuickAdd('Login bug: crash', epics)).toEqual({ title: 'Login bug: crash' });
  });
  it('ignores an unknown prefix word', () => {
    expect(parseQuickAdd('task: x', epics)).toEqual({ title: 'task: x' });
  });
});
