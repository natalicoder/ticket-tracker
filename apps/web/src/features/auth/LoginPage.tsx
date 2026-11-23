import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { LoginBody, type LoginInput, type UserDto } from '@ticketing/shared';
import { MailWarning } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError, errorMessage } from '../../api/client';
import { keys } from '../../api/queries';
import { Button } from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Field';
import { AuthLayout, FormError, safeNext } from './AuthLayout';
import { ResendForm } from './ResendForm';

export function LoginPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const [formError, setFormError] = useState<string>();
  const [unverified, setUnverified] = useState<string>();
  const [resendOpen, setResendOpen] = useState(false);
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(LoginBody), defaultValues: { email: '', password: '' } });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(undefined);
    setUnverified(undefined);
    try {
      const user = await api<UserDto>('/api/auth/login', { method: 'POST', body: values });
      qc.clear();
      qc.setQueryData(keys.me, user);
      navigate(next, { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'EMAIL_NOT_VERIFIED') setUnverified(values.email);
      else if (err instanceof ApiError && err.status === 401) setFormError('Invalid email or password.');
      else setFormError(errorMessage(err));
    }
  });

  return (
    <AuthLayout
      title="Log in"
      subtitle={params.get('next') ? 'Your session ended. Log in to pick up where you left off.' : 'Welcome back.'}
      footer={
        <>
          New here?{' '}
          <Link className="font-medium text-accent" to="/signup">
            Create an account
          </Link>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Resend forms stay outside the login form: nested forms submit the wrong one. */}
        {unverified && (
          <div role="alert" className="rounded-md border border-warn/40 bg-warn-soft p-3">
            <div className="mb-2 flex items-start gap-2 text-sm text-ink">
              <MailWarning className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-hidden />
              <span>Verify your email first. Open the link we sent to {unverified}, or get a new one.</span>
            </div>
            <ResendForm defaultEmail={unverified} hideEmail />
          </div>
        )}
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <FormError>{formError}</FormError>
          <Field label="Email" error={errors.email?.message}>
            <Input type="email" autoComplete="email" autoFocus placeholder="you@company.com" {...register('email')} />
          </Field>
          <Field
            label="Password"
            error={errors.password?.message}
            aside={
              <Link to={`/forgot-password?email=${encodeURIComponent(getValues('email') ?? '')}`} className="text-xs font-medium text-accent">
                Forgot password?
              </Link>
            }
          >
            <Input type="password" autoComplete="current-password" {...register('password')} />
          </Field>
          <Button type="submit" variant="primary" loading={isSubmitting} className="mt-1 w-full justify-center">
            Log in
          </Button>
        </form>
        {!unverified && (resendOpen ? (
          <div className="rounded-md border border-line bg-sunken/60 p-3">
            <p className="mb-2 text-sm text-ink-2">Enter your email and we will send a fresh verification link.</p>
            <ResendForm defaultEmail={getValues('email') ?? ''} />
          </div>
        ) : (
          <button type="button" onClick={() => setResendOpen(true)} className="self-center text-xs font-medium text-accent">
            Resend verification email
          </button>
        ))}
      </div>
    </AuthLayout>
  );
}
