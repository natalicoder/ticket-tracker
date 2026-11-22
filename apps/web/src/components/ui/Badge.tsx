import { STATE_LABELS, TYPE_LABELS, type TicketState, type TicketType } from '@ticketing/shared';
import { Bug, Sparkles, Wrench } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

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
  bug: { cls: 'text-ty-bug border-ty-bug/30 bg-ty-bug/[0.07]', icon: Bug },
  feature: { cls: 'text-ty-feature border-ty-feature/30 bg-ty-feature/[0.07]', icon: Sparkles },
  fix: { cls: 'text-ty-fix border-ty-fix/30 bg-ty-fix/[0.07]', icon: Wrench },
};

/** Type is shown with an icon and a word, so colour is never the only signal. */
export function TypeBadge({ type, className }: { type: TicketType; className?: string }) {
  const { cls, icon: Icon } = TYPE_STYLE[type];
  return (
    <span className={cn('inline-flex h-5 items-center gap-1 rounded-sm border px-1.5 text-2xs font-semibold', cls, className)}>
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
    <span title={title} className={cn('inline-flex h-5 max-w-full items-center gap-1 truncate rounded-sm bg-sunken px-1.5 text-2xs font-medium text-ink-2', className)}>
      {children}
    </span>
  );
}
