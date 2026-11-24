import { CircleCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../../api/client';
import { Spinner } from '../../components/ui/Spinner';
import { AuthLayout } from './AuthLayout';
import { ResendForm } from './ResendForm';

type Status = 'verifying' | 'verified' | 'TOKEN_EXPIRED' | 'TOKEN_USED' | 'TOKEN_INVALID' | 'error';

const FAILURES: Record<Exclude<Status, 'verifying' | 'verified'>, { title: string; body: string }> = {
  TOKEN_EXPIRED: { title: 'This link has expired', body: 'Verification links work for 24 hours. Enter your email and we will send a fresh one.' },
  TOKEN_USED: {
    title: 'This link was already used',
    body: 'Your email may already be verified. Try logging in. If you asked for a newer link, use the latest email.',
  },
  TOKEN_INVALID: { title: 'This link is not valid', body: 'The link is incomplete or was mistyped. Request a new one below.' },
  error: { title: 'We could not verify your email', body: 'Something went wrong. Request a new link or try again later.' },
};

export function VerifyPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [status, setStatus] = useState<Status>(token ? 'verifying' : 'TOKEN_INVALID');
  const started = useRef(false);

  useEffect(() => {
    // The token is single-use: StrictMode runs effects twice in development, so guard with a ref.
    if (!token || started.current) return;
    started.current = true;
    api('/api/auth/verify', { method: 'POST', body: { token } })
      .then(() => setStatus('verified'))
      .catch((err) => {
        const code = err instanceof ApiError ? err.code : '';
        setStatus(code === 'TOKEN_EXPIRED' || code === 'TOKEN_USED' || code === 'TOKEN_INVALID' ? code : 'error');
      });
  }, [token]);

  if (status === 'verifying') {
    return (
      <AuthLayout title="Verifying your email">
        <div className="flex items-center gap-2 text-sm text-muted" role="status">
          <Spinner /> One moment…
        </div>
      </AuthLayout>
    );
  }

  if (status === 'verified') {
    return (
      <AuthLayout title="Email verified" subtitle="Your account is active. Log in to start tracking work.">
        <div className="mb-5 flex items-center gap-2 text-sm text-success">
          <CircleCheck className="h-5 w-5" aria-hidden /> Thanks for confirming your address.
        </div>
        <Link to="/login" className="inline-flex h-9 w-full items-center justify-center rounded-full bg-brand text-sm font-semibold text-brand-ink hover:bg-brand/85">
          Go to login
        </Link>
      </AuthLayout>
    );
  }

  const copy = FAILURES[status];
  return (
    <AuthLayout title={copy.title} subtitle={copy.body} footer={<Link className="font-medium text-accent" to="/login">Back to login</Link>}>
      <ResendForm />
    </AuthLayout>
  );
}
