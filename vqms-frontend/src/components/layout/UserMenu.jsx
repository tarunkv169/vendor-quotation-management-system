import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronsUpDown, LogOut, User } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { ROLE_LABELS } from '@/utils/permissions';
import { cn } from '@/utils/cn';

export function Avatar({ name, solid = false, className }) {
  const initials = (name || '?').slice(0, 2).toUpperCase();
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-semibold',
        solid ? 'h-9 w-9 bg-sidebar text-xs text-sidebar-strong ring-1 ring-line' : 'h-8 w-8 border border-line bg-surface text-2xs text-slate-700',
        className,
      )}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

/**
 * Signed-in user with Profile / Sign out.
 * variant="sidebar": full-width row at the bottom of the sidebar, menu opens upwards (compact = avatar only).
 * variant="topbar": avatar button, menu opens downwards (used on small screens where the sidebar is hidden).
 */
export default function UserMenu({ variant = 'sidebar', compact = false }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const roleLabel = ROLE_LABELS[user?.role] || user?.role;

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (event) => {
      if (!ref.current?.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const sidebar = variant === 'sidebar';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'flex items-center gap-2.5 rounded-lg text-left transition-colors',
          sidebar ? 'w-full p-2 hover:bg-sidebar-hover' : 'py-1 pl-1 pr-2 hover:bg-slate-100',
          compact && 'justify-center',
        )}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={compact ? `Account: ${user?.username}` : undefined}
      >
        <Avatar name={user?.username} solid={!sidebar} />
        {sidebar && !compact && (
          <>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-13 font-medium text-slate-900">{user?.username}</span>
              <span className="block truncate text-xs text-slate-500">{roleLabel}</span>
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          </>
        )}
        {!sidebar && (
          <>
            <span className="hidden min-w-0 leading-tight sm:block">
              <span className="block max-w-36 truncate text-13 font-semibold text-slate-900">{user?.username}</span>
              <span className="block max-w-36 truncate text-xs text-slate-500">{roleLabel}</span>
            </span>
            <ChevronDown className="hidden h-4 w-4 shrink-0 text-slate-400 sm:block" aria-hidden="true" />
          </>
        )}
      </button>
      {open && (
        <div
          role="menu"
          className={cn(
            'absolute z-50 w-56 rounded-lg border border-line bg-surface py-1 shadow-lg',
            sidebar ? 'bottom-full left-0 mb-2' : 'right-0 top-full mt-2',
          )}
        >
          <div className="border-b border-line px-3 py-2.5">
            <p className="truncate text-13 font-medium text-slate-900">{user?.username}</p>
            <p className="text-xs text-slate-500">{roleLabel}</p>
          </div>
          <Link role="menuitem" to="/profile" onClick={() => setOpen(false)} className="mt-1 flex items-center gap-2.5 px-3 py-2 text-13 text-slate-700 hover:bg-slate-50">
            <User className="h-4 w-4 text-slate-400" aria-hidden="true" /> Profile
          </Link>
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              logout();
              navigate('/login', { replace: true });
            }}
            className="mb-1 flex w-full items-center gap-2.5 px-3 py-2 text-left text-13 text-slate-700 hover:bg-slate-50"
          >
            <LogOut className="h-4 w-4 text-slate-400" aria-hidden="true" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
