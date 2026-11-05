import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import Input, { PasswordInput } from '@/components/common/Input';
import Select from '@/components/common/Select';
import Button from '@/components/common/Button';
import Alert from '@/components/common/Alert';
import { applyFieldErrors } from '@/utils/errors';
import { ROLE_LABELS, SELF_REGISTER_ROLES } from '@/utils/permissions';
import AuthLayout from '../components/AuthLayout';

// Mirrors RegisterRequest validation.
const schema = z
  .object({
    fullName: z.string().trim().min(1, 'Full name is required').max(150, 'Full name cannot exceed 150 characters'),
    username: z.string().trim().min(3, 'Username must be between 3 and 100 characters').max(100, 'Username must be between 3 and 100 characters'),
    email: z.string().trim().min(1, 'Email is required').email('Email must be valid'),
    password: z.string().min(6, 'Password must be at least 6 characters').max(100),
    confirmPassword: z.string(),
    role: z.enum(SELF_REGISTER_ROLES),
  })
  .refine((values) => values.password === values.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' });

export default function RegisterPage() {
  const { register: registerAccount, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { fullName: '', username: '', email: '', password: '', confirmPassword: '', role: 'EMPLOYEE' },
  });

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  const onSubmit = async ({ confirmPassword: _confirm, ...payload }) => {
    setServerError(null);
    try {
      await registerAccount(payload);
      toast.success('Account created');
      navigate('/dashboard', { replace: true });
    } catch (error) {
      if (!applyFieldErrors(error, setError)) setServerError(error.message);
    }
  };

  return (
    <AuthLayout
      title="Create account"
      description="Employees raise procurement requests; vendors submit quotations."
      footer={
        <>
          Already registered?{' '}
          <Link to="/login" className="font-medium text-brand-700 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {serverError && <Alert tone="error">{serverError}</Alert>}
        <Input label="Full name" autoComplete="name" required error={errors.fullName?.message} {...register('fullName')} />
        <Input label="Username" autoComplete="username" required error={errors.username?.message} {...register('username')} />
        <Input label="Email" type="email" autoComplete="email" required error={errors.email?.message} {...register('email')} />
        <Select
          label="Account type"
          required
          options={SELF_REGISTER_ROLES.map((role) => ({ value: role, label: ROLE_LABELS[role] }))}
          error={errors.role?.message}
          {...register('role')}
        />
        <PasswordInput label="Password" autoComplete="new-password" required hint="At least 6 characters." error={errors.password?.message} {...register('password')} />
        <PasswordInput
          label="Confirm password"
          autoComplete="new-password"
          required
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />
        <Button type="submit" className="mt-2 w-full justify-center" loading={isSubmitting}>
          {isSubmitting ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </AuthLayout>
  );
}
