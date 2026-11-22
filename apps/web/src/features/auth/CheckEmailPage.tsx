import { Inbox } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthLayout } from './AuthLayout';
import { ResendForm } from './ResendForm';

const showMailpit = import.meta.env.VITE_SHOW_MAILPIT_LINK !== 'false';
const mailpitPort = import.meta.env.VITE_MAILPIT_PORT || '8025';

export function CheckEmailPage() {
  const [params] = useSearchParams();
  const email = params.get('email') ?? '';
  const mailpitUrl = `${window.location.protocol}//${window.location.hostname}:${mailpitPort}`;

  return (
    <AuthLayout
      title="Check your email"
      subtitle={
        email ? (
          <>
            We sent a verification link to <span className="font-medium text-ink">{email}</span>. It works once and expires in 24 hours.
          </>
        ) : (
          'We sent you a verification link. It works once and expires in 24 hours.'
        )
      }
      footer={
        <>
          Verified already?{' '}
          <Link className="font-medium text-accent" to="/login">
            Log in
          </Link>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {showMailpit && (
          <a
            href={mailpitUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-md border border-line bg-sunken/60 px-3 py-2.5 text-sm hover:border-line-strong"
          >
            <Inbox className="h-4 w-4 text-accent" aria-hidden />
            <span>
              <span className="font-medium text-ink">Open Mailpit</span>
              <span className="block text-xs text-muted">Local inbox that catches emails in this development setup</span>
            </span>
          </a>
        )}
        <div>
          <p className="mb-2 text-sm text-muted">Didn’t get it? Check spam, or send it again.</p>
          <ResendForm defaultEmail={email} hideEmail={!!email} />
        </div>
      </div>
    </AuthLayout>
  );
}
