import { EpicCreateBody, type EpicDto } from '@ticketing/shared';
import { Layers, Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ApiError, errorMessage } from '../../api/client';
import { useCreateEpic, useDeleteEpic, useEpics, useTeams, useUpdateEpic } from '../../api/queries';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { EmptyState, ErrorCard } from '../../components/EmptyState';
import { GuardedButton } from '../../components/GuardedButton';
import { Page, PageHeader } from '../../components/PageHeader';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { Field, Input, Select, Textarea } from '../../components/ui/Field';
import { Skeleton } from '../../components/ui/misc';
import { Tooltip } from '../../components/ui/Tooltip';
import { plural } from '../../lib/format';
import { absoluteTime, relativeTime } from '../../lib/time';
import { useCurrentTeamId } from '../../lib/useCurrentTeam';

type Editing = { mode: 'create'; teamId: string } | { mode: 'edit'; epic: EpicDto };

function EpicDialog({ editing, onClose }: { editing: Editing; onClose: () => void }) {
  const teams = useTeams();
  const create = useCreateEpic();
  const update = useUpdateEpic();
  const initial = editing.mode === 'edit' ? editing.epic : null;
  const [teamId, setTeamId] = useState(editing.mode === 'create' ? editing.teamId : editing.epic.teamId);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const teamName = teams.data?.find((t) => t.id === teamId)?.name ?? '';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = EpicCreateBody.safeParse({ teamId, title, description });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[String(i.path[0])] ??= i.message;
      return setErrors(errs);
    }
    setErrors({});
    setBusy(true);
    try {
      if (editing.mode === 'create') {
        await create.mutateAsync(parsed.data);
        toast.success(`Epic “${parsed.data.title}” created`);
      } else {
        await update.mutateAsync({ id: editing.epic.id, title: parsed.data.title, description: parsed.data.description ?? null });
        toast.success('Epic updated');
      }
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'VALIDATION_ERROR') setErrors(err.fieldErrors());
      else if (err instanceof ApiError && err.code === 'TEAM_NOT_FOUND') setErrors({ teamId: err.message });
      else toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={editing.mode === 'create' ? 'New epic' : 'Edit epic'}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        {editing.mode === 'create' ? (
          <Field label="Team" error={errors.teamId} hint="An epic stays in this team.">
            <Select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
              {(teams.data ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-ink-2">Team</span>
            <span className="text-sm">{teamName}</span>
            <span className="text-xs text-muted">An epic’s team cannot change.</span>
          </div>
        )}
        <Field label="Title" error={errors.title}>
          <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Checkout redesign" />
        </Field>
        <Field label="Description" error={errors.description} hint="Optional.">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-[5rem]" />
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={busy}>
            {editing.mode === 'create' ? 'Create epic' : 'Save changes'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function EpicsPage() {
  const teams = useTeams();
  const currentTeam = useCurrentTeamId();
  const [params, setParams] = useSearchParams();
  const teamFilter = params.get('team') ?? currentTeam ?? 'all';
  const epics = useEpics(teamFilter === 'all' ? undefined : teamFilter);
  const del = useDeleteEpic();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [confirm, setConfirm] = useState<EpicDto | null>(null);

  const teamNames = useMemo(() => new Map((teams.data ?? []).map((t) => [t.id, t.name])), [teams.data]);
  const list = epics.data ?? [];
  const hasTeams = (teams.data?.length ?? 0) > 0;
  const defaultTeam = teamFilter !== 'all' ? teamFilter : (currentTeam ?? teams.data?.[0]?.id ?? '');

  const newButton = (
    <Button variant="primary" onClick={() => setEditing({ mode: 'create', teamId: defaultTeam })} disabled={!hasTeams}>
      <Plus className="h-4 w-4" aria-hidden /> New epic
    </Button>
  );

  return (
    <Page>
      <PageHeader title="Epics" count={epics.data?.length} description="Group related tickets inside a team.">
        {hasTeams && (
          <div className="w-44">
            <label htmlFor="epic-team-filter" className="sr-only">
              Team
            </label>
            <Select id="epic-team-filter" value={teamFilter} onChange={(e) => setParams(e.target.value === (currentTeam ?? '') ? {} : { team: e.target.value }, { replace: true })}>
              <option value="all">All teams</option>
              {(teams.data ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>
        )}
        {hasTeams && newButton}
      </PageHeader>

      {teams.isSuccess && !hasTeams ? (
        <EmptyState icon={<Layers className="h-6 w-6" />} title="Create a team first" action={<Link className="text-sm font-medium text-accent" to="/teams">Go to teams</Link>}>
          Epics belong to a team.
        </EmptyState>
      ) : epics.isPending ? (
        <div className="space-y-2" aria-busy>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : epics.isError ? (
        <ErrorCard message={errorMessage(epics.error)} onRetry={() => void epics.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState icon={<Layers className="h-6 w-6" />} title="No epics here yet" action={newButton}>
          Use epics for larger pieces of work, like “Checkout redesign”.
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface shadow-card">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-line text-xs text-muted">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">Epic</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Team</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Tickets</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Modified</th>
                <th scope="col" className="w-20 px-3 py-2.5"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {list.map((e) => (
                <tr key={e.id} className="hover:bg-sunken/50">
                  <td className="max-w-md px-4 py-2.5">
                    <Link to={`/board/${e.teamId}?epic=${e.id}`} className="font-medium text-ink hover:text-accent">
                      {e.title}
                    </Link>
                    {e.description && <p className="mt-0.5 truncate text-xs text-muted">{e.description}</p>}
                  </td>
                  <td className="px-3 py-2.5 text-ink-2">{teamNames.get(e.teamId)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-ink-2">{e.ticketCount}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-muted">
                    <Tooltip content={absoluteTime(e.modifiedAt)}>
                      <time dateTime={e.modifiedAt}>{relativeTime(e.modifiedAt)}</time>
                    </Tooltip>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-end gap-0.5">
                      <button
                        type="button"
                        aria-label={`Edit epic ${e.title}`}
                        onClick={() => setEditing({ mode: 'edit', epic: e })}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-ink/5 hover:text-ink"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden />
                      </button>
                      <GuardedButton
                        label={`Delete epic ${e.title}`}
                        blockedReason={e.ticketCount > 0 ? `Epic is used by ${plural(e.ticketCount, 'ticket')}. Move them to another epic first.` : undefined}
                        onClick={() => setConfirm(e)}
                      >
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

      {editing && <EpicDialog editing={editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Delete epic “${confirm?.title}”?`}
        description="No tickets use this epic. This cannot be undone."
        confirmLabel="Delete epic"
        destructive
        onConfirm={async () => {
          if (!confirm) return;
          try {
            await del.mutateAsync(confirm.id);
            toast.success('Epic deleted');
          } catch (err) {
            toast.error(errorMessage(err));
            throw err;
          }
        }}
      />
    </Page>
  );
}
