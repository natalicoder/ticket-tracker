import { TICKET_STATES, type TicketCardDto, type TicketState } from '@ticketing/shared';
import { useCallback, useMemo, useState } from 'react';

type Key = Pick<KeyboardEvent, 'key' | 'shiftKey' | 'preventDefault'>;

interface Actions {
  move: (id: number, to: TicketState) => void;
  open: (id: number) => void;
}

/**
 * Keyboard navigation over board columns (in TICKET_STATES order).
 * j/k or ↓/↑ move within a column, h/l or ←/→ jump to the nearest non-empty column (row clamped),
 * Shift+←/→ move the card to the neighbouring state, Enter/e open it. Focus follows the card by id.
 */
export function useBoardKeyboard(columns: TicketCardDto[][], { move, open }: Actions) {
  const [focusedId, setFocusedId] = useState<number | null>(null);

  const focused = useMemo(() => {
    if (focusedId === null) return null;
    for (let col = 0; col < columns.length; col++) {
      const row = columns[col]!.findIndex((c) => c.id === focusedId);
      if (row >= 0) return { col, row };
    }
    return null;
  }, [columns, focusedId]);

  const onKeyDown = useCallback(
    (e: Key): boolean => {
      const k = e.key;
      const nav = ['j', 'k', 'h', 'l', 'ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'];
      const isNav = nav.includes(k);
      if (!isNav && k !== 'Enter' && k !== 'e') return false;

      if (!focused) {
        if (!isNav || e.shiftKey) return false;
        const first = columns.flat()[0];
        if (!first) return false;
        e.preventDefault();
        setFocusedId(first.id);
        return true;
      }

      const { col, row } = focused;
      const current = columns[col]![row]!;

      if (k === 'Enter' || k === 'e') {
        e.preventDefault();
        open(current.id);
        return true;
      }

      if (e.shiftKey && (k === 'ArrowLeft' || k === 'ArrowRight')) {
        const index = TICKET_STATES.indexOf(current.state);
        const target = TICKET_STATES[index + (k === 'ArrowRight' ? 1 : -1)];
        e.preventDefault();
        if (target) move(current.id, target);
        return true;
      }

      e.preventDefault();
      if (k === 'j' || k === 'ArrowDown') {
        const next = columns[col]![Math.min(row + 1, columns[col]!.length - 1)]!;
        setFocusedId(next.id);
      } else if (k === 'k' || k === 'ArrowUp') {
        setFocusedId(columns[col]![Math.max(row - 1, 0)]!.id);
      } else {
        const step = k === 'l' || k === 'ArrowRight' ? 1 : -1;
        for (let c = col + step; c >= 0 && c < columns.length; c += step) {
          const list = columns[c]!;
          if (list.length > 0) {
            setFocusedId(list[Math.min(row, list.length - 1)]!.id);
            break;
          }
        }
      }
      return true;
    },
    [columns, focused, move, open],
  );

  return { focused, focusedId: focused ? focusedId : null, setFocusedId, onKeyDown };
}
