import { emailSchema } from '@ticketing/shared';
import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, errorMessage } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Field';
import { AuthLayout, FormError } from './AuthLayout';

export function ForgotPasswordPage() {
  const [params] = useSearchParams();
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [fieldError, setFieldError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [sentTo, setSentTo] = useState<string>();
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) return setFieldError(parsed.error.issues[0]?.message);
    setFieldError(undefined);
    setFormError(undefined);
    setBusy(true);
    try {
      await api('/api/auth/forgot-password', { method: 'POST', body: { email: parsed.data } });
      setSentTo(parsed.data);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Reset your password"
      subtitle={sentTo ? undefined : 'Enter your email and we will send you a link to choose a new password.'}
      footer={
        <Link className="font-medium text-accent" to="/login">
          Back to login
        </Link>
      }
    >
      {sentTo ? (
        <p role="status" className="text-sm text-ink">
          If an account exists for <span className="font-medium">{sentTo}</span>, we sent a link to reset the password. It expires in 1 hour.
        </p>
      ) : (
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <FormError>{formError}</FormError>
          <Field label="Email" error={fieldError}>
            <Input type="email" autoComplete="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
          </Field>
          <Button type="submit" variant="primary" loading={busy} className="w-full justify-center">
            Send reset link
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
