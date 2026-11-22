import { QueryClientProvider } from '@tanstack/react-query';
import type { TicketCardDto } from '@ticketing/shared';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { keys } from '../../api/queries';
import { jsonResponse, newQueryClient } from '../../test/utils';
import { useMoveTicket } from './useMoveTicket';

const toastMock = vi.hoisted(() => Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), dismiss: vi.fn() }));
vi.mock('sonner', () => ({ toast: toastMock }));

const card = (id: number, state: TicketCardDto['state']): TicketCardDto => ({
  id,
  teamId: 'team',
  type: 'bug',
  state,
  epicId: null,
  title: `T${id}`,
  modifiedAt: '2026-11-01T10:00:00.000Z',
  stateSince: '2026-11-01T10:00:00.000Z',
  checklist: { done: 0, total: 0 },
});

function setup(initial: TicketCardDto[]) {
  const client = newQueryClient();
  client.setQueryData(keys.board('team'), initial);
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const { result } = renderHook(() => useMoveTicket('team'), { wrapper });
  const board = () => client.getQueryData<TicketCardDto[]>(keys.board('team'))!;
  return { client, result, board };
}

function deferred() {
  let resolve!: (r: Response) => void;
  const promise = new Promise<Response>((r) => (resolve = r));
  return { promise, resolve };
}

beforeEach(() => {
  toastMock.mockClear();
  toastMock.success.mockClear();
  toastMock.error.mockClear();
});

describe('useMoveTicket', () => {
  it('moves the card optimistically to the top and PATCHes the new state', async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => jsonResponse(200, { ...card(1, 'done'), ...JSON.parse(String(init.body)) }));
    vi.stubGlobal('fetch', fetchMock);
    const { result, board } = setup([card(2, 'done'), card(1, 'new')]);

    act(() => result.current.move(1, 'done'));
    expect(board()[0]).toMatchObject({ id: 1, state: 'done' });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/tickets/1/state');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(String(init.body))).toEqual({ state: 'done' });
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith('Moved #1 to Done', expect.objectContaining({ action: expect.objectContaining({ label: 'Undo' }) })));
  });

  it('puts the card back and shows the error when the server fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(500, { error: { code: 'INTERNAL', message: 'Something went wrong. Please try again.' } })));
    const { result, board } = setup([card(1, 'new')]);
    act(() => result.current.move(1, 'in_progress'));
    expect(board()[0]!.state).toBe('in_progress');
    await waitFor(() => expect(board()[0]!.state).toBe('new'));
    expect(board()[0]!.modifiedAt).toBe('2026-11-01T10:00:00.000Z');
    expect(toastMock.error).toHaveBeenCalledWith('Could not move #1: Something went wrong. Please try again.');
  });

  it('restores the card even if the board was refetched in between', async () => {
    const d = deferred();
    vi.stubGlobal('fetch', vi.fn(() => d.promise));
    const { client, result, board } = setup([card(1, 'new')]);
    act(() => result.current.move(1, 'done'));
    // A refetch lands while the PATCH is in flight and brings another ticket.
    act(() => client.setQueryData(keys.board('team'), [card(1, 'done'), card(7, 'new')]));
    await act(async () => d.resolve(jsonResponse(409, { error: { code: 'CONFLICT', message: 'nope' } })));
    await waitFor(() => expect(board().find((c) => c.id === 1)!.state).toBe('new'));
    expect(board().some((c) => c.id === 7)).toBe(true);
  });

  it('sends nothing when the card is already in that state', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { result, board } = setup([card(1, 'new')]);
    act(() => result.current.move(1, 'new'));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(board()[0]!.state).toBe('new');
  });

  it('ends in the last chosen state after two quick moves, sending them in order', async () => {
    const first = deferred();
    const second = deferred();
    const fetchMock = vi.fn().mockImplementationOnce(() => first.promise).mockImplementationOnce(() => second.promise);
    vi.stubGlobal('fetch', fetchMock);
    const { result, board } = setup([card(1, 'new')]);

    act(() => result.current.move(1, 'in_progress'));
    act(() => result.current.move(1, 'done'));
    expect(board()[0]!.state).toBe('done');

    await act(async () => first.resolve(jsonResponse(200, card(1, 'in_progress'))));
    expect(board()[0]!.state).toBe('done');
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(JSON.parse(String((fetchMock.mock.calls[1]![1] as RequestInit).body))).toEqual({ state: 'done' });
    await act(async () => second.resolve(jsonResponse(200, card(1, 'done'))));
    await waitFor(() => expect(board()[0]!.state).toBe('done'));
  });

  it('undo moves the card back without offering another undo', async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => jsonResponse(200, { ...card(1, 'new'), ...JSON.parse(String(init.body)) }));
    vi.stubGlobal('fetch', fetchMock);
    const { result, board } = setup([card(1, 'new')]);
    act(() => result.current.move(1, 'done'));
    await waitFor(() => expect(toastMock.success).toHaveBeenCalled());
    const undo = toastMock.success.mock.calls[0]![1].action.onClick as () => void;
    act(() => undo());
    expect(board()[0]!.state).toBe('new');
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(JSON.parse(String((fetchMock.mock.calls[1]![1] as RequestInit).body))).toEqual({ state: 'new' });
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledTimes(2));
    expect(toastMock.success.mock.calls[1]![1]?.action).toBeUndefined();
  });
});
