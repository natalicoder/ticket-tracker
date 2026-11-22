import { TeamBody, type TeamDto } from '@ticketing/shared';
import { Pencil, Plus, Trash2, Users } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { errorMessage } from '../../api/client';
import { useCreateTeam, useDeleteTeam, useRenameTeam, useTeams } from '../../api/queries';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { EmptyState, ErrorCard } from '../../components/EmptyState';
import { GuardedButton } from '../../components/GuardedButton';
import { Page, PageHeader } from '../../components/PageHeader';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Field';
import { Skeleton } from '../../components/ui/misc';
import { Tooltip } from '../../components/ui/Tooltip';
import { plural } from '../../lib/format';
import { absoluteTime, relativeTime } from '../../lib/time';

function deleteBlockedReason(t: TeamDto): string | undefined {
  if (t.ticketCount === 0 && t.epicCount === 0) return undefined;
  const parts = [t.ticketCount && plural(t.ticketCount, 'ticket'), t.epicCount && plural(t.epicCount, 'epic')].filter(Boolean);
  return `Team has ${parts.join(' and ')}. Move or delete them first.`;
}

/** Inline name editor: Enter saves, Escape cancels. Validates with the same schema as the API. */
function NameEditor({ initial, onSave, onCancel, submitLabel }: { initial: string; onSave: (name: string) => Promise<unknown>; onCancel: () => void; submitLabel: string }) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const parsed = TeamBody.safeParse({ name: value });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message);
    if (parsed.data.name === initial) return onCancel();
    setBusy(true);
    setError(undefined);
    try {
      await onSave(parsed.data.name);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void save();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Input
          autoFocus
          aria-label="Team name"
          aria-invalid={error ? true : undefined}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          className="h-8 max-w-xs"
          placeholder="e.g. Platform"
        />
        <Button size="sm" variant="primary" loading={busy} onClick={() => void save()}>
          {submitLabel}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function TeamsPage() {
  const teams = useTeams();
  const createTeam = useCreateTeam();
  const renameTeam = useRenameTeam();
  const deleteTeam = useDeleteTeam();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<TeamDto | null>(null);

  const list = teams.data ?? [];
  const newTeamButton = (
    <Button variant="primary" onClick={() => setCreating(true)}>
      <Plus className="h-4 w-4" aria-hidden /> New team
    </Button>
  );

  return (
    <Page>
      <PageHeader title="Teams" count={teams.data?.length} description="Every ticket and epic belongs to one team.">
        {list.length > 0 && newTeamButton}
      </PageHeader>

      {creating && (
        <div className="mb-4 rounded-lg border border-line bg-surface p-3 shadow-card">
          <NameEditor
            initial=""
            submitLabel="Create team"
            onCancel={() => setCreating(false)}
            onSave={async (name) => {
              await createTeam.mutateAsync(name);
              toast.success(`Team “${name}” created`);
              setCreating(false);
            }}
          />
        </div>
      )}

      {teams.isPending ? (
        <div className="space-y-2" aria-busy>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : teams.isError ? (
        <ErrorCard message={errorMessage(teams.error)} onRetry={() => void teams.refetch()} />
      ) : list.length === 0 ? (
        !creating && (
          <EmptyState icon={<Users className="h-6 w-6" />} title="No teams yet" action={newTeamButton}>
            Create a team to get a board. Tickets and epics live inside teams.
          </EmptyState>
        )
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface shadow-card">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-line text-xs text-muted">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">Name</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Epics</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Tickets</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Created</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Modified</th>
                <th scope="col" className="w-20 px-3 py-2.5"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {list.map((t) => (
                <tr key={t.id} className="group hover:bg-sunken/50">
                  <td className="px-4 py-2.5">
                    {editing === t.id ? (
                      <NameEditor
                        initial={t.name}
                        submitLabel="Save"
                        onCancel={() => setEditing(null)}
                        onSave={async (name) => {
                          await renameTeam.mutateAsync({ id: t.id, name });
                          toast.success('Team renamed');
                          setEditing(null);
                        }}
                      />
                    ) : (
                      <Link to={`/board/${t.id}`} className="font-medium text-ink hover:text-accent">
                        {t.name}
                      </Link>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-ink-2">{t.epicCount}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-ink-2">{t.ticketCount}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-muted">
                    <Tooltip content={absoluteTime(t.createdAt)}>
                      <time dateTime={t.createdAt}>{relativeTime(t.createdAt)}</time>
                    </Tooltip>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-muted">
                    <Tooltip content={absoluteTime(t.modifiedAt)}>
                      <time dateTime={t.modifiedAt}>{relativeTime(t.modifiedAt)}</time>
                    </Tooltip>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-end gap-0.5">
                      <button
                        type="button"
                        aria-label={`Rename team ${t.name}`}
                        onClick={() => setEditing(t.id)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-ink/5 hover:text-ink"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden />
                      </button>
                      <GuardedButton label={`Delete team ${t.name}`} blockedReason={deleteBlockedReason(t)} onClick={() => setConfirm(t)}>
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </GuardedButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Delete team “${confirm?.name}”?`}
        description="The team has no tickets or epics. This cannot be undone."
        confirmLabel="Delete team"
        destructive
        onConfirm={async () => {
          if (!confirm) return;
          try {
            await deleteTeam.mutateAsync(confirm.id);
            toast.success(`Team “${confirm.name}” deleted`);
          } catch (err) {
            toast.error(errorMessage(err));
            throw err;
          }
        }}
      />
    </Page>
  );
}
