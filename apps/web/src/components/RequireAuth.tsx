import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ApiError } from '../api/client';
import { useMe } from '../api/queries';
import { ErrorCard } from './EmptyState';
import { Spinner } from './ui/Spinner';

export function loginPathFor(pathAndSearch: string): string {
  return pathAndSearch && pathAndSearch !== '/' ? `/login?next=${encodeURIComponent(pathAndSearch)}` : '/login';
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const me = useMe();
  const location = useLocation();

  if (me.isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted">
        <Spinner label="Loading" className="h-5 w-5" />
      </div>
    );
  }
  if (me.isError) {
    if (me.error instanceof ApiError && me.error.status === 401) {
      return <Navigate to={loginPathFor(location.pathname + location.search)} replace />;
    }
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <ErrorCard message={me.error instanceof ApiError ? me.error.message : 'Cannot load your session.'} onRetry={() => void me.refetch()} />
      </div>
    );
  }
  return <>{children}</>;
}
