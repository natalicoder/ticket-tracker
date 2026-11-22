import type { TicketCardDto, TicketState } from '@ticketing/shared';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useBoardKeyboard } from './useBoardKeyboard';

const card = (id: number, state: TicketState): TicketCardDto => ({
  id,
  teamId: 't',
  type: 'bug',
  state,
  epicId: null,
  title: `T${id}`,
  modifiedAt: '',
  stateSince: '',
  checklist: { done: 0, total: 0 },
});

const a = card(1, 'new');
const b = card(2, 'new');
const c = card(3, 'in_progress');
// Columns follow TICKET_STATES order; index 1 (ready_for_implementation) is empty, 3 and 4 too.
const columns = [[a, b], [], [c], [], []];

function key(k: string, shift = false) {
  return { key: k, shiftKey: shift, preventDefault: vi.fn() } as unknown as KeyboardEvent;
}

function setup() {
  const move = vi.fn();
  const open = vi.fn();
  const hook = renderHook(({ cols }) => useBoardKeyboard(cols, { move, open }), { initialProps: { cols: columns } });
  return { ...hook, move, open };
}

describe('useBoardKeyboard', () => {
  it('focuses the first card on the first navigation key', () => {
    const { result } = setup();
    expect(result.current.focused).toBeNull();
    act(() => void result.current.onKeyDown(key('j')));
    expect(result.current.focused).toEqual({ col: 0, row: 0 });
    expect(result.current.focusedId).toBe(a.id);
  });

  it('moves within a column with j/k and arrows, staying put at the edges', () => {
    const { result } = setup();
    act(() => result.current.setFocusedId(a.id));
    act(() => void result.current.onKeyDown(key('k')));
    expect(result.current.focusedId).toBe(a.id);
    act(() => void result.current.onKeyDown(key('j')));
    expect(result.current.focusedId).toBe(b.id);
    act(() => void result.current.onKeyDown(key('ArrowDown')));
    expect(result.current.focusedId).toBe(b.id);
    act(() => void result.current.onKeyDown(key('ArrowUp')));
    expect(result.current.focusedId).toBe(a.id);
  });

  it('moves between columns with h/l, skipping empty columns and clamping the row', () => {
    const { result } = setup();
    act(() => result.current.setFocusedId(b.id));
    act(() => void result.current.onKeyDown(key('l')));
    expect(result.current.focusedId).toBe(c.id);
    expect(result.current.focused).toEqual({ col: 2, row: 0 });
    act(() => void result.current.onKeyDown(key('l')));
    expect(result.current.focusedId).toBe(c.id);
    act(() => void result.current.onKeyDown(key('ArrowLeft')));
    expect(result.current.focusedId).toBe(a.id);
  });

  it('Shift+ArrowRight moves the card to the next state and keeps focus on it', () => {
    const { result, move } = setup();
    act(() => result.current.setFocusedId(a.id));
    act(() => void result.current.onKeyDown(key('ArrowRight', true)));
    expect(move).toHaveBeenCalledWith(a.id, 'ready_for_implementation');
    expect(result.current.focusedId).toBe(a.id);
  });

  it('Shift+ArrowLeft in the first column does nothing', () => {
    const { result, move } = setup();
    act(() => result.current.setFocusedId(a.id));
    act(() => void result.current.onKeyDown(key('ArrowLeft', true)));
    expect(move).not.toHaveBeenCalled();
  });

  it('Enter and e open the focused ticket', () => {
    const { result, open } = setup();
    act(() => result.current.setFocusedId(c.id));
    act(() => void result.current.onKeyDown(key('Enter')));
    act(() => void result.current.onKeyDown(key('e')));
    expect(open).toHaveBeenCalledTimes(2);
    expect(open).toHaveBeenCalledWith(c.id);
  });

  it('follows a card that moved to another column', () => {
    const { result, rerender } = setup();
    act(() => result.current.setFocusedId(a.id));
    rerender({ cols: [[b], [{ ...a, state: 'ready_for_implementation' }], [c], [], []] });
    expect(result.current.focused).toEqual({ col: 1, row: 0 });
  });

  it('ignores unrelated keys', () => {
    const { result } = setup();
    let handled = true;
    act(() => {
      handled = result.current.onKeyDown(key('x'));
    });
    expect(handled).toBe(false);
  });
});
