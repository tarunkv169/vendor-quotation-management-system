import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CircleX, Clock, FileSpreadsheet, FileText, History, Info, Play, RefreshCw, ScanText, Settings, Upload, Zap } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePagination } from '@/hooks/usePagination';
import { useAiExtraction } from '@/hooks/useAiExtraction';
import { useDocumentStorage } from '@/hooks/useDocumentStorage';
import Button from '@/components/common/Button';
import DataTable from '@/components/common/DataTable';
import Pagination from '@/components/common/Pagination';
import StatusBadge from '@/components/common/StatusBadge';
import Tabs from '@/components/common/Tabs';
import KpiCard from '@/components/common/KpiCard';
import Modal from '@/components/common/Modal';
import Skeleton from '@/components/common/Skeleton';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import EmptyState, { ErrorState } from '@/components/common/EmptyState';
import { cn } from '@/utils/cn';
import { normalizePage } from '@/utils/pagination';
import { formatDateTime, formatRelative } from '@/utils/formatDate';
import { formatFileSize, formatNumber } from '@/utils/formatCurrency';
import { humanize } from '@/utils/constants';
import { FEATURE_MESSAGES, reportExtractionError } from '@/utils/features';
import { documentKeys, documentService } from '@/features/documents/documentService';
import ExtractionResult from '../components/ExtractionResult';
import { EXTRACTION_ACTIVE, extractionKeys, extractionService } from '../extractionService';

// The AI Extraction Service has no "list all extractions" endpoint, so the page lists the quotation
// documents (Document Service) and shows the extraction history of the selected one. The Document
// Service moves a document to PROCESSING / PROCESSED / FAILED while it is extracted, which the KPIs use.
const TYPES = [
  { value: 'QUOTATION_PDF', label: 'Quotation PDF', icon: FileText },
  { value: 'QUOTATION_EXCEL', label: 'Quotation Excel', icon: FileSpreadsheet },
];
const EXTRACTABLE_STATUSES = ['ACTIVE', 'PROCESSED', 'FAILED']; // existing rule of this page
const PENDING_STATUSES = ['UPLOADING', 'PENDING_SCAN', 'PROCESSING'];
const PAGE_SIZE = 100;
const MAX_PAGES = 20;

async function loadQuotationDocuments(signal) {
  const all = [];
  for (const type of TYPES) {
    for (let index = 0; index < MAX_PAGES; index += 1) {
      const result = normalizePage(await documentService.search({ documentType: type.value, page: index, size: PAGE_SIZE, sortBy: 'createdAt', direction: 'desc' }, signal));
      all.push(...result.items);
      if (index + 1 >= result.totalPages) break;
    }
  }
  return all.filter((row) => row.documentStatus !== 'DELETED');
}

function ConfigurationGuide({ open, onClose }) {
  const rows = [
    ['LLM_ENABLED', 'true', 'Switches extraction on.'],
    ['LLM_PROVIDER', 'openai or anthropic', 'Which LLM API the service calls.'],
    ['LLM_MODEL', 'model name', 'Required when LLM_ENABLED=true.'],
    ['LLM_API_KEY', 'API key', 'Required when LLM_ENABLED=true.'],
  ];
  return (
    <Modal open={open} onClose={onClose} title="Configure AI extraction" size="lg">
      <div className="space-y-4 text-sm text-slate-700">
        <p>
          AI extraction runs in the AI Extraction Service. It is configured with environment variables, in Docker in{' '}
          <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">backend/docker-compose/default/.env</code>:
        </p>
        <div className="overflow-x-auto rounded-md border border-line">
          <table className="min-w-full text-13">
            <thead className="bg-slate-50/70 text-left text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">Variable</th>
                <th className="px-3 py-2 font-medium">Value</th>
                <th className="px-3 py-2 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(([name, value, note]) => (
                <tr key={name}>
                  <td className="px-3 py-2 font-mono text-xs text-slate-900">{name}</td>
                  <td className="px-3 py-2">{value}</td>
                  <td className="px-3 py-2 text-slate-500">{note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ol className="list-decimal space-y-1 pl-5">
          <li>Set the variables above and restart the AI Extraction Service.</li>
          <li>Rebuild the web app so it shows the extraction actions (it reads the same LLM_ENABLED value).</li>
          <li>Document storage must be on (S3_ENABLED=true) too: the service downloads the file to extract it.</li>
        </ol>
      </div>
    </Modal>
  );
}

function AttemptState({ extraction }) {
  if (EXTRACTION_ACTIVE.includes(extraction.status)) {
    return (
      <div className="flex items-center gap-2.5 rounded-md bg-blue-50 px-3 py-2.5 text-13 text-blue-700">
        <LoadingSpinner size="sm" /> Extraction in progress — this panel refreshes automatically.
      </div>
    );
  }
  if (extraction.status === 'FAILED') {
    return (
      <div className="rounded-md bg-red-50 px-3 py-2.5 text-13 text-danger">
        <p className="font-semibold">{extraction.failureCode ? humanize(extraction.failureCode) : 'Extraction failed'}</p>
        {extraction.failureReason && <p className="mt-0.5 text-red-700">{extraction.failureReason}</p>}
      </div>
    );
  }
  return <ExtractionResult extraction={extraction} />;
}

function HistoryPanel({ document, aiEnabled, canStart, onStart, starting }) {
  const [chosen, setChosen] = useState(null);
  const history = useQuery({
    queryKey: extractionKeys.byDocument(document.id),
    queryFn: ({ signal }) => extractionService.byDocument(document.id, signal),
    refetchInterval: (query) => ((query.state.data || []).some((row) => EXTRACTION_ACTIVE.includes(row.status)) ? 3000 : false),
  });
  const attempts = useMemo(() => [...(history.data || [])].sort((a, b) => (b.attempt ?? 0) - (a.attempt ?? 0)), [history.data]);
  const current = attempts.find((row) => row.extractionId === chosen) || attempts[0];
  const Icon = document.documentType === 'QUOTATION_EXCEL' ? FileSpreadsheet : FileText;

  return (
    <div className="space-y-4 p-5 pt-0">
      {/* Selected document */}
      <div className="flex items-start gap-3 rounded-md border border-line p-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600">
          <Icon className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <Link to={`/documents/${document.id}`} className="block truncate font-semibold text-slate-900 hover:text-brand-700" title={document.documentName}>
            {document.documentName}
          </Link>
          <p className="mt-0.5 text-xs text-slate-500">
            {humanize(document.documentType)} · {formatFileSize(document.fileSize)} · uploaded {formatRelative(document.createdAt)}
          </p>
        </div>
        <StatusBadge status={document.documentStatus} />
      </div>

      {aiEnabled && canStart && (
        <Button
          variant={attempts.length ? 'secondary' : 'primary'}
          icon={attempts.length ? RefreshCw : Play}
          onClick={() => onStart(document, attempts.length > 0)}
          loading={starting}
          disabled={!EXTRACTABLE_STATUSES.includes(document.documentStatus)}
          title={EXTRACTABLE_STATUSES.includes(document.documentStatus) ? undefined : `Not available while ${humanize(document.documentStatus).toLowerCase()}`}
          className="w-full justify-center"
        >
          {attempts.length ? 'Re-extract' : 'Start extraction'}
        </Button>
      )}

      {history.isLoading ? (
        <div className="space-y-2" aria-hidden="true">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : history.error ? (
        <ErrorState error={history.error} onRetry={history.refetch} className="py-6" />
      ) : attempts.length === 0 ? (
        <EmptyState
          showIcon
          icon={ScanText}
          title="Not extracted yet"
          detail={aiEnabled ? 'Start an extraction to read the vendor, items and totals from this document.' : 'Extraction attempts appear here once AI extraction is enabled.'}
          className="py-8"
        />
      ) : (
        <>
          {/* Attempts */}
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.06em] text-slate-500">Attempts</p>
            <ul className="divide-y divide-slate-100 rounded-md border border-line">
              {attempts.map((row) => (
                <li key={row.extractionId}>
                  <button
                    type="button"
                    onClick={() => setChosen(row.extractionId)}
                    aria-pressed={row.extractionId === current?.extractionId}
                    className={cn('flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-13 hover:bg-slate-50', row.extractionId === current?.extractionId && 'bg-brand-50/50')}
                  >
                    <span className="min-w-0">
                      <span className="block font-medium text-slate-900">Attempt {row.attempt}</span>
                      <span className="block text-xs text-slate-500">
                        {formatDateTime(row.createdAt)}
                        {row.completedAt && ` · done ${formatRelative(row.completedAt)}`}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {row.overallConfidence != null && <span className="num text-xs text-slate-500">{formatNumber(row.overallConfidence * 100, 0)}%</span>}
                      <StatusBadge status={row.status} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Result of the chosen attempt */}
          {current && (
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.06em] text-slate-500">Result · attempt {current.attempt}</p>
                <Link to={`/extraction/${current.extractionId}`} className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline">
                  Full details <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </Link>
              </div>
              <AttemptState extraction={current} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function ExtractionPage() {
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const aiEnabled = useAiExtraction();
  const storageEnabled = useDocumentStorage();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get('documentId');
  const type = searchParams.get('type') || 'QUOTATION_PDF';
  const [guideOpen, setGuideOpen] = useState(false);
  const pager = usePagination({ size: 10, sortBy: 'createdAt', direction: 'desc' });

  const documents = useQuery({ queryKey: documentKeys.list({ scope: 'extraction' }), queryFn: ({ signal }) => loadQuotationDocuments(signal) });
  const all = useMemo(() => documents.data || [], [documents.data]);

  const setParam = (key, value) => {
    const next = new URLSearchParams(window.location.search);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  const rows = useMemo(() => {
    const factor = pager.direction === 'asc' ? 1 : -1;
    return all
      .filter((row) => row.documentType === type)
      .sort((a, b) => String(a[pager.sortBy] ?? '').localeCompare(String(b[pager.sortBy] ?? '')) * factor);
  }, [all, type, pager.sortBy, pager.direction]);
  const pageRows = rows.slice(pager.page * pager.size, (pager.page + 1) * pager.size);
  const selected = all.find((row) => row.id === selectedId);

  const count = (statuses) => all.filter((row) => statuses.includes(row.documentStatus)).length;
  const figure = (value) => ({ isLoading: documents.isLoading, error: documents.error, data: documents.error ? null : value });

  const start = useMutation({
    mutationFn: ({ document, force }) => extractionService.start(document.id, force),
    meta: { successMessage: 'Extraction started' },
    onSuccess: (accepted) => {
      queryClient.invalidateQueries({ queryKey: extractionKeys.byDocument(accepted.documentId) });
      queryClient.invalidateQueries({ queryKey: documentKeys.all });
    },
    onError: (error) => reportExtractionError(error),
  });
  const canStart = can('extraction.start');
  const canUpload = can('document.upload');

  const columns = [
    {
      key: 'documentName',
      header: 'Document',
      sortKey: 'documentName',
      className: 'min-w-56',
      render: (row) => {
        const Icon = row.documentType === 'QUOTATION_EXCEL' ? FileSpreadsheet : FileText;
        const active = row.id === selectedId;
        return (
          <div className="flex min-w-0 items-center gap-3">
            <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-md', active ? 'bg-brand-600 text-white' : 'bg-brand-50 text-brand-600')}>
              <Icon className="h-4.5 w-4.5" strokeWidth={1.8} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className={cn('block max-w-60 truncate font-semibold', active ? 'text-brand-700' : 'text-slate-900')} title={row.documentName}>
                {row.documentName}
              </span>
              <span className="block text-xs text-slate-500">{formatFileSize(row.fileSize)}</span>
            </span>
          </div>
        );
      },
    },
    { key: 'documentStatus', header: 'Status', sortKey: 'documentStatus', render: (row) => <StatusBadge status={row.documentStatus} /> },
    {
      key: 'createdAt',
      header: 'Uploaded',
      sortKey: 'createdAt',
      className: 'whitespace-nowrap',
      render: (row) => (
        <span className="block leading-tight" title={formatDateTime(row.createdAt)}>
          <span className="block text-slate-800">{formatDateTime(row.createdAt).split(', ')[0]}</span>
          <span className="block text-xs text-slate-500">{formatRelative(row.createdAt)}</span>
        </span>
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      render: (row) =>
        aiEnabled &&
        canStart && (
          <Button
            variant="secondary"
            size="sm"
            icon={Play}
            onClick={(event) => {
              event.stopPropagation();
              setParam('documentId', row.id);
              start.mutate({ document: row, force: false });
            }}
            disabled={start.isPending || !EXTRACTABLE_STATUSES.includes(row.documentStatus)}
          >
            Extract
          </Button>
        ),
    },
  ];

  const typeLabel = TYPES.find((option) => option.value === type)?.label || 'quotation';

  return (
    <>
      {/* Header */}
      <div className="mb-5 flex min-w-0 items-center gap-4">
        <span className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 sm:flex">
          <ScanText className="h-7 w-7" strokeWidth={1.8} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">AI Extraction</h1>
          <p className="mt-1 text-sm text-slate-500">Extract quotation data from uploaded documents using AI-powered document processing.</p>
        </div>
      </div>

      {/* Configuration status */}
      {!aiEnabled && (
        <div className="mb-5 flex flex-col gap-3 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 sm:flex-row sm:items-center" role="status">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface text-blue-700">
            <Info className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1 text-13 text-blue-700">
            <p className="font-semibold">AI extraction is currently disabled (LLM_ENABLED=false).</p>
            <p>{FEATURE_MESSAGES.aiExtraction.replace('AI extraction is currently disabled (LLM_ENABLED=false). ', '')}</p>
          </div>
          <Button variant="secondary" icon={Settings} onClick={() => setGuideOpen(true)} className="shrink-0">
            Configuration Guide
          </Button>
        </div>
      )}

      {/* KPIs (from the document status the Document Service keeps during extraction) */}
      <section aria-label="Extraction figures" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KpiCard icon={FileText} tone="brand" label="Total Documents" query={figure(all.length)} emptyText="—" caption="PDF and Excel files" />
        <KpiCard icon={Zap} tone="success" label="Extracted" query={figure(count(['PROCESSED']))} emptyText="—" />
        <KpiCard icon={Clock} tone="warning" label="Pending" query={figure(count(PENDING_STATUSES))} emptyText="—" />
        <KpiCard icon={CircleX} tone="danger" label="Failed" query={figure(count(['FAILED']))} emptyText="—" />
      </section>

      <section className="card mt-5" aria-label="Documents and extraction history">
        <div className="overflow-x-auto px-4 pt-2 sm:px-5">
          <Tabs
            variant="pill"
            label="Document type"
            value={type}
            onChange={(value) => {
              setParam('type', value === 'QUOTATION_PDF' ? '' : value);
              pager.reset();
            }}
            tabs={TYPES.map((option) => ({ value: option.value, label: option.label, icon: option.icon, count: documents.data ? all.filter((row) => row.documentType === option.value).length : undefined }))}
          />
        </div>

        <div className="grid grid-cols-1 gap-5 p-4 sm:p-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          {/* Documents */}
          <div className="min-w-0 rounded-md border border-line">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-50 text-brand-600">
                  <FileText className="h-4.5 w-4.5" strokeWidth={1.8} aria-hidden="true" />
                </span>
                <h2 className="text-[15px] font-semibold text-slate-900">Quotation Documents</h2>
              </div>
              {canUpload && (
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="secondary"
                    icon={Upload}
                    to={storageEnabled ? `/documents/upload?documentType=${type}` : undefined}
                    disabled={!storageEnabled}
                    title={storageEnabled ? undefined : 'Document storage is disabled. Uploads are currently unavailable.'}
                  >
                    Upload Document
                  </Button>
                  {!storageEnabled && (
                    <span className="group relative">
                      <button type="button" className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:text-slate-900" aria-label="Why is upload unavailable?" aria-describedby="extraction-upload-help">
                        <Info className="h-4.5 w-4.5" aria-hidden="true" />
                      </button>
                      <span
                        id="extraction-upload-help"
                        role="tooltip"
                        className="pointer-events-none absolute bottom-full right-0 z-30 mb-2 w-56 rounded-md border border-line bg-surface px-3 py-2 text-xs text-slate-700 opacity-0 shadow-lg transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
                      >
                        Document storage is disabled (S3_ENABLED=false). Uploads are currently unavailable.
                      </span>
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="hidden md:block">
            <DataTable
              caption={`${typeLabel} documents`}
              columns={columns}
              rows={pageRows}
              loading={documents.isLoading}
              error={documents.error}
              onRetry={documents.refetch}
              onRowClick={(row) => setParam('documentId', row.id)}
              sort={{ sortBy: pager.sortBy, direction: pager.direction, onSort: pager.toggleSort }}
              empty={{
                icon: Upload,
                title: 'No quotation documents yet',
                detail: `Upload ${typeLabel} files to extract key information (supplier, items, prices, etc.)${aiEnabled ? '.' : ' once AI extraction is enabled.'}`,
              }}
            />
            </div>
            {/* Phones: simple list instead of the table */}
            <div className="md:hidden">
              {documents.isLoading ? (
                <div className="space-y-2 p-4" aria-hidden="true">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : documents.error ? (
                <ErrorState error={documents.error} onRetry={documents.refetch} />
              ) : pageRows.length === 0 ? (
                <EmptyState showIcon icon={Upload} title="No quotation documents yet" detail={`Upload ${typeLabel} files to extract key information${aiEnabled ? '.' : ' once AI extraction is enabled.'}`} />
              ) : (
                <ul className="divide-y divide-slate-100 border-t border-line">
                  {pageRows.map((row) => (
                    <li key={row.id}>
                      <button type="button" onClick={() => setParam('documentId', row.id)} className={cn('flex w-full items-center gap-3 px-4 py-3 text-left', row.id === selectedId && 'bg-brand-50/50')}>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold text-slate-900">{row.documentName}</span>
                          <span className="block text-xs text-slate-500">{formatFileSize(row.fileSize)} · {formatRelative(row.createdAt)}</span>
                        </span>
                        <StatusBadge status={row.documentStatus} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <Pagination
              page={pager.page}
              size={pager.size}
              totalElements={rows.length}
              totalPages={Math.ceil(rows.length / pager.size)}
              onPageChange={pager.setPage}
              onSizeChange={pager.setSize}
              noun={['document', 'documents']}
            />
          </div>

          {/* Extraction history */}
          <div className="min-w-0 rounded-md border border-line">
            <div className="flex items-center gap-3 px-5 py-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-50 text-brand-600">
                <History className="h-4.5 w-4.5" strokeWidth={1.8} aria-hidden="true" />
              </span>
              <h2 className="text-[15px] font-semibold text-slate-900">Extraction History</h2>
            </div>
            {selected ? (
              <HistoryPanel
                key={selected.id}
                document={selected}
                aiEnabled={aiEnabled}
                canStart={canStart}
                starting={start.isPending}
                onStart={(document, force) => start.mutate({ document, force })}
              />
            ) : (
              <EmptyState showIcon icon={Clock} title="No document selected" detail="Select a document from the list to view its extraction history and results." className="pb-12" />
            )}
          </div>
        </div>
      </section>

      <ConfigurationGuide open={guideOpen} onClose={() => setGuideOpen(false)} />
    </>
  );
}
