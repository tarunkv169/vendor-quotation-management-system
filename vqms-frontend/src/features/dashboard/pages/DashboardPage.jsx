import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import {
  ArrowRight,
  Bell,
  Building2,
  Check,
  CircleCheck,
  ClipboardCheck,
  FileText,
  Hourglass,
  LayoutDashboard,
  Pencil,
  Plus,
  Quote,
  Send,
  ShieldCheck,
  TriangleAlert,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import Button from '@/components/common/Button';
import DataTable from '@/components/common/DataTable';
import KpiCard from '@/components/common/KpiCard';
import Skeleton from '@/components/common/Skeleton';
import StatusBadge, { statusColor } from '@/components/common/StatusBadge';
import { ErrorState } from '@/components/common/EmptyState';
import { cn } from '@/utils/cn';
import { formatCurrency, formatNumber } from '@/utils/formatCurrency';
import { formatDate, formatRelative } from '@/utils/formatDate';
import { humanize } from '@/utils/constants';
import { quotationKeys, quotationService } from '@/features/quotations/quotationService';
import { approvalKeys, approvalService } from '@/features/approval/approvalService';
import { notificationKeys, notificationService } from '@/features/notifications/notificationService';
import { iconFor, notificationLink, toneFor } from '@/features/notifications/notificationLinks';
import { ChartTooltip } from '@/components/dashboard/ChartCard';
import { dashboardService } from '../dashboardService';

const REQUEST_COUNTS = ['', 'DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'];
// Shown in the status chart even when empty, so the legend always reads the same.
const MAIN_QUOTATION_STATUSES = ['SUBMITTED', 'VALIDATED', 'REJECTED'];
const ROWS = 6;

/** Client-side sort of a small list (the dashboard tables show the latest few rows only). */
function useLocalSort(rows, initial) {
  const [sort, setSort] = useState(initial);
  const sorted = useMemo(() => {
    const factor = sort.direction === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const left = a[sort.sortBy] ?? '';
      const right = b[sort.sortBy] ?? '';
      if (typeof left === 'number' || typeof right === 'number') return (Number(left) - Number(right)) * factor;
      return String(left).localeCompare(String(right)) * factor;
    });
  }, [rows, sort]);
  const onSort = (key) => setSort((current) => ({ sortBy: key, direction: current.sortBy === key && current.direction === 'desc' ? 'asc' : 'desc' }));
  return [sorted, { ...sort, onSort }];
}

function Panel({ title, subtitle, icon: Icon, to, children, className, bodyClassName }) {
  return (
    <section className={cn('card flex flex-col overflow-hidden', className)}>
      <header className="flex items-start justify-between gap-3 px-5 pb-3 pt-4">
        <div className="flex min-w-0 items-center gap-3">
          {Icon && (
            <span className={cn('flex shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600', subtitle ? 'h-10 w-10' : 'h-8 w-8')}>
              <Icon className={subtitle ? 'h-5 w-5' : 'h-4 w-4'} strokeWidth={1.8} aria-hidden="true" />
            </span>
          )}
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>
            {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
          </div>
        </div>
        {to && (
          <Link to={to} className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-13 font-medium text-brand-700 hover:underline">
            View All <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        )}
      </header>
      <div className={cn('flex-1', bodyClassName)}>{children}</div>
    </section>
  );
}

function PanelEmpty({ icon: Icon, title, detail }) {
  return (
    <div className="flex flex-col items-center px-5 pb-6 pt-2 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
        <Icon className="h-6 w-6" strokeWidth={1.6} aria-hidden="true" />
      </span>
      <p className="mt-2.5 text-13 font-semibold text-slate-900">{title}</p>
      {detail && <p className="mt-0.5 text-xs text-slate-500">{detail}</p>}
    </div>
  );
}

function PanelLoading({ lines = 3 }) {
  return (
    <div className="space-y-3 px-5 pb-5" aria-hidden="true">
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} className="h-4 w-full" />
      ))}
    </div>
  );
}

function IconCell({ icon: Icon, children, to }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600">
        <Icon className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
      </span>
      <Link to={to} onClick={(event) => event.stopPropagation()} className="block max-w-64 truncate font-semibold text-slate-900 hover:text-brand-700">
        {children}
      </Link>
    </span>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { can, canAccess } = useAuth();
  const scope = can('procurement.viewAll') ? 'all' : 'mine';
  const showProcurement = canAccess('procurement');
  const showApprovals = canAccess('approvals');
  const showVendors = canAccess('vendors');

  // ---- Data (all from existing list endpoints) ----
  const requestCounts = useQueries({
    queries: REQUEST_COUNTS.map((status) => ({
      queryKey: ['dashboard', 'procurement-count', scope, status],
      queryFn: ({ signal }) => dashboardService.procurementCount({ scope, status }, signal),
      enabled: showProcurement,
    })),
  });
  const recentRequests = useQuery({
    queryKey: ['dashboard', 'recent-procurement', scope],
    queryFn: ({ signal }) => dashboardService.recentProcurement(scope, 6, signal),
    enabled: showProcurement,
  });
  const activeVendors = useQuery({
    queryKey: ['dashboard', 'vendor-count', 'ACTIVE'],
    queryFn: ({ signal }) => dashboardService.vendorCount('ACTIVE', signal),
    enabled: showVendors,
  });
  const quotations = useQuery({ queryKey: quotationKeys.list, queryFn: ({ signal }) => quotationService.list(signal) });
  const pendingApprovals = useQuery({ queryKey: approvalKeys.pending, queryFn: ({ signal }) => approvalService.pending(signal), enabled: showApprovals });
  const notifications = useQuery({
    queryKey: notificationKeys.list({ unreadOnly: false, page: 0, size: 5 }),
    queryFn: ({ signal }) => notificationService.my({ page: 0, size: 5 }, signal),
  });

  const quotationList = useMemo(() => (Array.isArray(quotations.data) ? quotations.data : quotations.data?.content || []), [quotations.data]);
  const countQuery = (status) => requestCounts[REQUEST_COUNTS.indexOf(status)];

  const recentRows = useMemo(() => (recentRequests.data || []).slice(0, ROWS), [recentRequests.data]);
  const latestQuotations = useMemo(
    () => [...quotationList].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, ROWS),
    [quotationList],
  );
  const [sortedRequests, requestSort] = useLocalSort(recentRows, { sortBy: 'createdAt', direction: 'desc' });
  const [sortedQuotations, quotationSort] = useLocalSort(latestQuotations, { sortBy: 'createdAt', direction: 'desc' });

  const quotationStatus = useMemo(() => {
    const counts = {};
    quotationList.forEach((row) => {
      counts[row.status] = (counts[row.status] || 0) + 1;
    });
    MAIN_QUOTATION_STATUSES.forEach((status) => {
      counts[status] = counts[status] || 0;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [quotationList]);
  const topVendors = useMemo(() => {
    const counts = {};
    quotationList.forEach((row) => {
      const name = row.vendorName || 'Unknown vendor';
      counts[name] = (counts[name] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [quotationList]);
  const quotationFigure = (value) => ({ isLoading: quotations.isLoading, error: quotations.error, data: value });
  const quotationCount = (status) => quotationList.filter((row) => row.status === status).length;

  return (
    <>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <span className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 sm:flex">
            <LayoutDashboard className="h-7 w-7" strokeWidth={1.8} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Dashboard</h1>
            <p className="mt-1 text-sm text-slate-500">Overview of procurement, quotations and vendor activities.</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {can('quotation.manage') && (
            <Button variant="secondary" to="/quotations/new" icon={Plus}>
              New Quotation
            </Button>
          )}
          {showProcurement && (
            <Button to="/procurement/new" icon={Plus}>
              New Request
            </Button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <section aria-label="Key figures" className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
        {showProcurement && (
          <>
            <KpiCard compact icon={FileText} tone="brand" label={scope === 'mine' ? 'My Requests' : 'Requests'} query={countQuery('')} onClick={() => navigate('/procurement')} />
            <KpiCard compact icon={Pencil} tone="warning" label="Draft" query={countQuery('DRAFT')} onClick={() => navigate('/procurement?status=DRAFT')} />
            <KpiCard compact icon={Send} tone="info" label="Submitted" query={countQuery('SUBMITTED')} onClick={() => navigate('/procurement?status=SUBMITTED')} />
            <KpiCard compact icon={Check} tone="success" label="Approved" query={countQuery('APPROVED')} onClick={() => navigate('/procurement?status=APPROVED')} />
            <KpiCard compact icon={X} tone="danger" label="Rejected" query={countQuery('REJECTED')} onClick={() => navigate('/procurement?status=REJECTED')} />
          </>
        )}
        {showApprovals && (
          <KpiCard
            compact
            icon={Hourglass}
            tone="warning"
            label="Waiting for Me"
            query={{ isLoading: pendingApprovals.isLoading, error: pendingApprovals.error, data: pendingApprovals.data?.length }}
            onClick={() => navigate('/approvals')}
          />
        )}
        <KpiCard compact icon={Quote} tone="brand" label="Quotations" query={quotationFigure(quotationList.length)} onClick={() => navigate('/quotations')} />
        {showVendors ? (
          <KpiCard compact icon={Users} tone="info" label="Active Vendors" query={activeVendors} onClick={() => navigate('/vendors')} />
        ) : (
          <>
            <KpiCard compact icon={CircleCheck} tone="success" label="Submitted" query={quotationFigure(quotationCount('SUBMITTED'))} onClick={() => navigate('/quotations?status=SUBMITTED')} />
            <KpiCard compact icon={ShieldCheck} tone="info" label="Validated" query={quotationFigure(quotationCount('VALIDATED'))} onClick={() => navigate('/quotations?status=VALIDATED')} />
            <KpiCard compact icon={TriangleAlert} tone="warning" label="Needs Review" query={quotationFigure(quotationCount('NEEDS_REVIEW'))} onClick={() => navigate('/quotations?status=NEEDS_REVIEW')} />
          </>
        )}
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        {/* Left column */}
        <div className="min-w-0 space-y-5 xl:col-span-2">
          {showProcurement && (
            <Panel
              icon={FileText}
              title={scope === 'mine' ? 'My Recent Requests' : 'Recent Requests'}
              subtitle="Your latest procurement requests and their status."
              to="/procurement"
            >
              <DataTable
                dense
                caption="Recent procurement requests"
                loading={recentRequests.isLoading}
                error={recentRequests.error}
                onRetry={recentRequests.refetch}
                rows={sortedRequests}
                sort={requestSort}
                onRowClick={(row) => navigate(`/procurement/${row.id}`)}
                empty={{ title: 'No requests yet' }}
                columns={[
                  { key: 'title', header: 'Request', sortKey: 'title', render: (row) => <IconCell icon={FileText} to={`/procurement/${row.id}`}>{row.title}</IconCell> },
                  { key: 'requiredBy', header: 'Needed by', sortKey: 'requiredBy', className: 'whitespace-nowrap', render: (row) => formatDate(row.requiredBy) },
                  { key: 'budget', header: 'Budget', sortKey: 'budget', align: 'right', className: 'whitespace-nowrap', render: (row) => (row.budget != null ? formatCurrency(row.budget) : '—') },
                  { key: 'status', header: 'Status', sortKey: 'status', render: (row) => <StatusBadge status={row.status} /> },
                  { key: 'createdAt', header: 'Created', sortKey: 'createdAt', align: 'right', className: 'whitespace-nowrap', render: (row) => formatDate(row.createdAt) },
                ]}
              />
            </Panel>
          )}

          <Panel icon={FileText} title="Latest Quotations" subtitle="Recently submitted quotations from vendors." to="/quotations">
            <DataTable
              dense
              caption="Latest quotations"
              loading={quotations.isLoading}
              error={quotations.error}
              onRetry={quotations.refetch}
              rows={sortedQuotations}
              sort={quotationSort}
              onRowClick={(row) => navigate(`/quotations/${row.id}`)}
              empty={{ title: 'No quotations yet' }}
              columns={[
                { key: 'vendorName', header: 'Vendor', sortKey: 'vendorName', render: (row) => <IconCell icon={Building2} to={`/quotations/${row.id}`}>{row.vendorName || 'Unknown vendor'}</IconCell> },
                { key: 'quotationDate', header: 'Date', sortKey: 'quotationDate', className: 'whitespace-nowrap', render: (row) => formatDate(row.quotationDate) },
                { key: 'version', header: 'Ver.', sortKey: 'version', align: 'right', render: (row) => row.version ?? 1 },
                { key: 'totalAmount', header: 'Total', sortKey: 'totalAmount', align: 'right', className: 'whitespace-nowrap', render: (row) => formatCurrency(row.totalAmount, row.currency) },
                { key: 'status', header: 'Status', sortKey: 'status', render: (row) => <StatusBadge status={row.status} /> },
              ]}
            />
          </Panel>
        </div>

        {/* Right column */}
        <div className="min-w-0 space-y-5">
          {showApprovals && (
            <Panel icon={Hourglass} title="Waiting for My Approval" to="/approvals">
              {pendingApprovals.isLoading ? (
                <PanelLoading />
              ) : pendingApprovals.error ? (
                <ErrorState error={pendingApprovals.error} onRetry={pendingApprovals.refetch} />
              ) : (pendingApprovals.data || []).length === 0 ? (
                <PanelEmpty icon={ClipboardCheck} title="Nothing waiting for you" detail="You have no pending approvals." />
              ) : (
                <ul className="divide-y divide-slate-100 border-t border-line">
                  {pendingApprovals.data.slice(0, 5).map((approval) => (
                    <li key={approval.id}>
                      <Link to={`/approvals/${approval.id}`} className="flex items-center justify-between gap-3 px-5 py-2.5 text-13 hover:bg-slate-50">
                        <span className="min-w-0">
                          <span className="block truncate font-mono text-xs font-semibold text-slate-900">{approval.approvalNumber}</span>
                          <span className="block text-xs text-slate-500">{formatRelative(approval.createdAt)}</span>
                        </span>
                        <span className="num shrink-0 font-semibold text-slate-900">{formatCurrency(approval.amount, approval.currencyCode)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}

          <Panel icon={Quote} title="Quotations by Status" to="/quotations">
            {quotations.isLoading ? (
              <PanelLoading lines={2} />
            ) : quotations.error ? (
              <ErrorState error={quotations.error} onRetry={quotations.refetch} />
            ) : quotationList.length === 0 ? (
              <PanelEmpty icon={FileText} title="No quotations yet" />
            ) : (
              <div className="flex items-center gap-5 px-5 pb-5">
                <div className="relative h-32 w-32 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={quotationStatus.filter(([, count]) => count > 0).map(([status, count]) => ({ name: humanize(status), status, value: count }))}
                        dataKey="value"
                        innerRadius="72%"
                        outerRadius="100%"
                        paddingAngle={quotationStatus.filter(([, count]) => count > 0).length > 1 ? 2 : 0}
                        stroke="none"
                        isAnimationActive={false}
                      >
                        {quotationStatus
                          .filter(([, count]) => count > 0)
                          .map(([status]) => (
                            <Cell key={status} fill={statusColor(status)} />
                          ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="num text-2xl font-semibold leading-none text-slate-900">{formatNumber(quotationList.length)}</span>
                    <span className="mt-1 text-xs text-slate-500">Total</span>
                  </div>
                </div>
                <ul className="min-w-0 flex-1 space-y-1">
                  {quotationStatus.map(([status, count]) => (
                    <li key={status}>
                      <Link to={`/quotations?status=${status}`} className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-13 hover:bg-slate-50">
                        <span className="flex min-w-0 items-center gap-2.5 text-slate-800">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: statusColor(status) }} aria-hidden="true" />
                          <span className="truncate">{humanize(status)}</span>
                        </span>
                        <span className="num font-semibold text-slate-900">{formatNumber(count)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Panel>

          <Panel icon={Users} title="Top Vendors" to={showVendors ? '/vendors' : undefined}>
            {quotations.isLoading ? (
              <PanelLoading />
            ) : quotations.error ? (
              <ErrorState error={quotations.error} onRetry={quotations.refetch} />
            ) : topVendors.length === 0 ? (
              <PanelEmpty icon={Building2} title="No vendors with quotations yet" />
            ) : (
              <ul className="mx-4 mb-4 divide-y divide-slate-100 rounded-md border border-line">
                {topVendors.map(([name, count]) => (
                  <li key={name} className="flex items-center justify-between gap-3 px-3 py-2.5 text-13">
                    <span className="flex min-w-0 items-center gap-2.5 text-slate-800">
                      <Building2 className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                      <span className="truncate">{name}</span>
                    </span>
                    <span className="num font-semibold text-slate-900" title={`${count} ${count === 1 ? 'quotation' : 'quotations'}`}>
                      {formatNumber(count)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel icon={Bell} title="Notifications" to="/notifications">
            {notifications.isLoading ? (
              <PanelLoading />
            ) : notifications.error ? (
              <ErrorState error={notifications.error} onRetry={notifications.refetch} />
            ) : (notifications.data?.content || []).length === 0 ? (
              <PanelEmpty icon={Bell} title="No notifications" detail="You're all caught up!" />
            ) : (
              <ul className="divide-y divide-slate-100 border-t border-line">
                {notifications.data.content.map((notification) => {
                  const Icon = iconFor(notification);
                  return (
                    <li key={notification.id}>
                      <Link to={notificationLink(notification) || '/notifications'} className="flex items-start gap-3 px-5 py-2.5 text-13 hover:bg-slate-50">
                        <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-md', toneFor(notification))}>
                          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={cn('block truncate', notification.read ? 'text-slate-700' : 'font-semibold text-slate-900')}>{notification.title}</span>
                          <span className="block text-xs text-slate-500">{formatRelative(notification.createdAt)}</span>
                        </span>
                        {!notification.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600" aria-label="Unread" />}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
