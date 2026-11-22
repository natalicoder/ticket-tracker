import { screen } from '@testing-library/react';
import { Route } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { LocationProbe, mockFetch, renderWithProviders } from '../test/utils';
import { RequireAuth } from './RequireAuth';

describe('RequireAuth', () => {
  it('redirects to /login with next= when the session is missing', async () => {
    mockFetch({ 'GET /api/auth/me': { status: 401, body: { error: { code: 'UNAUTHENTICATED', message: 'Please log in' } } } });
    renderWithProviders(
      <RequireAuth>
        <div>secret board</div>
      </RequireAuth>,
      { route: '/board/abc?type=bug', path: '/board/:teamId', extraRoutes: <Route path="/login" element={<LocationProbe />} /> },
    );
    expect(await screen.findByTestId('location')).toHaveTextContent('/login?next=%2Fboard%2Fabc%3Ftype%3Dbug');
    expect(screen.queryByText('secret board')).not.toBeInTheDocument();
  });

  it('renders children for a logged-in user', async () => {
    mockFetch({ 'GET /api/auth/me': { status: 200, body: { id: 'u1', email: 'a@b.co' } } });
    renderWithProviders(
      <RequireAuth>
        <div>secret board</div>
      </RequireAuth>,
      { route: '/board/abc', path: '/board/:teamId' },
    );
    expect(await screen.findByText('secret board')).toBeInTheDocument();
  });
});
