import { describe, expect, it } from 'vitest';
import { countChecklist, toggleChecklistItem } from './checklist.js';

describe('countChecklist', () => {
  it('counts done and total items across list markers', () => {
    expect(countChecklist('- [x] a\n- [ ] b\n* [X] c')).toEqual({ done: 2, total: 3 });
  });
  it('ignores items inside fenced code blocks', () => {
    expect(countChecklist('- [ ] a\n```\n- [x] not me\n```\n~~~\n- [ ] nor me\n~~~\n+ [x] b')).toEqual({ done: 1, total: 2 });
  });
  it('handles nested and numbered items and CRLF', () => {
    expect(countChecklist('1. [x] a\r\n  - [ ] b')).toEqual({ done: 1, total: 2 });
  });
  it('returns zero for plain text', () => {
    expect(countChecklist('no list here [x]')).toEqual({ done: 0, total: 0 });
  });
});

describe('toggleChecklistItem', () => {
  it('toggles the n-th item', () => {
    expect(toggleChecklistItem('- [ ] a\n- [ ] b', 1)).toBe('- [ ] a\n- [x] b');
    expect(toggleChecklistItem('- [x] a\n- [ ] b', 0)).toBe('- [ ] a\n- [ ] b');
  });
  it('skips fenced code when indexing', () => {
    expect(toggleChecklistItem('```\n- [ ] x\n```\n- [ ] a', 0)).toBe('```\n- [ ] x\n```\n- [x] a');
  });
  it('returns the body unchanged for an out-of-range index', () => {
    expect(toggleChecklistItem('- [ ] a', 5)).toBe('- [ ] a');
  });
});
