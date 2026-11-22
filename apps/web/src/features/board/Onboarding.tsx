import { TeamBody } from '@ticketing/shared';
import { Check } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { errorMessage } from '../../api/client';
import { useCreateTeam, useEpics } from '../../api/queries';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Field';
import { cn } from '../../lib/cn';

function Step({ n, done, title, children, optional }: { n: number; done: boolean; title: string; children?: ReactNode; optional?: boolean }) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden
        className={cn(
          'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
          done ? 'bg-st-done text-white dark:text-bg' : 'border border-line-strong bg-surface text-muted',
        )}
      >
        {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : n}
      </span>
      <div className="min-w-0 flex-1 pb-5">
        <p className={cn('text-sm font-medium', done ? 'text-muted line-through decoration-line-strong' : 'text-ink')}>
          {title}
          {optional && <span className="ml-1.5 text-xs font-normal text-muted no-underline">optional</span>}
          <span className="sr-only">{done ? ' (done)' : ' (to do)'}</span>
        </p>
        {!done && children && <div className="mt-2">{children}</div>}
      </div>
    </li>
  );
}

function CreateTeamInline() {
  const create = useCreateTeam();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [error, setError] = useState<string>();
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = TeamBody.safeParse({ name });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message);
    try {
      const team = await create.mutateAsync(parsed.data.name);
      navigate(`/board/${team.id}`);
    } catch (err) {
      setError(errorMessage(err));
    }
  };
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        <Input aria-label="Team name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Platform" className="max-w-xs" aria-invalid={error ? true : undefined} />
        <Button type="submit" variant="primary" loading={create.isPending}>
          Create team
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </form>
  );
}

/** First-run guide. Steps tick off from live data: no team → epic → first ticket. */
export function Onboarding({ teamId }: { teamId?: string }) {
  const epics = useEpics(teamId);
  const location = useLocation();
  const hasEpic = !!teamId && (epics.data?.length ?? 0) > 0;
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-10">
      <div className="rounded-lg border border-line bg-surface p-6 shadow-card">
        <h1 className="text-lg font-semibold tracking-tight">{teamId ? 'Your board is ready' : 'Set up your first board'}</h1>
        <p className="mt-1 text-sm text-muted">Three steps and your team is tracking work.</p>
        <ol className="mt-6">
          <Step n={1} done={!!teamId} title="Create a team">
            <CreateTeamInline />
          </Step>
          <Step n={2} done={hasEpic} title="Create an epic" optional>
            {teamId && (
              <Link to={`/epics?team=${teamId}`} className="text-sm font-medium text-accent">
                Add an epic
              </Link>
            )}
          </Step>
          <Step n={3} done={false} title="Create your first ticket">
            {teamId && (
              <Link
                to={`/tickets/new?teamId=${teamId}`}
                state={{ background: location }}
                className="inline-flex h-9 items-center rounded-md bg-accent px-3.5 text-sm font-medium text-accent-ink shadow-card hover:bg-accent/90"
              >
                New ticket
              </Link>
            )}
          </Step>
        </ol>
      </div>
    </div>
  );
}
