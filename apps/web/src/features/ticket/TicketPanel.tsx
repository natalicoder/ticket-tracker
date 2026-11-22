import * as RD from '@radix-ui/react-dialog';
import { isTicketState, isTicketType, type TicketDto } from '@ticketing/shared';
import { ArrowLeft, Link2, Trash2, X } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams, type Location } from 'react-router-dom';
import { toast } from 'sonner';
import { ApiError, errorMessage } from '../../api/client';
import { useComments, useCreateTicket, useDeleteTicket, useTeams, useTicket, useUpdateTicket, type TicketInput } from '../../api/queries';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { EmptyState, ErrorCard } from '../../components/EmptyState';
import { Skeleton, Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/misc';
import { Tooltip } from '../../components/ui/Tooltip';
import { cn } from '../../lib/cn';
import { plural } from '../../lib/format';
import { lastTeam } from '../../lib/prefs';
import { absoluteTime, relativeTime } from '../../lib/time';
import { Activity } from './Activity';
import { Avatar, Comments } from './Comments';
import { TicketForm } from './TicketForm';

function MetaRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-xs">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 break-all text-right text-ink-2">{children}</dd>
    </div>
  );
}

function Timestamp({ iso }: { iso: string }) {
  return (
    <Tooltip content={relativeTime(iso)}>
      <time dateTime={iso}>{absoluteTime(iso)}</time>
    </Tooltip>
  );
}

function Meta({ ticket }: { ticket: TicketDto }) {
  return (
    <dl className="space-y-2 border-t border-line pt-4">
      <MetaRow label="Created by">
        <span className="inline-flex items-center gap-1.5">
          <span className="scale-75">
            <Avatar email={ticket.createdBy.email} />
          </span>
          {ticket.createdBy.email}
        </span>
      </MetaRow>
      <MetaRow label="Created">
        <Timestamp iso={ticket.createdAt} />
      </MetaRow>
      <MetaRow label="Modified">
        <Timestamp iso={ticket.modifiedAt} />
      </MetaRow>
    </dl>
  );
}

/** Right-side sheet over the board (when opened from it) or a full page on a direct load. */
function Frame({ mode, onClose, header, children }: { mode: 'page' | 'sheet'; onClose: () => void; header: ReactNode; children: ReactNode }) {
  if (mode === 'page') {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
        <div className="rounded-lg border border-line bg-surface shadow-card">
          <div className="flex items-center gap-2 border-b border-line px-5 py-3">{header}</div>
          <div className="flex flex-col px-5 pt-5">{children}</div>
        </div>
      </div>
    );
  }
  return (
    <RD.Root open onOpenChange={(o) => !o && onClose()}>
      <RD.Portal>
        <RD.Overlay className="fixed inset-0 z-40 bg-ink/20 animate-fade-in dark:bg-black/50" />
        <RD.Content
          className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[860px] flex-col border-l border-line bg-surface shadow-pop animate-sheet-in focus:outline-none"
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="flex items-center gap-2 border-b border-line px-5 py-3">{header}</div>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pt-5">{children}</div>
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}

function useClose(mode: 'page' | 'sheet', teamId?: string) {
  const navigate = useNavigate();
  const location = useLocation();
  const background = (location.state as { background?: Location } | null)?.background;
  return () => {
    if (background) navigate(background.pathname + background.search, { replace: false });
    else navigate(teamId ? `/board/${teamId}` : '/');
    void mode;
  };
}

function Title({ mode, children }: { mode: 'page' | 'sheet'; children: ReactNode }) {
  return mode === 'sheet' ? <RD.Title className="min-w-0 truncate text-sm font-semibold">{children}</RD.Title> : <h1 className="min-w-0 truncate text-sm font-semibold">{children}</h1>;
}

function CloseButton({ mode, onClose }: { mode: 'page' | 'sheet'; onClose: () => void }) {
  return (
    <button type="button" onClick={onClose} className="ml-1 rounded-md p-1.5 text-muted hover:bg-ink/5 hover:text-ink" aria-label={mode === 'sheet' ? 'Close' : 'Back to board'}>
      {mode === 'sheet' ? <X className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
    </button>
  );
}

function CreateTicket({ mode }: { mode: 'page' | 'sheet' }) {
  const [params] = useSearchParams();
  const teams = useTeams();
  const create = useCreateTicket();
  const navigate = useNavigate();
  const location = useLocation();
  const background = (location.state as { background?: Location } | null)?.background;

  const teamParam = params.get('teamId');
  const fallbackTeam = teams.data?.find((t) => t.id === lastTeam())?.id ?? teams.data?.[0]?.id;
  const teamId = teamParam ?? fallbackTeam ?? '';
  const close = useClose(mode, teamId);
  const state = params.get('state');
  const type = params.get('type');
  const title = params.get('title') ?? '';

  const initial = useMemo<TicketInput>(
    () => ({
      teamId,
      type: isTicketType(type) ? type : 'bug',
      state: isTicketState(state) ? state : 'new',
      epicId: params.get('epicId'),
      title,
      body: '',
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [teamId],
  );

  const header = (
    <>
      <Title mode={mode}>New ticket</Title>
      <span className="ml-auto" />
      <CloseButton mode={mode} onClose={close} />
    </>
  );

  if (teams.isPending) return <Frame mode={mode} onClose={close} header={header}><Skeleton className="h-64 w-full" /></Frame>;
  if (!teamId) {
    return (
      <Frame mode={mode} onClose={close} header={header}>
        <EmptyState title="Create a team first" action={<button className="text-sm font-medium text-accent" onClick={() => navigate('/teams')}>Go to teams</button>}>
          Every ticket belongs to a team.
        </EmptyState>
      </Frame>
    );
  }

  return (
    <Frame mode={mode} onClose={close} header={header}>
      <TicketForm
        mode="create"
        initial={initial}
        autoFocus={title ? 'body' : 'title'}
        onCancel={close}
        onSubmit={async (values) => {
          const t = await create.mutateAsync(values);
          toast.success(`Ticket #${t.id} created`, {
            action: { label: 'Open', onClick: () => navigate(`/tickets/${t.id}`, { state: { background: background ?? { pathname: `/board/${t.teamId}`, search: '' } } }) },
          });
          if (background && background.pathname.startsWith('/board/')) navigate(background.pathname + background.search);
          else navigate(`/board/${t.teamId}`);
        }}
      />
    </Frame>
  );
}

function EditTicket({ mode, id }: { mode: 'page' | 'sheet'; id: number }) {
  const ticket = useTicket(id);
  const update = useUpdateTicket();
  const del = useDeleteTicket();
  const comments = useComments(id);
  const close = useClose(mode, ticket.data?.teamId);
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const [tab, setTab] = useState('comments');

  const copyLink = async () => {
    const url = `${window.location.origin}/tickets/${id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied');
    } catch {
      toast.message(url);
    }
  };

  const t = ticket.data;
  const header = (
    <>
      <Title mode={mode}>
        <span className="tabular-nums text-muted">#{id}</span> {t?.title ?? ''}
      </Title>
      <span className="ml-auto" />
      {t && (
        <>
          <Tooltip content="Copy link">
            <button type="button" onClick={() => void copyLink()} className="rounded-md p-1.5 text-muted hover:bg-ink/5 hover:text-ink" aria-label="Copy link to ticket">
              <Link2 className="h-4 w-4" />
            </button>
          </Tooltip>
          <Tooltip content="Delete ticket">
            <button type="button" onClick={() => setConfirm(true)} className="rounded-md p-1.5 text-muted hover:bg-danger/10 hover:text-danger" aria-label="Delete ticket">
              <Trash2 className="h-4 w-4" />
            </button>
          </Tooltip>
        </>
      )}
      <CloseButton mode={mode} onClose={close} />
    </>
  );

  if (ticket.isPending) {
    return (
      <Frame mode={mode} onClose={close} header={header}>
        <div className="space-y-3">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-48 w-full" />
        </div>
      </Frame>
    );
  }
  if (ticket.isError || !t) {
    const notFound = ticket.error instanceof ApiError && ticket.error.status === 404;
    return (
      <Frame mode={mode} onClose={close} header={header}>
        {notFound ? (
          <EmptyState title={`Ticket #${id} does not exist`} className="mb-6">
            It may have been deleted.
          </EmptyState>
        ) : (
          <ErrorCard message={errorMessage(ticket.error)} onRetry={() => void ticket.refetch()} />
        )}
      </Frame>
    );
  }

  const n = comments.data?.length ?? 0;
  return (
    <Frame mode={mode} onClose={close} header={header}>
      <TicketForm
        key={t.id}
        mode="edit"
        ticketId={t.id}
        initial={{ teamId: t.teamId, type: t.type, state: t.state, epicId: t.epicId, title: t.title, body: t.body }}
        meta={<Meta ticket={t} />}
        onSubmit={async (values) => {
          await update.mutateAsync({ id: t.id, ...values });
          toast.success('Changes saved');
        }}
        onQuickSaveBody={async (body) => {
          await update.mutateAsync({ id: t.id, body });
        }}
      >
        <Tabs value={tab} onValueChange={setTab} className="pt-4">
          <TabsList label="Ticket discussion">
            <TabsTrigger value="comments">
              Comments{n > 0 && <span className="ml-1.5 text-xs tabular-nums text-muted">{n}</span>}
            </TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>
          <TabsContent value="comments" className={cn('pt-4')}>
            <Comments ticketId={t.id} />
          </TabsContent>
          <TabsContent value="activity" className="pt-4">
            <Activity ticketId={t.id} />
          </TabsContent>
        </Tabs>
      </TicketForm>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Delete ticket #${t.id}${n > 0 ? ` and its ${plural(n, 'comment')}` : ''}?`}
        description="This cannot be undone."
        confirmLabel="Delete ticket"
        destructive
        onConfirm={async () => {
          try {
            await del.mutateAsync(t.id);
            toast.success(`Ticket #${t.id} deleted`);
            navigate(`/board/${t.teamId}`, { replace: true });
          } catch (err) {
            toast.error(errorMessage(err));
            throw err;
          }
        }}
      />
    </Frame>
  );
}

export function TicketPanel({ mode }: { mode: 'page' | 'sheet' }) {
  const { id } = useParams();
  if (!id) return <CreateTicket mode={mode} />;
  const n = Number(id);
  if (!Number.isInteger(n) || n < 1) {
    return (
      <div className="p-6">
        <EmptyState title="Ticket not found">The address does not point to a ticket.</EmptyState>
      </div>
    );
  }
  return <EditTicket key={n} mode={mode} id={n} />;
}
