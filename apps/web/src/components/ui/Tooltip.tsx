import * as RT from '@radix-ui/react-tooltip';
import type { ReactElement, ReactNode } from 'react';

export const TooltipProvider = RT.Provider;

export function Tooltip({ content, children, side = 'top' }: { content: ReactNode; children: ReactElement; side?: 'top' | 'bottom' | 'left' | 'right' }) {
  if (!content) return children;
  return (
    <RT.Root>
      <RT.Trigger asChild>{children}</RT.Trigger>
      <RT.Portal>
        <RT.Content side={side} sideOffset={6} className="z-[60] max-w-xs rounded-md bg-ink px-2 py-1 text-xs text-bg shadow-lift animate-fade-in">
          {content}
        </RT.Content>
      </RT.Portal>
    </RT.Root>
  );
}
