import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, ScanText, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import DetailHeader, { HeaderLink } from '@/components/common/DetailHeader';
import Button from '@/components/common/Button';
import SummaryPanel from '@/components/common/SummaryPanel';
import DataTable from '@/components/common/DataTable';
import DetailList, { IdText } from '@/components/common/DetailList';
import StatusBadge from '@/components/common/StatusBadge';
import Alert from '@/components/common/Alert';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { DetailSkeleton } from '@/components/common/Skeleton';
import { ErrorState } from '@/components/common/EmptyState';
import { formatDateTime } from '@/utils/formatDate';
import { formatNumber } from '@/utils/formatCurrency';
import { humanize } from '@/utils/constants';
import { FEATURES, FEATURE_MESSAGES } from '@/utils/features';
import { validationService } from '@/features/validation/validationService';
import { extractionKeys, extractionService, EXTRACTION_ACTIVE } from '../extractionService';

/** One ExtractedField: value + confidence + ambiguity flag + evidence. */
function FieldValue({ field }) {
  if (!field || (field.value === null && !field.rawText)) return <span className="text-slate-400">Not found</span>;
  const level = field.confidence?.level;
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span title={field.evidence?.sourceText || undefined}>{String(field.value ?? field.rawText)}</span>
      {level && <StatusBadge status={level} tone={level === 'HIGH' ? 'green' : level === 'MEDIUM' ? 'amber' : 'red'} label={`${humanize(level)} confidence`} />}
      {field.ambiguous && <StatusBadge status="AMBIGUOUS" tone="amber" label="Ambiguous" />}
    </span>
  );
}

const fieldItems = (pairs) => pairs.map(([label, field]) => ({ label, value: <FieldValue field={field} /> }));

export default function ExtractionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can } = useAuth();

  const extraction = useQuery({
    queryKey: extractionKeys.one(id),
    queryFn: ({ signal }) => extractionService.get(id, signal),
    // Poll while the job is running.
    refetchInterval: (query) => (EXTRACTION_ACTIVE.includes(query.state.data?.status) ? 3000 : false),
  });

  const retry = useMutation({
    mutationFn: () => extractionService.retry(id),
    meta: { successMessage: 'Extraction queued again' },
    onSuccess: (accepted) => {
      queryClient.invalidateQueries({ queryKey: extractionKeys.all });
      if (accepted.extractionId !== id) navigate(`/extraction/${accepted.extractionId}`);
    },
  });
  const validate = useMutation({
    mutationFn: () => validationService.run({ quotationId: extraction.data.quotationId, extractionId: id, documentId: extraction.data.documentId }),
    meta: { successMessage: 'Validation completed' },
    onSuccess: (validation) => navigate(`/validation/${validation.id}`),
  });

  if (extraction.isLoading) return <DetailSkeleton />;
  if (extraction.error) return <ErrorState error={extraction.error} onRetry={extraction.refetch} />;

  const data = extraction.data;
  const running = EXTRACTION_ACTIVE.includes(data.status);
  const q = data.quotation;

  return (
    <>
      <DetailHeader
        backTo="/extraction"
        backLabel="AI Extraction"
        icon={ScanText}
        title={q?.vendor?.name?.value ? `Extraction · ${q.vendor.name.value}` : 'Document extraction'}
        badges={
          <>
            <StatusBadge status={data.status} />
            {data.requiresHumanReview && <StatusBadge status="NEEDS_REVIEW" label="Review required" />}
          </>
        }
        meta={`Attempt ${data.attempt} · started ${formatDateTime(data.createdAt)}${data.documentFormat ? ` · ${humanize(data.documentFormat)}` : ''}${data.usedOcr ? ' · OCR' : ''}`}
        links={
          <>
            <HeaderLink to={`/documents/${data.documentId}`}>Source document</HeaderLink>
            {data.quotationId && <HeaderLink to={`/quotations/${data.quotationId}`}>Quotation</HeaderLink>}
          </>
        }
        figure={data.overallConfidence != null ? formatNumber(data.overallConfidence, 2) : '—'}
        figureLabel="Overall confidence"
        figureNote={data.processingMs != null ? `${formatNumber(data.processingMs)} ms processing` : undefined}
        next={
          running
            ? 'Extraction in progress. This page refreshes automatically.'
            : data.status === 'FAILED'
              ? 'The extraction failed. Retry after checking the source document.'
              : 'Review the extracted values, then validate the quotation.'
        }
        actions={
          <>
            {data.quotationId && can('validation.run') && ['COMPLETED', 'NEEDS_REVIEW'].includes(data.status) && (
              <Button icon={ShieldCheck} onClick={() => validate.mutate()} loading={validate.isPending}>
                Validate quotation
              </Button>
            )}
            {FEATURES.aiExtraction && ['FAILED', 'NEEDS_REVIEW'].includes(data.status) && can('extraction.start') && (
              <Button variant="secondary" icon={RefreshCw} onClick={() => retry.mutate()} loading={retry.isPending}>
                Retry
              </Button>
            )}
          </>
        }
      />

      <div className="mt-6 space-y-6">
        {running && (
          <Alert tone="info" title="Extraction in progress">
            <span className="inline-flex items-center gap-2">
              <LoadingSpinner size="sm" /> The page refreshes automatically.
            </span>
          </Alert>
        )}
        {data.status === 'FAILED' && (
          <Alert tone="error" title={data.failureCode ? humanize(data.failureCode) : 'Extraction failed'}>
            {data.failureReason}
          </Alert>
        )}
        {data.requiresHumanReview && <Alert tone="warning" title="Human review required">Check the flagged fields below before using this data.</Alert>}

        <SummaryPanel title="Summary">
          <DetailList
            columns={4}
            items={[
              { label: 'Document', value: <Link className="text-brand-700 hover:underline" to={`/documents/${data.documentId}`}><IdText value={data.documentId} /></Link> },
              { label: 'Quotation', value: data.quotationId ? <Link className="text-brand-700 hover:underline" to={`/quotations/${data.quotationId}`}><IdText value={data.quotationId} /></Link> : null },
              { label: 'Format', value: humanize(data.documentFormat) },
              { label: 'OCR used', value: data.usedOcr ? 'Yes' : 'No' },
              { label: 'Overall confidence', value: data.overallConfidence != null ? formatNumber(data.overallConfidence, 3) : null },
              { label: 'Processing time', value: data.processingMs != null ? `${formatNumber(data.processingMs)} ms` : null },
              { label: 'Completed', value: formatDateTime(data.completedAt) },
              { label: 'Model', value: data.llmUsage ? [data.llmUsage.provider, data.llmUsage.model].filter(Boolean).join(' / ') : null },
            ]}
          />
        </SummaryPanel>

        {q && (
          <>
            <div className="grid gap-6 lg:grid-cols-2">
              <SummaryPanel title="Quotation fields">
                <DetailList
                  columns={1}
                  items={fieldItems([
                    ['Quotation number', q.quotationNumber],
                    ['Quotation date', q.quotationDate],
                    ['Valid until', q.validUntil],
                    ['Delivery days', q.deliveryDays],
                    ['Delivery terms', q.deliveryTerms],
                    ['Warranty (months)', q.warrantyMonths],
                    ['Warranty terms', q.warrantyTerms],
                    ['Payment terms', q.paymentTerms],
                  ])}
                />
              </SummaryPanel>
              <div className="space-y-6">
                <SummaryPanel title="Vendor">
                  <DetailList
                    columns={1}
                    items={fieldItems([
                      ['Name', q.vendor?.name],
                      ['Tax ID', q.vendor?.taxId],
                      ['Email', q.vendor?.email],
                      ['Phone', q.vendor?.phone],
                      ['Address', q.vendor?.address],
                    ])}
                  />
                </SummaryPanel>
                <SummaryPanel title="Stated totals">
                  <DetailList
                    columns={1}
                    items={fieldItems([
                      ['Currency', q.financials?.currencyCode],
                      ['Subtotal', q.financials?.subtotalStated],
                      ['Discount', q.financials?.discountAmountStated],
                      ['Tax', q.financials?.taxAmountStated],
                      ['Total', q.financials?.totalAmountStated],
                    ])}
                  />
                </SummaryPanel>
              </div>
            </div>

            <SummaryPanel title="Extracted line items" bodyClassName="overflow-hidden p-0">
              <DataTable
                dense
                rowKey="lineNumber"
                columns={[
                  { key: 'lineNumber', header: '#', align: 'right' },
                  { key: 'productName', header: 'Product', render: (row) => <FieldValue field={row.productName} /> },
                  { key: 'quantity', header: 'Qty', render: (row) => <FieldValue field={row.quantity} /> },
                  { key: 'unit', header: 'Unit', render: (row) => <FieldValue field={row.unit} /> },
                  { key: 'unitPrice', header: 'Unit price', render: (row) => <FieldValue field={row.unitPrice} /> },
                  { key: 'taxRatePercent', header: 'Tax %', render: (row) => <FieldValue field={row.taxRatePercent} /> },
                  { key: 'lineAmountStated', header: 'Line amount', render: (row) => <FieldValue field={row.lineAmountStated} /> },
                ]}
                rows={q.items || []}
                empty={{ title: 'No line items extracted' }}
              />
            </SummaryPanel>
          </>
        )}

        <SummaryPanel title="Missing or ambiguous fields" bodyClassName="overflow-hidden p-0">
          <DataTable
            dense
            rowKey={(row, index) => `${row.fieldPath}-${index}`}
            columns={[
              { key: 'severity', header: 'Severity', render: (row) => <StatusBadge status={row.severity} /> },
              { key: 'fieldPath', header: 'Field', render: (row) => <code className="text-xs">{row.fieldPath}</code> },
              { key: 'issueType', header: 'Issue', render: (row) => humanize(row.issueType) },
              { key: 'message', header: 'Message' },
            ]}
            rows={data.issues || []}
            empty={{ title: running ? 'Waiting for results' : 'No issues reported' }}
          />
        </SummaryPanel>
      </div>
    </>
  );
}
