import { useContext } from 'react';
import { AuthContext } from '@/features/auth/AuthContext';
import { can, canAccessModule } from '@/utils/permissions';

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return {
    ...context,
    can: (action) => can(context.role, action),
    canAccess: (module) => canAccessModule(context.role, module),
  };
}
