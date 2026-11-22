import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { STATE_LABELS, TICKET_STATES, isTicketState, type TicketCardDto, type TicketState } from '@ticketing/shared';
import { Plus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { errorMessage } from '../../api/client';
import { useBoard, useEpics, useTeams } from '../../api/queries';
import { EmptyState, ErrorCard } from '../../components/EmptyState';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/misc';
import { onCommand } from '../../lib/events';
import { rememberTeam } from '../../lib/prefs';
import { Column } from './Column';
import { FilterBar } from './FilterBar';
import { filterTickets, filtersFromSearchParams, filtersToSearchParams, hasFilters, type BoardFilters } from './filterTickets';
import { Onboarding } from './Onboarding';
import { PipelineRibbon } from './PipelineRibbon';
import { TicketCard } from './TicketCard';
import { useMoveTicket } from './useMoveTicket';
import { QuickAdd } from '../ticket/QuickAdd';

function BoardSkeleton() {
  return (
    <div className="flex gap-3 overflow-hidden px-4 pt-4 sm:px-6" aria-busy aria-label="Loading board">
      {TICKET_STATES.map((s) => (
        <div key={s} className="w-[284px] shrink-0 space-y-2 rounded-lg bg-sunken/70 p-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ))}
    </div>
  );
}

export function BoardPage() {
  const { teamId = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const teams = useTeams();
  const board = useBoard(teamId);
  const epics = useEpics(teamId);
  const { move } = useMoveTicket(teamId);
  const [dragging, setDragging] = useState<TicketCardDto | null>(null);

  const team = teams.data?.find((t) => t.id === teamId);
  useEffect(() => {
    if (team) rememberTeam(team.id);
  }, [team]);

  const filters = useMemo(() => filtersFromSearchParams(params), [params]);
  const setFilters = useCallback((f: BoardFilters) => setParams(filtersToSearchParams(f, params), { replace: true }), [params, setParams]);

  const epicTitles = useMemo(() => new Map((epics.data ?? []).map((e) => [e.id, e.title])), [epics.data]);
  const all = board.data ?? [];
  const shown = useMemo(() => filterTickets(all, filters), [all, filters]);
  const columns = useMemo(() => {
    const by = new Map<TicketState, TicketCardDto[]>(TICKET_STATES.map((s) => [s, []]));
    for (const c of shown) by.get(c.state)!.push(c);
    return by;
  }, [shown]);

  const openTicket = useCallback((id: number) => navigate(`/tickets/${id}`, { state: { background: location } }), [navigate, location]);
  const newTicket = useCallback(
    (state: TicketState = 'new') => navigate(`/tickets/new?teamId=${teamId}${state !== 'new' ? `&state=${state}` : ''}`, { state: { background: location } }),
    [navigate, location, teamId],
  );
  useEffect(() => onCommand((c) => c === 'new-ticket' && newTicket()), [newTicket]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space', 'Enter'] } }),
  );

  const label = (id: string | number) => {
    const c = all.find((x) => x.id === Number(id));
    return c ? `ticket #${c.id} ${c.title}` : `ticket ${id}`;
  };
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${label(active.id)}. Use arrow keys to move between columns, Space to drop, Escape to cancel.`,
    onDragOver: ({ active, over }) => (over ? `${label(active.id)} is over ${STATE_LABELS[over.id as TicketState]}.` : `${label(active.id)} is not over a column.`),
    onDragEnd: ({ active, over }) => (over ? `Dropped ${label(active.id)} in ${STATE_LABELS[over.id as TicketState]}.` : `Dropped ${label(active.id)}.`),
    onDragCancel: ({ active }) => `Cancelled moving ${label(active.id)}.`,
  };

  const onDragStart = (e: DragStartEvent) => setDragging(all.find((c) => c.id === Number(e.active.id)) ?? null);
  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    const to = e.over?.id;
    if (isTicketState(to)) move(Number(e.active.id), to);
  };

  if (teams.isSuccess && !team) {
    return (
      <div className="p-6">
        <EmptyState title="Team not found" action={<Button onClick={() => navigate('/')}>Go to your board</Button>}>
          It may have been deleted, or the link is wrong.
        </EmptyState>
      </div>
    );
  }

  const isEmptyTeam = board.isSuccess && all.length === 0;

  return (
    <div className="flex h-[calc(100dvh-3rem)] min-h-[420px] flex-col">
      <div className="space-y-3 border-b border-line px-4 pb-3 pt-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="text-lg font-semibold tracking-tight">{team?.name ?? <Skeleton className="h-6 w-32" />}</h1>
          <div className="order-last w-full sm:order-none sm:w-auto sm:flex-1">
            <PipelineRibbon cards={all} />
          </div>
          <Button variant="primary" onClick={() => newTicket()} className="ml-auto sm:ml-0">
            <Plus className="h-4 w-4" aria-hidden /> New ticket{' '}
            <kbd className="ml-1 hidden h-5 min-w-[1.25rem] items-center justify-center rounded-sm bg-white/20 px-1 font-sans text-2xs font-semibold sm:inline-flex">C</kbd>
          </Button>
        </div>
        {!isEmptyTeam && <FilterBar filters={filters} onChange={setFilters} epics={epics.data ?? []} shown={shown.length} total={all.length} />}
      </div>

      {board.isPending ? (
        <BoardSkeleton />
      ) : board.isError ? (
        <div className="p-6">
          <ErrorCard message={`Cannot load the board. ${errorMessage(board.error)}`} onRetry={() => void board.refetch()} />
        </div>
      ) : isEmptyTeam ? (
        <Onboarding teamId={teamId} />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)} accessibility={{ announcements }}>
          <div className="flex min-h-0 flex-1 snap-x gap-3 overflow-x-auto px-4 py-4 sm:px-6" data-board>
            {TICKET_STATES.map((s) => (
              <Column
                key={s}
                state={s}
                cards={columns.get(s)!}
                epicTitles={epicTitles}
                onOpen={openTicket}
                onNew={newTicket}
                filtered={hasFilters(filters)}
                footer={<QuickAdd teamId={teamId} state={s} epics={epics.data ?? []} />}
              />
            ))}
          </div>
          <DragOverlay dropAnimation={{ duration: 160, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }}>
            {dragging && <TicketCard card={dragging} epicTitle={dragging.epicId ? epicTitles.get(dragging.epicId) : undefined} overlay className="w-[268px] rotate-[3deg] scale-[1.03]" />}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
