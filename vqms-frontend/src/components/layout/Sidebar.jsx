import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { NAV_SECTIONS } from '@/routes/navigation';
import { notificationKeys, notificationService } from '@/features/notifications/notificationService';
import { approvalKeys, approvalService } from '@/features/approval/approvalService';
import { cn } from '@/utils/cn';
import { APP_NAME } from '@/utils/constants';

function Logo({ collapsed }) {
  return (
    <div className={cn('flex h-16 shrink-0 items-center gap-2.5', collapsed ? 'justify-center' : 'px-5')}>
      <img src="/favicon.svg" alt="" className="h-7 w-7 shrink-0" />
      {!collapsed && (
        <div className="min-w-0 leading-tight">
          <p className="text-[15px] font-semibold tracking-tight text-sidebar-strong">{APP_NAME}</p>
          <p className="truncate text-2xs text-sidebar-muted">Vendor Quotation Management</p>
        </div>
      )}
    </div>
  );
}

/**
 * Live counts shown next to nav items. Both use the same query keys as the pages and the topbar,
 * so React Query fetches each only once.
 */
function useNavCounts() {
  const { canAccess } = useAuth();
  const unread = useQuery({
    queryKey: notificationKeys.unread,
    queryFn: ({ signal }) => notificationService.unreadCount(signal),
    refetchInterval: 60_000,
    meta: { silent: true },
  });
  const pending = useQuery({
    queryKey: approvalKeys.pending,
    queryFn: ({ signal }) => approvalService.pending(signal),
    enabled: canAccess('approvals'),
    refetchInterval: 120_000,
    meta: { silent: true },
  });
  return { unread: unread.data?.unread ?? 0, pendingApprovals: pending.data?.length ?? 0 };
}

/** Permission-aware navigation. Desktop: fixed, collapsible (icon rail with tooltips). Mobile: off-canvas drawer. */
export default function Sidebar({ collapsed, mobileOpen, onCloseMobile }) {
  const { canAccess } = useAuth();
  const counts = useNavCounts();

  const sections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => canAccess(item.module)),
  })).filter((section) => section.items.length > 0);

  const nav = (isMobile) => {
    const rail = collapsed && !isMobile;
    return (
      <nav aria-label="Main navigation" className={cn('flex-1 pb-4 pt-2', rail ? 'overflow-visible px-2.5' : 'overflow-y-auto px-3')}>
        {sections.map((section, sectionIndex) => (
          <div key={section.label} className={cn(sectionIndex > 0 && (rail ? 'mt-3 border-t border-sidebar-line pt-3' : 'mt-6'))}>
            {!rail && <p className="mb-1.5 px-3 text-2xs font-semibold uppercase tracking-[0.08em] text-sidebar-muted">{section.label}</p>}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const count = item.badge === 'unread' ? counts.unread : item.badge === 'pendingApprovals' ? counts.pendingApprovals : 0;
                return (
                  <li key={item.to} className="group/nav relative">
                    <NavLink
                      to={item.to}
                      onClick={isMobile ? onCloseMobile : undefined}
                      aria-label={rail ? `${item.label}${count ? `, ${count}` : ''}` : undefined}
                      className={({ isActive }) =>
                        cn(
                          'relative flex h-10 items-center gap-3 rounded-md text-13 transition-colors',
                          rail ? 'justify-center' : 'px-3',
                          isActive
                            ? 'bg-brand-600 font-medium text-white shadow-sm'
                            : 'text-sidebar-text hover:bg-sidebar-hover hover:text-sidebar-strong',
                        )
                      }
                    >
                      <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
                      {!rail && <span className="flex-1 truncate">{item.label}</span>}
                      {count > 0 &&
                        (rail ? (
                          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-brand-500" aria-hidden="true" />
                        ) : (
                          <span className="num rounded-md bg-white/10 px-1.5 text-2xs font-medium text-sidebar-strong">{count > 99 ? '99+' : count}</span>
                        ))}
                    </NavLink>
                    {rail && (
                      <span
                        role="tooltip"
                        className="pointer-events-none absolute left-full top-1/2 z-50 ml-2.5 -translate-y-1/2 whitespace-nowrap rounded-md bg-[#111111] px-2 py-1 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover/nav:opacity-100 group-focus-within/nav:opacity-100"
                      >
                        {item.label}
                        {count > 0 && ` · ${count}`}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    );
  };

  return (
    <>
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden flex-col bg-sidebar transition-[width] duration-200 lg:flex',
          collapsed ? 'w-[72px]' : 'w-64',
        )}
      >
        <div className="border-b border-sidebar-line">
          <Logo collapsed={collapsed} />
        </div>
        {nav(false)}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={onCloseMobile} aria-hidden="true" />
          <aside className="relative flex h-full w-72 max-w-[85vw] flex-col bg-sidebar shadow-xl">
            <div className="flex items-center justify-between pr-3">
              <Logo collapsed={false} />
              <button type="button" onClick={onCloseMobile} className="rounded-md p-2 text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-strong" aria-label="Close navigation">
                <X className="h-5 w-5" />
              </button>
            </div>
            {nav(true)}
          </aside>
        </div>
      )}
    </>
  );
}
