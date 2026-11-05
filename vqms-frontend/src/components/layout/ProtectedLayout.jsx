import ProtectedRoute from '@/routes/ProtectedRoute';
import AppLayout from './AppLayout';

/** Signed-in area: authentication guard + application shell. */
export default function ProtectedLayout() {
  return (
    <ProtectedRoute>
      <AppLayout />
    </ProtectedRoute>
  );
}
