import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ThemeToggle } from '../../components/AppShell';

const RIBBON = ['bg-st-new', 'bg-st-ready', 'bg-st-progress', 'bg-st-accept', 'bg-st-done'];

export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex items-center justify-between px-4 py-3 sm:px-6">
        <Link to="/login" className="flex items-center gap-2 font-semibold tracking-tight">
          <svg viewBox="0 0 32 32" className="h-6 w-6" aria-hidden>
            <rect width="32" height="32" rx="7" className="fill-ink" />
            <rect x="6" y="9" width="4" height="14" rx="1.5" className="fill-st-new" />
            <rect x="12" y="9" width="4" height="10" rx="1.5" className="fill-st-ready" />
            <rect x="18" y="9" width="4" height="7" rx="1.5" className="fill-st-progress" />
            <rect x="24" y="9" width="2.5" height="4" rx="1.25" className="fill-st-done" />
          </svg>
          Ticketing
        </Link>
        <ThemeToggle />
      </div>
      <main className="flex flex-1 items-start justify-center px-4 pb-16 pt-[8vh]">
        <div className="w-full max-w-[400px]">
          <div className="overflow-hidden rounded-lg border border-line bg-surface shadow-card">
            <div className="flex h-1" aria-hidden>
              {RIBBON.map((c, i) => (
                <span key={c} className={c} style={{ flex: 5 - i }} />
              ))}
            </div>
            <div className="p-6 sm:p-7">
              <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
              {subtitle && <div className="mt-1.5 text-sm text-muted">{subtitle}</div>}
              <div className="mt-6">{children}</div>
            </div>
          </div>
          {footer && <div className="mt-5 text-center text-sm text-muted">{footer}</div>}
        </div>
      </main>
    </div>
  );
}

export function FormError({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <div role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-ink">
      {children}
    </div>
  );
}

/** Only same-origin paths are accepted as a post-login destination. */
export function safeNext(next: string | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/';
  return next;
}
