import { useId, type ReactNode } from 'react';
import { cn } from '../lib/cn';
import { Tooltip } from './ui/Tooltip';

interface GuardedButtonProps {
  /** When set, the button is disabled and this reason is shown as a tooltip and exposed as its accessible description. */
  blockedReason?: string;
  onClick: () => void;
  label: string;
  children: ReactNode;
  className?: string;
}

/**
 * A disabled button that can still explain itself: `aria-disabled` keeps it focusable and hoverable,
 * so keyboard and pointer users both see why it is unavailable.
 */
export function GuardedButton({ blockedReason, onClick, label, children, className }: GuardedButtonProps) {
  const id = useId();
  const blocked = !!blockedReason;
  return (
    <Tooltip content={blockedReason}>
      <button
        type="button"
        aria-label={label}
        aria-disabled={blocked || undefined}
        aria-describedby={blocked ? id : undefined}
        onClick={() => !blocked && onClick()}
        className={cn(
          'inline-flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors',
          blocked ? 'cursor-not-allowed opacity-40' : 'hover:bg-danger/10 hover:text-danger',
          className,
        )}
      >
        {children}
        {blocked && (
          <span id={id} className="sr-only">
            {blockedReason}
          </span>
        )}
      </button>
    </Tooltip>
  );
}
