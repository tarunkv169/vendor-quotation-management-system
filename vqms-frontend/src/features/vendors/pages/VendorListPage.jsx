import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowUpDown, CalendarPlus, CircleCheck, CircleX, Copy, Download, Eye, Layers, Mail, MapPin, Pencil, Phone, Plus, Power, Trash, Users } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { useDebounce } from '@/hooks/useDebounce';
import { usePagination } from '@/hooks/usePagination';
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
import { normalizePage } from '@/utils/pagination';
import { formatDate } from '@/utils/formatDate';
import { formatNumber } from '@/utils/formatCurrency';
import { downloadCsv } from '@/utils/exportCsv';
import { vendorKeys, vendorService } from '../vendorService';
import { registeredThisMonth, vendorInitials, vendorLocation } from '../vendorUtils';

// The vendor API pages results and searches name/email only, without location or monthly figures, so
// the page loads every vendor once (100 per call) and searches, filters, counts and pages them here.
const PAGE_SIZE = 100;
const MAX_PAGES = 20;

async function loadAllVendors(signal) {
  let rows = [];
  for (let index = 0; index < MAX_PAGES; index += 1) {
    const result = normalizePage(await vendorService.list({ page: index, size: PAGE_SIZE, sortBy: 'name', direction: 'asc' }, signal));
    rows = rows.concat(result.items);
    if (index + 1 >= result.totalPages) break;
  }
  return rows;
}

const SORTS = [
  { value: 'name:asc', label: 'Name (A–Z)' },
  { value: 'name:desc', label: 'Name (Z–A)' },
  { value: 'createdAt:desc', label: 'Newest first' },
  { value: 'createdAt:asc', label: 'Oldest first' },
];
const STATUSES = ['ACTIVE', 'INACTIVE']; // VendorServiceImpl accepts only these

const ICON_BUTTON =
  'flex h-9 w-9 items-center justify-center rounded-md border border-line bg-surface text-slate-600 transition-colors hover:border-line-strong hover:text-slate-900';

const EXPORT_COLUMNS = [
  { header: 'Vendor', value: (row) => row.name },
  { header: 'Email', value: (row) => row.email },
  { header: 'Phone', value: (row) => row.phone },
  { header: 'Address', value: (row) => row.address },
  { header: 'Location', value: (row) => vendorLocation(row) },
  { header: 'Status', value: (row) => row.status },
  { header: 'Registered', value: (row) => row.createdAt?.slice(0, 10) },
];

function VendorCell({ row }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-13 font-semibold text-brand-700" aria-hidden="true">
        {vendorInitials(row.name)}
      </span>
      <div className="min-w-0">
        <Link to={`/vendors/${row.id}`} onClick={(event) => event.stopPropagation()} className="block max-w-64 truncate font-semibold text-slate-900 hover:text-brand-700" title={row.name}>
          {row.name}
        </Link>
        <p className="mt-0.5 max-w-64 truncate text-xs text-slate-500">{row.email}</p>
      </div>
    </div>
  );
}

function ContactCell({ row }) {
  return (
    <div className="min-w-0 space-y-0.5 text-13">
      {row.email && (
        <a href={`mailto:${row.email}`} onClick={(event) => event.stopPropagation()} className="flex max-w-60 items-center gap-2 text-slate-700 hover:text-brand-700">
          <Mail className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          <span className="truncate">{row.email}</span>
        </a>
      )}
      {row.phone && (
        <a href={`tel:${row.phone}`} onClick={(event) => event.stopPropagation()} className="flex items-center gap-2 text-xs text-slate-500 hover:text-brand-700">
          <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
          {row.phone}
        </a>
      )}
    </div>
  );
}

function LocationCell({ row }) {
  const location = vendorLocation(row);
  if (!location) return <span className="text-slate-400">—</span>;
  return (
    <span className="flex max-w-44 items-center gap-2 text-slate-700" title={row.address}>
      <MapPin className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
      <span className="truncate">{location}</span>
    </span>
  );
}

export default function VendorListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const canManage = can('vendor.manage');
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get('status') || '';
  const location = searchParams.get('location') || '';
  const [keyword, setKeyword] = useState('');
  const debounced = useDebounce(keyword.trim().toLowerCase(), 250);
  const pager = usePagination({ size: 10, sortBy: 'name', direction: 'asc' });
  const [dialog, setDialog] = useState(null); // { vendor, kind: 'toggle' | 'delete' }

  const query = useQuery({ queryKey: vendorKeys.list({ scope: 'all' }), queryFn: ({ signal }) => loadAllVendors(signal) });
  const all = useMemo(() => query.data || [], [query.data]);

  const setParam = (key, value) => {
    const next = new URLSearchParams(window.location.search);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
    pager.reset();
  };

  const locations = useMemo(
    () => [...new Set(all.map(vendorLocation).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [all],
  );
  const filtered = useMemo(() => {
    const rows = all.filter(
      (row) =>
        (!status || row.status === status) &&
        (!location || vendorLocation(row) === location) &&
        (!debounced || [row.name, row.email, row.phone].some((value) => value?.toLowerCase().includes(debounced))),
    );
    const factor = pager.direction === 'asc' ? 1 : -1;
    const key = pager.sortBy === 'location' ? vendorLocation : (row) => row[pager.sortBy];
    return [...rows].sort((a, b) => String(key(a) ?? '').localeCompare(String(key(b) ?? ''), undefined, { sensitivity: 'base' }) * factor);
  }, [all, status, location, debounced, pager.sortBy, pager.direction]);
  const pageRows = filtered.slice(pager.page * pager.size, (pager.page + 1) * pager.size);

  const statusCount = (value) => all.filter((row) => row.status === value).length;
  const newThisMonth = all.filter((row) => registeredThisMonth(row)).length;
  const figure = (value) => ({ isLoading: query.isLoading, error: query.error, data: query.error ? null : value });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: vendorKeys.all });
    queryClient.invalidateQueries({ queryKey: ['dashboard', 'vendor-count'] });
    queryClient.invalidateQueries({ queryKey: ['lookup'] });
  };
  const toggle = useMutation({
    mutationFn: (vendor) => (vendor.status === 'ACTIVE' ? vendorService.deactivate(vendor.id) : vendorService.activate(vendor.id)),
    meta: { successMessage: 'Vendor status updated' },
    onSuccess: () => {
      setDialog(null);
      refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (vendor) => vendorService.remove(vendor.id),
    meta: { successMessage: 'Vendor deleted' },
    onSuccess: () => {
      setDialog(null);
      refresh();
    },
  });

  const copyEmail = async (vendor) => {
    try {
      await navigator.clipboard.writeText(vendor.email);
      toast.success('Email copied');
    } catch {
      toast.error('Could not copy to the clipboard');
    }
  };
  const exportCsv = () => {
    if (!filtered.length) {
      toast.info('Nothing to export');
      return;
    }
    downloadCsv(`vendors-${new Date().toISOString().slice(0, 10)}.csv`, EXPORT_COLUMNS, filtered);
    toast.success(`Exported ${formatNumber(filtered.length)} ${filtered.length === 1 ? 'vendor' : 'vendors'}`);
  };

  const menuItems = (vendor) => [
    { key: 'open', label: 'View vendor', icon: Eye, onClick: () => navigate(`/vendors/${vendor.id}`) },
    ...(vendor.email ? [{ key: 'mail', label: 'Send email', icon: Mail, onClick: () => window.open(`mailto:${vendor.email}`, '_self') }] : []),
    ...(vendor.email ? [{ key: 'copy', label: 'Copy email', icon: Copy, onClick: () => copyEmail(vendor) }] : []),
    ...(canManage
      ? [
          {
            key: 'toggle',
            label: vendor.status === 'ACTIVE' ? 'Deactivate' : 'Activate',
            icon: Power,
            tone: vendor.status === 'ACTIVE' ? 'danger' : undefined,
            divider: true,
            onClick: () => setDialog({ vendor, kind: 'toggle' }),
          },
          { key: 'delete', label: 'Delete', icon: Trash, tone: 'danger', onClick: () => setDialog({ vendor, kind: 'delete' }) },
        ]
      : []),
  ];

  const renderActions = (vendor) => (
    <div className="flex items-center justify-end gap-2" onClick={(event) => event.stopPropagation()}>
      <Link to={`/vendors/${vendor.id}`} className={ICON_BUTTON} aria-label={`View ${vendor.name}`} title="View">
        <Eye className="h-4 w-4" aria-hidden="true" />
      </Link>
      {canManage && (
        <Link to={`/vendors/${vendor.id}/edit`} className={ICON_BUTTON} aria-label={`Edit ${vendor.name}`} title="Edit">
          <Pencil className="h-4 w-4" aria-hidden="true" />
        </Link>
      )}
      <ActionMenu items={menuItems(vendor)} label={`More actions for ${vendor.name}`} />
    </div>
  );

  const columns = [
    { key: 'name', header: 'Vendor', sortKey: 'name', className: 'min-w-64', render: (row) => <VendorCell row={row} /> },
    { key: 'contact', header: 'Contact', render: (row) => <ContactCell row={row} /> },
    { key: 'location', header: 'Location', sortKey: 'location', render: (row) => <LocationCell row={row} /> },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'createdAt', header: 'Registered', sortKey: 'createdAt', className: 'whitespace-nowrap', render: (row) => <span className="text-slate-700">{formatDate(row.createdAt)}</span> },
    { key: 'actions', header: 'Actions', headerClassName: 'text-right', render: (row) => renderActions(row) },
  ];

  const sortValue = `${pager.sortBy}:${pager.direction}`;
  const knownSort = SORTS.some((option) => option.value === sortValue);
  const filteredView = Boolean(keyword || status || location);
  const clearFilters = () => {
    setKeyword('');
    setSearchParams({}, { replace: true });
    pager.reset();
  };
  const empty = {
    title: filteredView ? 'No vendors match these filters' : 'No vendors registered yet',
    action: filteredView ? (
      <Button variant="secondary" size="sm" onClick={clearFilters}>
        Clear filters
      </Button>
    ) : (
      canManage && (
        <Button to="/vendors/new" size="sm" icon={Plus}>
          Register vendor
        </Button>
      )
    ),
  };
  const tabs = [
    { value: '', label: 'All', count: query.data ? all.length : undefined },
    { value: 'ACTIVE', label: 'Active', count: query.data ? statusCount('ACTIVE') : undefined },
    { value: 'INACTIVE', label: 'Inactive', count: query.data ? statusCount('INACTIVE') : undefined },
  ];
  const target = dialog?.vendor;

  return (
    <>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <span className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 sm:flex">
            <Users className="h-7 w-7" strokeWidth={1.8} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Vendors</h1>
            <p className="mt-1 text-sm text-slate-500">Manage supplier profiles, onboarding and account status.</p>
          </div>
        </div>
        {canManage && (
          <Button to="/vendors/new" icon={Plus} size="lg" className="shrink-0 self-start sm:self-auto">
            Register vendor
          </Button>
        )}
      </div>

      {/* KPIs */}
      <section aria-label="Vendor figures" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KpiCard icon={Users} tone="brand" label="Total Vendors" query={figure(all.length)} emptyText="—" onClick={() => setParam('status', '')} active={!status} />
        <KpiCard
          icon={CircleCheck}
          tone="success"
          label="Active Vendors"
          query={figure(statusCount('ACTIVE'))}
          emptyText="—"
          caption={all.length ? `${Math.round((statusCount('ACTIVE') / all.length) * 100)}% of all vendors` : undefined}
          onClick={() => setParam('status', status === 'ACTIVE' ? '' : 'ACTIVE')}
          active={status === 'ACTIVE'}
        />
        <KpiCard icon={CircleX} tone="danger" label="Inactive Vendors" query={figure(statusCount('INACTIVE'))} emptyText="—" onClick={() => setParam('status', status === 'INACTIVE' ? '' : 'INACTIVE')} active={status === 'INACTIVE'} />
        <KpiCard icon={CalendarPlus} tone="info" label="New This Month" query={figure(newThisMonth)} emptyText="—" caption={`Registered since 1 ${format(new Date(), 'MMM')}`} />
      </section>

      {/* Tabs, filters and table */}
      <section aria-label="Vendors" className="card mt-5">
        <div className="overflow-x-auto px-4 pt-2 sm:px-5">
          <Tabs variant="pill" label="Filter by status" value={status} onChange={(value) => setParam('status', value)} tabs={tabs} />
        </div>

        <div className="flex flex-col gap-3 border-b border-line p-4 sm:px-5 lg:flex-row lg:items-center">
          <SearchInput
            value={keyword}
            onChange={(value) => {
              setKeyword(value);
              pager.reset();
            }}
            placeholder="Search by vendor name or email…"
            className="lg:min-w-56 lg:flex-1"
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:flex">
            <div className="relative lg:w-48">
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
            <div className="relative lg:w-48">
              <MapPin className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <Select
                aria-label="Location"
                value={location}
                onChange={(event) => setParam('location', event.target.value)}
                options={[{ value: '', label: 'All locations' }, ...locations.map((value) => ({ value, label: value }))]}
                selectClassName="pl-9"
              />
            </div>
            <div className="relative lg:w-44">
              <Layers className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <Select
                aria-label="Status"
                value={status}
                onChange={(event) => setParam('status', event.target.value)}
                options={[{ value: '', label: 'All statuses' }, ...STATUSES.map((value) => ({ value, label: value === 'ACTIVE' ? 'Active' : 'Inactive' }))]}
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
            <Button variant="secondary" icon={Download} onClick={exportCsv} disabled={query.isLoading || Boolean(query.error)}>
              Export
            </Button>
          </div>
        </div>

        {/* Desktop / tablet: table */}
        <div className="hidden md:block">
          <DataTable
            roomy
            caption="Vendors"
            columns={columns}
            rows={pageRows}
            loading={query.isLoading}
            error={query.error}
            onRetry={query.refetch}
            onRowClick={(row) => navigate(`/vendors/${row.id}`)}
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
                  <Skeleton className="h-10 w-10 rounded-full" />
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
                    <VendorCell row={row} />
                    <StatusBadge status={row.status} />
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-13">
                    <div>
                      <dt className="text-xs text-slate-500">Location</dt>
                      <dd className="truncate text-slate-800">{vendorLocation(row) || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Registered</dt>
                      <dd className="text-slate-800">{formatDate(row.createdAt)}</dd>
                    </div>
                    {row.phone && (
                      <div className="col-span-2">
                        <dt className="text-xs text-slate-500">Phone</dt>
                        <dd className="text-slate-800">{row.phone}</dd>
                      </div>
                    )}
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
          noun={['vendor', 'vendors']}
        />
      </section>

      <ConfirmDialog
        open={dialog?.kind === 'toggle'}
        onClose={() => setDialog(null)}
        onConfirm={() => toggle.mutate(target)}
        loading={toggle.isPending}
        title={target?.status === 'ACTIVE' ? 'Deactivate vendor' : 'Activate vendor'}
        message={
          target?.status === 'ACTIVE'
            ? `${target?.name} will no longer be available for new quotations.`
            : `${target?.name} will be available for quotations again.`
        }
        tone={target?.status === 'ACTIVE' ? 'danger' : 'primary'}
        confirmLabel={target?.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
      />
      <ConfirmDialog
        open={dialog?.kind === 'delete'}
        onClose={() => setDialog(null)}
        onConfirm={() => remove.mutate(target)}
        loading={remove.isPending}
        title="Delete vendor"
        message={`Delete ${target?.name}? This cannot be undone.`}
        tone="danger"
        confirmLabel="Delete"
      />
    </>
  );
}
