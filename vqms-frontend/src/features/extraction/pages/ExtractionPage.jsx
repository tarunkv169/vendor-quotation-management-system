import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Play, RefreshCw, ScanText, Upload } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePagination } from '@/hooks/usePagination';
import PageHeader from '@/components/common/PageHeader';
import SummaryPanel from '@/components/common/SummaryPanel';
import Tabs from '@/components/common/Tabs';
import EmptyState from '@/components/common/EmptyState';
import Button from '@/components/common/Button';
import DataTable from '@/components/common/DataTable';
import Pagination from '@/components/common/Pagination';
import StatusBadge from '@/components/common/StatusBadge';
import Alert from '@/components/common/Alert';
import { IdText } from '@/components/common/DetailList';
import { cn } from '@/utils/cn';
import { normalizePage } from '@/utils/pagination';
import { formatDateTime } from '@/utils/formatDate';
import { humanize } from '@/utils/constants';
import { FEATURES, FEATURE_MESSAGES } from '@/utils/features';
import { documentKeys, documentService } from '@/features/documents/documentService';
import { extractionKeys, extractionService } from '../extractionService';

/**
 * The AI Extraction Service has no "list all extractions" endpoint, so this page lists extractable
 * documents (Document Service) and shows the extraction history of the selected document.
 */
export default function ExtractionPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get('documentId');
  const [documentType, setDocumentType] = useState('QUOTATION_PDF');
  const pager = usePagination({ size: 10 });

  const params = { documentType, page: pager.page, size: pager.size };
  const documents = useQuery({
    queryKey: documentKeys.list(params),
    queryFn: ({ signal }) => documentService.search(params, signal),
    placeholderData: keepPreviousData,
  });
  const page = normalizePage(documents.data);

  const history = useQuery({
    queryKey: extractionKeys.byDocument(selectedId),
    queryFn: ({ signal }) => extractionService.byDocument(selectedId, signal),
    enabled: Boolean(selectedId),
  });

  const start = useMutation({
    mutationFn: ({ documentId, force }) => extractionService.start(documentId, force),
    meta: { successMessage: 'Extraction started' },
    onSuccess: (accepted) => {
      queryClient.invalidateQueries({ queryKey: extractionKeys.byDocument(accepted.documentId) });
      navigate(`/extraction/${accepted.extractionId}`);
    },
  });

  const selected = page.items.find((document) => document.id === selectedId);

  return (
    <>
      <PageHeader
        title="AI Extraction"
        description="Read line items, prices and terms from uploaded quotation PDFs and Excel files."
        actions={can('document.upload') && <Button variant="secondary" icon={Upload} to="/documents/upload">Upload document</Button>}
      />
      {!FEATURES.aiExtraction && <Alert tone="info" className="mb-5">{FEATURE_MESSAGES.aiExtraction}</Alert>}

      <Tabs
        variant="pill"
        label="Document type"
        value={documentType}
        onChange={(type) => {
          setDocumentType(type);
          pager.reset();
        }}
        tabs={['QUOTATION_PDF', 'QUOTATION_EXCEL'].map((type) => ({ value: type, label: humanize(type) }))}
      />

      <div className="mt-5 grid gap-4 xl:grid-cols-5">
        <SummaryPanel title="Quotation documents" className="xl:col-span-3" bodyClassName="overflow-hidden p-0">
          <DataTable
            dense
            caption="Extractable quotation documents"
            columns={[
              {
                key: 'documentName',
                header: 'Document',
                className: 'min-w-56',
                render: (row) => (
                  <div className="flex min-w-0 items-center gap-2.5">
                    <FileText className={cn('h-4 w-4 shrink-0', row.id === selectedId ? 'text-brand-600' : 'text-slate-400')} aria-hidden="true" />
                    <span className={cn('truncate font-medium', row.id === selectedId ? 'text-brand-700' : 'text-slate-900')}>{row.documentName}</span>
                  </div>
                ),
              },
              { key: 'documentStatus', header: 'Status', render: (row) => <StatusBadge status={row.documentStatus} /> },
              { key: 'createdAt', header: 'Uploaded', className: 'whitespace-nowrap text-slate-500', render: (row) => formatDateTime(row.createdAt) },
              {
                key: 'actions',
                header: <span className="sr-only">Actions</span>,
                align: 'right',
                render: (row) =>
                  FEATURES.aiExtraction && (
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={Play}
                      onClick={(event) => {
                        event.stopPropagation();
                        start.mutate({ documentId: row.id, force: false });
                      }}
                      disabled={start.isPending || !['ACTIVE', 'PROCESSED', 'FAILED'].includes(row.documentStatus)}
                    >
                      Extract
                    </Button>
                  ),
              },
            ]}
            rows={page.items}
            loading={documents.isLoading}
            error={documents.error}
            onRetry={documents.refetch}
            onRowClick={(row) => setSearchParams({ documentId: row.id }, { replace: true })}
            empty={{
              title: 'No quotation documents',
              description: 'Upload a quotation PDF or Excel file first.',
              action: can('document.upload') && (
                <Button size="sm" to="/documents/upload">
                  Upload document
                </Button>
              ),
            }}
          />
          <Pagination {...page} onPageChange={pager.setPage} disabled={documents.isFetching} />
        </SummaryPanel>

        <SummaryPanel
          title="Extraction history"
          className="xl:col-span-2"
          bodyClassName="overflow-hidden p-0"
          footer={selected ? selected.documentName : undefined}
          action={
            FEATURES.aiExtraction &&
            selectedId && (
              <Button size="sm" variant="secondary" icon={RefreshCw} onClick={() => start.mutate({ documentId: selectedId, force: true })} loading={start.isPending}>
                Re-extract
              </Button>
            )
          }
        >
          {!selectedId ? (
            <EmptyState icon={ScanText} title="No document selected" description="Choose a document on the left to see each extraction attempt and its result." />
          ) : (
            <DataTable
              dense
              caption="Extraction attempts"
              rowKey="extractionId"
              columns={[
                { key: 'extractionId', header: 'Extraction', render: (row) => <IdText value={row.extractionId} /> },
                { key: 'attempt', header: 'Attempt', align: 'right' },
                { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
                { key: 'createdAt', header: 'Started', className: 'whitespace-nowrap', render: (row) => formatDateTime(row.createdAt) },
              ]}
              rows={history.data || []}
              loading={history.isLoading}
              error={history.error}
              onRetry={history.refetch}
              onRowClick={(row) => navigate(`/extraction/${row.extractionId}`)}
              empty={{ title: 'Not extracted yet', description: 'Use Extract to run the AI extraction on this document.' }}
            />
          )}
        </SummaryPanel>
      </div>
    </>
  );
}
