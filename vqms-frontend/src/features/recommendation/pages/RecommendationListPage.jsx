import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { usePagination } from '@/hooks/usePagination';
import { useRequestOptions, useRequestTitles } from '@/hooks/useLookups';
import { useVendorNames } from '@/hooks/useVendorNames';
import PageHeader from '@/components/common/PageHeader';
import DataTable from '@/components/common/DataTable';
import Pagination from '@/components/common/Pagination';
import Select from '@/components/common/Select';
import StatusBadge from '@/components/common/StatusBadge';
import { normalizePage } from '@/utils/pagination';
import { formatDateTime } from '@/utils/formatDate';
import { formatNumber } from '@/utils/formatCurrency';
import { RECOMMENDATION_STATUSES, toOptions } from '@/utils/constants';
import { recommendationKeys, recommendationService } from '../recommendationService';

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

export default function RecommendationListPage() {
  const navigate = useNavigate();
  const vendorName = useVendorNames();
  const [filters, setFilters] = useState({ status: '', procurementRequestId: '' });
  const pager = usePagination({ size: 20, sortBy: 'generatedAt', direction: 'desc' });
  const requests = useRequestOptions();
  const requestTitle = useRequestTitles();

  const params = { ...filters, page: pager.page, size: pager.size, sortBy: pager.sortBy, direction: pager.direction };
  const query = useQuery({ queryKey: recommendationKeys.list(params), queryFn: ({ signal }) => recommendationService.search(params, signal), placeholderData: keepPreviousData });
  const page = normalizePage(query.data);
  const setFilter = (key) => (event) => {
    setFilters((current) => ({ ...current, [key]: event.target.value }));
    pager.reset();
  };

  return (
    <>
      <PageHeader title="Recommendations" description="Vendor recommendations generated from completed comparisons. Generate one from a comparison page." />
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <Select aria-label="Status" value={filters.status} onChange={setFilter('status')} placeholder="All statuses" options={toOptions(RECOMMENDATION_STATUSES)} className="md:w-56" />
          <Select aria-label="Procurement request" value={filters.procurementRequestId} onChange={setFilter('procurementRequestId')} placeholder="All requests" options={requests.data || []} className="md:w-72" />
      </div>
      <div className="card mt-4 overflow-hidden">
        <DataTable
          caption="Recommendations"
          columns={[
            {
              key: 'recommendationNumber',
              header: 'Request',
              render: (row) => <RequestCell title={requestTitle(row.procurementRequestId)} reference={row.recommendationNumber} />,
            },
            { key: 'recommendedVendorId', header: 'Recommended vendor', render: (row) => (row.recommendedVendorId ? <span className="font-medium text-slate-800">{vendorName(row.recommendedVendorId)}</span> : '—') },
            { key: 'type', header: 'Outcome', render: (row) => <StatusBadge status={row.type} /> },
            { key: 'overallScore', header: 'Score', align: 'right', render: (row) => formatNumber(row.overallScore, 2) },
            { key: 'riskLevel', header: 'Risk', render: (row) => <StatusBadge status={row.riskLevel} /> },
            { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
            { key: 'generatedAt', header: 'Generated', sortKey: 'generatedAt', className: 'whitespace-nowrap', render: (row) => formatDateTime(row.generatedAt) },
          ]}
          rows={page.items}
          loading={query.isLoading}
          error={query.error}
          onRetry={query.refetch}
          onRowClick={(row) => navigate(`/recommendations/${row.id}`)}
          sort={{ sortBy: pager.sortBy, direction: pager.direction, onSort: pager.toggleSort }}
          empty={{ title: 'No recommendations yet', description: 'Recommendations are generated from a calculated comparison.' }}
        />
        <Pagination {...page} onPageChange={pager.setPage} onSizeChange={pager.setSize} disabled={query.isFetching} />
      </div>
    </>
  );
}
