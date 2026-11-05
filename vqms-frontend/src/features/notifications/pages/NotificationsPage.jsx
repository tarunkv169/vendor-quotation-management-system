import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDownUp, Bell, CalendarDays, CalendarRange, Check, CheckCheck, CircleCheck, ExternalLink, Eye, Info, Layers, ListFilter, Mail, MailOpen, MonitorSmartphone, RefreshCw, Settings } from 'lucide-react';
import { format, isToday, isValid, isYesterday, parseISO, startOfDay, startOfWeek, subDays } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { useDebounce } from '@/hooks/useDebounce';
import { usePagination } from '@/hooks/usePagination';
import Button from '@/components/common/Button';
import Pagination from '@/components/common/Pagination';
import SearchInput from '@/components/common/SearchInput';
import Select from '@/components/common/Select';
import StatusBadge from '@/components/common/StatusBadge';
import Tabs from '@/components/common/Tabs';
import KpiCard from '@/components/common/KpiCard';
import ActionMenu from '@/components/common/ActionMenu';
import Modal from '@/components/common/Modal';
import DetailList from '@/components/common/DetailList';
import Skeleton from '@/components/common/Skeleton';
import EmptyState, { ErrorState } from '@/components/common/EmptyState';
import { cn } from '@/utils/cn';
import { normalizePage } from '@/utils/pagination';
import { formatDateTime } from '@/utils/formatDate';
import { formatNumber } from '@/utils/formatCurrency';
import { humanize } from '@/utils/constants';
import { notificationKeys, notificationService } from '../notificationService';
import {
  ACTION_CATEGORIES,
  CATEGORY_GROUPS,
  groupConfig,
  groupOf,
  iconFor,
  needsAction,
  notificationLink,
  popupGroupEnabled,
  popupsEnabled,
  setPopupGroupEnabled,
  setPopupsEnabled,
  toneFor,
} from '../notificationLinks';

// GET /notifications/my is paged (max 100 per page) without search or filters, so the page loads the
// user's notifications once and searches, filters, counts and pages them in the browser.
const PAGE_SIZE = 100;
const MAX_PAGES = 20;

async function loadAllNotifications(signal) {
  let rows = [];
  for (let index = 0; index < MAX_PAGES; index += 1) {
    const result = normalizePage(await notificationService.my({ page: index, size: PAGE_SIZE }, signal));
    rows = rows.concat(result.items);
    if (index + 1 >= result.totalPages) break;
  }
  return rows;
}

const DATE_RANGES = [
  { value: '', label: 'All dates' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week', label: 'This week' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
];

function parse(value) {
  const date = value ? parseISO(value) : null;
  return date && isValid(date) ? date : null;
}

const weekStart = () => startOfWeek(new Date(), { weekStartsOn: 1 });

function inRange(notification, range) {
  if (!range) return true;
  const date = parse(notification.createdAt);
  if (!date) return false;
  if (range === 'today') return isToday(date);
  if (range === 'yesterday') return isYesterday(date);
  if (range === 'week') return date >= weekStart();
  return date >= startOfDay(subDays(new Date(), Number(range)));
}

/** Today / Yesterday / Earlier section of a notification. */
function sectionOf(notification) {
  const date = parse(notification.createdAt);
  if (date && isToday(date)) return 'Today';
  if (date && isYesterday(date)) return 'Yesterday';
  return 'Earlier';
}

/** "11:59 AM" today and yesterday, "03 Nov 2026, 09:00 AM" before that. */
function when(value) {
  const date = parse(value);
  if (!date) return '—';
  const time = format(date, 'hh:mm a');
  return isToday(date) || isYesterday(date) ? time : `${format(date, 'dd MMM yyyy')}, ${time}`;
}

/** Short, readable reference: "Approval · 1A2B3C4D". */
function referenceLabel(notification) {
  if (!notification.referenceType) return null;
  const type = humanize(notification.referenceType);
  return notification.referenceId ? `${type} · ${String(notification.referenceId).slice(0, 8).toUpperCase()}` : type;
}

function Toggle({ checked, onChange, label, description, disabled }) {
  return (
    <label className={cn('flex items-start justify-between gap-6 py-4', disabled ? 'cursor-not-allowed' : 'cursor-pointer')}>
      <span>
        <span className={cn('block text-13 font-medium', disabled && !checked ? 'text-slate-500' : 'text-slate-900')}>{label}</span>
        {description && <span className="mt-0.5 block text-xs text-slate-500">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn('relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-60', checked ? 'bg-brand-600' : 'bg-slate-300')}
      >
        <span className={cn('inline-block h-4 w-4 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-4.5' : 'translate-x-0.5')} />
      </button>
    </label>
  );
}

/** Groups to list: every backend-backed group, plus comparison / recommendation groups only when such notifications exist. */
function visibleGroups(notifications) {
  const present = new Set(notifications.map(groupOf));
  return CATEGORY_GROUPS.filter((group) => (group.optional || group.key === 'system' ? present.has(group.key) : true));
}

/**
 * Preferences: what exists today — in-app delivery (always on), this browser's pop-ups (overall and per
 * category) and e-mail as configured on the server. The backend has no per-user notification settings.
 */
function PreferencesPanel({ notifications }) {
  const { user } = useAuth();
  const [popups, setPopups] = useState(popupsEnabled);
  const groups = visibleGroups(notifications);
  const [groupState, setGroupState] = useState(() => Object.fromEntries(CATEGORY_GROUPS.map((group) => [group.key, popupGroupEnabled(group.key)])));
  const email = notifications.reduce((map, notification) => {
    map[notification.emailStatus] = (map[notification.emailStatus] || 0) + 1;
    return map;
  }, {});
  const emailUsed = (email.SENT || 0) + (email.PENDING || 0) + (email.FAILED || 0) > 0;
  const received = Object.entries(
    notifications.reduce((map, notification) => {
      map[notification.category] = (map[notification.category] || 0) + 1;
      return map;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);

  return (
    <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-2">
      <section className="rounded-md border border-line">
        <header className="flex items-center gap-2.5 border-b border-line px-4 py-3">
          <MonitorSmartphone className="h-4 w-4 text-slate-400" aria-hidden="true" />
          <h2 className="text-13 font-semibold text-slate-900">In this browser</h2>
        </header>
        <div className="divide-y divide-slate-100 px-4">
          <Toggle label="In-app notifications" description="Always on. Every notification addressed to you or your role appears here and in the bell." checked disabled onChange={() => {}} />
          <Toggle
            label="Pop-up for new notifications"
            description="Shows a short message with an Open button when something new arrives while VQMS is open. Saved in this browser only."
            checked={popups}
            onChange={(value) => {
              setPopups(value);
              setPopupsEnabled(value);
            }}
          />
        </div>
      </section>

      <section className="rounded-md border border-line">
        <header className="flex items-center gap-2.5 border-b border-line px-4 py-3">
          <ListFilter className="h-4 w-4 text-slate-400" aria-hidden="true" />
          <h2 className="text-13 font-semibold text-slate-900">Pop-ups by category</h2>
        </header>
        <div className="divide-y divide-slate-100 px-4">
          {groups.map((group) => (
            <Toggle
              key={group.key}
              label={`${group.label} updates`}
              description={popups ? undefined : 'Turn on pop-ups to choose categories.'}
              checked={popups && groupState[group.key]}
              disabled={!popups}
              onChange={(value) => {
                setGroupState((current) => ({ ...current, [group.key]: value }));
                setPopupGroupEnabled(group.key, value);
              }}
            />
          ))}
          <p className="py-3 text-xs text-slate-500">These switches only control pop-ups in this browser. Notifications are still delivered and listed here.</p>
        </div>
      </section>

      <section className="rounded-md border border-line">
        <header className="flex items-center gap-2.5 border-b border-line px-4 py-3">
          <Mail className="h-4 w-4 text-slate-400" aria-hidden="true" />
          <h2 className="text-13 font-semibold text-slate-900">E-mail</h2>
        </header>
        <div className="space-y-3 px-4 py-4 text-13 text-slate-600">
          <p>
            E-mail delivery is configured by your administrator on the server; there are no per-user e-mail settings.
            {emailUsed ? ' Your recent notifications were e-mailed as follows:' : ' None of your notifications requested an e-mail so far.'}
          </p>
          {emailUsed && (
            <dl className="grid grid-cols-3 gap-3">
              {['SENT', 'PENDING', 'FAILED'].map((status) => (
                <div key={status} className="rounded-md bg-canvas px-3 py-2">
                  <dt className="text-xs text-slate-500">{humanize(status)}</dt>
                  <dd className="num text-base font-semibold text-slate-900">{formatNumber(email[status] || 0)}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </section>

      <section className="rounded-md border border-line">
        <header className="flex items-center justify-between gap-2.5 border-b border-line px-4 py-3">
          <span className="flex items-center gap-2.5">
            <Info className="h-4 w-4 text-slate-400" aria-hidden="true" />
            <h2 className="text-13 font-semibold text-slate-900">What you receive</h2>
          </span>
          <span className="text-xs text-slate-500">Signed in as {user?.username}</span>
        </header>
        {received.length === 0 ? (
          <p className="px-4 py-6 text-center text-13 text-slate-500">No notifications received yet.</p>
        ) : (
          <ul className="grid gap-x-6 px-4 py-2 sm:grid-cols-2">
            {received.map(([category, count]) => {
              const Icon = iconFor({ category });
              return (
                <li key={category} className="flex items-center justify-between gap-3 border-b border-slate-100 py-2.5 text-13 last:border-0">
                  <span className="flex items-center gap-2.5 text-slate-700">
                    <span className={cn('flex h-7 w-7 items-center justify-center rounded-md', toneFor({ category }))}>
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                    {humanize(category)}
                    {ACTION_CATEGORIES.includes(category) && <span className="rounded bg-amber-50 px-1.5 text-2xs font-medium text-warning">action</span>}
                  </span>
                  <span className="num font-medium text-slate-900">{formatNumber(count)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Inbox-with-bell illustration for the "all caught up" state (colours follow the theme tokens). */
function CaughtUpIllustration() {
  return (
    <svg viewBox="0 0 240 170" className="h-36 w-auto" aria-hidden="true">
      <ellipse cx="120" cy="92" rx="96" ry="66" className="fill-brand-50" />
      <rect x="78" y="44" width="80" height="70" rx="6" className="fill-surface stroke-line-strong" strokeWidth="1.5" />
      <rect x="90" y="58" width="44" height="5" rx="2.5" className="fill-brand-200" />
      <rect x="90" y="70" width="56" height="5" rx="2.5" className="fill-line-strong" />
      <rect x="90" y="82" width="38" height="5" rx="2.5" className="fill-line-strong" />
      <path d="M62 104 L78 84 H162 L178 104 V136 a6 6 0 0 1 -6 6 H68 a6 6 0 0 1 -6 -6 Z" className="fill-brand-500" opacity="0.85" />
      <path d="M62 104 H98 a22 10 0 0 0 44 0 H178 V136 a6 6 0 0 1 -6 6 H68 a6 6 0 0 1 -6 -6 Z" className="fill-brand-600" />
      <circle cx="166" cy="48" r="17" className="fill-brand-600" />
      <path d="M160 52 v-5 a6 6 0 0 1 12 0 v5 l2 2 h-16 Z M164 56 a2 2 0 0 0 4 0" className="fill-white" />
      <path d="M186 22 l-4 7 M196 32 l-7 3 M178 16 v7" className="stroke-brand-500" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawView = searchParams.get('view') || 'all';
  // ?view=action (older links) is now the "Action required" read filter on the All tab.
  const view = rawView === 'action' ? 'all' : rawView;
  const [group, setGroup] = useState('');
  const [state, setState] = useState(rawView === 'action' ? 'action' : '');
  const [range, setRange] = useState('');
  const [sort, setSort] = useState('newest');
  const [keyword, setKeyword] = useState('');
  const debounced = useDebounce(keyword.trim().toLowerCase(), 250);
  const pager = usePagination({ size: 20 });
  const [selected, setSelected] = useState(null);

  const query = useQuery({ queryKey: notificationKeys.list({ scope: 'all' }), queryFn: ({ signal }) => loadAllNotifications(signal) });
  const all = useMemo(() => query.data || [], [query.data]);

  const changeView = (next) => {
    setSearchParams(next === 'all' ? {} : { view: next }, { replace: true });
    pager.reset();
  };

  const refresh = () => queryClient.invalidateQueries({ queryKey: notificationKeys.all });
  const markRead = useMutation({ mutationFn: (id) => notificationService.markRead(id), onSuccess: refresh, meta: { silent: true } });
  const markAll = useMutation({ mutationFn: () => notificationService.markAllRead(), onSuccess: refresh, meta: { successMessage: 'All notifications marked as read' } });

  const unreadCount = all.filter((notification) => !notification.read).length;
  const weekCount = all.filter((notification) => inRange(notification, 'week')).length;
  const figure = (value) => ({ isLoading: query.isLoading, error: query.error, data: value });

  const filtered = useMemo(() => {
    const rows = all.filter(
      (notification) =>
        (view !== 'unread' || !notification.read) &&
        (!group || groupOf(notification) === group) &&
        (!state || (state === 'action' ? needsAction(notification) : state === 'unread' ? !notification.read : notification.read)) &&
        inRange(notification, range) &&
        (!debounced ||
          [notification.title, notification.message, humanize(notification.category), groupConfig(groupOf(notification)).label, notification.referenceId].some((value) =>
            value?.toLowerCase().includes(debounced),
          )),
    );
    const factor = sort === 'oldest' ? 1 : -1;
    return [...rows].sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')) * factor);
  }, [all, view, group, state, range, sort, debounced]);
  const pageRows = filtered.slice(pager.page * pager.size, (pager.page + 1) * pager.size);
  const sections = pageRows.reduce((list, notification) => {
    const name = sectionOf(notification);
    const last = list[list.length - 1];
    if (last?.name === name) last.rows.push(notification);
    else list.push({ name, rows: [notification] });
    return list;
  }, []);
  const groups = visibleGroups(all);
  const groupCount = (key) => all.filter((notification) => groupOf(notification) === key).length;

  const openNotification = (notification) => {
    if (!notification.read) markRead.mutate(notification.id);
    const link = notificationLink(notification);
    if (link) navigate(link);
    else setSelected(notification);
  };

  const menuItems = (notification) => {
    const link = notificationLink(notification);
    return [
      ...(link ? [{ key: 'open', label: `Open ${humanize(notification.referenceType).toLowerCase()}`, icon: ExternalLink, onClick: () => openNotification(notification) }] : []),
      ...(!notification.read ? [{ key: 'read', label: 'Mark as read', icon: Check, onClick: () => markRead.mutate(notification.id) }] : []),
      {
        key: 'details',
        label: 'View details',
        icon: Eye,
        onClick: () => {
          if (!notification.read) markRead.mutate(notification.id);
          setSelected(notification);
        },
      },
    ];
  };

  const filteredView = Boolean(keyword || group || state || range);
  const clearFilters = () => {
    setKeyword('');
    setGroup('');
    setState('');
    setRange('');
    pager.reset();
  };
  const filter = (setter) => (event) => {
    setter(event.target.value);
    pager.reset();
  };

  const tabs = [
    { value: 'all', label: 'All', count: query.data ? all.length : undefined },
    { value: 'unread', label: 'Unread', count: query.data ? unreadCount : undefined },
    { value: 'preferences', label: 'Preferences', icon: Settings },
  ];

  const caughtUp = !filteredView && (all.length === 0 || (view === 'unread' && unreadCount === 0));

  const renderItem = (notification) => {
    const action = needsAction(notification);
    const link = notificationLink(notification);
    const config = groupConfig(groupOf(notification));
    // General (SYSTEM) notifications about a comparison or recommendation take that group's icon.
    const generic = notification.category === 'SYSTEM' && config.key !== 'system';
    const Icon = generic ? config.icon : iconFor(notification);
    const reference = referenceLabel(notification);
    return (
      <li
        key={notification.id}
        className={cn(
          'group relative flex items-start gap-3 rounded-md border px-3 py-3.5 transition-colors sm:gap-4 sm:px-4',
          notification.read ? 'border-line bg-surface hover:border-line-strong hover:bg-slate-50' : 'border-brand-100 bg-brand-50/50 hover:bg-brand-50/80',
        )}
      >
        <span className={cn('mt-4 h-2 w-2 shrink-0 rounded-full', notification.read ? 'bg-transparent' : 'bg-brand-600')} aria-hidden="true" />
        <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-md', generic ? config.tone : toneFor(notification))}>
          <Icon className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
        </span>
        <button type="button" onClick={() => openNotification(notification)} className="min-w-0 flex-1 text-left after:absolute after:inset-0 after:content-['']">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={cn('text-sm', notification.read ? 'font-medium text-slate-700' : 'font-semibold text-slate-900')}>{notification.title}</span>
            {notification.priority === 'HIGH' && <StatusBadge status="HIGH" label="High priority" />}
            {action && <span className="rounded bg-amber-50 px-1.5 py-0.5 text-2xs font-medium text-warning">Action required</span>}
            <span className="sr-only">{notification.read ? '(read)' : '(unread)'}</span>
          </span>
          <span className="mt-0.5 line-clamp-2 block text-13 text-slate-500">{notification.message}</span>
          <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            <span className={cn('inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium', config.tone)}>
              <config.icon className="h-3 w-3" aria-hidden="true" />
              {config.label}
            </span>
            {reference && <span className="font-mono text-2xs text-slate-500">{reference}</span>}
            <span className="sm:hidden" title={formatDateTime(notification.createdAt)}>
              {when(notification.createdAt)}
            </span>
          </span>
        </button>
        <div className="relative z-10 flex shrink-0 items-center gap-1.5 self-center">
          <span className="num mr-2 hidden whitespace-nowrap text-13 text-slate-500 sm:block" title={formatDateTime(notification.createdAt)}>
            {when(notification.createdAt)}
          </span>
          {link && (
            <Button variant="secondary" size="sm" className="hidden lg:inline-flex" onClick={() => openNotification(notification)}>
              Open
            </Button>
          )}
          {!notification.read && (
            <button
              type="button"
              onClick={() => markRead.mutate(notification.id)}
              className="hidden h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 sm:flex"
              aria-label={`Mark ${notification.title} as read`}
              title="Mark as read"
            >
              <Check className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
          <ActionMenu items={menuItems(notification)} label={`More actions for ${notification.title}`} />
        </div>
      </li>
    );
  };

  return (
    <>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <span className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 sm:flex">
            <Bell className="h-7 w-7" strokeWidth={1.8} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Notifications</h1>
            <p className="mt-1 text-sm text-slate-500">Stay up to date with approvals, validation alerts and quotation activity.</p>
          </div>
        </div>
        <Button
          variant="secondary"
          size="lg"
          icon={CheckCheck}
          className="shrink-0 self-start sm:self-auto"
          onClick={() => markAll.mutate()}
          loading={markAll.isPending}
          disabled={!unreadCount}
          title={unreadCount ? undefined : 'Everything is already read'}
        >
          Mark all as read
        </Button>
      </div>

      {/* KPIs */}
      <section aria-label="Notification figures" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KpiCard icon={Layers} tone="brand" label="Total Notifications" query={figure(all.length)} onClick={() => { changeView('all'); setState(''); }} active={view === 'all' && !state} />
        <KpiCard icon={Bell} tone="warning" label="Unread" query={figure(unreadCount)} onClick={() => changeView('unread')} active={view === 'unread'} />
        <KpiCard
          icon={CircleCheck}
          tone="success"
          label="Read"
          query={figure(all.length - unreadCount)}
          onClick={() => {
            changeView('all');
            setState('read');
          }}
          active={view === 'all' && state === 'read'}
        />
        <KpiCard
          icon={CalendarRange}
          tone="info"
          label="This Week"
          query={figure(weekCount)}
          caption={query.data ? `Since ${format(weekStart(), 'EEE dd MMM')}` : undefined}
          onClick={() => {
            changeView('all');
            setRange(range === 'week' ? '' : 'week');
          }}
          active={range === 'week'}
        />
      </section>

      <section aria-label="Notifications" className="card mt-5">
        <div className="overflow-x-auto px-4 pt-2 sm:px-5">
          <Tabs variant="pill" label="Notification views" value={view} onChange={changeView} tabs={tabs} />
        </div>

        {view === 'preferences' ? (
          query.isLoading ? (
            <div className="space-y-3 p-5" aria-hidden="true">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : (
            <PreferencesPanel notifications={all} />
          )
        ) : (
          <>
            <div className="flex flex-col gap-3 p-4 sm:px-5 xl:flex-row xl:items-center">
              <SearchInput
                value={keyword}
                onChange={(value) => {
                  setKeyword(value);
                  pager.reset();
                }}
                placeholder="Search notifications…"
                className="xl:flex-1"
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:flex">
                <Select
                  aria-label="Category"
                  value={group}
                  onChange={filter(setGroup)}
                  options={[{ value: '', label: 'All categories' }, ...groups.map((item) => ({ value: item.key, label: query.data ? `${item.label} (${groupCount(item.key)})` : item.label }))]}
                  className="xl:w-52"
                />
                <Select
                  aria-label="Read status"
                  value={state}
                  onChange={filter(setState)}
                  options={[
                    { value: '', label: 'Read and unread' },
                    { value: 'unread', label: 'Unread' },
                    { value: 'read', label: 'Read' },
                    { value: 'action', label: 'Action required' },
                  ]}
                  className="xl:w-44"
                />
                <div className="relative xl:w-44">
                  <CalendarDays className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                  <Select aria-label="Date" value={range} onChange={filter(setRange)} options={DATE_RANGES} selectClassName="pl-9" />
                </div>
                <div className="relative xl:w-40">
                  <ArrowDownUp className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                  <Select
                    aria-label="Sort"
                    value={sort}
                    onChange={filter(setSort)}
                    options={[
                      { value: 'newest', label: 'Newest first' },
                      { value: 'oldest', label: 'Oldest first' },
                    ]}
                    selectClassName="pl-9"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                {filteredView && (
                  <Button variant="ghost" onClick={clearFilters}>
                    Clear
                  </Button>
                )}
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-md border border-line bg-surface text-slate-600 transition-colors hover:border-line-strong hover:text-slate-900"
                  onClick={() => query.refetch()}
                  aria-label="Refresh"
                  title="Refresh"
                >
                  <RefreshCw className={cn('h-4 w-4', query.isFetching && 'animate-spin')} aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="px-4 pb-2 sm:px-5">
              {query.isLoading ? (
                <div className="space-y-3" aria-hidden="true">
                  {[0, 1, 2, 3].map((key) => (
                    <div key={key} className="flex items-center gap-4 rounded-md border border-line px-4 py-4">
                      <Skeleton className="h-10 w-10 rounded-md" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-1/3" />
                        <Skeleton className="h-3 w-2/3" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : query.error ? (
                <ErrorState error={query.error} onRetry={query.refetch} />
              ) : caughtUp ? (
                <div className="flex flex-col items-center px-4 py-10 text-center">
                  <CaughtUpIllustration />
                  <h2 className="mt-4 text-xl font-semibold text-slate-900">You’re all caught up</h2>
                  <p className="mt-1.5 max-w-md text-sm text-slate-500">New approval requests, quotation updates and validation alerts will appear here.</p>
                  <Button variant="secondary" icon={Settings} className="mt-5" onClick={() => changeView('preferences')}>
                    Notification preferences
                  </Button>
                </div>
              ) : pageRows.length === 0 ? (
                <EmptyState
                  showIcon
                  icon={Bell}
                  title="No notifications match these filters"
                  description="Try another search term, category or date."
                  action={
                    <Button variant="secondary" size="sm" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  }
                />
              ) : (
                <div className="space-y-5">
                  {sections.map((section) => (
                    <section key={section.name} aria-label={section.name}>
                      <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.06em] text-slate-500">
                        {section.name}
                        <span className="num rounded bg-slate-100 px-1.5 py-0.5 text-2xs font-medium normal-case tracking-normal text-slate-600">{section.rows.length}</span>
                      </h3>
                      <ul className="space-y-2">{section.rows.map(renderItem)}</ul>
                    </section>
                  ))}
                </div>
              )}
            </div>

            {!caughtUp && !query.isLoading && !query.error && (
              <Pagination
                page={pager.page}
                size={pager.size}
                totalElements={filtered.length}
                totalPages={Math.ceil(filtered.length / pager.size)}
                onPageChange={pager.setPage}
                onSizeChange={pager.setSize}
                noun={['notification', 'notifications']}
              />
            )}

            {/* Category legend / quick filter */}
            <div className="flex flex-col gap-3 border-t border-line px-4 py-4 sm:px-5 lg:flex-row lg:items-center">
              <p className="shrink-0 text-13 font-semibold text-slate-900 lg:border-r lg:border-line lg:pr-4">Notification categories</p>
              <div className="flex flex-wrap gap-2">
                {groups.map((item) => {
                  const active = group === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        setGroup(active ? '' : item.key);
                        if (view === 'preferences') changeView('all');
                        pager.reset();
                      }}
                      className={cn(
                        'inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-13 font-medium transition-colors',
                        active ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-line bg-canvas text-slate-700 hover:border-line-strong hover:text-slate-900',
                      )}
                    >
                      <item.icon className="h-4 w-4" aria-hidden="true" />
                      {item.label}
                      {query.data && <span className="num text-xs text-slate-500">{groupCount(item.key)}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </section>

      <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.title}>
        {selected && (
          <div className="space-y-4">
            <p className="whitespace-pre-line text-sm text-slate-700">{selected.message}</p>
            <DetailList
              columns={2}
              items={[
                { label: 'Category', value: groupConfig(groupOf(selected)).label },
                { label: 'Type', value: humanize(selected.category) },
                { label: 'Priority', value: humanize(selected.priority) },
                { label: 'Received', value: formatDateTime(selected.createdAt) },
                ...(selected.referenceType ? [{ label: 'Reference', value: <span className="font-mono text-xs">{humanize(selected.referenceType)} · {selected.referenceId || '—'}</span> }] : []),
                {
                  label: 'E-mail',
                  value: (
                    <span className="inline-flex items-center gap-1.5">
                      <MailOpen className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                      <StatusBadge status={selected.emailStatus} />
                    </span>
                  ),
                },
              ]}
            />
            {notificationLink(selected) && (
              <Button
                onClick={() => {
                  const link = notificationLink(selected);
                  setSelected(null);
                  navigate(link);
                }}
                icon={ExternalLink}
              >
                Open {humanize(selected.referenceType).toLowerCase()}
              </Button>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
