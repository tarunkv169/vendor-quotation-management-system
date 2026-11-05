import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FileClock } from 'lucide-react';
import PageHeader from '@/components/common/PageHeader';
import Button from '@/components/common/Button';
import SummaryPanel from '@/components/common/SummaryPanel';
import DataTable from '@/components/common/DataTable';
import DetailList, { IdText } from '@/components/common/DetailList';
import StatusBadge from '@/components/common/StatusBadge';
import JsonView from '@/components/common/JsonView';
import { DetailSkeleton } from '@/components/common/Skeleton';
import { ErrorState } from '@/components/common/EmptyState';
import { formatDateTime } from '@/utils/formatDate';
import { auditKeys, auditService } from '../auditService';

export default function AuditDetailPage() {
  const { id } = useParams();
  const event = useQuery({ queryKey: auditKeys.one(id), queryFn: ({ signal }) => auditService.get(id, signal) });

  if (event.isLoading) return <DetailSkeleton />;
  if (event.error) return <ErrorState error={event.error} onRetry={event.refetch} />;
  const data = event.data;

  return (
    <>
      <PageHeader
        title={data.eventType}
        meta={<StatusBadge status={data.outcome} />}
        description={`Sequence #${data.sequenceNumber} · ${formatDateTime(data.occurredAt)}`}
        actions={
          data.aggregateType &&
          data.aggregateId && (
            <Button variant="secondary" icon={FileClock} to={`/audit/entity/${encodeURIComponent(data.aggregateType)}/${data.aggregateId}`}>
              Entity history
            </Button>
          )
        }
      />
      <div className="space-y-6">
        <SummaryPanel title="Event">
          <DetailList
            items={[
              { label: 'Entity', value: <span>{data.aggregateType} <IdText value={data.aggregateId} /></span> },
              { label: 'User', value: <span><IdText value={data.actorId} /> {data.actorRole}</span> },
              { label: 'Service', value: data.sourceService },
              { label: 'Recorded', value: formatDateTime(data.recordedAt) },
              { label: 'Event ID', value: <span className="font-mono text-xs">{data.eventId}</span> },
              { label: 'Correlation ID', value: <span className="font-mono text-xs">{data.correlationId}</span> },
              { label: 'Description', value: data.description, full: true },
              { label: 'Hash', value: <span className="break-all font-mono text-xs">{data.hash}</span>, full: true },
            ]}
          />
        </SummaryPanel>
        <SummaryPanel title="Payload">
          <JsonView value={data.payload} />
        </SummaryPanel>
      </div>
    </>
  );
}

export function EntityHistoryPage() {
  const { type, id } = useParams();
  const navigate = useNavigate();
  const timeline = useQuery({ queryKey: auditKeys.timeline(type, id), queryFn: ({ signal }) => auditService.timeline(type, id, signal) });

  return (
    <>
      <PageHeader title="Entity history" description={`${decodeURIComponent(type)} ${id}`} />
      <div className="card overflow-hidden">
        <DataTable
          dense
          columns={[
            { key: 'sequenceNumber', header: '#', align: 'right' },
            { key: 'occurredAt', header: 'Occurred', render: (row) => formatDateTime(row.occurredAt) },
            { key: 'eventType', header: 'Action', render: (row) => <span className="font-medium text-slate-900">{row.eventType}</span> },
            { key: 'actor', header: 'User', render: (row) => <IdText value={row.actorId} /> },
            { key: 'description', header: 'Description', render: (row) => row.description || '—' },
            { key: 'outcome', header: 'Outcome', render: (row) => <StatusBadge status={row.outcome} /> },
          ]}
          rows={timeline.data || []}
          loading={timeline.isLoading}
          error={timeline.error}
          onRetry={timeline.refetch}
          onRowClick={(row) => navigate(`/audit/${row.id}`)}
          empty={{ title: 'No events recorded for this entity' }}
        />
      </div>
    </>
  );
}
