import { useQueryClient } from '@tanstack/react-query';
import { STATE_LABELS, type TicketCardDto, type TicketState } from '@ticketing/shared';
import { useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { api, errorMessage } from '../../api/client';
import { keys } from '../../api/queries';

export interface MoveOptions {
  /** Offer an Undo action in the success toast (default true). */
  undoable?: boolean;
  /** Called after the server confirms the move. */
  onMoved?: (card: TicketCardDto) => void;
}

/**
 * Moves a card between columns optimistically.
 * - Requests for one ticket are sent one after another, so the server applies them in the order the user made them.
 * - A sequence number per ticket makes sure only the latest move decides the final card state.
 * - On failure the card goes back to where it was, even if the board was refetched meanwhile.
 */
export function useMoveTicket(teamId: string) {
  const qc = useQueryClient();
  const seq = useRef(new Map<number, number>());
  const queue = useRef(new Map<number, Promise<unknown>>());
  const moveRef = useRef<(id: number, to: TicketState, opts?: MoveOptions) => void>(() => {});

  const move = useCallback(
    (id: number, to: TicketState, opts: MoveOptions = {}) => {
      const key = keys.board(teamId);
      const before = qc.getQueryData<TicketCardDto[]>(key)?.find((c) => c.id === id);
      if (!before || before.state === to) return;

      void qc.cancelQueries({ queryKey: key });
      const now = new Date().toISOString();
      qc.setQueryData<TicketCardDto[]>(key, (old = []) => [{ ...before, state: to, modifiedAt: now, stateSince: now }, ...old.filter((c) => c.id !== id)]);

      const n = (seq.current.get(id) ?? 0) + 1;
      seq.current.set(id, n);
      const isLatest = () => seq.current.get(id) === n;

      const previous = queue.current.get(id) ?? Promise.resolve();
      const request = previous
        .catch(() => undefined)
        .then(() => api<TicketCardDto>(`/api/tickets/${id}/state`, { method: 'PATCH', body: { state: to } }));
      queue.current.set(id, request);

      request.then(
        (card) => {
          if (isLatest()) {
            qc.setQueryData<TicketCardDto[]>(key, (old = []) => old.map((c) => (c.id === id ? card : c)));
            const undoable = opts.undoable ?? true;
            toast.success(
              `Moved #${id} to ${STATE_LABELS[to]}`,
              undoable
                ? { duration: 5000, action: { label: 'Undo', onClick: () => moveRef.current(id, before.state, { undoable: false }) } }
                : { duration: 2500 },
            );
            opts.onMoved?.(card);
          }
          void qc.invalidateQueries({ queryKey: key });
          void qc.invalidateQueries({ queryKey: keys.ticket(id) });
          void qc.invalidateQueries({ queryKey: keys.events(id) });
        },
        (err) => {
          if (isLatest()) {
            qc.setQueryData<TicketCardDto[]>(key, (old = []) =>
              old.some((c) => c.id === id) ? old.map((c) => (c.id === id ? before : c)) : [before, ...old],
            );
          }
          toast.error(`Could not move #${id}: ${errorMessage(err)}`);
          void qc.invalidateQueries({ queryKey: key });
        },
      );
    },
    [qc, teamId],
  );
  moveRef.current = move;

  return { move };
}
