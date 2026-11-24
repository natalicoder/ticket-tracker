import { passwordSchema } from '@ticketing/shared';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { api, ApiError, errorMessage } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Field';
import { AuthLayout, FormError } from './AuthLayout';

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [fieldError, setFieldError] = useState<string>();
  const [tokenError, setTokenError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) return setFieldError(parsed.error.issues[0]?.message);
    setFieldError(undefined);
    setFormError(undefined);
    setBusy(true);
    try {
      await api('/api/auth/reset-password', { method: 'POST', body: { token, password } });
      toast.success('Password updated. Log in with your new password.');
      navigate('/login', { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.code.startsWith('TOKEN_')) setTokenError(err.message);
      else setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (!token || tokenError) {
    return (
      <AuthLayout title="This reset link does not work" subtitle={tokenError ?? 'The link is incomplete. Request a new one.'}>
        <Link to="/forgot-password" className="inline-flex h-9 w-full items-center justify-center rounded-full bg-brand text-sm font-semibold text-brand-ink hover:bg-brand/85">
          Request a new link
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Choose a new password" subtitle="After saving, you will be logged out everywhere and can log in with the new password.">
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <FormError>{formError}</FormError>
        <Field label="New password" error={fieldError} hint="At least 8 characters.">
          <Input type="password" autoComplete="new-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Button type="submit" variant="primary" loading={busy} className="w-full justify-center">
          Save new password
        </Button>
      </form>
    </AuthLayout>
  );
}
