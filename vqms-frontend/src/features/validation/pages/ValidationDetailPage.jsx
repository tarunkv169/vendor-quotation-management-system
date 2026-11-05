import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import DetailHeader, { HeaderLink } from '@/components/common/DetailHeader';
import Button from '@/components/common/Button';
import SummaryPanel from '@/components/common/SummaryPanel';
import DataTable from '@/components/common/DataTable';
import DetailList, { IdText } from '@/components/common/DetailList';
import StatusBadge from '@/components/common/StatusBadge';
import Tabs from '@/components/common/Tabs';
import Alert from '@/components/common/Alert';
import { DetailSkeleton } from '@/components/common/Skeleton';
import { ErrorState } from '@/components/common/EmptyState';
import { formatDateTime } from '@/utils/formatDate';
import { formatCurrency } from '@/utils/formatCurrency';
import { humanize } from '@/utils/constants';
import { normalizePage } from '@/utils/pagination';
import { validationKeys, validationService } from '../validationService';

export default function ValidationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const [severity, setSeverity] = useState('');

  const validation = useQuery({ queryKey: validationKeys.one(id), queryFn: ({ signal }) => validationService.get(id, signal) });
  const quotationId = validation.data?.quotationId;
  const history = useQuery({
    queryKey: validationKeys.byQuotation(quotationId),
    queryFn: ({ signal }) => validationService.byQuotation(quotationId, { page: 0, size: 20 }, signal),
    enabled: Boolean(quotationId),
  });

  const revalidate = useMutation({
    mutationFn: () => validationService.revalidate(id),
    meta: { successMessage: 'Revalidation completed' },
    onSuccess: (next) => {
      queryClient.invalidateQueries({ queryKey: validationKeys.all });
      navigate(`/validation/${next.id}`);
    },
  });

  const issues = useMemo(() => (validation.data?.issues || []).filter((issue) => !severity || issue.severity === severity), [validation.data, severity]);

  if (validation.isLoading) return <DetailSkeleton />;
  if (validation.error) return <ErrorState error={validation.error} onRetry={validation.refetch} />;
  const data = validation.data;
  const currency = data.currencyCode;

  return (
    <>
      <DetailHeader
        backTo="/validation"
        backLabel="Validations"
        icon={ShieldCheck}
        title={data.quotationNumber ? `Validation of ${data.quotationNumber}` : 'Quotation validation'}
        badges={<StatusBadge status={data.status} />}
        meta={`${humanize(data.trigger)} · ${formatDateTime(data.validatedAt || data.createdAt)}`}
        links={
          <>
            <HeaderLink to={`/quotations/${data.quotationId}`}>Quotation</HeaderLink>
            {data.procurementRequestId && <HeaderLink to={`/procurement/${data.procurementRequestId}`}>Procurement request</HeaderLink>}
          </>
        }
        next={data.status === 'PASSED' ? 'All checks passed.' : data.status === 'FAILED' ? 'Some checks failed. Review the findings below.' : 'Some findings need a manual review.'}
        actions={
          can('validation.run') && (
            <Button variant="secondary" icon={RefreshCw} onClick={() => revalidate.mutate()} loading={revalidate.isPending}>
              Revalidate
            </Button>
          )
        }
      >
        {data.summary && <Alert tone={data.status === 'PASSED' ? 'success' : data.status === 'FAILED' ? 'error' : 'warning'}>{data.summary}</Alert>}
      </DetailHeader>
      <div className="mt-6 space-y-6">

        <div className="grid gap-6 lg:grid-cols-3">
          <SummaryPanel title="Context" className="lg:col-span-2">
            <DetailList
              items={[
                { label: 'Quotation', value: <Link className="text-brand-700 hover:underline" to={`/quotations/${data.quotationId}`}><IdText value={data.quotationId} /></Link> },
                { label: 'Quotation version', value: data.quotationVersion },
                { label: 'Vendor', value: data.vendorId ? <Link className="text-brand-700 hover:underline" to={`/vendors/${data.vendorId}`}><IdText value={data.vendorId} /></Link> : null },
                { label: 'Procurement request', value: data.procurementRequestId ? <Link className="text-brand-700 hover:underline" to={`/procurement/${data.procurementRequestId}`}><IdText value={data.procurementRequestId} /></Link> : null },
                { label: 'Extraction', value: data.extractionId ? <Link className="text-brand-700 hover:underline" to={`/extraction/${data.extractionId}`}><IdText value={data.extractionId} /></Link> : null },
                { label: 'Document', value: data.documentId ? <Link className="text-brand-700 hover:underline" to={`/documents/${data.documentId}`}><IdText value={data.documentId} /></Link> : null },
              ]}
            />
          </SummaryPanel>
          <SummaryPanel title="Amount check">
            <dl className="space-y-2 text-sm">
              {[
                ['Expected subtotal', data.expectedSubtotal],
                ['Expected discount', data.expectedDiscount],
                ['Expected tax', data.expectedTax],
                ['Expected total', data.expectedTotal],
                ['Quoted total', data.quotedTotal],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="tabular-nums">{formatCurrency(value, currency)}</dd>
                </div>
              ))}
            </dl>
          </SummaryPanel>
        </div>

        <SummaryPanel title="Issues" bodyClassName="overflow-hidden p-0">
          <Tabs
            className="px-4"
            value={severity}
            onChange={setSeverity}
            tabs={[
              { value: '', label: 'All', count: data.issues?.length || 0 },
              { value: 'ERROR', label: 'Errors', count: data.errorCount },
              { value: 'WARNING', label: 'Warnings', count: data.warningCount },
              { value: 'INFO', label: 'Info', count: data.infoCount },
            ]}
          />
          <DataTable
            dense
            columns={[
              { key: 'severity', header: 'Severity', render: (row) => <StatusBadge status={row.severity} /> },
              { key: 'validationType', header: 'Check', render: (row) => humanize(row.validationType) },
              { key: 'message', header: 'Message', className: 'min-w-64' },
              { key: 'fieldPath', header: 'Field', render: (row) => (row.fieldPath ? <code className="text-xs">{row.fieldPath}</code> : '—') },
              { key: 'expectedValue', header: 'Expected', render: (row) => row.expectedValue ?? '—' },
              { key: 'actualValue', header: 'Actual', render: (row) => row.actualValue ?? '—' },
            ]}
            rows={issues}
            empty={{ title: 'No issues', description: 'This validation did not report any issue for the selected severity.' }}
          />
        </SummaryPanel>

        <SummaryPanel title="Validation history of this quotation" bodyClassName="overflow-hidden p-0">
          <DataTable
            dense
            columns={[
              { key: 'createdAt', header: 'When', render: (row) => formatDateTime(row.createdAt) },
              { key: 'trigger', header: 'Trigger', render: (row) => humanize(row.trigger) },
              { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
              { key: 'errorCount', header: 'Errors', align: 'right' },
              { key: 'warningCount', header: 'Warnings', align: 'right' },
            ]}
            rows={normalizePage(history.data).items}
            loading={history.isLoading}
            error={history.error}
            onRetry={history.refetch}
            onRowClick={(row) => row.id !== id && navigate(`/validation/${row.id}`)}
          />
        </SummaryPanel>
      </div>
    </>
  );
}
