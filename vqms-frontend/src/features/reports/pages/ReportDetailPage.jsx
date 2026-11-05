import { useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import PageHeader from '@/components/common/PageHeader';
import Button from '@/components/common/Button';
import SummaryPanel from '@/components/common/SummaryPanel';
import DetailList from '@/components/common/DetailList';
import StatusBadge from '@/components/common/StatusBadge';
import Alert from '@/components/common/Alert';
import { DetailSkeleton } from '@/components/common/Skeleton';
import { ErrorState } from '@/components/common/EmptyState';
import { formatDateTime } from '@/utils/formatDate';
import { formatNumber } from '@/utils/formatCurrency';
import { humanize } from '@/utils/constants';
import { reportKeys, reportingService } from '../reportingService';
import ReportDataView from '../components/ReportDataView';

export default function ReportDetailPage() {
  const { id } = useParams();
  const report = useQuery({ queryKey: reportKeys.one(id), queryFn: ({ signal }) => reportingService.get(id, signal) });
  const exportCsv = useMutation({ mutationFn: () => reportingService.exportCsv(id, `${report.data?.reportNumber || id}.csv`) });

  if (report.isLoading) return <DetailSkeleton />;
  if (report.error) return <ErrorState error={report.error} onRetry={report.refetch} />;
  const data = report.data;

  return (
    <>
      <PageHeader
        title={data.reportNumber}
        meta={<StatusBadge status={data.status} />}
        description={humanize(data.reportType)}
        actions={
          data.status !== 'FAILED' && (
            <Button variant="secondary" icon={Download} onClick={() => exportCsv.mutate()} loading={exportCsv.isPending}>
              Export CSV
            </Button>
          )
        }
      />
      <div className="space-y-6">
        {data.failureReason && <Alert tone="error" title="Report failed">{data.failureReason}</Alert>}
        {data.warnings?.length > 0 && (
          <Alert tone="warning" title="Partial data">
            <ul className="list-disc pl-4">
              {data.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </Alert>
        )}
        <SummaryPanel title="Report">
          <DetailList
            columns={4}
            items={[
              { label: 'Generated', value: formatDateTime(data.generatedAt) },
              { label: 'Rows', value: formatNumber(data.rowCount) },
              { label: 'Duration', value: `${formatNumber(data.durationMs)} ms` },
              { label: 'Parameters', value: Object.entries(data.parameters || {}).map(([key, value]) => `${key}: ${value}`).join(', ') || 'None' },
            ]}
          />
        </SummaryPanel>
        <ReportDataView data={data.data} />
      </div>
    </>
  );
}
