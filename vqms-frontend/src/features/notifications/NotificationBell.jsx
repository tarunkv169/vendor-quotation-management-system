import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Bell } from 'lucide-react';
import Skeleton from '@/components/common/Skeleton';
import { cn } from '@/utils/cn';
import { formatRelative } from '@/utils/formatDate';
import { notificationKeys, notificationService } from './notificationService';
import { iconFor, notificationLink } from './notificationLinks';

const POLL_MS = 30_000;
const PREVIEW = { unreadOnly: false, page: 0, size: 8 };

/**
 * Bell in the top bar: unread badge (polled every 30 s and on window focus), a dropdown with the
 * latest notifications, and a toast when something new arrives while the app is open.
 */
export default function NotificationBell({ className }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const lastUnread = useRef(null);

  const unreadQuery = useQuery({
    queryKey: notificationKeys.unread,
    queryFn: ({ signal }) => notificationService.unreadCount(signal),
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    meta: { silent: true },
  });
  const unread = unreadQuery.data?.unread ?? 0;

  const list = useQuery({
    queryKey: notificationKeys.list(PREVIEW),
    queryFn: ({ signal }) => notificationService.my(PREVIEW, signal),
    enabled: open,
    meta: { silent: true },
  });
  const items = list.data?.content || [];

  const refresh = () => queryClient.invalidateQueries({ queryKey: notificationKeys.all });
  const markRead = useMutation({ mutationFn: (id) => notificationService.markRead(id), onSuccess: refresh, meta: { silent: true } });
  const markAll = useMutation({ mutationFn: () => notificationService.markAllRead(), onSuccess: refresh });

  const openNotification = (notification) => {
    if (!notification.read) markRead.mutate(notification.id);
    setOpen(false);
    navigate(notificationLink(notification) || '/notifications');
  };

  // New notifications since the last poll: refresh lists and show the newest one as a toast.
  useEffect(() => {
    if (unreadQuery.data == null) return;
    const previous = lastUnread.current;
    lastUnread.current = unread;
    if (previous == null || unread <= previous) return;
    refresh();
    notificationService
      .my({ unreadOnly: true, page: 0, size: 1 })
      .then((page) => {
        const latest = page?.content?.[0];
        if (!latest) return;
        const more = unread - previous - 1;
        toast(latest.title, {
          description: more > 0 ? `${latest.message} (+${more} more)` : latest.message,
          action: { label: 'Open', onClick: () => openNotification(latest) },
        });
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadQuery.data]);

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (event) => !ref.current?.contains(event.target) && setOpen(false);
    const onKey = (event) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={className}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        {unread > 0 && (
          <span className="num absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white ring-2 ring-workspace">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div role="dialog" aria-label="Notifications" className="absolute right-0 top-10 z-40 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-md border border-line bg-surface shadow-lg">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <p className="text-13 font-semibold text-slate-900">
              Notifications{unread > 0 && <span className="ml-1.5 font-normal text-slate-500">{unread} unread</span>}
            </p>
            <button
              type="button"
              onClick={() => markAll.mutate()}
              disabled={unread === 0 || markAll.isPending}
              className="text-xs font-medium text-brand-700 hover:underline disabled:cursor-default disabled:text-slate-400 disabled:no-underline"
            >
              Mark all read
            </button>
          </div>

          <div className="max-h-[26rem] overflow-y-auto">
            {list.isLoading ? (
              <div className="space-y-3 p-4" aria-hidden="true">
                {[0, 1, 2].map((key) => (
                  <div key={key} className="space-y-1.5">
                    <Skeleton className="h-3.5 w-2/3" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                ))}
              </div>
            ) : list.error ? (
              <p className="px-4 py-8 text-center text-13 text-slate-500">Could not load notifications.</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-8 text-center text-13 text-slate-500">No notifications yet</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {items.map((notification) => {
                  const Icon = iconFor(notification);
                  return (
                    <li key={notification.id}>
                      <button type="button" onClick={() => openNotification(notification)} className="flex w-full gap-3 px-4 py-2.5 text-left hover:bg-slate-50">
                        <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', notification.read ? 'text-slate-400' : 'text-brand-600')} aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-2">
                            <span className={cn('truncate text-13', notification.read ? 'text-slate-700' : 'font-semibold text-slate-900')}>{notification.title}</span>
                            <span className="num shrink-0 text-2xs text-slate-400">{formatRelative(notification.createdAt)}</span>
                          </span>
                          <span className="mt-0.5 line-clamp-2 block text-xs text-slate-500">{notification.message}</span>
                        </span>
                        {!notification.read && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600" aria-label="Unread" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <Link to="/notifications" onClick={() => setOpen(false)} className="block border-t border-line px-4 py-2 text-center text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900">
            View all notifications
          </Link>
        </div>
      )}
    </div>
  );
}
