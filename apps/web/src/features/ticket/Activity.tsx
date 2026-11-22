import { isTicketState, isTicketType, STATE_LABELS, TYPE_LABELS, type TicketEventDto } from '@ticketing/shared';
import { useMemo } from 'react';
import { errorMessage } from '../../api/client';
import { useEpics, useEvents, useTeams } from '../../api/queries';
import { ErrorCard } from '../../components/EmptyState';
import { Skeleton } from '../../components/ui/misc';
import { Tooltip } from '../../components/ui/Tooltip';
import { absoluteTime, relativeTime } from '../../lib/time';

const FIELD_NAMES: Record<string, string> = { teamId: 'team', epicId: 'epic', type: 'type', state: 'state', title: 'title', body: 'description' };

export function Activity({ ticketId }: { ticketId: number }) {
  const events = useEvents(ticketId);
  const epics = useEpics();
  const teams = useTeams();
  const names = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of epics.data ?? []) m.set(e.id, e.title);
    for (const t of teams.data ?? []) m.set(t.id, t.name);
    return m;
  }, [epics.data, teams.data]);

  const show = (field: string | null, v: string | null): string => {
    if (v === null) return field === 'epicId' ? 'no epic' : 'nothing';
    if (field === 'state' && isTicketState(v)) return STATE_LABELS[v];
    if (field === 'type' && isTicketType(v)) return TYPE_LABELS[v];
    if (field === 'epicId' || field === 'teamId') return names.get(v) ?? 'a deleted item';
    return `“${v}”`;
  };

  const sentence = (e: TicketEventDto) => {
    if (e.kind === 'created') return 'created the ticket';
    if (e.field === 'body') return 'edited the description';
    return `changed ${FIELD_NAMES[e.field ?? ''] ?? e.field} from ${show(e.field, e.from)} to ${show(e.field, e.to)}`;
  };

  if (events.isPending) return <Skeleton className="h-24 w-full" />;
  if (events.isError) return <ErrorCard message={errorMessage(events.error)} onRetry={() => void events.refetch()} />;
  return (
    <ol className="relative space-y-3 border-l border-line pl-4" aria-label="Activity, oldest first">
      {events.data.map((e) => (
        <li key={e.id} className="relative text-sm">
          <span aria-hidden className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full border-2 border-surface bg-line-strong" />
          <span className="font-medium text-ink">{e.actor.email}</span> <span className="text-ink-2">{sentence(e)}</span>
          <Tooltip content={absoluteTime(e.at)}>
            <time dateTime={e.at} className="ml-1.5 text-xs text-muted">
              {relativeTime(e.at)}
            </time>
          </Tooltip>
        </li>
      ))}
    </ol>
  );
}
