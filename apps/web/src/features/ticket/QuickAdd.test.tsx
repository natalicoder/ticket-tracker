import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { LocationProbe, renderWithProviders } from '../../test/utils';
import { QuickAdd } from './QuickAdd';

const epics = [
  { id: 'e-auth', teamId: 'T', title: 'Auth', description: null, createdAt: '', modifiedAt: '', ticketCount: 0 },
  { id: 'e-pay', teamId: 'T', title: 'Payments', description: null, createdAt: '', modifiedAt: '', ticketCount: 0 },
];

describe('QuickAdd', () => {
  it('shows parsed chips and opens the prefilled create form on Enter', async () => {
    renderWithProviders(<QuickAdd teamId="T" state="in_progress" epics={epics} defaultOpen />, {
      route: '/board/T',
      path: '/board/:teamId',
      extraRoutes: <Route path="/tickets/new" element={<LocationProbe />} />,
    });
    const input = screen.getByRole('textbox', { name: /quick add/i });
    await userEvent.type(input, 'bug: Crash @pay');
    expect(screen.getByText('Bug')).toBeInTheDocument();
    expect(screen.getByText('Payments')).toBeInTheDocument();
    await userEvent.keyboard('{Enter}');
    const loc = await screen.findByTestId('location');
    const url = new URL(loc.textContent!, 'http://x');
    expect(url.pathname).toBe('/tickets/new');
    expect(Object.fromEntries(url.searchParams)).toEqual({ teamId: 'T', state: 'in_progress', type: 'bug', epicId: 'e-pay', title: 'Crash' });
  });

  it('warns about an unknown epic', async () => {
    renderWithProviders(<QuickAdd teamId="T" state="new" epics={epics} defaultOpen />, { route: '/board/T', path: '/board/:teamId' });
    await userEvent.type(screen.getByRole('textbox', { name: /quick add/i }), 'fix: thing @nomatch');
    expect(screen.getByText('Unknown epic @nomatch')).toBeInTheDocument();
  });

  it('does nothing on Enter with an empty title', async () => {
    renderWithProviders(<QuickAdd teamId="T" state="new" epics={epics} defaultOpen />, {
      route: '/board/T',
      path: '/board/:teamId',
      extraRoutes: <Route path="/tickets/new" element={<LocationProbe />} />,
    });
    await userEvent.type(screen.getByRole('textbox', { name: /quick add/i }), 'bug:   {Enter}');
    expect(screen.queryByTestId('location')).not.toBeInTheDocument();
  });
});
