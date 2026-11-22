import { emailSchema } from '@ticketing/shared';
import { useState, type FormEvent } from 'react';
import { api, errorMessage } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Field';

/** Requests a fresh verification link. The API always answers 202, so the copy never reveals whether an account exists. */
export function ResendForm({ defaultEmail = '', hideEmail = false }: { defaultEmail?: string; hideEmail?: boolean }) {
  const [email, setEmail] = useState(defaultEmail);
  const [error, setError] = useState<string>();
  const [sentTo, setSentTo] = useState<string>();
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message);
      return;
    }
    setError(undefined);
    setBusy(true);
    try {
      await api('/api/auth/resend-verification', { method: 'POST', body: { email: parsed.data } });
      setSentTo(parsed.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      {!hideEmail && (
        <Field label="Email" error={error}>
          <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
        </Field>
      )}
      {hideEmail && error && (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
      <Button type="submit" loading={busy} variant={hideEmail ? 'secondary' : 'primary'}>
        {sentTo ? 'Send another link' : 'Send a new link'}
      </Button>
      {sentTo && (
        <p role="status" className="text-sm text-success">
          We sent a new link to {sentTo}. Earlier links no longer work.
        </p>
      )}
    </form>
  );
}
