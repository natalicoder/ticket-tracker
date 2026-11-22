import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { TooltipProvider } from '../../components/ui/Tooltip';
import { jsonResponse, mockFetch, renderWithProviders } from '../../test/utils';
import { TeamsPage } from './TeamsPage';

const team = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 't1',
  name: 'Core',
  createdAt: '2026-11-20T10:00:00.000Z',
  modifiedAt: '2026-11-21T10:00:00.000Z',
  ticketCount: 2,
  epicCount: 0,
  ...over,
});

const renderPage = () =>
  renderWithProviders(
    <TooltipProvider>
      <TeamsPage />
    </TooltipProvider>,
    { route: '/teams' },
  );

describe('TeamsPage', () => {
  it('disables deleting a team that still has tickets and says why', async () => {
    mockFetch({ 'GET /api/teams': { status: 200, body: [team()] } });
    renderPage();
    const del = await screen.findByRole('button', { name: 'Delete team Core' });
    expect(del).toHaveAttribute('aria-disabled', 'true');
    expect(del).toHaveAccessibleDescription(/2 tickets/);
  });

  it('enables deleting an empty team behind a confirmation', async () => {
    const fetchMock = mockFetch({
      'GET /api/teams': { status: 200, body: [team({ ticketCount: 0, epicCount: 0 })] },
      'DELETE /api/teams/t1': () => jsonResponse(204),
    });
    renderPage();
    const del = await screen.findByRole('button', { name: 'Delete team Core' });
    expect(del).not.toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(del);
    const dialog = await screen.findByRole('alertdialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete team' }));
    expect(fetchMock.mock.calls.some(([u, i]) => String(u) === '/api/teams/t1' && (i as RequestInit).method === 'DELETE')).toBe(true);
  });

  it('shows the server message when a rename conflicts', async () => {
    mockFetch({
      'GET /api/teams': { status: 200, body: [team()] },
      'PATCH /api/teams/t1': { status: 409, body: { error: { code: 'TEAM_NAME_TAKEN', message: 'A team named "Platform" already exists' } } },
    });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Rename team Core' }));
    const input = screen.getByRole('textbox', { name: 'Team name' });
    await userEvent.clear(input);
    await userEvent.type(input, 'Platform{Enter}');
    expect(await screen.findByText('A team named "Platform" already exists')).toBeInTheDocument();
  });

  it('invites the user to create the first team when there are none', async () => {
    mockFetch({ 'GET /api/teams': { status: 200, body: [] } });
    renderPage();
    expect(await screen.findByRole('heading', { name: 'No teams yet' })).toBeInTheDocument();
  });

  it('rejects a blank name without calling the API', async () => {
    const fetchMock = mockFetch({ 'GET /api/teams': { status: 200, body: [] } });
    renderPage();
    await userEvent.click((await screen.findAllByRole('button', { name: 'New team' }))[0]!);
    await userEvent.type(screen.getByRole('textbox', { name: 'Team name' }), '   {Enter}');
    expect(await screen.findByText('Name must not be empty')).toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([, i]) => (i as RequestInit | undefined)?.method === 'POST')).toHaveLength(0);
  });
});
