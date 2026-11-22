import { STATE_LABELS, TICKET_STATES, type TicketCardDto } from '@ticketing/shared';
import { STATE_COLOR } from '../../components/ui/Badge';
import { cn } from '../../lib/cn';

/** Proportional bar of where the team's work sits across the workflow. */
export function PipelineRibbon({ cards }: { cards: TicketCardDto[] }) {
  const counts = TICKET_STATES.map((s) => ({ state: s, n: cards.filter((c) => c.state === s).length }));
  const total = cards.length;
  const done = counts[counts.length - 1]!.n;
  const summary = total === 0 ? 'No tickets yet' : counts.map((c) => `${c.n} ${STATE_LABELS[c.state]}`).join(', ');
  return (
    <div className="flex items-center gap-3">
      <div role="img" aria-label={`Workflow: ${summary}`} className="flex h-2 min-w-0 flex-1 gap-[2px] overflow-hidden rounded-full">
        {total === 0 ? (
          <span className="h-full w-full rounded-full border border-dashed border-line-strong" />
        ) : (
          counts
            .filter((c) => c.n > 0)
            .map((c) => (
              <span
                key={c.state}
                title={`${STATE_LABELS[c.state]}: ${c.n}`}
                className={cn('h-full min-w-[6px] transition-[flex-grow] duration-500 ease-out motion-reduce:transition-none', STATE_COLOR[c.state])}
                style={{ flexGrow: c.n }}
              />
            ))
        )}
      </div>
      <span className="shrink-0 text-xs tabular-nums text-muted">{total === 0 ? '0 tickets' : `${done}/${total} done`}</span>
    </div>
  );
}
