import { STATE_LABELS, type TicketCardDto } from '@ticketing/shared';
import { CheckSquare, Clock3, Layers } from 'lucide-react';
import { memo, forwardRef, type HTMLAttributes } from 'react';
import { Chip, TypeBadge } from '../../components/ui/Badge';
import { cn } from '../../lib/cn';
import { absoluteTime, age, ageInDays, relativeTime } from '../../lib/time';

export const STALE_DAYS = 7;

export interface TicketCardProps extends HTMLAttributes<HTMLDivElement> {
  card: TicketCardDto;
  epicTitle?: string;
  overlay?: boolean;
  dragging?: boolean;
  focused?: boolean;
}

/** One ticket on the board. Memoised so moving one card does not re-render every other card. */
export const TicketCard = memo(
  forwardRef<HTMLDivElement, TicketCardProps>(function TicketCard({ card, epicTitle, overlay, dragging, focused, className, ...rest }, ref) {
    const stale = card.state !== 'done' && ageInDays(card.stateSince) >= STALE_DAYS;
    const { done, total } = card.checklist;
    return (
      <div
        ref={ref}
        data-ticket-id={card.id}
        aria-label={`#${card.id} ${card.title}`}
        className={cn(
          'group relative cursor-pointer select-none rounded-md border bg-surface p-2.5 text-left shadow-card outline-none transition-[box-shadow,border-color,opacity]',
          'border-line hover:border-line-strong focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30',
          focused && 'border-accent ring-2 ring-accent/30',
          dragging && 'opacity-40',
          overlay && 'cursor-grabbing border-line-strong shadow-lift',
          className,
        )}
        {...rest}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-2xs font-medium tabular-nums text-muted">#{card.id}</span>
          <TypeBadge type={card.type} />
        </div>
        <p className="mt-1.5 line-clamp-2 break-words text-[13px] font-medium leading-snug text-ink">{card.title}</p>
        {total > 0 && (
          <div className="mt-2 flex items-center gap-1.5" title={`${done} of ${total} checklist items done`}>
            <CheckSquare className="h-3 w-3 text-muted" aria-hidden />
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-sunken" aria-hidden>
              <div className={cn('h-full rounded-full', done === total ? 'bg-st-done' : 'bg-accent')} style={{ width: `${(done / total) * 100}%` }} />
            </div>
            <span className="text-2xs tabular-nums text-muted">
              {done}/{total}
            </span>
          </div>
        )}
        <div className="mt-2 flex items-center gap-1.5 text-2xs text-muted">
          {epicTitle && (
            <Chip className="min-w-0" title={`Epic: ${epicTitle}`}>
              <Layers className="h-3 w-3 shrink-0" aria-hidden />
              <span className="truncate">{epicTitle}</span>
            </Chip>
          )}
          <span
            className={cn('inline-flex shrink-0 items-center gap-1 rounded-sm px-1 py-0.5', stale && 'bg-warn-soft font-medium text-warn')}
            title={`In ${STATE_LABELS[card.state]} since ${absoluteTime(card.stateSince)}`}
          >
            <Clock3 className="h-3 w-3" aria-hidden />
            <span className="sr-only">In {STATE_LABELS[card.state]} for </span>
            {age(card.stateSince)}
          </span>
          <time className="ml-auto shrink-0 whitespace-nowrap" dateTime={card.modifiedAt} title={`Modified ${absoluteTime(card.modifiedAt)}`}>
            {relativeTime(card.modifiedAt)}
          </time>
        </div>
      </div>
    );
  }),
);
