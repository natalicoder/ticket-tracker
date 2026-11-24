import { STATE_LABELS, TYPE_LABELS, type TicketState, type TicketType } from '@ticketing/shared';
import { Bug, Sparkles, Wrench } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

/** Soft pastel background for each state's column, the board's main colour signal. */
export const STATE_TINT: Record<TicketState, string> = {
  new: 'bg-col-new',
  ready_for_implementation: 'bg-col-ready',
  in_progress: 'bg-col-progress',
  ready_for_acceptance: 'bg-col-accept',
  done: 'bg-col-done',
};

export const STATE_COLOR: Record<TicketState, string> = {
  new: 'bg-st-new',
  ready_for_implementation: 'bg-st-ready',
  in_progress: 'bg-st-progress',
  ready_for_acceptance: 'bg-st-accept',
  done: 'bg-st-done',
};

export const STATE_TEXT: Record<TicketState, string> = {
  new: 'text-st-new',
  ready_for_implementation: 'text-st-ready',
  in_progress: 'text-st-progress',
  ready_for_acceptance: 'text-st-accept',
  done: 'text-st-done',
};

const TYPE_STYLE: Record<TicketType, { cls: string; icon: typeof Bug }> = {
  bug: { cls: 'text-ty-bug bg-col-ready', icon: Bug },
  feature: { cls: 'text-ty-feature bg-col-new', icon: Sparkles },
  fix: { cls: 'text-ty-fix bg-col-done', icon: Wrench },
};

/** Type is shown with an icon and a word, so colour is never the only signal. */
export function TypeBadge({ type, className }: { type: TicketType; className?: string }) {
  const { cls, icon: Icon } = TYPE_STYLE[type];
  return (
    <span className={cn('inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-2xs font-semibold', cls, className)}>
      <Icon aria-hidden className="h-3 w-3" strokeWidth={2.25} />
      {TYPE_LABELS[type]}
    </span>
  );
}

export function StateDot({ state, className }: { state: TicketState; className?: string }) {
  return <span aria-hidden className={cn('inline-block h-2 w-2 shrink-0 rounded-full', STATE_COLOR[state], className)} />;
}

export function StateLabel({ state }: { state: TicketState }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <StateDot state={state} />
      {STATE_LABELS[state]}
    </span>
  );
}

export function Chip({ children, className, title }: { children: ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={cn('inline-flex h-6 max-w-full items-center gap-1 truncate rounded-full bg-sunken px-2.5 text-2xs font-medium text-ink-2', className)}>
      {children}
    </span>
  );
}
