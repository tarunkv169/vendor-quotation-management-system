import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpDown, Plus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useDebounce } from '@/hooks/useDebounce';
import { usePagination } from '@/hooks/usePagination';
import { useRequestTitles } from '@/hooks/useLookups';
import PageHeader from '@/components/common/PageHeader';
import Button from '@/components/common/Button';
import DataTable from '@/components/common/DataTable';
import Pagination from '@/components/common/Pagination';
import SearchInput from '@/components/common/SearchInput';
import Select from '@/components/common/Select';
import StatusBadge from '@/components/common/StatusBadge';
import Tabs from '@/components/common/Tabs';
import { formatDate, formatRelative } from '@/utils/formatDate';
import { formatCurrency } from '@/utils/formatCurrency';
import { QUOTATION_STATUSES, humanize } from '@/utils/constants';
import { quotationKeys, quotationService } from '../quotationService';

const SORTS = [
  { value: 'createdAt:desc', label: 'Newest first' },
  { value: 'createdAt:asc', label: 'Oldest first' },
  { value: 'totalAmount:asc', label: 'Total (low to high)' },
  { value: 'totalAmount:desc', label: 'Total (high to low)' },
  { value: 'vendorName:asc', label: 'Vendor (A–Z)' },
];


// GET /quotations returns the complete list (no server paging), so filtering, sorting and paging
// happen on that response. Amounts are displayed exactly as the backend returns them.
export default function QuotationListPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const requestTitle = useRequestTitles();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState(() => searchParams.get('status') || '');
  const [keyword, setKeyword] = useState('');
  const debounced = useDebounce(keyword.trim().toLowerCase(), 250);
  const pager = usePagination({ size: 10, sortBy: 'createdAt', direction: 'desc' });

  const query = useQuery({ queryKey: quotationKeys.list, queryFn: ({ signal }) => quotationService.list(signal) });

  const filtered = useMemo(() => {
    const all = query.data || [];
    const rows = all.filter(
      (row) =>
        (!status || row.status === status) &&
        (!debounced || [row.vendorName, row.fileName, row.notes].some((value) => value?.toLowerCase().includes(debounced))),
    );
    const { sortBy, direction } = pager;
    const factor = direction === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const left = a[sortBy] ?? '';
      const right = b[sortBy] ?? '';
      if (typeof left === 'number' || typeof right === 'number') return (Number(left) - Number(right)) * factor;
      return String(left).localeCompare(String(right)) * factor;
    });
  }, [query.data, status, debounced, pager]);

  const pageRows = filtered.slice(pager.page * pager.size, (pager.page + 1) * pager.size);
  const counts = useMemo(() => {
    const map = {};
    (query.data || []).forEach((row) => {
      map[row.status] = (map[row.status] || 0) + 1;
    });
    return map;
  }, [query.data]);

  // Pills: "All" plus every status that has quotations (and the active one, even if empty).
  const tabs = [
    { value: '', label: 'All', count: query.data?.length },
    ...QUOTATION_STATUSES.filter((value) => counts[value] || value === status).map((value) => ({ value, label: humanize(value), count: counts[value] || 0 })),
  ];
  const sortValue = `${pager.sortBy}:${pager.direction}`;
  const knownSort = SORTS.some((option) => option.value === sortValue);

  const columns = [
    {
      key: 'vendorName',
      header: 'Vendor',
      sortKey: 'vendorName',
      className: 'min-w-60',
      render: (row) => {
        const title = requestTitle(row.purchaseRequestId);
        return (
          <div className="flex min-w-0 items-center gap-3">
            <div className="min-w-0">
              <p className="truncate font-medium text-slate-900">{row.vendorName || 'Unknown vendor'}</p>
              <p className="truncate text-xs text-slate-500">{title ? `For: ${title}` : !row.fileName || row.fileName === 'manual_entry' ? 'Manual entry' : row.fileName}</p>
            </div>
          </div>
        );
      },
    },
    { key: 'quotationDate', header: 'Quotation date', sortKey: 'quotationDate', className: 'whitespace-nowrap', render: (row) => formatDate(row.quotationDate) },
    { key: 'version', header: 'Version', align: 'right', render: (row) => (row.version != null ? `v${row.version}` : '—') },
    {
      key: 'totalAmount',
      header: 'Total',
      sortKey: 'totalAmount',
      align: 'right',
      className: 'whitespace-nowrap',
      render: (row) => <span className="font-medium text-slate-900">{formatCurrency(row.totalAmount, row.currency)}</span>,
    },
    { key: 'status', header: 'Status', sortKey: 'status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'createdAt',
      header: 'Received',
      sortKey: 'createdAt',
      className: 'whitespace-nowrap',
      render: (row) => (
        <span title={formatDate(row.createdAt)} className="text-slate-500">
          {formatRelative(row.createdAt)}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Quotations"
        description="Vendor offers received against procurement requests."
        actions={can('quotation.manage') && <Button to="/quotations/new" icon={Plus}>New quotation</Button>}
      />

      <Tabs
        variant="pill"
        label="Filter by status"
        value={status}
        onChange={(value) => {
          setStatus(value);
          pager.reset();
        }}
        tabs={tabs}
      />

      <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center">
        <SearchInput
          value={keyword}
          onChange={(value) => {
            setKeyword(value);
            pager.reset();
          }}
          placeholder="Search vendor, file or notes"
          className="md:w-80"
        />
        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          <Select
            aria-label="Sort by"
            value={knownSort ? sortValue : ''}
            placeholder={knownSort ? undefined : 'Custom sort'}
            onChange={(event) => {
              const [sortBy, direction] = event.target.value.split(':');
              if (sortBy) pager.setSort(sortBy, direction);
            }}
            options={SORTS}
            selectClassName="border-transparent bg-transparent pl-1 shadow-none hover:border-line"
            className="w-48"
          />
        </div>
      </div>

      <div className="card mt-4 overflow-hidden">
        <DataTable
          caption="Quotations"
          columns={columns}
          rows={pageRows}
          loading={query.isLoading}
          error={query.error}
          onRetry={query.refetch}
          onRowClick={(row) => navigate(`/quotations/${row.id}`)}
          sort={{ sortBy: pager.sortBy, direction: pager.direction, onSort: pager.toggleSort }}
          empty={{
            title: keyword || status ? 'No matching quotations' : 'No quotations yet',
            description: keyword || status ? 'Try a different search or status.' : 'Quotations appear here once vendors respond to an open request.',
            action: !keyword && !status && can('quotation.manage') && (
              <Button to="/quotations/new" size="sm" icon={Plus}>
                New quotation
              </Button>
            ),
          }}
        />
        <Pagination
          page={pager.page}
          size={pager.size}
          totalElements={filtered.length}
          totalPages={Math.ceil(filtered.length / pager.size)}
          onPageChange={pager.setPage}
          onSizeChange={pager.setSize}
        />
      </div>
    </>
  );
}
