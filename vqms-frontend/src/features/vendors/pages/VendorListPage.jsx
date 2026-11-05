import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { keepPreviousData, useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Power } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useDebounce } from '@/hooks/useDebounce';
import { usePagination } from '@/hooks/usePagination';
import PageHeader from '@/components/common/PageHeader';
import Button from '@/components/common/Button';
import DataTable from '@/components/common/DataTable';
import Pagination from '@/components/common/Pagination';
import SearchInput from '@/components/common/SearchInput';
import StatusBadge from '@/components/common/StatusBadge';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import Tabs from '@/components/common/Tabs';
import ListToolbar, { SortSelect } from '@/components/common/ListToolbar';
import { cn } from '@/utils/cn';
import { normalizePage } from '@/utils/pagination';
import { formatDate } from '@/utils/formatDate';
import { dashboardService } from '@/features/dashboard/dashboardService';
import { vendorKeys, vendorService } from '../vendorService';

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];
const SORTS = [
  { value: 'name:asc', label: 'Name (A–Z)' },
  { value: 'name:desc', label: 'Name (Z–A)' },
  { value: 'createdAt:desc', label: 'Newest first' },
  { value: 'createdAt:asc', label: 'Oldest first' },
];

export default function VendorListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const canManage = can('vendor.manage');
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('');
  const [toggleTarget, setToggleTarget] = useState(null);
  const debouncedKeyword = useDebounce(keyword.trim());
  const pager = usePagination({ size: 10, sortBy: 'name', direction: 'asc' });
  const searching = Boolean(debouncedKeyword);

  // The backend does not combine keyword search with the status filter.
  const params = { keyword: debouncedKeyword, status: searching ? '' : status, page: pager.page, size: pager.size, sortBy: pager.sortBy, direction: pager.direction };
  const query = useQuery({
    queryKey: vendorKeys.list(params),
    queryFn: ({ signal }) => vendorService.list(params, signal),
    placeholderData: keepPreviousData,
  });
  const page = normalizePage(query.data);

  // Same query keys as the dashboard figures.
  const counts = useQueries({
    queries: STATUS_TABS.map((tab) => ({
      queryKey: ['dashboard', 'vendor-count', tab.value],
      queryFn: ({ signal }) => dashboardService.vendorCount(tab.value, signal),
      meta: { silent: true },
    })),
  });

  const toggle = useMutation({
    mutationFn: (vendor) => (vendor.status === 'ACTIVE' ? vendorService.deactivate(vendor.id) : vendorService.activate(vendor.id)),
    meta: { successMessage: 'Vendor status updated' },
    onSuccess: () => {
      setToggleTarget(null);
      queryClient.invalidateQueries({ queryKey: vendorKeys.all });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'vendor-count'] });
    },
  });

  const columns = [
    {
      key: 'name',
      header: 'Vendor',
      sortKey: 'name',
      className: 'min-w-64',
      render: (row) => (
        <div className="flex min-w-0 items-center gap-3">
          <div className="min-w-0">
            <Link to={`/vendors/${row.id}`} onClick={(event) => event.stopPropagation()} className="block truncate font-medium text-slate-900 hover:text-brand-700">
              {row.name}
            </Link>
            <p className="truncate text-xs text-slate-500">{row.email}</p>
          </div>
        </div>
      ),
    },
    { key: 'phone', header: 'Phone', className: 'whitespace-nowrap', render: (row) => row.phone || <span className="text-slate-400">—</span> },
    { key: 'address', header: 'Address', render: (row) => (row.address ? <span className="block max-w-64 truncate" title={row.address}>{row.address}</span> : <span className="text-slate-400">—</span>) },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'createdAt', header: 'Registered', sortKey: 'createdAt', className: 'whitespace-nowrap text-slate-500', render: (row) => formatDate(row.createdAt) },
    canManage && {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      render: (row) => (
        <Button
          variant="ghost"
          size="sm"
          icon={Power}
          className={cn(row.status === 'ACTIVE' ? 'text-slate-500 hover:text-danger' : 'text-success')}
          onClick={(event) => {
            event.stopPropagation();
            setToggleTarget(row);
          }}
        >
          {row.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
        </Button>
      ),
    },
  ].filter(Boolean);

  return (
    <>
      <PageHeader
        title="Vendors"
        description="Registered suppliers who can be invited to quote, and their status."
        actions={canManage && <Button to="/vendors/new" icon={Plus}>Register vendor</Button>}
      />

      <div className={cn('transition-opacity', searching && 'pointer-events-none opacity-50')} aria-disabled={searching || undefined}>
        <Tabs
          variant="pill"
          label="Filter by status"
          value={status}
          onChange={(value) => {
            setStatus(value);
            pager.reset();
          }}
          tabs={STATUS_TABS.map((tab, index) => ({ ...tab, count: counts[index].data }))}
        />
      </div>

      <ListToolbar>
        <SearchInput
          value={keyword}
          onChange={(value) => {
            setKeyword(value);
            pager.reset();
          }}
          placeholder="Search by name or email"
          className="md:w-80"
        />
        <SortSelect pager={pager} options={SORTS} />
      </ListToolbar>
      {searching && <p className="mt-2 text-xs text-slate-500">Searching all statuses. Clear the search to filter by status.</p>}

      <div className="card mt-4 overflow-hidden">
        <DataTable
          caption="Vendors"
          columns={columns}
          rows={page.items}
          loading={query.isLoading}
          error={query.error}
          onRetry={query.refetch}
          onRowClick={(row) => navigate(`/vendors/${row.id}`)}
          sort={{ sortBy: pager.sortBy, direction: pager.direction, onSort: pager.toggleSort }}
          empty={{
            title: keyword || status ? 'No matching vendors' : 'No vendors registered yet',
            description: keyword || status ? 'Try a different search or status.' : 'Register the first vendor to start collecting quotations.',
            action: !keyword && !status && canManage && (
              <Button to="/vendors/new" size="sm" icon={Plus}>
                Register vendor
              </Button>
            ),
          }}
        />
        <Pagination {...page} onPageChange={pager.setPage} onSizeChange={pager.setSize} disabled={query.isFetching} />
      </div>

      <ConfirmDialog
        open={Boolean(toggleTarget)}
        onClose={() => setToggleTarget(null)}
        onConfirm={() => toggle.mutate(toggleTarget)}
        loading={toggle.isPending}
        title={toggleTarget?.status === 'ACTIVE' ? 'Deactivate vendor' : 'Activate vendor'}
        message={
          toggleTarget?.status === 'ACTIVE'
            ? `${toggleTarget?.name} will no longer be available for new quotations.`
            : `${toggleTarget?.name} will be available for quotations again.`
        }
        tone={toggleTarget?.status === 'ACTIVE' ? 'danger' : 'primary'}
        confirmLabel={toggleTarget?.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
      />
    </>
  );
}
