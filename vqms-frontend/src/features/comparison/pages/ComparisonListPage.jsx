import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePagination } from '@/hooks/usePagination';
import { useRequestOptions, useRequestTitles } from '@/hooks/useLookups';
import PageHeader from '@/components/common/PageHeader';
import Button from '@/components/common/Button';
import DataTable from '@/components/common/DataTable';
import Pagination from '@/components/common/Pagination';
import Select from '@/components/common/Select';
import StatusBadge from '@/components/common/StatusBadge';
import { normalizePage } from '@/utils/pagination';
import { formatDateTime } from '@/utils/formatDate';
import { COMPARISON_STATUSES, toOptions } from '@/utils/constants';
import { comparisonKeys, comparisonService } from '../comparisonService';

function RequestCell({ title, reference }) {
  return (
    <div className="min-w-0">
      {title ? (
        <>
          <p className="max-w-72 truncate font-medium text-slate-900">{title}</p>
          <p className="font-mono text-2xs text-slate-500">{reference}</p>
        </>
      ) : (
        <p className="font-mono text-xs font-medium text-slate-800" title="Request not visible to your account">
          {reference}
        </p>
      )}
    </div>
  );
}

export default function ComparisonListPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const [filters, setFilters] = useState({ status: '', procurementRequestId: '' });
  const pager = usePagination({ size: 20, sortBy: 'createdAt', direction: 'desc' });
  const requests = useRequestOptions();
  const requestTitle = useRequestTitles();

  const params = { ...filters, page: pager.page, size: pager.size, sortBy: pager.sortBy, direction: pager.direction };
  const query = useQuery({ queryKey: comparisonKeys.list(params), queryFn: ({ signal }) => comparisonService.search(params, signal), placeholderData: keepPreviousData });
  const page = normalizePage(query.data);
  const setFilter = (key) => (event) => {
    setFilters((current) => ({ ...current, [key]: event.target.value }));
    pager.reset();
  };

  return (
    <>
      <PageHeader
        title="Comparisons"
        description="Side-by-side evaluation of the quotations received for a procurement request."
        actions={can('comparison.manage') && <Button to="/comparison/new" icon={Plus}>New comparison</Button>}
      />
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <Select aria-label="Status" value={filters.status} onChange={setFilter('status')} placeholder="All statuses" options={toOptions(COMPARISON_STATUSES)} className="md:w-48" />
          <Select aria-label="Procurement request" value={filters.procurementRequestId} onChange={setFilter('procurementRequestId')} placeholder="All requests" options={requests.data || []} className="md:w-72" />
      </div>
      <div className="card mt-4 overflow-hidden">
        <DataTable
          caption="Comparisons"
          columns={[
            {
              key: 'comparisonNumber',
              header: 'Request',
              render: (row) => <RequestCell title={requestTitle(row.procurementRequestId)} reference={row.comparisonNumber} />,
            },
            {
              key: 'status',
              header: 'Status',
              render: (row) => (
                <div className="flex flex-wrap items-center gap-1.5">
                  <StatusBadge status={row.status} />
                  {row.requiresReview && <StatusBadge status="NEEDS_REVIEW" />}
                  {row.stale && <StatusBadge status="STALE" tone="amber" label="Out of date" />}
                </div>
              ),
            },
            { key: 'eligibleCount', header: 'Eligible quotations', align: 'right' },
            { key: 'calculatedAt', header: 'Calculated', className: 'whitespace-nowrap', render: (row) => formatDateTime(row.calculatedAt) },
            { key: 'createdAt', header: 'Created', sortKey: 'createdAt', className: 'whitespace-nowrap', render: (row) => formatDateTime(row.createdAt) },
          ]}
          rows={page.items}
          loading={query.isLoading}
          error={query.error}
          onRetry={query.refetch}
          onRowClick={(row) => navigate(`/comparison/${row.id}`)}
          sort={{ sortBy: pager.sortBy, direction: pager.direction, onSort: pager.toggleSort }}
          empty={{ title: 'No comparisons yet', description: 'A comparison is created once a procurement request has quotations to evaluate.' }}
        />
        <Pagination {...page} onPageChange={pager.setPage} onSizeChange={pager.setSize} disabled={query.isFetching} />
      </div>
    </>
  );
}
