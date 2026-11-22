import * as RD from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Dialog({ open, onOpenChange, title, description, children, className }: DialogProps) {
  return (
    <RD.Root open={open} onOpenChange={onOpenChange}>
      <RD.Portal>
        <RD.Overlay className="fixed inset-0 z-40 bg-ink/30 animate-fade-in dark:bg-black/60" />
        <RD.Content
          className={cn(
            'fixed left-1/2 top-[12vh] z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 rounded-lg bg-surface p-5 shadow-pop animate-pop-in focus:outline-none',
            className,
          )}
          aria-describedby={description ? undefined : undefined}
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <RD.Title className="text-base font-semibold text-ink">{title}</RD.Title>
              {description ? (
                <RD.Description className="mt-1 text-sm text-muted">{description}</RD.Description>
              ) : (
                <RD.Description className="sr-only">{title}</RD.Description>
              )}
            </div>
            <RD.Close className="rounded-md p-1 text-muted hover:bg-ink/5 hover:text-ink" aria-label="Close">
              <X className="h-4 w-4" />
            </RD.Close>
          </div>
          {children}
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}
