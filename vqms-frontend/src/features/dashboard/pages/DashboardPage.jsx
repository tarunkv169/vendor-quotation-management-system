import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Plus } from 'lucide-react';
import { addMonths, format, isValid, parseISO, startOfMonth } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import PageHeader from '@/components/common/PageHeader';
import Button from '@/components/common/Button';
import DataTable from '@/components/common/DataTable';
import SummaryPanel from '@/components/common/SummaryPanel';
import Skeleton from '@/components/common/Skeleton';
import StatusBadge from '@/components/common/StatusBadge';
import { ChartTooltip } from '@/components/dashboard/ChartCard';
import { cn } from '@/utils/cn';
import { AXIS_TICK, CHART } from '@/utils/chartTheme';
import { formatCurrency, formatNumber } from '@/utils/formatCurrency';
import { formatDate, formatRelative } from '@/utils/formatDate';
import { humanize } from '@/utils/constants';
import { quotationKeys, quotationService } from '@/features/quotations/quotationService';
import { approvalKeys, approvalService } from '@/features/approval/approvalService';
import { notificationKeys, notificationService } from '@/features/notifications/notificationService';
import { notificationLink } from '@/features/notifications/notificationLinks';
import { dashboardService } from '../dashboardService';

const PROCUREMENT_KPIS = [
  { status: '', label: 'Requests' },
  { status: 'DRAFT', label: 'Draft' },
  { status: 'SUBMITTED', label: 'Submitted' },
  { status: 'APPROVED', label: 'Approved' },
  { status: 'REJECTED', label: 'Rejected' },
];
const APPROVAL_STATES = ['PENDING', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'CANCELLED'];
const RECENT_WINDOW = 100;

function monthlySeries(requests) {
  const counts = new Map();
  let first = null;
  requests.forEach((request) => {
    const date = request.createdAt ? parseISO(request.createdAt) : null;
    if (!date || !isValid(date)) return;
    const month = startOfMonth(date);
    if (!first || month < first) first = month;
    const key = format(month, 'yyyy-MM');
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  if (!first) return [];
  const series = [];
  for (let month = first, now = startOfMonth(new Date()); month <= now; month = addMonths(month, 1)) {
    series.push({ month: format(month, 'MMM yyyy'), value: counts.get(format(month, 'yyyy-MM')) || 0 });
  }
  return series;
}

function countBy(list, keyOf) {
  const counts = {};
  list.forEach((item) => {
    const key = keyOf(item);
    counts[key] = (counts[key] || 0) + 1;
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

/** One figure in the key-figures row. */
function Figure({ label, query, to }) {
  const body = (
    <>
      <p className="truncate text-xs text-slate-500" title={label}>{label}</p>
      {query.isLoading ? (
        <Skeleton className="mt-1.5 h-6 w-10" />
      ) : query.error ? (
        <p className="mt-1 text-13 text-slate-400" title={query.error.message}>
          –
        </p>
      ) : (
        <p className="num mt-0.5 text-xl font-semibold text-slate-900">{formatNumber(query.data ?? 0)}</p>
      )}
    </>
  );
  return to ? (
    <Link to={to} className="block min-w-0 px-4 py-3 transition-colors hover:bg-slate-50">
      {body}
    </Link>
  ) : (
    <div className="min-w-0 px-4 py-3">{body}</div>
  );
}

/** Two-column label / count list used in the side column. */
function CountList({ rows, empty }) {
  if (!rows.length) return <p className="px-4 py-6 text-center text-13 text-slate-500">{empty}</p>;
  return (
    <ul className="divide-y divide-slate-100">
      {rows.map((row) => (
        <li key={row.key}>
          {row.to ? (
            <Link to={row.to} className="flex items-center justify-between gap-3 px-4 py-2 text-13 hover:bg-slate-50">
              <span className="truncate text-slate-700">{row.label}</span>
              <span className="num font-medium text-slate-900">{formatNumber(row.value)}</span>
            </Link>
          ) : (
            <div className="flex items-center justify-between gap-3 px-4 py-2 text-13">
              <span className="truncate text-slate-700">{row.label}</span>
              <span className="num font-medium text-slate-900">{formatNumber(row.value)}</span>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function ViewAll({ to }) {
  return (
    <Link to={to} className="font-medium text-brand-700 hover:underline">
      View all
    </Link>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { can, canAccess } = useAuth();
  const scope = can('procurement.viewAll') ? 'all' : 'mine';
  const showProcurement = canAccess('procurement');
  const showVendors = canAccess('vendors');
  const showApprovals = canAccess('approvals');

  const procurementCounts = useQueries({
    queries: PROCUREMENT_KPIS.map((kpi) => ({
      queryKey: ['dashboard', 'procurement-count', scope, kpi.status],
      queryFn: ({ signal }) => dashboardService.procurementCount({ scope, status: kpi.status }, signal),
      enabled: showProcurement,
    })),
  });
  const vendorCounts = useQueries({
    queries: ['', 'ACTIVE'].map((status) => ({
      queryKey: ['dashboard', 'vendor-count', status],
      queryFn: ({ signal }) => dashboardService.vendorCount(status, signal),
      enabled: showVendors,
    })),
  });
  const approvalCounts = useQueries({
    queries: APPROVAL_STATES.map((status) => ({
      queryKey: ['dashboard', 'approval-count', status],
      queryFn: ({ signal }) => dashboardService.approvalCount(status, signal),
      enabled: showApprovals,
    })),
  });

  const quotations = useQuery({ queryKey: quotationKeys.list, queryFn: ({ signal }) => quotationService.list(signal) });
  const pendingApprovals = useQuery({ queryKey: approvalKeys.pending, queryFn: ({ signal }) => approvalService.pending(signal), enabled: showApprovals });
  const recentRequests = useQuery({
    queryKey: ['dashboard', 'recent-procurement', scope],
    queryFn: ({ signal }) => dashboardService.recentProcurement(scope, RECENT_WINDOW, signal),
    enabled: showProcurement,
  });
  const notifications = useQuery({
    queryKey: notificationKeys.list({ unreadOnly: false, page: 0, size: 5 }),
    queryFn: ({ signal }) => notificationService.my({ page: 0, size: 5 }, signal),
  });

  const quotationList = useMemo(() => quotations.data || [], [quotations.data]);
  const latestQuotations = useMemo(
    () => [...quotationList].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 6),
    [quotationList],
  );
  const quotationStatus = useMemo(
    () => countBy(quotationList, (q) => q.status).map(([status, value]) => ({ key: status, label: humanize(status), value, to: `/quotations?status=${status}` })),
    [quotationList],
  );
  const topVendors = useMemo(
    () => countBy(quotationList, (q) => q.vendorName || 'Unknown vendor').slice(0, 5).map(([name, value]) => ({ key: name, label: name, value })),
    [quotationList],
  );
  const requestsPerMonth = useMemo(() => monthlySeries(recentRequests.data || []), [recentRequests.data]);

  // Key figures: all from the backend (list totals), shown in one row.
  const figures = [
    ...(showProcurement
      ? PROCUREMENT_KPIS.map((kpi, index) => ({
          key: kpi.label,
          label: kpi.status ? kpi.label : scope === 'mine' ? 'My requests' : 'Requests',
          query: procurementCounts[index],
          to: kpi.status ? `/procurement?status=${kpi.status}` : '/procurement',
        }))
      : []),
    ...(showApprovals ? [{ key: 'waiting', label: 'Waiting for me', query: { ...pendingApprovals, data: pendingApprovals.data?.length }, to: '/approvals' }] : []),
    { key: 'quotations', label: 'Quotations', query: { ...quotations, data: quotations.data?.length }, to: '/quotations' },
    ...(showApprovals ? [{ key: 'approved-rec', label: 'Approvals done', query: approvalCounts[2], to: '/approvals?view=approved' }] : []),
    ...(showVendors ? [{ key: 'vendors', label: 'Active vendors', query: vendorCounts[1], to: '/vendors' }] : []),
  ];

  return (
    <>
      <PageHeader
        title="Dashboard"
        actions={
          <>
            {can('quotation.manage') && (
              <Button variant={showProcurement ? 'secondary' : 'primary'} to="/quotations/new" icon={Plus}>
                New quotation
              </Button>
            )}
            {showProcurement && (
              <Button to="/procurement/new" icon={Plus}>
                New request
              </Button>
            )}
          </>
        }
      />

      {/* Key figures */}
      <section aria-label="Key figures" className="card overflow-hidden">
        <div className={cn('grid grid-cols-2 divide-x divide-y divide-line sm:grid-cols-4 sm:divide-y-0', figures.length > 4 && 'lg:grid-cols-[repeat(auto-fit,minmax(110px,1fr))]')}>
          {figures.map((figure) => (
            <Figure key={figure.key} label={figure.label} query={figure.query} to={figure.to} />
          ))}
        </div>
      </section>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <div className="min-w-0 space-y-4 xl:col-span-2">
          {showProcurement && (
            <SummaryPanel title={scope === 'mine' ? 'My recent requests' : 'Recent requests'} action={<ViewAll to="/procurement" />} bodyClassName="overflow-hidden p-0">
              <DataTable
                dense
                caption="Recent procurement requests"
                loading={recentRequests.isLoading}
                error={recentRequests.error}
                onRetry={recentRequests.refetch}
                rows={(recentRequests.data || []).slice(0, 6)}
                onRowClick={(row) => navigate(`/procurement/${row.id}`)}
                empty={{ title: 'No requests yet' }}
                columns={[
                  { key: 'title', header: 'Request', render: (row) => <span className="block max-w-80 truncate font-medium text-slate-900">{row.title}</span> },
                  { key: 'requiredBy', header: 'Needed by', className: 'whitespace-nowrap', render: (row) => formatDate(row.requiredBy) },
                  { key: 'budget', header: 'Budget', align: 'right', className: 'whitespace-nowrap', render: (row) => (row.budget != null ? formatCurrency(row.budget) : '—') },
                  { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
                  { key: 'createdAt', header: 'Created', align: 'right', className: 'whitespace-nowrap text-slate-500', render: (row) => formatDate(row.createdAt) },
                ]}
              />
            </SummaryPanel>
          )}

          <SummaryPanel title="Latest quotations" action={<ViewAll to="/quotations" />} bodyClassName="overflow-hidden p-0">
            <DataTable
              dense
              caption="Latest quotations"
              loading={quotations.isLoading}
              error={quotations.error}
              onRetry={quotations.refetch}
              rows={latestQuotations}
              onRowClick={(row) => navigate(`/quotations/${row.id}`)}
              empty={{ title: 'No quotations yet' }}
              columns={[
                { key: 'vendor', header: 'Vendor', render: (row) => <span className="block max-w-64 truncate font-medium text-slate-900">{row.vendorName || 'Unknown vendor'}</span> },
                { key: 'quotationDate', header: 'Date', className: 'whitespace-nowrap', render: (row) => formatDate(row.quotationDate) },
                { key: 'version', header: 'Ver.', align: 'right', render: (row) => row.version ?? 1 },
                { key: 'total', header: 'Total', align: 'right', className: 'whitespace-nowrap', render: (row) => formatCurrency(row.totalAmount, row.currency) },
                { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
              ]}
            />
          </SummaryPanel>

          {showProcurement && requestsPerMonth.length >= 2 && (
            <SummaryPanel title="Requests per month">
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={requestsPerMonth} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
                    <CartesianGrid stroke={CHART.grid} vertical={false} />
                    <XAxis dataKey="month" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: CHART.axisLine }} />
                    <YAxis allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} width={36} />
                    <Tooltip cursor={{ fill: CHART.cursor }} content={<ChartTooltip />} />
                    <Bar dataKey="value" name="Requests" fill={CHART.primary} radius={[2, 2, 0, 0]} maxBarSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SummaryPanel>
          )}
        </div>

        <div className="min-w-0 space-y-4">
          {showApprovals && (
            <SummaryPanel title="Waiting for my approval" action={<ViewAll to="/approvals" />} bodyClassName="p-0" loading={pendingApprovals.isLoading} error={pendingApprovals.error} onRetry={pendingApprovals.refetch}>
              {(pendingApprovals.data || []).length === 0 ? (
                <p className="px-4 py-6 text-center text-13 text-slate-500">Nothing waiting</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {pendingApprovals.data.slice(0, 5).map((approval) => (
                    <li key={approval.id}>
                      <Link to={`/approvals/${approval.id}`} className="flex items-center justify-between gap-3 px-4 py-2 text-13 hover:bg-slate-50">
                        <span className="min-w-0">
                          <span className="block truncate font-mono text-xs text-slate-900">{approval.approvalNumber}</span>
                          <span className="block text-xs text-slate-500">{formatRelative(approval.createdAt)}</span>
                        </span>
                        <span className="num shrink-0 font-medium text-slate-900">{formatCurrency(approval.amount, approval.currencyCode)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </SummaryPanel>
          )}

          <SummaryPanel title="Quotations by status" bodyClassName="p-0" loading={quotations.isLoading} error={quotations.error} onRetry={quotations.refetch}>
            <CountList rows={quotationStatus} empty="No quotations yet" />
          </SummaryPanel>

          <SummaryPanel title="Top vendors" bodyClassName="p-0" loading={quotations.isLoading} error={quotations.error} onRetry={quotations.refetch}>
            <CountList rows={topVendors} empty="No quotations yet" />
          </SummaryPanel>

          <SummaryPanel title="Notifications" action={<ViewAll to="/notifications" />} bodyClassName="p-0" loading={notifications.isLoading} error={notifications.error} onRetry={notifications.refetch}>
            {(notifications.data?.content || []).length === 0 ? (
              <p className="px-4 py-6 text-center text-13 text-slate-500">No notifications</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {notifications.data.content.map((notification) => (
                  <li key={notification.id}>
                    <Link to={notificationLink(notification) || '/notifications'} className="flex items-start gap-2.5 px-4 py-2 text-13 hover:bg-slate-50">
                      <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', notification.read ? 'bg-transparent' : 'bg-brand-600')} aria-hidden="true" />
                      <span className="min-w-0">
                        <span className={cn('block truncate', notification.read ? 'text-slate-700' : 'font-medium text-slate-900')}>{notification.title}</span>
                        <span className="block text-xs text-slate-500">{formatRelative(notification.createdAt)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SummaryPanel>
        </div>
      </div>
    </>
  );
}
