import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, Mail } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format, isToday, isValid, isYesterday, parseISO } from 'date-fns';
import { usePagination } from '@/hooks/usePagination';
import PageHeader from '@/components/common/PageHeader';
import SummaryPanel from '@/components/common/SummaryPanel';
import Button from '@/components/common/Button';
import Tabs from '@/components/common/Tabs';
import Pagination from '@/components/common/Pagination';
import Modal from '@/components/common/Modal';
import StatusBadge from '@/components/common/StatusBadge';
import Skeleton from '@/components/common/Skeleton';
import EmptyState, { ErrorState } from '@/components/common/EmptyState';
import DetailList from '@/components/common/DetailList';
import { cn } from '@/utils/cn';
import { normalizePage } from '@/utils/pagination';
import { formatDateTime, formatRelative } from '@/utils/formatDate';
import { humanize } from '@/utils/constants';
import { notificationKeys, notificationService } from '../notificationService';
import { iconFor, notificationLink } from '../notificationLinks';

/** Groups notifications (already newest first) under Today / Yesterday / dated headings. */
function groupByDay(items) {
  const groups = [];
  items.forEach((notification) => {
    const date = notification.createdAt ? parseISO(notification.createdAt) : null;
    const label = !date || !isValid(date) ? 'Earlier' : isToday(date) ? 'Today' : isYesterday(date) ? 'Yesterday' : format(date, 'EEEE, d MMMM yyyy');
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(notification);
    else groups.push({ label, items: [notification] });
  });
  return groups;
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [view, setView] = useState('all');
  const [selected, setSelected] = useState(null);
  const pager = usePagination({ size: 20 });

  const params = { unreadOnly: view === 'unread', page: pager.page, size: pager.size };
  const query = useQuery({ queryKey: notificationKeys.list(params), queryFn: ({ signal }) => notificationService.my(params, signal), placeholderData: keepPreviousData, });
  const page = normalizePage(query.data);
  const unreadCount = useQuery({
    queryKey: notificationKeys.unread,
    queryFn: ({ signal }) => notificationService.unreadCount(signal),
    meta: { silent: true },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: notificationKeys.all });
  const markRead = useMutation({ mutationFn: (id) => notificationService.markRead(id), onSuccess: refresh });
  const markAll = useMutation({
    mutationFn: () => notificationService.markAllRead(),
    onSuccess: (result) => {
      refresh();
      return result;
    },
    meta: { successMessage: 'All notifications marked as read' },
  });

  // Opens the record the notification is about; notifications without one open in a dialog.
  const open = (notification) => {
    if (!notification.read) markRead.mutate(notification.id);
    const link = notificationLink(notification);
    if (link) navigate(link);
    else setSelected(notification);
  };

  const unreadTotal = unreadCount.data?.unread ?? 0;
  const groups = groupByDay(page.items);

  return (
    <>
      <PageHeader
        title="Notifications"
        actions={
          <Button variant="secondary" icon={CheckCheck} onClick={() => markAll.mutate()} loading={markAll.isPending} disabled={unreadTotal === 0}>
            Mark all as read
          </Button>
        }
      />

      <Tabs
        variant="pill"
        label="Notification views"
        value={view}
        onChange={(next) => {
          setView(next);
          pager.reset();
        }}
        tabs={[
          { value: 'all', label: 'All' },
          { value: 'unread', label: 'Unread', count: unreadCount.data ? unreadTotal : undefined },
        ]}
      />

      <div className="mt-5">
        {query.isLoading ? (
          <div className="card divide-y divide-slate-100" aria-hidden="true">
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="flex gap-3.5 px-5 py-4">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : query.error ? (
          <div className="card">
            <ErrorState error={query.error} onRetry={query.refetch} />
          </div>
        ) : page.items.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={Bell}
              title={view === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            />
          </div>
        ) : (
          <div className="space-y-5">
            {groups.map((group) => (
              <SummaryPanel key={group.label} title={group.label} action={<span className="num text-slate-500">{group.items.length}</span>} bodyClassName="p-0">
                <ul className="divide-y divide-slate-100">
                  {group.items.map((notification) => {
                    const Icon = iconFor(notification);
                    return (
                      <li key={notification.id} className="group relative flex items-start gap-3.5 px-4 py-3.5 first:rounded-t-lg last:rounded-b-lg hover:bg-slate-50">
                        <span className={cn('mt-3 h-1.5 w-1.5 shrink-0 rounded-full', notification.read ? 'bg-transparent' : 'bg-brand-600')} aria-hidden="true" />
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-slate-500">
                          <Icon className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <button type="button" onClick={() => open(notification)} className="min-w-0 flex-1 text-left after:absolute after:inset-0 after:content-['']">
                          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className={cn('text-13', notification.read ? 'text-slate-700' : 'font-semibold text-slate-900')}>{notification.title}</span>
                            {notification.priority === 'HIGH' && <StatusBadge status="HIGH" label="High priority" />}
                            {!notification.read && <span className="sr-only">(unread)</span>}
                          </span>
                          <span className="mt-0.5 line-clamp-2 block text-13 text-slate-500">{notification.message}</span>
                          <span className="mt-1 block text-xs text-slate-400">
                            {humanize(notification.category)}
                            {notification.referenceType && ` · ${humanize(notification.referenceType)}`}
                          </span>
                        </button>
                        <div className="relative z-10 flex shrink-0 flex-col items-end gap-1.5">
                          <span className="num whitespace-nowrap text-xs text-slate-400" title={formatDateTime(notification.createdAt)}>
                            {formatRelative(notification.createdAt)}
                          </span>
                          {!notification.read && (
                            <button
                              type="button"
                              onClick={() => markRead.mutate(notification.id)}
                              disabled={markRead.isPending}
                              className="rounded-md px-1.5 py-0.5 text-xs font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50"
                            >
                              Mark as read
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </SummaryPanel>
            ))}
            <div className="card overflow-hidden empty:hidden">
              <Pagination {...page} onPageChange={pager.setPage} onSizeChange={pager.setSize} disabled={query.isFetching} />
            </div>
          </div>
        )}
      </div>

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.title}
      >
        {selected && (
          <div className="space-y-4">
            <p className="whitespace-pre-line text-sm text-slate-700">{selected.message}</p>
            <DetailList
              columns={2}
              items={[
                { label: 'Category', value: humanize(selected.category) },
                { label: 'Priority', value: humanize(selected.priority) },
                { label: 'Received', value: formatDateTime(selected.createdAt) },
                {
                  label: 'Email delivery',
                  value: (
                    <span className="inline-flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                      <StatusBadge status={selected.emailStatus} />
                    </span>
                  ),
                },
              ]}
            />
          </div>
        )}
      </Modal>
    </>
  );
}
