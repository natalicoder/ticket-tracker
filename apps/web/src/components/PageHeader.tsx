import type { ReactNode } from 'react';

export function PageHeader({ title, count, children, description }: { title: string; count?: number; children?: ReactNode; description?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 pb-5">
      <div>
        <h1 className="flex items-baseline gap-2 text-xl font-semibold tracking-tight">
          {title}
          {count !== undefined && <span className="text-sm font-medium text-muted">{count}</span>}
        </h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

export function Page({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">{children}</div>;
}
