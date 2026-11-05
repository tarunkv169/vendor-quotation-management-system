import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowUpDown,
  CalendarDays,
  Clock,
  CircleCheck,
  ClipboardList,
  Copy,
  Download,
  Eye,
  Layers,
  Package,
  Pencil,
  Plus,
  Send,
  Tag,
  Trash,
} from 'lucide-react';
import { differenceInCalendarDays, endOfDay, isValid, parseISO, startOfDay, startOfYear } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { useDebounce } from '@/hooks/useDebounce';
import { usePagination } from '@/hooks/usePagination';
import Button from '@/components/common/Button';
import DataTable from '@/components/common/DataTable';
import Pagination from '@/components/common/Pagination';
import SearchInput from '@/components/common/SearchInput';
import Select from '@/components/common/Select';
import Tabs from '@/components/common/Tabs';
import Input from '@/components/common/Input';
import StatusBadge from '@/components/common/StatusBadge';
import KpiCard from '@/components/common/KpiCard';
import ActionMenu from '@/components/common/ActionMenu';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import Skeleton from '@/components/common/Skeleton';
import EmptyState, { ErrorState } from '@/components/common/EmptyState';
import { cn } from '@/utils/cn';
import { normalizePage } from '@/utils/pagination';
import { formatDate, formatRelative } from '@/utils/formatDate';
import { formatCurrency, formatNumber } from '@/utils/formatCurrency';
import { humanize } from '@/utils/constants';
import { downloadCsv } from '@/utils/exportCsv';
import { dashboardService } from '@/features/dashboard/dashboardService';
import { procurementKeys, procurementService } from '../procurementService';
import { ACTIONS, requestPermissions, requestReference, runProcurementAction } from '../procurementActions';

const STATUSES = ['DRAFT', 'SUBMITTED', 'APPROVED', 'QUOTATION_REQUESTED', 'UNDER_EVALUATION', 'COMPLETED', 'REJECTED', 'CANCELLED'];
const OPEN_STATUSES = ['DRAFT', 'SUBMITTED', 'APPROVED', 'QUOTATION_REQUESTED', 'UNDER_EVALUATION'];
// Count queries: '' (all) followed by every status. Same keys as the dashboard, so they are shared.
const COUNT_STATUSES = ['', ...STATUSES];

// Created-date filter. The backend has no date filter, so while a range is active the page loads every
// request matching the other filters (100 per call) and filters and pages them in the browser.
const DATE_RANGES = [
  { value: '', label: 'Date range' },
  { value: '7', label: 'Created in the last 7 days' },
  { value: '30', label: 'Created in the last 30 days' },
  { value: '90', label: 'Created in the last 90 days' },
  { value: 'year', label: 'Created this year' },
  { value: 'custom', label: 'Custom date range…' },
];
const MAX_PAGES = 50;

const SORTS = [
  { value: 'createdAt:desc', label: 'Newest first' },
  { value: 'createdAt:asc', label: 'Oldest first' },
  { value: 'requiredBy:asc', label: 'Needed soonest' },
  { value: 'updatedAt:desc', label: 'Recently updated' },
  { value: 'title:asc', label: 'Title (A–Z)' },
];
// The tabs of the design; any other status chosen in the status filter gets a tab while selected.
const MAIN_TABS = ['SUBMITTED', 'UNDER_EVALUATION', 'COMPLETED'];

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

function inBounds(value, bounds) {
  const date = value ? parseISO(value) : null;
  if (!date || !isValid(date)) return false;
  const [start, end] = bounds;
  return (!start || date >= start) && (!end || date <= end);
}

const EXPORT_COLUMNS = [
  { header: 'Reference', value: (row) => requestReference(row.id) },
  { header: 'Title', value: (row) => row.title },
  { header: 'Description', value: (row) => row.description },
  { header: 'Quantity', value: (row) => row.quantity },
  { header: 'Unit', value: (row) => row.unit },
  { header: 'Budget', value: (row) => row.budget },
  { header: 'Required by', value: (row) => row.requiredBy?.slice(0, 10) },
  { header: 'Status', value: (row) => humanize(row.status) },
  { header: 'Created', value: (row) => row.createdAt?.slice(0, 10) },
];

const ICON_BUTTON =
  'flex h-9 w-9 items-center justify-center rounded-md border border-line bg-surface text-slate-600 transition-colors hover:border-line-strong hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-line disabled:hover:text-slate-600';

/** Date with a calendar icon; for open requests a due hint (overdue / due soon). */
function DateCell({ value, hint }) {
  const date = value ? parseISO(value) : null;
  if (!date || !isValid(date)) return <span className="text-slate-400">—</span>;
  const days = differenceInCalendarDays(date, new Date());
  return (
    <span className="block whitespace-nowrap">
      <span>
        <span className="block text-slate-800">{formatDate(value)}</span>
        {hint && (
          <span className={cn('block text-xs', days < 0 ? 'text-danger' : days <= 7 ? 'text-warning' : 'text-slate-500')}>
            {days < 0 ? `${Math.abs(days)} days overdue` : days === 0 ? 'Due today' : `In ${days} days`}
          </span>
        )}
      </span>
    </span>
  );
}

function RequestCell({ row }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600">
        <Package className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <Link to={`/procurement/${row.id}`} onClick={(event) => event.stopPropagation()} className="block max-w-72 truncate font-semibold text-slate-900 hover:text-brand-700" title={row.title}>
          {row.title}
        </Link>
        {row.description ? (
          <p className="mt-0.5 max-w-72 truncate text-xs text-slate-500" title={`${row.description} · ${requestReference(row.id)}`}>
            {row.description}
          </p>
        ) : (
          <p className="mt-0.5 font-mono text-xs text-slate-500">{requestReference(row.id)}</p>
        )}
      </div>
    </div>
  );
}

export default function ProcurementListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, can } = useAuth();
  const canViewAll = can('procurement.viewAll');
  const [searchParams, setSearchParams] = useSearchParams();
  const scope = canViewAll && searchParams.get('scope') !== 'mine' ? 'all' : 'mine';
  const status = searchParams.get('status') || '';
  const [keyword, setKeyword] = useState('');
  const debouncedKeyword = useDebounce(keyword.trim());
  const pager = usePagination({ size: 10, sortBy: 'createdAt', direction: 'desc' });
  const range = searchParams.get('created') || '';
  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';
  const [pending, setPending] = useState(null); // { row, key } – key is an action key or 'delete'
  const [exporting, setExporting] = useState(false);

  const updateParam = (key, value) => {
    const next = new URLSearchParams(window.location.search);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
    pager.reset();
  };

  // The backend does not combine keyword search with the status filter: a search covers all statuses.
  const searching = Boolean(debouncedKeyword);
  const params = { scope, keyword: debouncedKeyword, status: searching ? '' : status, page: pager.page, size: pager.size, sortBy: pager.sortBy, direction: pager.direction };
  const query = useQuery({
    queryKey: procurementKeys.list(params),
    queryFn: ({ signal }) => procurementService.list(params, signal),
    placeholderData: keepPreviousData,
    enabled: !rangeBounds(range, from, to),
  });
  const bounds = rangeBounds(range, from, to);
  const ranged = useQuery({
    queryKey: procurementKeys.list({ ...params, page: 'all', size: 100, created: range, from, to }),
    queryFn: async ({ signal }) => {
      let rows = [];
      for (let index = 0; index < MAX_PAGES; index += 1) {
        const result = normalizePage(await procurementService.list({ ...params, page: index, size: 100 }, signal));
        rows = rows.concat(result.items);
        if (index + 1 >= result.totalPages) break;
      }
      return rows;
    },
    enabled: Boolean(bounds),
    placeholderData: keepPreviousData,
  });
  const rangedRows = useMemo(() => (bounds ? (ranged.data || []).filter((row) => inBounds(row.createdAt, bounds)) : []), [ranged.data, bounds]);
  const serverPage = normalizePage(query.data);
  const page = bounds
    ? {
        items: rangedRows.slice(pager.page * pager.size, (pager.page + 1) * pager.size),
        page: pager.page,
        size: pager.size,
        totalElements: rangedRows.length,
        totalPages: Math.ceil(rangedRows.length / pager.size),
      }
    : serverPage;
  const listQuery = bounds ? ranged : query;

  const counts = useQueries({
    queries: COUNT_STATUSES.map((value) => ({
      queryKey: ['dashboard', 'procurement-count', scope, value],
      queryFn: ({ signal }) => dashboardService.procurementCount({ scope, status: value }, signal),
      meta: { silent: true },
    })),
  });
  const countOf = (value) => counts[COUNT_STATUSES.indexOf(value)];
  const total = countOf('').data;
  const share = (value) => {
    const count = countOf(value).data;
    return total ? `${Math.round(((count || 0) / total) * 100)}% of all requests` : undefined;
  };
  const openCount = OPEN_STATUSES.reduce((sum, value) => sum + (countOf(value).data || 0), 0);
  const breakdownReady = [...OPEN_STATUSES, 'COMPLETED'].every((value) => countOf(value).data != null);

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: procurementKeys.all });
    queryClient.invalidateQueries({ queryKey: ['dashboard', 'procurement-count'] });
  };

  const action = useMutation({
    mutationFn: ({ row, key, reason }) => (key === 'delete' ? procurementService.remove(row.id) : runProcurementAction(row.id, key, reason)),
    meta: { successMessage: 'Request updated' },
    onSuccess: () => {
      setPending(null);
      refreshAll();
    },
  });

  // ---- Export: every request matching the current filters (all pages) ----
  const exportCsv = async () => {
    setExporting(true);
    try {
      let rows = bounds ? rangedRows : [];
      if (!bounds) {
        for (let index = 0; index < MAX_PAGES; index += 1) {
          const result = normalizePage(await procurementService.list({ ...params, page: index, size: 100 }));
          rows = rows.concat(result.items);
          if (index + 1 >= result.totalPages) break;
        }
      }
      if (!rows.length) {
        toast.info('Nothing to export');
        return;
      }
      downloadCsv(`procurement-requests-${new Date().toISOString().slice(0, 10)}.csv`, EXPORT_COLUMNS, rows);
      toast.success(`Exported ${formatNumber(rows.length)} ${rows.length === 1 ? 'request' : 'requests'}`);
    } catch (error) {
      toast.error(error?.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const copyReference = async (row) => {
    try {
      await navigator.clipboard.writeText(requestReference(row.id));
      toast.success('Reference copied');
    } catch {
      toast.error('Could not copy to the clipboard');
    }
  };

  const menuItems = (row) => {
    const { actions, canDelete } = requestPermissions(row, { user, can });
    return [
      { key: 'open', label: 'Open details', icon: Eye, onClick: () => navigate(`/procurement/${row.id}`) },
      ...actions.map(([key, item]) => ({ key, label: item.label, icon: item.icon, tone: item.tone, onClick: () => setPending({ row, key }) })),
      { key: 'copy', label: 'Copy reference', icon: Copy, onClick: () => copyReference(row) },
      ...(canDelete ? [{ key: 'delete', label: 'Delete', icon: Trash, tone: 'danger', divider: true, onClick: () => setPending({ row, key: 'delete' }) }] : []),
    ];
  };

  const renderActions = (row) => {
    const { canEdit } = requestPermissions(row, { user, can });
    return (
      <div className="flex items-center justify-end gap-2" onClick={(event) => event.stopPropagation()}>
        <Link to={`/procurement/${row.id}`} className={ICON_BUTTON} aria-label={`View ${row.title}`} title="View">
          <Eye className="h-4 w-4" aria-hidden="true" />
        </Link>
        <button
          type="button"
          className={ICON_BUTTON}
          onClick={() => navigate(`/procurement/${row.id}/edit`)}
          disabled={!canEdit}
          aria-label={`Edit ${row.title}`}
          title={canEdit ? 'Edit' : 'Only draft requests can be edited'}
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
        </button>
        <ActionMenu items={menuItems(row)} label={`More actions for ${row.title}`} />
      </div>
    );
  };

  const columns = [
    { key: 'title', header: 'Request', sortKey: 'title', className: 'min-w-64', render: (row) => <RequestCell row={row} /> },
    { key: 'quantity', header: 'Quantity', sortKey: 'quantity', className: 'whitespace-nowrap', render: (row) => `${formatNumber(row.quantity)} ${row.unit || ''}` },
    {
      key: 'budget',
      header: 'Budget',
      className: 'whitespace-nowrap',
      render: (row) => (row.budget != null ? <span className="num font-medium text-slate-900">{formatCurrency(row.budget)}</span> : <span className="text-slate-400">Not set</span>),
    },
    { key: 'requiredBy', header: 'Needed by', sortKey: 'requiredBy', render: (row) => <DateCell value={row.requiredBy} hint={OPEN_STATUSES.includes(row.status)} /> },
    { key: 'status', header: 'Status', sortKey: 'status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'createdAt',
      header: 'Created',
      sortKey: 'createdAt',
      className: 'whitespace-nowrap',
      render: (row) => (
        <span className="text-slate-600" title={formatDate(row.createdAt)}>
          {formatRelative(row.createdAt)}
        </span>
      ),
    },
    { key: 'actions', header: 'Actions', headerClassName: 'text-right', render: (row) => renderActions(row) },
  ];

  const sortValue = `${pager.sortBy}:${pager.direction}`;
  const knownSort = SORTS.some((option) => option.value === sortValue);
  const tabs = [
    { value: '', label: 'All', count: countOf('').data },
    ...STATUSES.filter((value) => MAIN_TABS.includes(value) || value === status).map((value) => ({
      value,
      label: humanize(value).replace(/\b\w/g, (letter) => letter.toUpperCase()),
      count: countOf(value).data,
    })),
  ];

  const setRange = (value) => {
    const next = new URLSearchParams(window.location.search);
    if (value) next.set('created', value);
    else next.delete('created');
    if (value !== 'custom') {
      next.delete('from');
      next.delete('to');
    }
    setSearchParams(next, { replace: true });
    pager.reset();
  };
  const filteredView = Boolean(keyword || status || range);
  const clearFilters = () => {
    setKeyword('');
    const next = new URLSearchParams();
    if (searchParams.get('scope')) next.set('scope', searchParams.get('scope'));
    setSearchParams(next, { replace: true });
    pager.reset();
  };
  const empty = {
    title: filteredView ? 'No matching requests' : 'No procurement requests yet',
    action:
      filteredView ? (
        <Button variant="secondary" size="sm" onClick={clearFilters}>
          Clear filters
        </Button>
      ) : (
        <Button to="/procurement/new" size="sm" icon={Plus}>
          New request
        </Button>
      ),
  };
  const active = pending && (pending.key === 'delete' ? null : ACTIONS[pending.key]);

  return (
    <>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <span className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 sm:flex">
            <ClipboardList className="h-7 w-7" strokeWidth={1.8} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Procurement Requests</h1>
            <p className="mt-1 text-sm text-slate-500">
              {canViewAll ? 'Manage and track all procurement requests, from submission to completion.' : 'Manage and track your procurement requests, from submission to completion.'}
            </p>
          </div>
        </div>
        <Button to="/procurement/new" icon={Plus} size="lg" className="shrink-0 self-start sm:self-auto">
          New Request
        </Button>
      </div>

      {/* KPIs */}
      <section aria-label="Request figures" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KpiCard
          icon={ClipboardList}
          tone="brand"
          label={scope === 'mine' ? 'My Requests' : 'Total Requests'}
          query={countOf('')}
          caption={breakdownReady ? `${formatNumber(openCount)} open · ${formatNumber(countOf('COMPLETED').data || 0)} completed` : undefined}
          onClick={() => updateParam('status', '')}
          active={!status && !searching}
        />
        <KpiCard icon={Send} tone="info" label="Submitted" query={countOf('SUBMITTED')} caption={share('SUBMITTED')} onClick={() => updateParam('status', status === 'SUBMITTED' ? '' : 'SUBMITTED')} active={status === 'SUBMITTED' && !searching} />
        <KpiCard icon={Clock} tone="warning" label="Under Evaluation" query={countOf('UNDER_EVALUATION')} caption={share('UNDER_EVALUATION')} onClick={() => updateParam('status', status === 'UNDER_EVALUATION' ? '' : 'UNDER_EVALUATION')} active={status === 'UNDER_EVALUATION' && !searching} />
        <KpiCard icon={CircleCheck} tone="success" label="Completed" query={countOf('COMPLETED')} caption={share('COMPLETED')} onClick={() => updateParam('status', status === 'COMPLETED' ? '' : 'COMPLETED')} active={status === 'COMPLETED' && !searching} />
      </section>

      {/* Tabs, toolbar and table in one card */}
      <section aria-label="Procurement requests" className="card mt-5 overflow-hidden">
        <div className={cn('overflow-x-auto px-4 pt-2 transition-opacity sm:px-5', searching && 'pointer-events-none opacity-50')} aria-disabled={searching || undefined}>
          <Tabs variant="pill" label="Filter by status" value={searching ? '' : status} onChange={(value) => updateParam('status', value)} tabs={tabs} />
        </div>
        <div className="border-b border-line p-4 sm:px-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <SearchInput
              value={keyword}
              onChange={(value) => {
                setKeyword(value);
                pager.reset();
              }}
              placeholder="Search by title or description…"
              className="xl:min-w-40 xl:flex-1"
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:flex">
              <div className="relative xl:w-40">
                <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <Select
                  aria-label="Sort by"
                  value={knownSort ? sortValue : ''}
                  placeholder={knownSort ? undefined : 'Custom sort'}
                  onChange={(event) => {
                    const [sortBy, direction] = event.target.value.split(':');
                    if (sortBy) pager.setSort(sortBy, direction);
                  }}
                  options={SORTS}
                  selectClassName="pl-9"
                />
              </div>
              {canViewAll && (
                <div className="relative xl:w-40">
                  <Layers className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                  <Select
                    aria-label="Whose requests"
                    value={scope}
                    onChange={(event) => updateParam('scope', event.target.value === 'mine' ? 'mine' : '')}
                    options={[
                      { value: 'all', label: 'All requests' },
                      { value: 'mine', label: 'My requests' },
                    ]}
                    selectClassName="pl-9"
                  />
                </div>
              )}
              <div className="relative xl:w-40">
                <Tag className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <Select
                  aria-label="Status"
                  value={searching ? '' : status}
                  onChange={(event) => updateParam('status', event.target.value)}
                  disabled={searching}
                  title={searching ? 'A search covers all statuses' : undefined}
                  options={[
                    { value: '', label: 'All statuses' },
                    ...STATUSES.map((value) => ({ value, label: countOf(value).data != null ? `${humanize(value)} (${countOf(value).data})` : humanize(value) })),
                  ]}
                  selectClassName="pl-9"
                />
              </div>
              <div className="relative xl:w-40">
                <CalendarDays className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <Select aria-label="Created date range" value={range} onChange={(event) => setRange(event.target.value)} options={DATE_RANGES} selectClassName="pl-9" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              {filteredView && (
                <Button variant="ghost" onClick={clearFilters}>
                  Clear
                </Button>
              )}
              <Button variant="secondary" icon={Download} onClick={exportCsv} loading={exporting}>
                Export
              </Button>
            </div>
          </div>
          {range === 'custom' && (
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
              <Input label="Created from" type="date" value={from} max={to || undefined} onChange={(event) => updateParam('from', event.target.value)} className="sm:w-48" />
              <Input label="Created to" type="date" value={to} min={from || undefined} onChange={(event) => updateParam('to', event.target.value)} className="sm:w-48" />
              {!from && !to && <p className="pb-2 text-xs text-slate-500">Pick a start and/or end date.</p>}
            </div>
          )}
          {searching && <p className="mt-2 text-xs text-slate-500">Searching all statuses. Clear the search to filter by status.</p>}
        </div>

        {/* Desktop / tablet: table */}
        <div className="hidden md:block">
          <DataTable
            roomy
            caption="Procurement requests"
            columns={columns}
            rows={page.items}
            loading={listQuery.isLoading}
            error={listQuery.error}
            onRetry={listQuery.refetch}
            onRowClick={(row) => navigate(`/procurement/${row.id}`)}
            sort={{ sortBy: pager.sortBy, direction: pager.direction, onSort: pager.toggleSort }}
            empty={empty}
          />
        </div>

        {/* Mobile: cards */}
        <div className="md:hidden">
          {listQuery.isLoading ? (
            <div className="divide-y divide-slate-100" aria-hidden="true">
              {[0, 1, 2].map((key) => (
                <div key={key} className="space-y-2 p-4">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              ))}
            </div>
          ) : listQuery.error ? (
            <ErrorState error={listQuery.error} onRetry={listQuery.refetch} />
          ) : page.items.length === 0 ? (
            <EmptyState title={empty.title} action={empty.action} />
          ) : (
            <ul className="divide-y divide-slate-100">
              {page.items.map((row) => (
                <li key={row.id} className="p-4">
                  <div>
                    <div className="min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <RequestCell row={row} />
                        <StatusBadge status={row.status} />
                      </div>
                      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-13">
                        <div>
                          <dt className="text-xs text-slate-500">Quantity</dt>
                          <dd className="text-slate-800">
                            {formatNumber(row.quantity)} {row.unit}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-slate-500">Budget</dt>
                          <dd className="num font-medium text-slate-900">{row.budget != null ? formatCurrency(row.budget) : 'Not set'}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-slate-500">Required by</dt>
                          <dd className="text-slate-800">{formatDate(row.requiredBy)}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-slate-500">Created</dt>
                          <dd className="text-slate-800">{formatDate(row.createdAt)}</dd>
                        </div>
                      </dl>
                      <div className="mt-3">
                        {renderActions(row)}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Pagination {...page} onPageChange={pager.setPage} onSizeChange={pager.setSize} disabled={listQuery.isFetching} noun={['request', 'requests']} />
      </section>

      <ConfirmDialog
        open={Boolean(active)}
        onClose={() => setPending(null)}
        onConfirm={(reason) => action.mutate({ row: pending.row, key: pending.key, reason })}
        loading={action.isPending}
        title={active ? `${active.label}: ${pending?.row.title}` : ''}
        message={active?.message}
        tone={active?.tone}
        confirmLabel={active?.label}
        reasonLabel={active?.reason}
        reasonRequired={active?.reasonRequired}
      />
      <ConfirmDialog
        open={pending?.key === 'delete'}
        onClose={() => setPending(null)}
        onConfirm={() => action.mutate({ row: pending.row, key: 'delete' })}
        loading={action.isPending}
        title="Delete request"
        message={`Delete "${pending?.row.title}"? This cannot be undone.`}
        tone="danger"
        confirmLabel="Delete"
      />
    </>
  );
}
