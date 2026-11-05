import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useDebounce } from '@/hooks/useDebounce';
import { usePagination } from '@/hooks/usePagination';
import PageHeader from '@/components/common/PageHeader';
import { FilterBar } from '@/components/common/Card';
import Button from '@/components/common/Button';
import DataTable from '@/components/common/DataTable';
import Pagination from '@/components/common/Pagination';
import Input from '@/components/common/Input';
import Alert from '@/components/common/Alert';
import StatusBadge from '@/components/common/StatusBadge';
import { IdText } from '@/components/common/DetailList';
import { isUuid } from '@/components/common/EntitySelect';
import { normalizePage } from '@/utils/pagination';
import { formatDateTime } from '@/utils/formatDate';
import { formatNumber } from '@/utils/formatCurrency';
import { auditKeys, auditService } from '../auditService';

const EMPTY = { actorId: '', aggregateType: '', aggregateId: '', eventType: '', sourceService: '', from: '', to: '' };

function toApiFilters(filters) {
  return {
    actorId: isUuid(filters.actorId) ? filters.actorId : undefined,
    aggregateId: isUuid(filters.aggregateId) ? filters.aggregateId : undefined,
    aggregateType: filters.aggregateType.trim() || undefined,
    eventType: filters.eventType.trim() || undefined,
    sourceService: filters.sourceService.trim() || undefined,
    from: filters.from ? new Date(filters.from).toISOString() : undefined,
    to: filters.to ? new Date(filters.to).toISOString() : undefined,
  };
}

export default function AuditLogPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const [filters, setFilters] = useState(EMPTY);
  const debounced = useDebounce(filters, 500);
  const pager = usePagination({ size: 50 });

  const params = { ...toApiFilters(debounced), page: pager.page, size: pager.size };
  const query = useQuery({ queryKey: auditKeys.list(params), queryFn: ({ signal }) => auditService.search(params, signal), placeholderData: keepPreviousData });
  const page = normalizePage(query.data);
  const verify = useMutation({ mutationFn: () => auditService.verify() });

  const set = (key) => (event) => {
    setFilters((current) => ({ ...current, [key]: event.target.value }));
    pager.reset();
  };
  const invalidUuid = (value) => (value && !isUuid(value) ? 'Enter a full ID' : undefined);

  return (
    <>
      <PageHeader
        title="Audit logs"
        description="Tamper-evident, read-only record of business events across all services."
        actions={
          can('audit.verify') && (
            <Button variant="secondary" icon={ShieldCheck} onClick={() => verify.mutate()} loading={verify.isPending}>
              Verify integrity
            </Button>
          )
        }
      />
      {verify.data && (
        <Alert tone={verify.data.intact ? 'success' : 'error'} title={verify.data.intact ? 'Audit chain intact' : 'Audit chain broken'} className="mb-6">
          {formatNumber(verify.data.recordsChecked)} records checked at {formatDateTime(verify.data.verifiedAt)}.
          {!verify.data.intact && ` First broken sequence: ${verify.data.firstBrokenSequence}. ${verify.data.reason || ''}`}
        </Alert>
      )}
      <div className="card overflow-hidden">
        <FilterBar className="md:grid md:grid-cols-4">
          <Input label="User (actor ID)" value={filters.actorId} onChange={set('actorId')} error={invalidUuid(filters.actorId)} />
          <Input label="Entity type" placeholder="e.g. APPROVAL" value={filters.aggregateType} onChange={set('aggregateType')} />
          <Input label="Entity ID" value={filters.aggregateId} onChange={set('aggregateId')} error={invalidUuid(filters.aggregateId)} />
          <Input label="Action (event type)" placeholder="e.g. APPROVAL_APPROVED" value={filters.eventType} onChange={set('eventType')} />
          <Input label="Service" placeholder="e.g. approval-service" value={filters.sourceService} onChange={set('sourceService')} />
          <Input label="From" type="datetime-local" value={filters.from} onChange={set('from')} />
          <Input label="To" type="datetime-local" value={filters.to} onChange={set('to')} />
          <div className="flex items-end">
            <Button variant="ghost" onClick={() => setFilters(EMPTY)} disabled={JSON.stringify(filters) === JSON.stringify(EMPTY)}>
              Clear filters
            </Button>
          </div>
        </FilterBar>
        <DataTable
          dense
          caption="Audit events"
          columns={[
            { key: 'sequenceNumber', header: '#', align: 'right', render: (row) => <span className="font-mono text-xs">{row.sequenceNumber}</span> },
            { key: 'occurredAt', header: 'Occurred', render: (row) => formatDateTime(row.occurredAt) },
            { key: 'eventType', header: 'Action', render: (row) => <span className="font-medium text-slate-900">{row.eventType}</span> },
            { key: 'aggregate', header: 'Entity', render: (row) => <span>{row.aggregateType} <IdText value={row.aggregateId} /></span> },
            { key: 'actor', header: 'User', render: (row) => <span><IdText value={row.actorId} /> {row.actorRole && <span className="text-xs text-slate-500">({row.actorRole})</span>}</span> },
            { key: 'sourceService', header: 'Service' },
            { key: 'outcome', header: 'Outcome', render: (row) => <StatusBadge status={row.outcome} /> },
          ]}
          rows={page.items}
          loading={query.isLoading}
          error={query.error}
          onRetry={query.refetch}
          onRowClick={(row) => navigate(`/audit/${row.id}`)}
          empty={{ title: 'No audit events match the filters' }}
        />
        <Pagination {...page} onPageChange={pager.setPage} onSizeChange={pager.setSize} disabled={query.isFetching} />
      </div>
    </>
  );
}
