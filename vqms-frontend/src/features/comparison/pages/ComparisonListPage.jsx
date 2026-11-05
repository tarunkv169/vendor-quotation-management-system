import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CalendarDays, Calculator, CircleCheck, CircleX, ClipboardList, Copy, Download, Eye, FileText, Hourglass, Layers, Lightbulb, Plus, RefreshCw, Scale } from 'lucide-react';
import { endOfDay, parseISO, startOfDay, startOfYear } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { useDebounce } from '@/hooks/useDebounce';
import { usePagination } from '@/hooks/usePagination';
import { useRequestOptions, useRequestTitles } from '@/hooks/useLookups';
import Button from '@/components/common/Button';
import DataTable from '@/components/common/DataTable';
import Pagination from '@/components/common/Pagination';
import SearchInput from '@/components/common/SearchInput';
import Select from '@/components/common/Select';
import Input from '@/components/common/Input';
import Tabs from '@/components/common/Tabs';
import StatusBadge from '@/components/common/StatusBadge';
import KpiCard from '@/components/common/KpiCard';
import ActionMenu from '@/components/common/ActionMenu';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import Skeleton from '@/components/common/Skeleton';
import EmptyState, { ErrorState } from '@/components/common/EmptyState';
import { cn } from '@/utils/cn';
import { normalizePage } from '@/utils/pagination';
import { formatDateTime } from '@/utils/formatDate';
import { formatNumber } from '@/utils/formatCurrency';
import { COMPARISON_STATUSES, humanize } from '@/utils/constants';
import { downloadCsv } from '@/utils/exportCsv';
import { recommendationService } from '@/features/recommendation/recommendationService';
import { comparisonKeys, comparisonService } from '../comparisonService';
import { comparisonPermissions } from '../comparisonActions';

// GET /comparisons is paged (max 100 per page) and has no keyword or "requires review" filter, so the
// page loads every comparison once and searches, filters, counts and pages that list in the browser.
const PAGE_SIZE = 100;
const MAX_PAGES = 20;

async function loadAllComparisons(signal) {
  let rows = [];
  for (let index = 0; index < MAX_PAGES; index += 1) {
    const result = normalizePage(await comparisonService.search({ page: index, size: PAGE_SIZE, sortBy: 'createdAt', direction: 'desc' }, signal));
    rows = rows.concat(result.items);
    if (index + 1 >= result.totalPages) break;
  }
  return rows;
}

// The backend has no separate "in progress" state: a CALCULATED comparison has results but is not
// completed (locked) yet, so it is shown as In Progress.
const STATUS_LABELS = { CALCULATED: 'In Progress' };
const statusLabel = (value) => STATUS_LABELS[value] || humanize(value);

// Status filter: backend statuses plus the two flags shown in the table.
const STATUS_FILTERS = [
  ...COMPARISON_STATUSES.map((value) => ({ value, label: statusLabel(value), match: (row) => row.status === value })),
  { value: 'NEEDS_REVIEW', label: 'Needs review', match: (row) => row.requiresReview },
  { value: 'STALE', label: 'Out of date', match: (row) => row.stale },
];

const DATE_RANGES = [
  { value: '', label: 'Any date' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: 'year', label: 'This year' },
  { value: 'custom', label: 'Custom range…' },
];

function rangeBounds(range, from, to) {
  const now = new Date();
  if (!range) return null;
  if (range === 'year') return [startOfYear(now), endOfDay(now)];
  if (range === 'custom') {
    const start = from ? startOfDay(parseISO(from)) : null;
    const end = to ? endOfDay(parseISO(to)) : null;
    return start || end ? [start, end] : null;
  }
  return [startOfDay(new Date(now.getTime() - Number(range) * 86400000)), endOfDay(now)];
}

const EXPORT_COLUMNS = (requestTitle) => [
  { header: 'Comparison', value: (row) => row.comparisonNumber },
  { header: 'Procurement request', value: (row) => requestTitle(row.procurementRequestId) || row.procurementRequestId },
  { header: 'Status', value: (row) => statusLabel(row.status) },
  { header: 'Eligible quotations', value: (row) => row.eligibleCount },
  { header: 'Needs review', value: (row) => (row.requiresReview ? 'Yes' : 'No') },
  { header: 'Up to date', value: (row) => (row.stale ? 'No' : 'Yes') },
  { header: 'Currency', value: (row) => row.currencyCode },
  { header: 'Calculated', value: (row) => row.calculatedAt },
  { header: 'Completed', value: (row) => row.completedAt },
  { header: 'Created', value: (row) => row.createdAt },
];

const ICON_BUTTON =
  'flex h-9 w-9 items-center justify-center rounded-md border border-line bg-surface text-slate-600 transition-colors hover:border-line-strong hover:text-slate-900';

const sortValue = (row, key) => {
  if (key === 'review') return row.requiresReview ? 1 : 0;
  if (key === 'upToDate') return row.stale ? 0 : 1;
  return row[key];
};

function ComparisonCell({ row, requestTitle }) {
  const title = requestTitle(row.procurementRequestId);
  return (
    <div className="min-w-0">
      <Link
        to={`/comparison/${row.id}`}
        onClick={(event) => event.stopPropagation()}
        className="block max-w-72 truncate font-semibold text-slate-900 hover:text-brand-700"
        title={title || 'Request not visible to your account'}
      >
        {title || 'Request not visible'}
      </Link>
      <p className="mt-0.5 whitespace-nowrap font-mono text-xs text-slate-500">{row.comparisonNumber}</p>
    </div>
  );
}

const FLAG = 'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium';

/** Backend status plus the "needs review" and "out of date" flags. */
function StatusCell({ row }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <StatusBadge status={row.status} label={statusLabel(row.status)} tone={row.status === 'CALCULATED' ? 'amber' : undefined} />
      {row.requiresReview && (
        <span className={cn(FLAG, 'bg-amber-50 text-warning')} title="The calculation found issues a reviewer should check">
          <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
          Needs review
        </span>
      )}
      {row.stale && (
        <span className={cn(FLAG, 'bg-red-50 text-danger')} title="Quotations changed after the calculation; recalculate">
          <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
          Out of date
        </span>
      )}
    </div>
  );
}

const DateTime = ({ value }) => (value ? <span className="whitespace-nowrap text-slate-700">{formatDateTime(value)}</span> : <span className="text-slate-400">—</span>);

export default function ComparisonListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can, canAccess } = useAuth();
  const requests = useRequestOptions();
  const requestTitle = useRequestTitles();
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get('status') || '';
  const requestId = searchParams.get('request') || '';
  const range = searchParams.get('created') || '';
  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';
  const [keyword, setKeyword] = useState('');
  const debounced = useDebounce(keyword.trim().toLowerCase(), 250);
  const pager = usePagination({ size: 20, sortBy: 'createdAt', direction: 'desc' });
  const [confirmComplete, setConfirmComplete] = useState(null);

  const query = useQuery({ queryKey: comparisonKeys.list({ scope: 'all' }), queryFn: ({ signal }) => loadAllComparisons(signal) });
  const all = useMemo(() => query.data || [], [query.data]);

  const setParam = (key, value) => {
    const next = new URLSearchParams(window.location.search);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key === 'created' && value !== 'custom') {
      next.delete('from');
      next.delete('to');
    }
    setSearchParams(next, { replace: true });
    pager.reset();
  };

  const filtered = useMemo(() => {
    const statusFilter = STATUS_FILTERS.find((option) => option.value === status);
    const bounds = rangeBounds(range, from, to);
    const rows = all.filter((row) => {
      if (statusFilter && !statusFilter.match(row)) return false;
      if (requestId && row.procurementRequestId !== requestId) return false;
      if (bounds) {
        const created = row.createdAt ? new Date(row.createdAt) : null;
        if (!created || (bounds[0] && created < bounds[0]) || (bounds[1] && created > bounds[1])) return false;
      }
      return !debounced || [row.comparisonNumber, row.id, row.procurementRequestId, requestTitle(row.procurementRequestId)].some((value) => value?.toLowerCase().includes(debounced));
    });
    const factor = pager.direction === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const left = sortValue(a, pager.sortBy) ?? '';
      const right = sortValue(b, pager.sortBy) ?? '';
      if (typeof left === 'number' || typeof right === 'number') return (Number(left) - Number(right)) * factor;
      return String(left).localeCompare(String(right)) * factor;
    });
  }, [all, status, requestId, range, from, to, debounced, requestTitle, pager.sortBy, pager.direction]);
  const pageRows = filtered.slice(pager.page * pager.size, (pager.page + 1) * pager.size);

  const count = (match) => all.filter(match).length;
  const figure = (value) => ({ isLoading: query.isLoading, error: query.error, data: value });
  const statusCount = (value) => count((row) => row.status === value);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: comparisonKeys.all });
  const calculate = useMutation({ mutationFn: (row) => comparisonService.calculate(row.id), meta: { successMessage: 'Comparison calculated' }, onSuccess: invalidate });
  const complete = useMutation({
    mutationFn: (row) => comparisonService.complete(row.id),
    meta: { successMessage: 'Comparison completed' },
    onSuccess: () => {
      setConfirmComplete(null);
      invalidate();
    },
  });
  const recommend = useMutation({
    mutationFn: (row) => recommendationService.generate({ comparisonId: row.id }),
    meta: { successMessage: 'Recommendation generated' },
    onSuccess: (recommendation) => navigate(`/recommendations/${recommendation.id}`),
  });
  const busy = calculate.isPending || complete.isPending || recommend.isPending;

  const copyNumber = async (row) => {
    try {
      await navigator.clipboard.writeText(row.comparisonNumber);
      toast.success('Comparison ID copied');
    } catch {
      toast.error('Could not copy to the clipboard');
    }
  };

  const exportCsv = () => {
    if (!filtered.length) {
      toast.info('Nothing to export');
      return;
    }
    downloadCsv(`comparisons-${new Date().toISOString().slice(0, 10)}.csv`, EXPORT_COLUMNS(requestTitle), filtered);
    toast.success(`Exported ${formatNumber(filtered.length)} ${filtered.length === 1 ? 'comparison' : 'comparisons'}`);
  };

  const menuItems = (row) => {
    const permissions = comparisonPermissions(row, can);
    return [
      { key: 'open', label: 'View details', icon: Eye, onClick: () => navigate(`/comparison/${row.id}`) },
      ...(permissions.canCalculate ? [{ key: 'calculate', label: permissions.calculateLabel, icon: Calculator, disabled: busy, onClick: () => calculate.mutate(row) }] : []),
      ...(permissions.canComplete ? [{ key: 'complete', label: 'Complete', icon: CircleCheck, disabled: busy, onClick: () => setConfirmComplete(row) }] : []),
      ...(permissions.canRecommend ? [{ key: 'recommend', label: 'Generate recommendation', icon: Lightbulb, disabled: busy, onClick: () => recommend.mutate(row) }] : []),
      ...(canAccess('procurement') ? [{ key: 'request', label: 'Open procurement request', icon: ClipboardList, divider: true, onClick: () => navigate(`/procurement/${row.procurementRequestId}`) }] : []),
      { key: 'copy', label: 'Copy comparison ID', icon: Copy, divider: !canAccess('procurement'), onClick: () => copyNumber(row) },
    ];
  };

  const renderActions = (row) => (
    <div className="flex items-center justify-end gap-2" onClick={(event) => event.stopPropagation()}>
      <Link to={`/comparison/${row.id}`} className={ICON_BUTTON} aria-label={`View details of ${row.comparisonNumber}`} title="View details">
        <Eye className="h-4 w-4" aria-hidden="true" />
      </Link>
      <ActionMenu items={menuItems(row)} label={`More actions for ${row.comparisonNumber}`} />
    </div>
  );

  const columns = [
    { key: 'request', header: 'Request', sortKey: 'comparisonNumber', className: 'min-w-60', render: (row) => <ComparisonCell row={row} requestTitle={requestTitle} /> },
    { key: 'status', header: 'Status', sortKey: 'status', className: 'min-w-36', render: (row) => <StatusCell row={row} /> },
    { key: 'eligibleCount', header: 'Eligible Quotations', sortKey: 'eligibleCount', align: 'center', render: (row) => formatNumber(row.eligibleCount ?? 0) },
    { key: 'calculatedAt', header: 'Calculated', sortKey: 'calculatedAt', render: (row) => <DateTime value={row.calculatedAt} /> },
    { key: 'createdAt', header: 'Created', sortKey: 'createdAt', render: (row) => <DateTime value={row.createdAt} /> },
    { key: 'actions', header: 'Actions', headerClassName: 'text-right', render: (row) => renderActions(row) },
  ];

  const filteredView = Boolean(keyword || requestId || range);
  const clearFilters = () => {
    setKeyword('');
    const next = new URLSearchParams();
    if (status) next.set('status', status);
    setSearchParams(next, { replace: true });
    pager.reset();
  };
  const empty = {
    icon: Scale,
    title: filteredView || status ? 'No comparisons match these filters' : 'No comparisons yet',
    detail: filteredView || status ? undefined : 'Create a comparison for a procurement request to rank its validated quotations.',
    action: filteredView ? (
      <Button variant="secondary" size="sm" onClick={clearFilters}>
        Clear filters
      </Button>
    ) : (
      !status &&
      can('comparison.manage') && (
        <Button to="/comparison/new" size="sm" icon={Plus}>
          New comparison
        </Button>
      )
    ),
  };

  const kpis = [
    { key: '', label: 'Total Comparisons', icon: Layers, tone: 'brand', value: all.length },
    { key: 'COMPLETED', label: 'Completed', icon: CircleCheck, tone: 'success', value: statusCount('COMPLETED') },
    { key: 'CALCULATED', label: 'In Progress', icon: Hourglass, tone: 'warning', value: statusCount('CALCULATED'), caption: query.data ? 'Awaiting completion' : undefined },
    { key: 'FAILED', label: 'Failed', icon: CircleX, tone: 'danger', value: statusCount('FAILED') },
    { key: 'CREATED', label: 'Created', icon: FileText, tone: 'neutral', value: statusCount('CREATED'), caption: query.data ? 'Not calculated' : undefined },
  ];
  const tabCount = (value) => (query.data ? statusCount(value) : undefined);
  const extraFilter = ['NEEDS_REVIEW', 'STALE'].includes(status) ? STATUS_FILTERS.find((option) => option.value === status) : null;
  const tabs = [
    { value: '', label: 'All', count: query.data ? all.length : undefined },
    { value: 'COMPLETED', label: 'Completed', count: tabCount('COMPLETED') },
    ...(statusCount('CALCULATED') || status === 'CALCULATED' ? [{ value: 'CALCULATED', label: 'In Progress', count: tabCount('CALCULATED') }] : []),
    { value: 'CREATED', label: 'Created', count: tabCount('CREATED') },
    { value: 'FAILED', label: 'Failed', count: tabCount('FAILED') },
    ...(extraFilter ? [{ value: extraFilter.value, label: extraFilter.label, count: query.data ? count(extraFilter.match) : undefined }] : []),
  ];

  return (
    <>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <span className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 sm:flex">
            <Scale className="h-7 w-7" strokeWidth={1.8} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Comparisons</h1>
            <p className="mt-1 text-sm text-slate-500">Compare vendor quotations, analyze pricing and identify the best value.</p>
          </div>
        </div>
        {can('comparison.manage') && (
          <Button to="/comparison/new" icon={Plus} size="lg" className="shrink-0 self-start sm:self-auto">
            New Comparison
          </Button>
        )}
      </div>

      {/* KPIs */}
      <section aria-label="Comparison figures" className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-5">
        {kpis.map((kpi) => (
          <KpiCard
            key={kpi.label}
            icon={kpi.icon}
            tone={kpi.tone}
            label={kpi.label}
            query={figure(kpi.value)}
            caption={kpi.caption}
            emptyText="—"
            onClick={() => setParam('status', kpi.key && status !== kpi.key ? kpi.key : '')}
            active={status === kpi.key}
          />
        ))}
      </section>

      {/* Tabs, filters and table */}
      <section aria-label="Comparisons" className="card mt-5">
        <div className="overflow-x-auto px-4 pt-2 sm:px-5">
          <Tabs variant="pill" label="Filter by status" value={status} onChange={(value) => setParam('status', value)} tabs={tabs} />
        </div>
        <div className="border-b border-line p-4 sm:px-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <SearchInput
              value={keyword}
              onChange={(value) => {
                setKeyword(value);
                pager.reset();
              }}
              placeholder="Search by request or request ID…"
              className="xl:w-80"
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:flex">
              <Select
                aria-label="Status"
                value={status}
                onChange={(event) => setParam('status', event.target.value)}
                options={[{ value: '', label: 'All statuses' }, ...STATUS_FILTERS.map((option) => ({ value: option.value, label: query.data ? `${option.label} (${count(option.match)})` : option.label }))]}
                className="xl:w-44"
              />
              <div className="relative xl:w-60">
                <ClipboardList className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <Select
                  aria-label="Procurement request"
                  value={requestId}
                  onChange={(event) => setParam('request', event.target.value)}
                  options={[{ value: '', label: 'All requests' }, ...(requests.data || []).map((option) => ({ value: option.value, label: option.title }))]}
                  selectClassName="pl-9"
                />
              </div>
              <div className="relative xl:w-48">
                <CalendarDays className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <Select aria-label="Created date range" value={range} onChange={(event) => setParam('created', event.target.value)} options={DATE_RANGES} selectClassName="pl-9" />
              </div>
            </div>
            <div className="flex items-center gap-2 xl:ml-auto">
              {filteredView && (
                <Button variant="ghost" onClick={clearFilters}>
                  Clear
                </Button>
              )}
              <button type="button" className={ICON_BUTTON} onClick={() => query.refetch()} aria-label="Refresh" title="Refresh">
                <RefreshCw className={cn('h-4 w-4', query.isFetching && 'animate-spin')} aria-hidden="true" />
              </button>
              <Button variant="secondary" icon={Download} onClick={exportCsv} disabled={query.isLoading || Boolean(query.error)}>
                Export
              </Button>
            </div>
          </div>
          {range === 'custom' && (
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
              <Input label="Created from" type="date" value={from} max={to || undefined} onChange={(event) => setParam('from', event.target.value)} className="sm:w-48" />
              <Input label="Created to" type="date" value={to} min={from || undefined} onChange={(event) => setParam('to', event.target.value)} className="sm:w-48" />
            </div>
          )}
        </div>

        {/* Desktop / tablet: table */}
        <div className="hidden md:block">
          <DataTable
            roomy
            caption="Comparisons"
            columns={columns}
            rows={pageRows}
            loading={query.isLoading}
            error={query.error}
            onRetry={query.refetch}
            onRowClick={(row) => navigate(`/comparison/${row.id}`)}
            sort={{ sortBy: pager.sortBy, direction: pager.direction, onSort: pager.toggleSort }}
            empty={empty}
          />
        </div>

        {/* Mobile: cards */}
        <div className="md:hidden">
          {query.isLoading ? (
            <div className="divide-y divide-slate-100" aria-hidden="true">
              {[0, 1, 2].map((key) => (
                <div key={key} className="flex gap-3 p-4">
                  <Skeleton className="h-10 w-10 rounded-md" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : query.error ? (
            <ErrorState error={query.error} onRetry={query.refetch} />
          ) : pageRows.length === 0 ? (
            <EmptyState showIcon icon={empty.icon} title={empty.title} description={empty.detail} action={empty.action} />
          ) : (
            <ul className="divide-y divide-slate-100">
              {pageRows.map((row) => (
                <li key={row.id} className="p-4">
                  <ComparisonCell row={row} requestTitle={requestTitle} />
                  <div className="mt-2">
                    <StatusCell row={row} />
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-13">
                    <div>
                      <dt className="text-xs text-slate-500">Eligible quotations</dt>
                      <dd className="text-slate-800">{formatNumber(row.eligibleCount ?? 0)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Calculated</dt>
                      <dd className="text-slate-800">{row.calculatedAt ? formatDateTime(row.calculatedAt) : '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Created</dt>
                      <dd className="text-slate-800">{formatDateTime(row.createdAt)}</dd>
                    </div>
                  </dl>
                  <div className="mt-3">{renderActions(row)}</div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Pagination
          page={pager.page}
          size={pager.size}
          totalElements={filtered.length}
          totalPages={Math.ceil(filtered.length / pager.size)}
          onPageChange={pager.setPage}
          onSizeChange={pager.setSize}
          noun={['comparison', 'comparisons']}
        />
      </section>

      <ConfirmDialog
        open={Boolean(confirmComplete)}
        onClose={() => setConfirmComplete(null)}
        onConfirm={() => complete.mutate(confirmComplete)}
        loading={complete.isPending}
        title={`Complete ${confirmComplete?.comparisonNumber || 'comparison'}`}
        message="Lock this comparison? It can then be used for the final recommendation."
        confirmLabel="Complete"
      />
    </>
  );
}
