import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Building2, CalendarDays, CircleX, ClipboardList, Copy, Download, Eye, FileText, Layers, Play, RefreshCw, Search, ShieldCheck, TriangleAlert } from 'lucide-react';
import { endOfDay, isValid, parseISO, startOfDay, startOfYear } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { useDebounce } from '@/hooks/useDebounce';
import { usePagination } from '@/hooks/usePagination';
import { useRequestOptions, useRequestTitles, useVendorOptions } from '@/hooks/useLookups';
import { useVendorNames } from '@/hooks/useVendorNames';
import Button from '@/components/common/Button';
import DataTable from '@/components/common/DataTable';
import Pagination from '@/components/common/Pagination';
import SearchInput from '@/components/common/SearchInput';
import Select from '@/components/common/Select';
import Modal from '@/components/common/Modal';
import Input from '@/components/common/Input';
import Alert from '@/components/common/Alert';
import StatusBadge from '@/components/common/StatusBadge';
import Tabs from '@/components/common/Tabs';
import KpiCard from '@/components/common/KpiCard';
import ActionMenu from '@/components/common/ActionMenu';
import Skeleton from '@/components/common/Skeleton';
import EmptyState, { ErrorState } from '@/components/common/EmptyState';
import { isUuid } from '@/components/common/EntitySelect';
import { cn } from '@/utils/cn';
import { normalizePage } from '@/utils/pagination';
import { formatDateTime } from '@/utils/formatDate';
import { formatCurrency, formatNumber } from '@/utils/formatCurrency';
import { VALIDATION_STATUSES, humanize } from '@/utils/constants';
import { downloadCsv } from '@/utils/exportCsv';
import { quotationKeys, quotationService } from '@/features/quotations/quotationService';
import { validationKeys, validationService } from '../validationService';

// GET /validations is paged (max 100 per page) with status / vendor / request filters but no keyword or
// date filter, so the page loads every validation once and searches, filters, counts and pages them here.
const PAGE_SIZE = 100;
const MAX_PAGES = 20;

async function loadAllValidations(signal) {
  let rows = [];
  for (let index = 0; index < MAX_PAGES; index += 1) {
    const result = normalizePage(await validationService.search({ page: index, size: PAGE_SIZE, sortBy: 'createdAt', direction: 'desc' }, signal));
    rows = rows.concat(result.items);
    if (index + 1 >= result.totalPages) break;
  }
  return rows;
}

const STATUS_LABELS = { NEEDS_REVIEW: 'Needs Review', IN_PROGRESS: 'In Progress' };
const statusLabel = (value) => STATUS_LABELS[value] || humanize(value);
// Running statuses are blue, as in the design system (PENDING is amber elsewhere in the app).
const statusTone = (value) => (value === 'PENDING' || value === 'IN_PROGRESS' ? 'blue' : undefined);
const TRIGGERS = {
  MANUAL: { label: 'Manual', className: 'bg-slate-100 text-slate-600' },
  EXTRACTION_EVENT: { label: 'Automatic', className: 'bg-blue-50 text-blue-700', title: 'Run after an AI extraction' },
  REVALIDATION: { label: 'Revalidation', className: 'bg-brand-50 text-brand-700' },
};

const DATE_RANGES = [
  { value: '', label: 'Date range' },
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

const ICON_BUTTON =
  'flex h-9 w-9 items-center justify-center rounded-md border border-line bg-surface text-slate-600 transition-colors hover:border-line-strong hover:text-slate-900';

const quotationLabel = (row) => row.quotationNumber || `Q-${String(row.quotationId || '').slice(0, 8).toUpperCase()}`;

function TriggerBadge({ trigger }) {
  const config = TRIGGERS[trigger] || { label: humanize(trigger), className: 'bg-slate-100 text-slate-600' };
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium', config.className)} title={config.title}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden="true" />
      {config.label}
    </span>
  );
}

const Count = ({ value, tone }) => (
  <span className={cn('num font-semibold', value ? (tone === 'error' ? 'text-danger' : 'text-warning') : 'text-slate-500')}>{formatNumber(value ?? 0)}</span>
);

/** Run validation: choose the quotation (existing POST /validations { quotationId, extractionId?, documentId? }). */
function RunValidationDialog({ open, onClose }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ quotationId: '', extractionId: '', documentId: '' });
  const [error, setError] = useState(null);
  const quotations = useQuery({ queryKey: quotationKeys.list, queryFn: ({ signal }) => quotationService.list(signal), enabled: open });
  const options = (quotations.data || [])
    .filter((row) => row.status !== 'CANCELLED')
    .map((row) => ({ value: row.id, label: `Q-${row.id.slice(0, 8).toUpperCase()} · ${row.vendorName || 'Unknown vendor'} · ${formatCurrency(row.totalAmount, row.currency)} · ${humanize(row.status)}` }));
  const run = useMutation({
    mutationFn: () => validationService.run(form),
    meta: { silent: true },
    onSuccess: (validation) => {
      toast.success(`Validation finished: ${statusLabel(validation.status)}`);
      queryClient.invalidateQueries({ queryKey: validationKeys.all });
      onClose();
      navigate(`/validation/${validation.id}`);
    },
    onError: (err) => setError(err.message),
  });
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value.trim() }));
  const invalid = !isUuid(form.quotationId) || (form.extractionId && !isUuid(form.extractionId)) || (form.documentId && !isUuid(form.documentId));

  return (
    <Modal
      open={open}
      onClose={run.isPending ? undefined : onClose}
      dismissible={!run.isPending}
      title="Run validation"
      description="Validates a quotation's amounts, dates and vendor against the backend rules."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={run.isPending}>
            Cancel
          </Button>
          <Button icon={Play} onClick={() => run.mutate()} disabled={invalid || run.isPending} loading={run.isPending}>
            {run.isPending ? 'Validating…' : 'Run validation'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        {quotations.isLoading ? (
          <Skeleton className="h-9 w-full" />
        ) : options.length ? (
          <Select label="Quotation" required value={form.quotationId} onChange={set('quotationId')} placeholder="Select a quotation" options={options} />
        ) : (
          <Input label="Quotation ID" required value={form.quotationId} onChange={set('quotationId')} hint={quotations.error ? 'Quotations could not be loaded; paste the ID.' : undefined} />
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Extraction ID" hint="Optional: compare against an AI extraction." value={form.extractionId} onChange={set('extractionId')} error={form.extractionId && !isUuid(form.extractionId) ? 'Enter a valid ID' : undefined} />
          <Input label="Document ID" hint="Optional." value={form.documentId} onChange={set('documentId')} error={form.documentId && !isUuid(form.documentId) ? 'Enter a valid ID' : undefined} />
        </div>
      </div>
    </Modal>
  );
}

export default function ValidationListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can, canAccess } = useAuth();
  const vendorName = useVendorNames();
  const vendors = useVendorOptions({ activeOnly: false });
  const requests = useRequestOptions();
  const requestTitle = useRequestTitles();
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get('status') || '';
  const vendorId = searchParams.get('vendor') || '';
  const requestId = searchParams.get('request') || '';
  const range = searchParams.get('created') || '';
  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';
  const [keyword, setKeyword] = useState('');
  const debounced = useDebounce(keyword.trim().toLowerCase(), 250);
  const pager = usePagination({ size: 20, sortBy: 'createdAt', direction: 'desc' });
  const [running, setRunning] = useState(false);

  const query = useQuery({ queryKey: validationKeys.list({ scope: 'all' }), queryFn: ({ signal }) => loadAllValidations(signal) });
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

  const vendorOf = (row) => (row.vendorId ? vendorName(row.vendorId) : '');
  const filtered = useMemo(() => {
    const bounds = rangeBounds(range, from, to);
    const rows = all.filter((row) => {
      if (status && row.status !== status) return false;
      if (vendorId && row.vendorId !== vendorId) return false;
      if (requestId && row.procurementRequestId !== requestId) return false;
      if (bounds) {
        const date = row.createdAt ? parseISO(row.createdAt) : null;
        if (!date || !isValid(date) || (bounds[0] && date < bounds[0]) || (bounds[1] && date > bounds[1])) return false;
      }
      return !debounced || [quotationLabel(row), row.quotationId, vendorOf(row)].some((value) => value?.toLowerCase().includes(debounced));
    });
    const valueOf = (row) => (pager.sortBy === 'vendor' ? vendorOf(row) : pager.sortBy === 'quotation' ? quotationLabel(row) : row[pager.sortBy]);
    const factor = pager.direction === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const left = valueOf(a) ?? '';
      const right = valueOf(b) ?? '';
      if (typeof left === 'number' || typeof right === 'number') return (Number(left) - Number(right)) * factor;
      return String(left).localeCompare(String(right)) * factor;
    });
    // vendorOf depends on vendorName
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, status, vendorId, requestId, range, from, to, debounced, vendorName, pager.sortBy, pager.direction]);
  const pageRows = filtered.slice(pager.page * pager.size, (pager.page + 1) * pager.size);

  // KPIs (all validations; errors / warnings are the totals of the issue counts)
  const statusCount = (value) => all.filter((row) => row.status === value).length;
  const errorTotal = all.reduce((sum, row) => sum + (row.errorCount || 0), 0);
  const warningTotal = all.reduce((sum, row) => sum + (row.warningCount || 0), 0);
  const figure = (value) => ({ isLoading: query.isLoading, error: query.error, data: query.error ? null : value });

  const revalidate = useMutation({
    mutationFn: (row) => validationService.revalidate(row.id),
    meta: { silent: true },
    onSuccess: (validation) => {
      toast.success(`Revalidated: ${statusLabel(validation.status)}`);
      queryClient.invalidateQueries({ queryKey: validationKeys.all });
      navigate(`/validation/${validation.id}`);
    },
    onError: (error) => toast.error(error.message || 'Revalidation failed'),
  });

  const copyId = async (row) => {
    try {
      await navigator.clipboard.writeText(row.id);
      toast.success('Validation ID copied');
    } catch {
      toast.error('Could not copy to the clipboard');
    }
  };
  const exportCsv = () => {
    if (!filtered.length) {
      toast.info('Nothing to export');
      return;
    }
    downloadCsv(
      `validations-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        { header: 'Validation ID', value: (row) => row.id },
        { header: 'Quotation', value: (row) => quotationLabel(row) },
        { header: 'Quotation ID', value: (row) => row.quotationId },
        { header: 'Vendor', value: (row) => vendorOf(row) },
        { header: 'Procurement request', value: (row) => requestTitle(row.procurementRequestId) || row.procurementRequestId },
        { header: 'Status', value: (row) => statusLabel(row.status) },
        { header: 'Errors', value: (row) => row.errorCount },
        { header: 'Warnings', value: (row) => row.warningCount },
        { header: 'Info', value: (row) => row.infoCount },
        { header: 'Currency', value: (row) => row.currencyCode },
        { header: 'Quoted total', value: (row) => row.quotedTotal },
        { header: 'Expected total', value: (row) => row.expectedTotal },
        { header: 'Trigger', value: (row) => TRIGGERS[row.trigger]?.label || row.trigger },
        { header: 'Created', value: (row) => row.createdAt },
      ],
      filtered,
    );
    toast.success(`Exported ${formatNumber(filtered.length)} ${filtered.length === 1 ? 'validation' : 'validations'}`);
  };

  const menuItems = (row) => [
    { key: 'open', label: 'View details', icon: Eye, onClick: () => navigate(`/validation/${row.id}`) },
    ...(can('validation.run') ? [{ key: 'revalidate', label: 'Revalidate', icon: RefreshCw, disabled: revalidate.isPending, onClick: () => revalidate.mutate(row) }] : []),
    ...(row.quotationId && canAccess('quotations') ? [{ key: 'quotation', label: 'Open quotation', icon: FileText, divider: true, onClick: () => navigate(`/quotations/${row.quotationId}`) }] : []),
    ...(row.procurementRequestId && canAccess('procurement')
      ? [{ key: 'request', label: 'Open procurement request', icon: ClipboardList, divider: !(row.quotationId && canAccess('quotations')), onClick: () => navigate(`/procurement/${row.procurementRequestId}`) }]
      : []),
    { key: 'copy', label: 'Copy validation ID', icon: Copy, divider: true, onClick: () => copyId(row) },
  ];

  const renderActions = (row) => (
    <div className="flex items-center justify-end gap-2" onClick={(event) => event.stopPropagation()}>
      <Link to={`/validation/${row.id}`} className={ICON_BUTTON} aria-label={`View validation of ${quotationLabel(row)}`} title="View details">
        <Eye className="h-4 w-4" aria-hidden="true" />
      </Link>
      <ActionMenu items={menuItems(row)} label={`More actions for ${quotationLabel(row)}`} />
    </div>
  );

  const columns = [
    {
      key: 'quotation',
      header: 'Quotation',
      sortKey: 'quotation',
      render: (row) =>
        row.quotationId && canAccess('quotations') ? (
          <Link to={`/quotations/${row.quotationId}`} onClick={(event) => event.stopPropagation()} className="whitespace-nowrap font-mono text-13 font-semibold text-brand-700 hover:underline" title="Open quotation">
            {quotationLabel(row)}
          </Link>
        ) : (
          <span className="whitespace-nowrap font-mono text-13 font-semibold text-slate-900">{quotationLabel(row)}</span>
        ),
    },
    {
      key: 'vendor',
      header: 'Vendor',
      sortKey: 'vendor',
      render: (row) => (
        <span className="flex max-w-44 items-center gap-2 text-slate-800" title={vendorOf(row)}>
          <Building2 className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          <span className="truncate">{vendorOf(row) || '—'}</span>
        </span>
      ),
    },
    { key: 'status', header: 'Status', sortKey: 'status', render: (row) => <StatusBadge status={row.status} tone={statusTone(row.status)} label={statusLabel(row.status)} /> },
    { key: 'errorCount', header: 'Errors', sortKey: 'errorCount', align: 'right', render: (row) => <Count value={row.errorCount} tone="error" /> },
    { key: 'warningCount', header: 'Warnings', sortKey: 'warningCount', align: 'right', render: (row) => <Count value={row.warningCount} tone="warning" /> },
    {
      key: 'quotedTotal',
      header: 'Quoted Total',
      sortKey: 'quotedTotal',
      align: 'right',
      className: 'whitespace-nowrap',
      render: (row) => <span className="font-medium text-slate-900">{formatCurrency(row.quotedTotal, row.currencyCode)}</span>,
    },
    { key: 'trigger', header: 'Trigger', render: (row) => <TriggerBadge trigger={row.trigger} /> },
    { key: 'createdAt', header: 'Created', sortKey: 'createdAt', className: 'whitespace-nowrap', render: (row) => <span className="text-slate-700">{formatDateTime(row.createdAt)}</span> },
    { key: 'actions', header: 'Actions', headerClassName: 'text-right', render: (row) => renderActions(row) },
  ];

  const filteredView = Boolean(keyword || vendorId || requestId || range);
  const clearFilters = () => {
    setKeyword('');
    const next = new URLSearchParams();
    if (status) next.set('status', status);
    setSearchParams(next, { replace: true });
    pager.reset();
  };
  const canRun = can('validation.run');
  const empty = {
    icon: ShieldCheck,
    title: filteredView || status ? 'No validations match these filters' : 'No validations yet',
    detail: filteredView || status ? undefined : 'Validations run automatically after an AI extraction, or manually with Run validation.',
    action: filteredView ? (
      <Button variant="secondary" size="sm" onClick={clearFilters}>
        Clear filters
      </Button>
    ) : (
      !status &&
      canRun && (
        <Button size="sm" icon={Play} onClick={() => setRunning(true)}>
          Run validation
        </Button>
      )
    ),
  };
  const tabs = [
    { value: '', label: 'All', count: query.data ? all.length : undefined },
    { value: 'NEEDS_REVIEW', label: 'Needs Review', count: query.data ? statusCount('NEEDS_REVIEW') : undefined },
    { value: 'PASSED', label: 'Passed', count: query.data ? statusCount('PASSED') : undefined },
    { value: 'FAILED', label: 'Failed', count: query.data ? statusCount('FAILED') : undefined },
    ...['PENDING', 'IN_PROGRESS'].filter((value) => statusCount(value) || status === value).map((value) => ({ value, label: statusLabel(value), count: statusCount(value) })),
  ];

  return (
    <>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <span className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 sm:flex">
            <ShieldCheck className="h-7 w-7" strokeWidth={1.8} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Validation</h1>
            <p className="mt-1 text-sm text-slate-500">Review quotation checks, resolve issues and monitor validation outcomes.</p>
          </div>
        </div>
        {canRun && (
          <Button icon={Play} size="lg" onClick={() => setRunning(true)} className="shrink-0 self-start sm:self-auto">
            Run validation
          </Button>
        )}
      </div>

      {/* KPIs */}
      <section aria-label="Validation figures" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KpiCard icon={Layers} tone="brand" label="Total Validations" query={figure(all.length)} emptyText="—" onClick={() => setParam('status', '')} active={!status} />
        <KpiCard icon={Search} tone="warning" label="Needs Review" query={figure(statusCount('NEEDS_REVIEW'))} emptyText="—" onClick={() => setParam('status', status === 'NEEDS_REVIEW' ? '' : 'NEEDS_REVIEW')} active={status === 'NEEDS_REVIEW'} />
        <KpiCard icon={CircleX} tone="danger" label="Errors" query={figure(errorTotal)} emptyText="—" caption={query.data ? `${formatNumber(statusCount('FAILED'))} failed ${statusCount('FAILED') === 1 ? 'validation' : 'validations'}` : undefined} />
        <KpiCard icon={TriangleAlert} tone="warning" label="Warnings" query={figure(warningTotal)} emptyText="—" caption={query.data ? `Across ${formatNumber(all.filter((row) => row.warningCount).length)} validations` : undefined} />
      </section>

      {/* Tabs, filters and table */}
      <section aria-label="Validations" className="card mt-5">
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
              placeholder="Search by quotation ID or vendor…"
              className="xl:min-w-48 xl:flex-1"
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:flex">
              <Select
                aria-label="Status"
                value={status}
                onChange={(event) => setParam('status', event.target.value)}
                options={[{ value: '', label: 'All statuses' }, ...VALIDATION_STATUSES.map((value) => ({ value, label: query.data ? `${statusLabel(value)} (${statusCount(value)})` : statusLabel(value) }))]}
                className="xl:w-40"
              />
              <Select
                aria-label="Vendor"
                value={vendorId}
                onChange={(event) => setParam('vendor', event.target.value)}
                options={[{ value: '', label: 'All vendors' }, ...(vendors.data || [])]}
                className="xl:w-40"
              />
              <Select
                aria-label="Procurement request"
                value={requestId}
                onChange={(event) => setParam('request', event.target.value)}
                options={[{ value: '', label: 'All requests' }, ...(requests.data || []).map((option) => ({ value: option.value, label: option.title }))]}
                className="xl:w-40"
              />
              <div className="relative xl:w-40">
                <CalendarDays className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <Select aria-label="Created date range" value={range} onChange={(event) => setParam('created', event.target.value)} options={DATE_RANGES} selectClassName="pl-9" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              {filteredView && (
                <Button variant="ghost" onClick={clearFilters}>
                  Clear
                </Button>
              )}
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
            caption="Validations"
            columns={columns}
            rows={pageRows}
            loading={query.isLoading}
            error={query.error}
            onRetry={query.refetch}
            onRowClick={(row) => navigate(`/validation/${row.id}`)}
            sort={{ sortBy: pager.sortBy, direction: pager.direction, onSort: pager.toggleSort }}
            empty={empty}
          />
        </div>

        {/* Mobile: cards */}
        <div className="md:hidden">
          {query.isLoading ? (
            <div className="space-y-2 p-4" aria-hidden="true">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : query.error ? (
            <ErrorState error={query.error} onRetry={query.refetch} />
          ) : pageRows.length === 0 ? (
            <EmptyState showIcon icon={ShieldCheck} title={empty.title} detail={empty.detail} action={empty.action} />
          ) : (
            <ul className="divide-y divide-slate-100">
              {pageRows.map((row) => (
                <li key={row.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block font-mono text-13 font-semibold text-brand-700">{quotationLabel(row)}</span>
                      <span className="block truncate text-xs text-slate-500">{vendorOf(row) || '—'}</span>
                    </span>
                    <StatusBadge status={row.status} tone={statusTone(row.status)} label={statusLabel(row.status)} />
                  </div>
                  <dl className="mt-3 grid grid-cols-3 gap-x-4 gap-y-2 text-13">
                    <div>
                      <dt className="text-xs text-slate-500">Errors</dt>
                      <dd>
                        <Count value={row.errorCount} tone="error" />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Warnings</dt>
                      <dd>
                        <Count value={row.warningCount} tone="warning" />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Quoted total</dt>
                      <dd className="num font-medium text-slate-900">{formatCurrency(row.quotedTotal, row.currencyCode)}</dd>
                    </div>
                    <div className="col-span-3 flex items-center justify-between gap-2">
                      <TriggerBadge trigger={row.trigger} />
                      <span className="text-xs text-slate-500">{formatDateTime(row.createdAt)}</span>
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
          noun={['validation', 'validations']}
        />
      </section>

      {running && <RunValidationDialog open onClose={() => setRunning(false)} />}
    </>
  );
}
