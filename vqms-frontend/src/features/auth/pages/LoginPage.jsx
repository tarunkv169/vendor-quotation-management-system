import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/hooks/useAuth';
import Input, { PasswordInput } from '@/components/common/Input';
import Button from '@/components/common/Button';
import Alert from '@/components/common/Alert';
import AuthLayout from '../components/AuthLayout';

// Mirrors LoginRequest (@NotBlank username, password).
const schema = z.object({
  username: z.string().trim().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState(null);
  const from = location.state?.from?.pathname || '/dashboard';

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { username: '', password: '' } });

  if (isAuthenticated) return <Navigate to={from} replace />;

  const onSubmit = async (values) => {
    setServerError(null);
    try {
      await login(values);
      navigate(from, { replace: true });
    } catch (error) {
      setServerError(error.status === 401 || error.status === 400 ? 'Invalid username or password.' : error.message);
    }
  };

  return (
    <AuthLayout
      title="Sign in to VQMS"
      description="Enter your username and password to continue."
      footer={
        <>
          <p>
            New employee or vendor?{' '}
            <Link to="/register" className="font-medium text-brand-700 hover:underline">
              Create an account
            </Link>
          </p>
          <p className="mt-1.5 text-xs text-slate-400">Forgotten your password? Contact your VQMS administrator.</p>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {serverError && <Alert tone="error">{serverError}</Alert>}
        <Input label="Username" autoComplete="username" autoFocus error={errors.username?.message} {...register('username')} />
        <PasswordInput label="Password" autoComplete="current-password" error={errors.password?.message} {...register('password')} />
        <Button type="submit" className="mt-2 w-full justify-center" loading={isSubmitting}>
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </AuthLayout>
  );
}
