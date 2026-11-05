import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Building2,
  CalendarDays,
  Check,
  CircleX,
  ClipboardList,
  Clock,
  Copy,
  Download,
  Eye,
  FileText,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash,
} from 'lucide-react';
import { differenceInCalendarDays, isValid, parseISO, startOfYear } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { useDebounce } from '@/hooks/useDebounce';
import { usePagination } from '@/hooks/usePagination';
import { useRequestTitles } from '@/hooks/useLookups';
import Button from '@/components/common/Button';
import DataTable from '@/components/common/DataTable';
import Pagination from '@/components/common/Pagination';
import SearchInput from '@/components/common/SearchInput';
import Select from '@/components/common/Select';
import StatusBadge from '@/components/common/StatusBadge';
import Tabs from '@/components/common/Tabs';
import KpiCard from '@/components/common/KpiCard';
import ActionMenu from '@/components/common/ActionMenu';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import Skeleton from '@/components/common/Skeleton';
import EmptyState, { ErrorState } from '@/components/common/EmptyState';
import { cn } from '@/utils/cn';
import { formatDate } from '@/utils/formatDate';
import { formatCurrency, formatNumber } from '@/utils/formatCurrency';
import { QUOTATION_STATUSES, humanize } from '@/utils/constants';
import { downloadCsv } from '@/utils/exportCsv';
import { validationKeys, validationService } from '@/features/validation/validationService';
import { quotationKeys, quotationService } from '../quotationService';
import { ACTIONS, isManual, quotationPermissions } from '../quotationActions';

// Tabs that are always shown (as in the design); other statuses get a tab once they have quotations.
const MAIN_TABS = ['SUBMITTED', 'VALIDATED', 'NEEDS_REVIEW', 'REJECTED'];
const TAB_LABELS = { NEEDS_REVIEW: 'Needs Review' };
const tabLabel = (value) => TAB_LABELS[value] || humanize(value);

const DATE_RANGES = [
  { value: '', label: 'Any quotation date' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: 'year', label: 'This year' },
];

const EXPORT_COLUMNS = (requestTitle) => [
  { header: 'Quotation ID', value: (row) => row.id },
  { header: 'Vendor', value: (row) => row.vendorName },
  { header: 'Procurement request', value: (row) => requestTitle(row.purchaseRequestId) || row.purchaseRequestId },
  { header: 'Source', value: (row) => (isManual(row) ? 'Manual entry' : row.fileName) },
  { header: 'Quotation date', value: (row) => row.quotationDate },
  { header: 'Valid until', value: (row) => row.validUntil },
  { header: 'Version', value: (row) => row.version },
  { header: 'Currency', value: (row) => row.currency },
  { header: 'Total', value: (row) => row.totalAmount },
  { header: 'Status', value: (row) => humanize(row.status) },
  { header: 'Received', value: (row) => row.createdAt?.slice(0, 10) },
];

const ICON_BUTTON =
  'flex h-9 w-9 items-center justify-center rounded-md border border-line bg-surface text-slate-600 transition-colors hover:border-line-strong hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-line disabled:hover:text-slate-600';

/** Quotation date (falls back to the date it was received). */
const dateOf = (row) => {
  const value = row.quotationDate || row.createdAt;
  const date = value ? parseISO(value) : null;
  return date && isValid(date) ? date : null;
};

function inRange(row, range) {
  if (!range) return true;
  const date = dateOf(row);
  if (!date) return false;
  if (range === 'year') return date >= startOfYear(new Date());
  return differenceInCalendarDays(new Date(), date) <= Number(range);
}

function VendorCell({ row, requestTitle }) {
  const title = requestTitle(row.purchaseRequestId);
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600">
        <Building2 className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <Link to={`/quotations/${row.id}`} onClick={(event) => event.stopPropagation()} className="block max-w-64 truncate font-semibold text-slate-900 hover:text-brand-700" title={row.vendorName}>
          {row.vendorName || 'Unknown vendor'}
        </Link>
        {title && (
          <p className="mt-0.5 max-w-64 truncate text-xs text-slate-500" title={title}>
            For: {title}
          </p>
        )}
      </div>
    </div>
  );
}

function SourceCell({ row }) {
  if (isManual(row)) return <span className="text-slate-600">Manual entry</span>;
  return (
    <span className="flex max-w-48 items-center gap-1.5 text-slate-700" title={row.fileName}>
      <FileText className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
      <span className="truncate">{row.fileName}</span>
    </span>
  );
}

function DateCell({ value }) {
  const date = value ? parseISO(value) : null;
  if (!date || !isValid(date)) return <span className="text-slate-400">—</span>;
  return (
    <span className="flex items-center gap-2 whitespace-nowrap text-slate-800">
      <CalendarDays className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
      {formatDate(value)}
    </span>
  );
}

// GET /quotations returns the complete list (no server paging), so counts, filters, sorting and
// paging are calculated on that response. Amounts are shown exactly as the backend returns them.
export default function QuotationListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can, canAccess } = useAuth();
  const requestTitle = useRequestTitles();
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get('status') || '';
  const [range, setRange] = useState('');
  const [keyword, setKeyword] = useState('');
  const debounced = useDebounce(keyword.trim().toLowerCase(), 250);
  const pager = usePagination({ size: 10, sortBy: 'createdAt', direction: 'desc' });
  const [pending, setPending] = useState(null); // { row, key } – workflow key or 'delete'

  const query = useQuery({ queryKey: quotationKeys.list, queryFn: ({ signal }) => quotationService.list(signal) });
  const all = useMemo(() => query.data || [], [query.data]);

  const setStatus = (value) => {
    const next = new URLSearchParams(window.location.search);
    if (value) next.set('status', value);
    else next.delete('status');
    setSearchParams(next, { replace: true });
    pager.reset();
  };

  const counts = useMemo(() => {
    const map = {};
    all.forEach((row) => {
      map[row.status] = (map[row.status] || 0) + 1;
    });
    return map;
  }, [all]);

  // Search + date range first (tab counts follow them), then the status.
  const matching = useMemo(
    () =>
      all.filter(
        (row) =>
          inRange(row, range) &&
          (!debounced || [row.vendorName, row.fileName, row.notes, requestTitle(row.purchaseRequestId)].some((value) => value?.toLowerCase().includes(debounced))),
      ),
    [all, range, debounced, requestTitle],
  );
  const matchingCounts = useMemo(() => {
    const map = {};
    matching.forEach((row) => {
      map[row.status] = (map[row.status] || 0) + 1;
    });
    return map;
  }, [matching]);

  const filtered = useMemo(() => {
    const rows = status ? matching.filter((row) => row.status === status) : matching;
    const { sortBy, direction } = pager;
    const factor = direction === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const left = a[sortBy] ?? '';
      const right = b[sortBy] ?? '';
      if (typeof left === 'number' || typeof right === 'number') return (Number(left) - Number(right)) * factor;
      return String(left).localeCompare(String(right)) * factor;
    });
  }, [matching, status, pager]);
  const pageRows = filtered.slice(pager.page * pager.size, (pager.page + 1) * pager.size);

  const tabs = [
    { value: '', label: 'All', count: query.data ? matching.length : undefined },
    ...MAIN_TABS.map((value) => ({ value, label: tabLabel(value), count: query.data ? matchingCounts[value] || 0 : undefined })),
    ...QUOTATION_STATUSES.filter((value) => !MAIN_TABS.includes(value) && (counts[value] || value === status)).map((value) => ({
      value,
      label: humanize(value),
      count: matchingCounts[value] || 0,
    })),
  ];

  // KPI figures from the full list (independent of search and filters).
  const figure = (value) => ({ isLoading: query.isLoading, error: query.error, data: value });
  const share = (value) => (all.length ? `${Math.round((value / all.length) * 100)}% of total` : undefined);
  const inProgress = ['UPLOADED', 'QUEUED', 'PROCESSING', 'EXTRACTED'].reduce((sum, value) => sum + (counts[value] || 0), 0);

  const refresh = () => queryClient.invalidateQueries({ queryKey: quotationKeys.all });
  const action = useMutation({
    mutationFn: ({ row, key }) => (key === 'delete' ? quotationService.remove(row.id) : quotationService[key](row.id)),
    meta: { successMessage: 'Quotation updated' },
    onSuccess: () => {
      setPending(null);
      refresh();
    },
  });
  const validate = useMutation({
    mutationFn: (row) => validationService.run({ quotationId: row.id }),
    meta: { successMessage: 'Validation completed' },
    onSuccess: (validation) => {
      queryClient.invalidateQueries({ queryKey: validationKeys.all });
      refresh();
      if (validation?.id) navigate(`/validation/${validation.id}`);
    },
  });

  const copyId = async (row) => {
    try {
      await navigator.clipboard.writeText(row.id);
      toast.success('Quotation ID copied');
    } catch {
      toast.error('Could not copy to the clipboard');
    }
  };

  const exportCsv = () => {
    if (!filtered.length) {
      toast.info('Nothing to export');
      return;
    }
    downloadCsv(`quotations-${new Date().toISOString().slice(0, 10)}.csv`, EXPORT_COLUMNS(requestTitle), filtered);
    toast.success(`Exported ${formatNumber(filtered.length)} ${filtered.length === 1 ? 'quotation' : 'quotations'}`);
  };

  const menuItems = (row) => {
    const permissions = quotationPermissions(row, can);
    return [
      { key: 'open', label: 'Open details', icon: Eye, onClick: () => navigate(`/quotations/${row.id}`) },
      ...permissions.actions.map((key) => ({ key, label: ACTIONS[key].label, icon: ACTIONS[key].icon, tone: ACTIONS[key].tone, onClick: () => setPending({ row, key }) })),
      ...(permissions.canValidate && row.status !== 'CANCELLED'
        ? [{ key: 'validate', label: 'Run validation', icon: ShieldCheck, disabled: validate.isPending, onClick: () => validate.mutate(row) }]
        : []),
      ...(permissions.canNewVersion ? [{ key: 'version', label: 'New version', icon: Copy, onClick: () => navigate(`/quotations/new?versionOf=${row.id}`) }] : []),
      ...(row.purchaseRequestId && canAccess('procurement')
        ? [{ key: 'request', label: 'Open procurement request', icon: ClipboardList, divider: true, onClick: () => navigate(`/procurement/${row.purchaseRequestId}`) }]
        : []),
      { key: 'copy', label: 'Copy quotation ID', icon: Copy, divider: !(row.purchaseRequestId && canAccess('procurement')), onClick: () => copyId(row) },
      ...(permissions.canDelete ? [{ key: 'delete', label: 'Delete', icon: Trash, tone: 'danger', divider: true, onClick: () => setPending({ row, key: 'delete' }) }] : []),
    ];
  };

  const renderActions = (row) => {
    const { canEdit } = quotationPermissions(row, can);
    return (
      <div className="flex items-center justify-end gap-2" onClick={(event) => event.stopPropagation()}>
        <Link to={`/quotations/${row.id}`} className={ICON_BUTTON} aria-label={`View quotation from ${row.vendorName}`} title="View">
          <Eye className="h-4 w-4" aria-hidden="true" />
        </Link>
        {can('quotation.manage') && (
          <button
            type="button"
            className={ICON_BUTTON}
            onClick={() => navigate(`/quotations/${row.id}/edit`)}
            disabled={!canEdit}
            aria-label={`Edit quotation from ${row.vendorName}`}
            title={canEdit ? 'Edit' : `A ${humanize(row.status).toLowerCase()} quotation cannot be edited`}
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
        <ActionMenu items={menuItems(row)} label={`More actions for the quotation from ${row.vendorName}`} />
      </div>
    );
  };

  const columns = [
    { key: 'vendorName', header: 'Vendor', sortKey: 'vendorName', className: 'min-w-60', render: (row) => <VendorCell row={row} requestTitle={requestTitle} /> },
    { key: 'source', header: 'Source', sortKey: 'fileName', render: (row) => <SourceCell row={row} /> },
    { key: 'quotationDate', header: 'Quotation Date', sortKey: 'quotationDate', render: (row) => <DateCell value={row.quotationDate} /> },
    { key: 'version', header: 'Version', sortKey: 'version', align: 'right', render: (row) => row.version ?? 1 },
    {
      key: 'totalAmount',
      header: 'Total',
      sortKey: 'totalAmount',
      align: 'right',
      className: 'whitespace-nowrap',
      render: (row) => <span className="font-semibold text-slate-900">{formatCurrency(row.totalAmount, row.currency)}</span>,
    },
    { key: 'status', header: 'Status', sortKey: 'status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'actions', header: 'Actions', headerClassName: 'text-right', render: (row) => renderActions(row) },
  ];

  const filteredView = Boolean(keyword || status || range);
  const clearFilters = () => {
    setKeyword('');
    setRange('');
    setStatus('');
  };
  const empty = {
    title: filteredView ? 'No quotations match these filters' : 'No quotations yet',
    action: filteredView ? (
      <Button variant="secondary" size="sm" onClick={clearFilters}>
        Clear filters
      </Button>
    ) : (
      can('quotation.manage') && (
        <Button to="/quotations/new" size="sm" icon={Plus}>
          New quotation
        </Button>
      )
    ),
  };
  const active = pending && pending.key !== 'delete' ? ACTIONS[pending.key] : null;

  return (
    <>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <span className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 sm:flex">
            <FileText className="h-7 w-7" strokeWidth={1.8} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Quotations</h1>
            <p className="mt-1 text-sm text-slate-500">Review and manage vendor quotations received against procurement requests.</p>
          </div>
        </div>
        {can('quotation.manage') && (
          <Button to="/quotations/new" icon={Plus} size="lg" className="shrink-0 self-start sm:self-auto">
            New Quotation
          </Button>
        )}
      </div>

      {/* KPIs */}
      <section aria-label="Quotation figures" className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          icon={FileText}
          tone="brand"
          label="Total Quotations"
          query={figure(all.length)}
          caption={all.length ? `${formatNumber(inProgress)} in processing` : undefined}
          onClick={() => setStatus('')}
          active={!status}
        />
        {[
          { value: 'SUBMITTED', label: 'Submitted', icon: Check, tone: 'success' },
          { value: 'VALIDATED', label: 'Validated', icon: ShieldCheck, tone: 'info' },
          { value: 'NEEDS_REVIEW', label: 'Needs Review', icon: Clock, tone: 'warning' },
          { value: 'REJECTED', label: 'Rejected', icon: CircleX, tone: 'danger' },
        ].map((card) => (
          <KpiCard
            key={card.value}
            icon={card.icon}
            tone={card.tone}
            label={card.label}
            query={figure(counts[card.value] || 0)}
            caption={share(counts[card.value] || 0)}
            onClick={() => setStatus(status === card.value ? '' : card.value)}
            active={status === card.value}
          />
        ))}
      </section>

      {/* Tabs, filters and table */}
      <section aria-label="Quotations" className="card mt-5 overflow-hidden">
        <div className="overflow-x-auto px-4 pt-2 sm:px-5">
          <Tabs variant="pill" label="Filter by status" value={status} onChange={setStatus} tabs={tabs} />
        </div>

        <div className="flex flex-col gap-3 border-b border-line p-4 sm:px-5 lg:flex-row lg:items-center">
          <SearchInput
            value={keyword}
            onChange={(value) => {
              setKeyword(value);
              pager.reset();
            }}
            placeholder="Search vendor, file, notes or request…"
            className="lg:w-96"
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex">
            <Select
              aria-label="Status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              options={[
                { value: '', label: 'All Statuses' },
                ...QUOTATION_STATUSES.map((value) => ({ value, label: query.data ? `${humanize(value)} (${counts[value] || 0})` : humanize(value) })),
              ]}
              className="lg:w-56"
            />
            <div className="relative lg:w-56">
              <CalendarDays className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <Select
                aria-label="Quotation date"
                value={range}
                onChange={(event) => {
                  setRange(event.target.value);
                  pager.reset();
                }}
                options={DATE_RANGES}
                selectClassName="pl-9"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 lg:ml-auto">
            {filteredView && (
              <Button variant="ghost" onClick={clearFilters}>
                Clear
              </Button>
            )}
            <Button variant="secondary" icon={Download} onClick={exportCsv} disabled={query.isLoading || Boolean(query.error)}>
              Export
            </Button>
            <button type="button" className={ICON_BUTTON} onClick={() => query.refetch()} aria-label="Refresh" title="Refresh">
              <RefreshCw className={cn('h-4 w-4', query.isFetching && 'animate-spin')} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Desktop / tablet: table */}
        <div className="hidden md:block">
          <DataTable
            roomy
            caption="Quotations"
            columns={columns}
            rows={pageRows}
            loading={query.isLoading}
            error={query.error}
            onRetry={query.refetch}
            onRowClick={(row) => navigate(`/quotations/${row.id}`)}
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
            <EmptyState title={empty.title} action={empty.action} />
          ) : (
            <ul className="divide-y divide-slate-100">
              {pageRows.map((row) => (
                <li key={row.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <VendorCell row={row} requestTitle={requestTitle} />
                    <StatusBadge status={row.status} />
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-13">
                    <div>
                      <dt className="text-xs text-slate-500">Total</dt>
                      <dd className="num font-semibold text-slate-900">{formatCurrency(row.totalAmount, row.currency)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Quotation date</dt>
                      <dd className="text-slate-800">{formatDate(row.quotationDate)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Source</dt>
                      <dd className="truncate text-slate-800">{isManual(row) ? 'Manual entry' : row.fileName}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Version</dt>
                      <dd className="text-slate-800">{row.version ?? 1}</dd>
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
          noun={['quotation', 'quotations']}
        />
      </section>

      <ConfirmDialog
        open={Boolean(active)}
        onClose={() => setPending(null)}
        onConfirm={() => action.mutate({ row: pending.row, key: pending.key })}
        loading={action.isPending}
        title={active ? `${active.label}: ${pending.row.vendorName || 'quotation'}` : ''}
        message={active?.message}
        tone={active?.tone}
        confirmLabel={active?.label}
      />
      <ConfirmDialog
        open={pending?.key === 'delete'}
        onClose={() => setPending(null)}
        onConfirm={() => action.mutate({ row: pending.row, key: 'delete' })}
        loading={action.isPending}
        title="Delete quotation"
        message={`Delete the quotation from ${pending?.row.vendorName || 'this vendor'}? This cannot be undone.`}
        tone="danger"
        confirmLabel="Delete"
      />
    </>
  );
}
