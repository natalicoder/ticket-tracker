import type {
  CommentDto,
  EpicDto,
  SimilarTicketDto,
  TeamDto,
  TicketCardDto,
  TicketDto,
  TicketEventDto,
  TicketState,
  TicketType,
  UserDto,
} from '@ticketing/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api, ApiError } from './client';

export const keys = {
  me: ['me'] as const,
  teams: ['teams'] as const,
  epics: (teamId?: string) => (teamId ? (['epics', teamId] as const) : (['epics'] as const)),
  board: (teamId: string) => ['board', teamId] as const,
  ticket: (id: number) => ['ticket', id] as const,
  comments: (id: number) => ['comments', id] as const,
  events: (id: number) => ['events', id] as const,
  similar: (teamId: string, q: string, excludeId?: number) => ['similar', teamId, q, excludeId ?? null] as const,
};

// ---- queries ----

export function useMe() {
  return useQuery({
    queryKey: keys.me,
    queryFn: ({ signal }) => api<UserDto>('/api/auth/me', { signal }),
    retry: (count, err) => !(err instanceof ApiError && err.status === 401) && count < 2,
    staleTime: 5 * 60_000,
  });
}

export function useTeams() {
  return useQuery({ queryKey: keys.teams, queryFn: ({ signal }) => api<TeamDto[]>('/api/teams', { signal }) });
}

export function useEpics(teamId?: string) {
  return useQuery({
    queryKey: keys.epics(teamId),
    queryFn: ({ signal }) => api<EpicDto[]>(teamId ? `/api/epics?teamId=${encodeURIComponent(teamId)}` : '/api/epics', { signal }),
  });
}

export function useBoard(teamId: string | undefined) {
  return useQuery({
    queryKey: keys.board(teamId ?? ''),
    queryFn: ({ signal }) => api<TicketCardDto[]>(`/api/teams/${encodeURIComponent(teamId!)}/tickets`, { signal }),
    enabled: !!teamId,
  });
}

export function useTicket(id: number | undefined) {
  return useQuery({
    queryKey: keys.ticket(id ?? 0),
    queryFn: ({ signal }) => api<TicketDto>(`/api/tickets/${id}`, { signal }),
    enabled: !!id,
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 2,
  });
}

export function useComments(id: number | undefined) {
  return useQuery({
    queryKey: keys.comments(id ?? 0),
    queryFn: ({ signal }) => api<CommentDto[]>(`/api/tickets/${id}/comments`, { signal }),
    enabled: !!id,
  });
}

export function useEvents(id: number | undefined) {
  return useQuery({
    queryKey: keys.events(id ?? 0),
    queryFn: ({ signal }) => api<TicketEventDto[]>(`/api/tickets/${id}/events`, { signal }),
    enabled: !!id,
  });
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const h = setTimeout(() => setV(value), ms);
    return () => clearTimeout(h);
  }, [value, ms]);
  return v;
}

export function useSimilar(teamId: string | undefined, q: string, excludeId?: number) {
  const debounced = useDebounced(q.trim(), 300);
  return useQuery({
    queryKey: keys.similar(teamId ?? '', debounced, excludeId),
    queryFn: ({ signal }) => {
      const params = new URLSearchParams({ q: debounced });
      if (excludeId) params.set('excludeId', String(excludeId));
      return api<SimilarTicketDto[]>(`/api/teams/${teamId}/tickets/similar?${params}`, { signal });
    },
    enabled: !!teamId && debounced.length >= 3,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

// ---- mutations ----

function invalidateTicketWorld(qc: QueryClient, ticketId?: number) {
  void qc.invalidateQueries({ queryKey: ['board'] });
  void qc.invalidateQueries({ queryKey: keys.teams });
  void qc.invalidateQueries({ queryKey: ['epics'] });
  void qc.invalidateQueries({ queryKey: ['similar'] });
  if (ticketId) {
    void qc.invalidateQueries({ queryKey: keys.ticket(ticketId) });
    void qc.invalidateQueries({ queryKey: keys.events(ticketId) });
  }
}

export function useCreateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api<TeamDto>('/api/teams', { method: 'POST', body: { name } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.teams }),
  });
}

export function useRenameTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => api<TeamDto>(`/api/teams/${id}`, { method: 'PATCH', body: { name } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.teams }),
  });
}

export function useDeleteTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/api/teams/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.teams }),
  });
}

export function useCreateEpic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { teamId: string; title: string; description?: string | null }) => api<EpicDto>('/api/epics', { method: 'POST', body }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['epics'] });
      void qc.invalidateQueries({ queryKey: keys.teams });
    },
  });
}

export function useUpdateEpic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; title?: string; description?: string | null }) =>
      api<EpicDto>(`/api/epics/${id}`, { method: 'PATCH', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['epics'] }),
  });
}

export function useDeleteEpic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/api/epics/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['epics'] });
      void qc.invalidateQueries({ queryKey: keys.teams });
    },
  });
}

export interface TicketInput {
  teamId: string;
  type: TicketType;
  state: TicketState;
  epicId: string | null;
  title: string;
  body: string;
}

export function useCreateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: TicketInput) => api<TicketDto>('/api/tickets', { method: 'POST', body }),
    onSuccess: (ticket) => {
      qc.setQueryData(keys.ticket(ticket.id), ticket);
      invalidateTicketWorld(qc, ticket.id);
    },
  });
}

export function useUpdateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<TicketInput> & { id: number }) => api<TicketDto>(`/api/tickets/${id}`, { method: 'PATCH', body }),
    onSuccess: (ticket) => {
      qc.setQueryData(keys.ticket(ticket.id), ticket);
      invalidateTicketWorld(qc, ticket.id);
    },
  });
}

export function useDeleteTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<void>(`/api/tickets/${id}`, { method: 'DELETE' }),
    onSuccess: (_v, id) => {
      qc.removeQueries({ queryKey: keys.ticket(id) });
      qc.removeQueries({ queryKey: keys.comments(id) });
      qc.removeQueries({ queryKey: keys.events(id) });
      invalidateTicketWorld(qc);
    },
  });
}

export function useAddComment(ticketId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => api<CommentDto>(`/api/tickets/${ticketId}/comments`, { method: 'POST', body: { body } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.comments(ticketId) }),
  });
}

export function useEditComment(ticketId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) => api<CommentDto>(`/api/comments/${id}`, { method: 'PATCH', body: { body } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.comments(ticketId) }),
  });
}

export function useDeleteComment(ticketId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/api/comments/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.comments(ticketId) }),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>('/api/auth/logout', { method: 'POST' }),
    onSettled: () => {
      qc.clear();
    },
  });
}
