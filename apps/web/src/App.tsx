import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate, type Location } from 'react-router-dom';
import { setOnUnauthenticated } from './api/client';
import { keys, useTeams } from './api/queries';
import { AppShell } from './components/AppShell';
import { EmptyState, ErrorCard } from './components/EmptyState';
import { loginPathFor, RequireAuth } from './components/RequireAuth';
import { Skeleton } from './components/ui/misc';
import { CheckEmailPage } from './features/auth/CheckEmailPage';
import { ForgotPasswordPage } from './features/auth/ForgotPasswordPage';
import { LoginPage } from './features/auth/LoginPage';
import { ResetPasswordPage } from './features/auth/ResetPasswordPage';
import { SignupPage } from './features/auth/SignupPage';
import { VerifyPage } from './features/auth/VerifyPage';
import { BoardPage } from './features/board/BoardPage';
import { Onboarding } from './features/board/Onboarding';
import { EpicsPage } from './features/epics/EpicsPage';
import { AppOverlays } from './features/palette/AppOverlays';
import { TeamsPage } from './features/teams/TeamsPage';
import { TicketPanel } from './features/ticket/TicketPanel';
import { lastTeam } from './lib/prefs';

export const PUBLIC_PATHS = ['/login', '/signup', '/check-email', '/verify', '/forgot-password', '/reset-password'];

/** Any 401 from the API mid-session sends the user to /login?next=<where they were>. */
function SessionExpiryRedirect() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  useEffect(() => {
    setOnUnauthenticated(() => {
      const { pathname, search } = window.location;
      if (PUBLIC_PATHS.includes(pathname)) return;
      qc.removeQueries({ queryKey: keys.me });
      navigate(loginPathFor(pathname + search), { replace: true });
    });
    return () => setOnUnauthenticated(null);
  }, [navigate, qc]);
  return null;
}

function HomeRedirect() {
  const teams = useTeams();
  if (teams.isPending) {
    return (
      <div className="p-6">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }
  if (teams.isError) return <div className="p-6"><ErrorCard message="Cannot load your teams." onRetry={() => void teams.refetch()} /></div>;
  const list = teams.data;
  if (list.length === 0) return <Onboarding />;
  const remembered = lastTeam();
  const target = list.find((t) => t.id === remembered) ?? list[0]!;
  return <Navigate to={`/board/${target.id}`} replace />;
}

function NotFound() {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <EmptyState title="Page not found" action={<a className="text-sm font-medium text-accent" href="/">Go to the board</a>}>
        This address does not match any page.
      </EmptyState>
    </div>
  );
}

export function App() {
  const location = useLocation();
  const background = (location.state as { background?: Location } | null)?.background;

  return (
    <>
      <SessionExpiryRedirect />
      <Routes location={background ?? location}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/check-email" element={<CheckEmailPage />} />
        <Route path="/verify" element={<VerifyPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route
          element={
            <RequireAuth>
              <AppShell />
              <AppOverlays />
            </RequireAuth>
          }
        >
          <Route index element={<HomeRedirect />} />
          <Route path="/board/:teamId" element={<BoardPage />} />
          <Route path="/tickets/new" element={<TicketPanel mode="page" />} />
          <Route path="/tickets/:id" element={<TicketPanel mode="page" />} />
          <Route path="/teams" element={<TeamsPage />} />
          <Route path="/epics" element={<EpicsPage />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
      {background && (
        <Routes>
          <Route path="/tickets/new" element={<RequireAuth><TicketPanel mode="sheet" /></RequireAuth>} />
          <Route path="/tickets/:id" element={<RequireAuth><TicketPanel mode="sheet" /></RequireAuth>} />
        </Routes>
      )}
    </>
  );
}
