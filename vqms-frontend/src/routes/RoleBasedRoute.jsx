import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

/** Allows the nested routes only for roles in MODULE_ACCESS[module] (or ACTION_ACCESS[action]). */
export default function RoleBasedRoute({ module, action, children }) {
  const { canAccess, can } = useAuth();
  const allowed = (module ? canAccess(module) : true) && (action ? can(action) : true);
  if (!allowed) return <Navigate to="/access-denied" replace />;
  return children || <Outlet />;
}
