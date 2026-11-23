import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { mockFetch, renderWithProviders } from '../../test/utils';
import { LoginPage } from './LoginPage';

const notVerified = { status: 403, body: { error: { code: 'EMAIL_NOT_VERIFIED', message: 'Verify your email first.' } } };

function calls(fetchMock: ReturnType<typeof mockFetch>, path: string) {
  return fetchMock.mock.calls.filter(([url]) => String(url).startsWith(path));
}

describe('LoginPage', () => {
  it('sends a new verification link from the unverified warning without submitting the login form', async () => {
    const fetchMock = mockFetch({
      'POST /api/auth/login': notVerified,
      'POST /api/auth/resend-verification': { status: 202 },
    });
    renderWithProviders(<LoginPage />, { route: '/login' });
    await userEvent.type(screen.getByLabelText('Email'), 'new@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'password-1');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    await screen.findByText(/Verify your email first/);
    expect(document.querySelector('form form')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Send a new link' }));
    expect(await screen.findByText(/We sent a new link to new@example.com/)).toBeInTheDocument();
    expect(calls(fetchMock, '/api/auth/login')).toHaveLength(1);
    expect(calls(fetchMock, '/api/auth/resend-verification')).toHaveLength(1);
  });

  it('offers to resend the verification email before any login attempt', async () => {
    const fetchMock = mockFetch({ 'POST /api/auth/resend-verification': { status: 202 } });
    renderWithProviders(<LoginPage />, { route: '/login' });
    await userEvent.click(screen.getByRole('button', { name: 'Resend verification email' }));
    const email = screen.getAllByLabelText('Email').at(-1)!;
    await userEvent.type(email, 'late@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Send a new link' }));
    expect(await screen.findByText(/We sent a new link to late@example.com/)).toBeInTheDocument();
    await waitFor(() => expect(calls(fetchMock, '/api/auth/resend-verification')).toHaveLength(1));
    expect(JSON.parse(String(calls(fetchMock, '/api/auth/resend-verification')[0]![1]!.body))).toEqual({ email: 'late@example.com' });
  });
});
