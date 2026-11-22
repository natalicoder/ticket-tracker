import * as RTabs from '@radix-ui/react-tabs';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-md bg-ink/[0.07]', className)} />;
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd className={cn('inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-sm border border-line bg-surface px-1 font-sans text-2xs font-medium text-muted shadow-card', className)}>
      {children}
    </kbd>
  );
}

export const Tabs = RTabs.Root;
export const TabsContent = RTabs.Content;

export function TabsList({ children, className, label }: { children: ReactNode; className?: string; label: string }) {
  return (
    <RTabs.List aria-label={label} className={cn('flex gap-1 border-b border-line', className)}>
      {children}
    </RTabs.List>
  );
}

export function TabsTrigger({ value, children }: { value: string; children: ReactNode }) {
  return (
    <RTabs.Trigger
      value={value}
      className="-mb-px border-b-2 border-transparent px-2.5 pb-2 pt-1 text-sm font-medium text-muted transition-colors hover:text-ink data-[state=active]:border-accent data-[state=active]:text-ink"
    >
      {children}
    </RTabs.Trigger>
  );
}

export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
export const modKey = isMac ? '⌘' : 'Ctrl';
