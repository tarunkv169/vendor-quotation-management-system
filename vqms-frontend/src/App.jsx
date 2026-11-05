import { BrowserRouter } from 'react-router-dom';
import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster, toast } from 'sonner';
import { AuthProvider } from '@/features/auth/AuthContext';
import AppRoutes from '@/routes/AppRoutes';
import { useTheme } from '@/utils/theme';

// Server state: deduplicated, cached and cancellable requests.
// - Client errors (4xx) are not retried; transient errors are retried once.
// - Every failed mutation shows a toast unless it sets meta: { silent: true } (forms show inline errors).
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => failureCount < 1 && (error?.status === 0 || error?.status >= 500),
    },
    mutations: { retry: false },
  },
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (mutation.meta?.silent || error?.status === 401) return;
      toast.error(error?.message || 'The operation failed.');
    },
    onSuccess: (_data, _variables, _context, mutation) => {
      if (mutation.meta?.successMessage) toast.success(mutation.meta.successMessage);
    },
  }),
});

export default function App() {
  const { theme } = useTheme();
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
      <Toaster position="top-right" theme={theme} richColors closeButton />
    </QueryClientProvider>
  );
}
