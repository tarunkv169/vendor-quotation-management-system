import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileText, ScanText, Trash } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import DetailHeader, { HeaderLink } from '@/components/common/DetailHeader';
import SummaryPanel from '@/components/common/SummaryPanel';
import Button from '@/components/common/Button';
import DataTable from '@/components/common/DataTable';
import DetailList, { IdText } from '@/components/common/DetailList';
import StatusBadge from '@/components/common/StatusBadge';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import Alert from '@/components/common/Alert';
import { DetailSkeleton } from '@/components/common/Skeleton';
import { ErrorState } from '@/components/common/EmptyState';
import { formatDateTime } from '@/utils/formatDate';
import { formatFileSize } from '@/utils/formatCurrency';
import { humanize } from '@/utils/constants';
import { FEATURE_MESSAGES } from '@/utils/features';
import { useDocumentStorage } from '@/hooks/useDocumentStorage';
import { extractionKeys, extractionService } from '@/features/extraction/extractionService';
import { documentKeys, documentService, openDocumentDownload } from '../documentService';
import { documentPermissions } from '../documentActions';


export default function DocumentDetailPage() {
  const { id } = useParams();
  const storageEnabled = useDocumentStorage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can, canAccess } = useAuth();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const document = useQuery({ queryKey: documentKeys.one(id), queryFn: ({ signal }) => documentService.get(id, signal) });
  const history = useQuery({ queryKey: documentKeys.history(id), queryFn: ({ signal }) => documentService.history(id, signal) });
  const extractions = useQuery({
    queryKey: extractionKeys.byDocument(id),
    queryFn: ({ signal }) => extractionService.byDocument(id, signal),
    enabled: can('extraction.start'),
    meta: { silent: true },
  });

  const download = useMutation({ mutationFn: () => openDocumentDownload(id) });
  const remove = useMutation({
    mutationFn: () => documentService.remove(id),
    meta: { successMessage: 'Document deleted' },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentKeys.all });
      navigate('/documents', { replace: true });
    },
  });
  const extract = useMutation({
    mutationFn: () => extractionService.start(id),
    meta: { successMessage: 'Extraction started' },
    onSuccess: (accepted) => navigate(`/extraction/${accepted.extractionId}`),
  });

  if (document.isLoading) return <DetailSkeleton />;
  if (document.error) return <ErrorState error={document.error} onRetry={document.refetch} />;
  const data = document.data;
  const { canDownload: downloadable, canExtract: extractable, canDelete } = documentPermissions(data, can);

  return (
    <>
      <DetailHeader
        backTo="/documents"
        backLabel="Documents"
        icon={FileText}
        title={data.documentName}
        badges={<StatusBadge status={data.documentStatus} />}
        meta={`${humanize(data.documentType)} · ${formatFileSize(data.fileSize)} · Uploaded ${formatDateTime(data.createdAt)}`}
        links={
          <>
            {data.quotationId && <HeaderLink to={`/quotations/${data.quotationId}`}>Quotation</HeaderLink>}
            {data.vendorId && canAccess('vendors') && <HeaderLink to={`/vendors/${data.vendorId}`}>Vendor</HeaderLink>}
            {data.procurementRequestId && <HeaderLink to={`/procurement/${data.procurementRequestId}`}>Procurement request</HeaderLink>}
          </>
        }
        next={
          extractable
            ? 'This quotation file can be sent to AI extraction to read its line items.'
            : downloadable
              ? 'Stored and available for download.'
              : `Status: ${humanize(data.documentStatus)}.`
        }
        actions={
          <>
            {extractable && (
              <Button icon={ScanText} onClick={() => extract.mutate()} loading={extract.isPending}>
                Start extraction
              </Button>
            )}
            {downloadable && (
              <Button variant="secondary" icon={Download} onClick={() => download.mutate()} loading={download.isPending}>
                Download
              </Button>
            )}
            {canDelete && (
              <Button variant="ghost" icon={Trash} onClick={() => setConfirmDelete(true)}>
                Delete
              </Button>
            )}
          </>
        }
      >
        {!storageEnabled && <Alert tone="info">{FEATURE_MESSAGES.documentStorage}</Alert>}
        {data.failureReason && <Alert tone="error" title="Failure reason">{data.failureReason}</Alert>}
      </DetailHeader>

      <SummaryPanel className="mt-6" title="File details">
        <DetailList
          items={[
            { label: 'Content type', value: data.contentType },
            { label: 'Size', value: formatFileSize(data.fileSize) },
            { label: 'Uploaded', value: formatDateTime(data.createdAt) },
            { label: 'Checksum (SHA-256)', value: <span className="break-all font-mono text-xs">{data.checksum}</span>, full: true },
            { label: 'Description', value: data.description, full: true },
          ]}
        />
      </SummaryPanel>

      {can('extraction.start') && (
        <SummaryPanel className="mt-4" title="AI extractions" bodyClassName="overflow-hidden p-0">
          <DataTable
            dense
            caption="Extractions of this document"
            columns={[
              { key: 'extractionId', header: 'Extraction', render: (row) => <IdText value={row.extractionId} /> },
              { key: 'attempt', header: 'Attempt', align: 'right' },
              { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
              { key: 'overallConfidence', header: 'Confidence', align: 'right', render: (row) => row.overallConfidence ?? '—' },
              { key: 'createdAt', header: 'Started', className: 'whitespace-nowrap', render: (row) => formatDateTime(row.createdAt) },
            ]}
            rows={extractions.data || []}
            rowKey="extractionId"
            loading={extractions.isLoading}
            error={extractions.error}
            onRetry={extractions.refetch}
            onRowClick={(row) => navigate(`/extraction/${row.extractionId}`)}
            empty={{ title: 'No extractions yet', description: extractable ? 'Start an extraction to read the items from this file.' : undefined }}
          />
        </SummaryPanel>
      )}

      <SummaryPanel className="mt-4" title="Status history" bodyClassName="overflow-hidden p-0">
        <DataTable
          dense
          caption="Document status history"
          columns={[
            { key: 'changedAt', header: 'When', className: 'whitespace-nowrap', render: (row) => formatDateTime(row.changedAt) },
            { key: 'fromStatus', header: 'From', render: (row) => <StatusBadge status={row.fromStatus} /> },
            { key: 'toStatus', header: 'To', render: (row) => <StatusBadge status={row.toStatus} /> },
            { key: 'reason', header: 'Reason', render: (row) => row.reason || <span className="text-slate-400">—</span> },
            { key: 'changedBy', header: 'By', render: (row) => <IdText value={row.changedBy} /> },
          ]}
          rows={history.data || []}
          loading={history.isLoading}
          error={history.error}
          onRetry={history.refetch}
          empty={{ title: 'No status changes recorded' }}
        />
      </SummaryPanel>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => remove.mutate()}
        loading={remove.isPending}
        title="Delete document"
        message={`Delete ${data.documentName}?`}
        tone="danger"
        confirmLabel="Delete"
      />
    </>
  );
}
