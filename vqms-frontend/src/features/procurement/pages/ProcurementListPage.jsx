import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  CalendarDays,
  Check,
  Copy,
  Download,
  Eye,
  FileText,
  Hourglass,
  ListFilter,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  ShoppingCart,
  Trash,
  X,
} from 'lucide-react';
import { differenceInCalendarDays, isValid, parseISO } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { useDebounce } from '@/hooks/useDebounce';
import { usePagination } from '@/hooks/usePagination';
import Button from '@/components/common/Button';
import DataTable from '@/components/common/DataTable';
import Pagination from '@/components/common/Pagination';
import SearchInput from '@/components/common/SearchInput';
import Select from '@/components/common/Select';
import StatusBadge from '@/components/common/StatusBadge';
import KpiCard from '@/components/common/KpiCard';
import ActionMenu from '@/components/common/ActionMenu';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import Skeleton from '@/components/common/Skeleton';
import EmptyState, { ErrorState } from '@/components/common/EmptyState';
import { cn } from '@/utils/cn';
import { normalizePage } from '@/utils/pagination';
import { formatDate } from '@/utils/formatDate';
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

const SORTS = [
  { value: 'createdAt:desc', label: 'Newest first' },
  { value: 'createdAt:asc', label: 'Oldest first' },
  { value: 'requiredBy:asc', label: 'Needed soonest' },
  { value: 'updatedAt:desc', label: 'Recently updated' },
  { value: 'title:asc', label: 'Title (A–Z)' },
];

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
    <span className="flex items-start gap-2 whitespace-nowrap">
      <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
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
        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
          <span className="h-1 w-1 rounded-full bg-slate-400" aria-hidden="true" />
          <span className="font-mono">{requestReference(row.id)}</span>
        </p>
      </div>
    </div>
  );
}

/** Small popover anchored to the "Filters" button. */
function FilterPopover({ open, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => !ref.current?.parentElement?.contains(event.target) && onClose();
    const onKey = (event) => event.key === 'Escape' && onClose();
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div ref={ref} role="dialog" aria-label="Filters" className="absolute right-0 top-11 z-30 w-72 rounded-md border border-line bg-surface p-4 shadow-lg">
      {children}
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
  const [selected, setSelected] = useState(() => new Map());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [pending, setPending] = useState(null); // { row, key } – key is an action key or 'delete'
  const [exporting, setExporting] = useState(false);

  const updateParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
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
  });
  const page = normalizePage(query.data);

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
    onSuccess: (_, { row, key }) => {
      if (key === 'delete') {
        setSelected((current) => {
          const next = new Map(current);
          next.delete(row.id);
          return next;
        });
      }
      setPending(null);
      refreshAll();
    },
  });

  // ---- Selection (kept across pages) ----
  const pageIds = page.items.map((row) => row.id);
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const someOnPage = pageIds.some((id) => selected.has(id));
  const toggleRow = (row) =>
    setSelected((current) => {
      const next = new Map(current);
      if (next.has(row.id)) next.delete(row.id);
      else next.set(row.id, row);
      return next;
    });
  const toggleAll = () =>
    setSelected((current) => {
      const next = new Map(current);
      if (allOnPage) pageIds.forEach((id) => next.delete(id));
      else page.items.forEach((row) => next.set(row.id, row));
      return next;
    });

  // ---- Export: the selection, or every request matching the current filters ----
  const exportCsv = async () => {
    setExporting(true);
    try {
      let rows = [...selected.values()];
      if (!rows.length) {
        for (let index = 0; index < 50; index += 1) {
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
    { key: 'requiredBy', header: 'Required By', sortKey: 'requiredBy', render: (row) => <DateCell value={row.requiredBy} hint={OPEN_STATUSES.includes(row.status)} /> },
    { key: 'status', header: 'Status', sortKey: 'status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'createdAt', header: 'Created', sortKey: 'createdAt', render: (row) => <DateCell value={row.createdAt} /> },
    { key: 'actions', header: 'Actions', headerClassName: 'text-right', render: (row) => renderActions(row) },
  ];

  const sortValue = `${pager.sortBy}:${pager.direction}`;
  const knownSort = SORTS.some((option) => option.value === sortValue);
  const activeFilters = (status && !searching ? 1 : 0) + (canViewAll && scope === 'mine' ? 1 : 0);
  const empty = {
    title: keyword || status ? 'No matching requests' : 'No procurement requests yet',
    action:
      keyword || status ? (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setKeyword('');
            updateParam('status', '');
          }}
        >
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
            <ShoppingCart className="h-7 w-7" strokeWidth={1.8} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Procurement Requests</h1>
            <p className="mt-1 text-sm text-slate-500">
              {canViewAll ? 'Create, track and manage procurement requests across your organization.' : 'Create, track and manage the procurement requests you have raised.'}
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
          icon={FileText}
          tone="brand"
          label={scope === 'mine' ? 'My Requests' : 'Total Requests'}
          query={countOf('')}
          caption={breakdownReady ? `${formatNumber(openCount)} open · ${formatNumber(countOf('COMPLETED').data || 0)} completed` : undefined}
          onClick={() => updateParam('status', '')}
          active={!status && !searching}
        />
        <KpiCard icon={Hourglass} tone="warning" label="Pending" query={countOf('SUBMITTED')} caption={share('SUBMITTED')} onClick={() => updateParam('status', status === 'SUBMITTED' ? '' : 'SUBMITTED')} active={status === 'SUBMITTED' && !searching} />
        <KpiCard icon={Check} tone="success" label="Approved" query={countOf('APPROVED')} caption={share('APPROVED')} onClick={() => updateParam('status', status === 'APPROVED' ? '' : 'APPROVED')} active={status === 'APPROVED' && !searching} />
        <KpiCard icon={X} tone="danger" label="Rejected" query={countOf('REJECTED')} caption={share('REJECTED')} onClick={() => updateParam('status', status === 'REJECTED' ? '' : 'REJECTED')} active={status === 'REJECTED' && !searching} />
      </section>

      {/* Toolbar */}
      <section aria-label="Search and filters" className="card mt-5 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <SearchInput
            value={keyword}
            onChange={(value) => {
              setKeyword(value);
              pager.reset();
            }}
            placeholder="Search by request title or description…"
            className="lg:w-96"
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex">
            <Select
              aria-label="Status"
              value={searching ? '' : status}
              onChange={(event) => updateParam('status', event.target.value)}
              disabled={searching}
              title={searching ? 'A search covers all statuses' : undefined}
              options={[
                { value: '', label: 'All Statuses' },
                ...STATUSES.map((value) => ({ value, label: countOf(value).data != null ? `${humanize(value)} (${countOf(value).data})` : humanize(value) })),
              ]}
              className="lg:w-56"
            />
            <div className="relative lg:w-56">
              <CalendarDays className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <Select
                aria-label="Sort by date or title"
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
          </div>
          <div className="flex items-center gap-2 lg:ml-auto">
            {canViewAll && (
              <div className="relative">
                <Button variant="secondary" icon={ListFilter} onClick={() => setFiltersOpen((value) => !value)} aria-expanded={filtersOpen}>
                  Filters
                  {activeFilters > 0 && <span className="num ml-1 rounded-full bg-brand-600 px-1.5 text-2xs font-semibold text-white">{activeFilters}</span>}
                </Button>
                <FilterPopover open={filtersOpen} onClose={() => setFiltersOpen(false)}>
                  <fieldset>
                    <legend className="text-13 font-semibold text-slate-900">Whose requests</legend>
                    <div className="mt-2 space-y-1.5">
                      {[
                        { value: 'all', label: 'All requests in the organization' },
                        { value: 'mine', label: 'Only requests I raised' },
                      ].map((option) => (
                        <label key={option.value} className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-13 text-slate-700 hover:bg-slate-50">
                          <input
                            type="radio"
                            name="scope"
                            className="accent-brand-600"
                            checked={scope === option.value}
                            onChange={() => updateParam('scope', option.value === 'mine' ? 'mine' : '')}
                          />
                          {option.label}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <div className="mt-4 flex justify-between border-t border-line pt-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setKeyword('');
                        setSearchParams({}, { replace: true });
                        pager.reset();
                        setFiltersOpen(false);
                      }}
                    >
                      Reset all
                    </Button>
                    <Button size="sm" onClick={() => setFiltersOpen(false)}>
                      Done
                    </Button>
                  </div>
                </FilterPopover>
              </div>
            )}
            <Button variant="secondary" icon={Download} onClick={exportCsv} loading={exporting}>
              {selected.size ? `Export (${selected.size})` : 'Export'}
            </Button>
            <button type="button" className={ICON_BUTTON} onClick={refreshAll} aria-label="Refresh" title="Refresh">
              <RefreshCw className={cn('h-4 w-4', query.isFetching && 'animate-spin')} aria-hidden="true" />
            </button>
          </div>
        </div>
        {searching && <p className="mt-2 text-xs text-slate-500">Searching all statuses. Clear the search to filter by status.</p>}
      </section>

      {/* Table */}
      <section aria-label="Procurement requests" className="card mt-5 overflow-hidden">
        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-b border-line bg-brand-50/50 px-5 py-2.5 text-13">
            <span className="font-medium text-slate-900">
              {formatNumber(selected.size)} selected
            </span>
            <button type="button" className="font-medium text-brand-700 hover:underline" onClick={exportCsv}>
              Export selected
            </button>
            <button type="button" className="text-slate-500 hover:text-slate-900" onClick={() => setSelected(new Map())}>
              Clear selection
            </button>
          </div>
        )}

        {/* Desktop / tablet: table */}
        <div className="hidden md:block">
          <DataTable
            roomy
            caption="Procurement requests"
            columns={columns}
            rows={page.items}
            loading={query.isLoading}
            error={query.error}
            onRetry={query.refetch}
            onRowClick={(row) => navigate(`/procurement/${row.id}`)}
            sort={{ sortBy: pager.sortBy, direction: pager.direction, onSort: pager.toggleSort }}
            selection={{ isSelected: (row) => selected.has(row.id), onToggle: toggleRow, allSelected: allOnPage, someSelected: someOnPage, onToggleAll: toggleAll }}
            empty={empty}
          />
        </div>

        {/* Mobile: cards */}
        <div className="md:hidden">
          {query.isLoading ? (
            <div className="divide-y divide-slate-100" aria-hidden="true">
              {[0, 1, 2].map((key) => (
                <div key={key} className="space-y-2 p-4">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              ))}
            </div>
          ) : query.error ? (
            <ErrorState error={query.error} onRetry={query.refetch} />
          ) : page.items.length === 0 ? (
            <EmptyState title={empty.title} action={empty.action} />
          ) : (
            <ul className="divide-y divide-slate-100">
              {page.items.map((row) => (
                <li key={row.id} className={cn('p-4', selected.has(row.id) && 'bg-brand-50/40')}>
                  <div className="flex items-start gap-3">
                    <input type="checkbox" className="checkbox-base mt-3" checked={selected.has(row.id)} onChange={() => toggleRow(row)} aria-label={`Select ${row.title}`} />
                    <div className="min-w-0 flex-1">
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

        <Pagination {...page} onPageChange={pager.setPage} onSizeChange={pager.setSize} disabled={query.isFetching} noun={['request', 'requests']} />
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
