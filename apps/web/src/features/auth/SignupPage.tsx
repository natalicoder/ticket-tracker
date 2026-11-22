import { zodResolver } from '@hookform/resolvers/zod';
import { SignupBody, type SignupInput } from '@ticketing/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { api, ApiError, errorMessage } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Field';
import { AuthLayout, FormError } from './AuthLayout';

export function SignupPage() {
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string>();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({ resolver: zodResolver(SignupBody), defaultValues: { email: '', password: '' } });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(undefined);
    try {
      const res = await api<{ email: string }>('/api/auth/signup', { method: 'POST', body: values });
      navigate(`/check-email?email=${encodeURIComponent(res.email)}`);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'EMAIL_TAKEN') {
        setError('email', { message: err.message });
      } else if (err instanceof ApiError && err.code === 'VALIDATION_ERROR') {
        for (const [path, message] of Object.entries(err.fieldErrors())) setError(path as keyof SignupInput, { message });
      } else {
        setFormError(errorMessage(err));
      }
    }
  });

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Track bugs, features and fixes on a shared board."
      footer={
        <>
          Already have an account?{' '}
          <Link className="font-medium text-accent" to="/login">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormError>{formError}</FormError>
        <Field label="Email" error={errors.email?.message}>
          <Input type="email" autoComplete="email" autoFocus placeholder="you@company.com" {...register('email')} />
        </Field>
        <Field label="Password" error={errors.password?.message} hint="At least 8 characters.">
          <Input type="password" autoComplete="new-password" {...register('password')} />
        </Field>
        <Button type="submit" variant="primary" loading={isSubmitting} className="mt-1 w-full justify-center">
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}
