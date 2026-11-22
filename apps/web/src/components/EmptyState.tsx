import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

export function EmptyState({ icon, title, children, action, className }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center rounded-lg border border-dashed border-line-strong px-6 py-12 text-center', className)}>
      {icon && <div className="mb-3 text-muted">{icon}</div>}
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      {children && <div className="mt-1 max-w-sm text-sm text-muted">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorCard({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-center rounded-lg border border-danger/30 bg-danger-soft px-6 py-8 text-center">
      <p className="text-sm font-medium text-ink">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-3 rounded-md px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent/10">
          Try again
        </button>
      )}
    </div>
  );
}
