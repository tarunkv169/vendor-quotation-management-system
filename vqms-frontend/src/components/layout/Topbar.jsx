import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, PanelLeft, Search, Settings } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import NotificationBell from '@/features/notifications/NotificationBell';
import Breadcrumbs from './Breadcrumbs';
import UserMenu from './UserMenu';
import ThemeToggle from './ThemeToggle';
import CommandPalette, { SHORTCUT_LABEL } from './CommandPalette';

const ICON_BUTTON =
  'relative h-9 w-9 items-center justify-center rounded-md border border-line bg-surface text-slate-600 transition-colors hover:border-line-strong hover:text-slate-900';

/** Top bar: breadcrumbs, global search (Ctrl+K), theme, notifications, settings and the signed-in user. */
export default function Topbar({ collapsed, onToggleSidebar, onOpenMobile }) {
  const { canAccess } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const onKey = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen((value) => !value);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-2 border-b border-line bg-surface/95 px-4 backdrop-blur-sm sm:px-6 lg:px-8">
      <button type="button" onClick={onOpenMobile} className="-ml-2 rounded-md p-2 text-slate-500 hover:bg-slate-100 lg:hidden" aria-label="Open navigation">
        <Menu className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={onToggleSidebar}
        className="-ml-2 hidden rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 lg:block"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-pressed={collapsed}
      >
        <PanelLeft className="h-4.5 w-4.5" />
      </button>
      <div className="min-w-0 flex-1">
        <Breadcrumbs />
      </div>

      <button
        type="button"
        onClick={() => setSearchOpen(true)}
        className="hidden h-9 w-64 items-center gap-2.5 rounded-md border border-line bg-field px-3 text-13 text-slate-400 transition-colors hover:border-line-strong md:flex xl:w-72"
        aria-label="Search"
        aria-keyshortcuts="Control+K Meta+K"
      >
        <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="flex-1 text-left">Search anything…</span>
        <kbd className="rounded border border-line px-1.5 py-0.5 font-sans text-2xs text-slate-500">{SHORTCUT_LABEL}</kbd>
      </button>

      <div className="flex items-center gap-2 md:ml-3">
        <button type="button" onClick={() => setSearchOpen(true)} className={`${ICON_BUTTON} flex md:hidden`} aria-label="Search">
          <Search className="h-4 w-4" aria-hidden="true" />
        </button>
        <ThemeToggle />
        <NotificationBell className={`${ICON_BUTTON} flex`} />
        {canAccess('settings') && (
          <Link to="/settings" className={`${ICON_BUTTON} hidden sm:flex`} aria-label="Settings">
            <Settings className="h-4 w-4" aria-hidden="true" />
          </Link>
        )}
        <div className="ml-1 border-l border-line pl-2 sm:pl-3">
          <UserMenu variant="topbar" />
        </div>
      </div>

      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  );
}
