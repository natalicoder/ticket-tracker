import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { mockFetch, newQueryClient } from '../../test/utils';
import { VerifyPage } from './VerifyPage';

function renderVerify(route = '/verify?token=tok123') {
  return render(
    <StrictMode>
      <QueryClientProvider client={newQueryClient()}>
        <MemoryRouter initialEntries={[route]}>
          <Routes>
            <Route path="/verify" element={<VerifyPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </StrictMode>,
  );
}

describe('VerifyPage', () => {
  it('verifies once, even under StrictMode, and links to login', async () => {
    const fetchMock = mockFetch({ 'POST /api/auth/verify': { status: 200, body: { status: 'verified' } } });
    renderVerify();
    expect(await screen.findByRole('heading', { name: 'Email verified' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to login' })).toHaveAttribute('href', '/login');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String((fetchMock.mock.calls[0]![1] as RequestInit).body))).toEqual({ token: 'tok123' });
  });

  it('explains an expired link and offers to resend', async () => {
    const fetchMock = mockFetch({
      'POST /api/auth/verify': { status: 400, body: { error: { code: 'TOKEN_EXPIRED', message: 'This link has expired. Request a new one.' } } },
      'POST /api/auth/resend-verification': { status: 202, body: { status: 'sent' } },
    });
    renderVerify();
    expect(await screen.findByRole('heading', { name: 'This link has expired' })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Email'), 'a@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Send a new link' }));
    expect(await screen.findByText(/we sent a new link to a@example.com/i)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('explains a used link', async () => {
    mockFetch({ 'POST /api/auth/verify': { status: 400, body: { error: { code: 'TOKEN_USED', message: 'used' } } } });
    renderVerify();
    expect(await screen.findByRole('heading', { name: 'This link was already used' })).toBeInTheDocument();
  });

  it('handles a missing token without calling the API', async () => {
    const fetchMock = mockFetch({});
    renderVerify('/verify');
    expect(await screen.findByRole('heading', { name: 'This link is not valid' })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
