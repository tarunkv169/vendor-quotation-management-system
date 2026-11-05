import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowUpDown,
  Award,
  ClipboardList,
  Copy,
  Database,
  Download,
  Eye,
  File,
  FileImage,
  FileSpreadsheet,
  FileText,
  Folder,
  Info,
  Layers,
  ScanText,
  Trash,
  Upload,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useDebounce } from '@/hooks/useDebounce';
import { usePagination } from '@/hooks/usePagination';
import { useDocumentStorage } from '@/hooks/useDocumentStorage';
import Button from '@/components/common/Button';
import DataTable from '@/components/common/DataTable';
import Pagination from '@/components/common/Pagination';
import SearchInput from '@/components/common/SearchInput';
import Select from '@/components/common/Select';
import StatusBadge from '@/components/common/StatusBadge';
import Tabs from '@/components/common/Tabs';
import KpiCard from '@/components/common/KpiCard';
import ActionMenu from '@/components/common/ActionMenu';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import Skeleton from '@/components/common/Skeleton';
import EmptyState, { ErrorState } from '@/components/common/EmptyState';
import { FEATURE_MESSAGES } from '@/utils/features';
import { normalizePage } from '@/utils/pagination';
import { formatDate, formatDateTime, formatRelative } from '@/utils/formatDate';
import { formatFileSize, formatNumber } from '@/utils/formatCurrency';
import { DOCUMENT_STATUSES, DOCUMENT_TYPES, humanize } from '@/utils/constants';
import { downloadCsv } from '@/utils/exportCsv';
import { extractionService } from '@/features/extraction/extractionService';
import { quotationKeys, quotationService } from '@/features/quotations/quotationService';
import { documentKeys, documentService, openDocumentDownload } from '../documentService';
import { documentPermissions } from '../documentActions';

// GET /documents is paged (max 100 per page) without keyword search, so the page loads every document the
// user may see once and searches, filters, counts and pages them in the browser.
const PAGE_SIZE = 100;
const MAX_PAGES = 20;

async function loadAllDocuments(signal) {
  let rows = [];
  for (let index = 0; index < MAX_PAGES; index += 1) {
    const result = normalizePage(await documentService.search({ page: index, size: PAGE_SIZE, sortBy: 'createdAt', direction: 'desc' }, signal));
    rows = rows.concat(result.items);
    if (index + 1 >= result.totalPages) break;
  }
  return rows;
}

// Category tabs (document types grouped as on the design).
const CATEGORIES = [
  { value: '', label: 'All Documents', icon: File, types: null },
  { value: 'quotation', label: 'Quotation Files', icon: Layers, types: ['QUOTATION_PDF', 'QUOTATION_EXCEL'] },
  { value: 'certificate', label: 'Certificates', icon: Award, types: ['VENDOR_CERTIFICATE'] },
  { value: 'supporting', label: 'Supporting Files', icon: Folder, types: ['SUPPORTING_DOCUMENT', 'PROCUREMENT_ATTACHMENT'] },
];

const SORTS = [
  { value: 'createdAt:desc', label: 'Newest first' },
  { value: 'createdAt:asc', label: 'Oldest first' },
  { value: 'documentName:asc', label: 'Name (A–Z)' },
  { value: 'fileSize:desc', label: 'Largest first' },
];

const ICON_BUTTON =
  'flex h-9 w-9 items-center justify-center rounded-md border border-line bg-surface text-slate-600 transition-colors hover:border-line-strong hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40';

const EXPORT_COLUMNS = [
  { header: 'Document', value: (row) => row.documentName },
  { header: 'Type', value: (row) => humanize(row.documentType) },
  { header: 'Status', value: (row) => humanize(row.documentStatus) },
  { header: 'Content type', value: (row) => row.contentType },
  { header: 'Size (bytes)', value: (row) => row.fileSize },
  { header: 'Quotation', value: (row) => row.quotationId },
  { header: 'Procurement request', value: (row) => row.procurementRequestId },
  { header: 'Description', value: (row) => row.description },
  { header: 'Uploaded', value: (row) => row.createdAt },
  { header: 'SHA-256', value: (row) => row.checksum },
];

function fileIcon(row) {
  const type = String(row.contentType || '');
  if (type.includes('sheet') || type.includes('excel') || row.documentType === 'QUOTATION_EXCEL') return FileSpreadsheet;
  if (type.startsWith('image/')) return FileImage;
  return FileText;
}

/** Short file kind for the second line when there is no description. */
function fileKind(row) {
  const type = String(row.contentType || '').toLowerCase();
  if (type.includes('pdf')) return 'PDF document';
  if (type.includes('sheet') || type.includes('excel')) return 'Excel workbook';
  if (type.startsWith('image/')) return `${type.slice(6).toUpperCase()} image`;
  return row.contentType || '—';
}

function DocumentCell({ row }) {
  const Icon = fileIcon(row);
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600">
        <Icon className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <Link to={`/documents/${row.id}`} onClick={(event) => event.stopPropagation()} className="block max-w-60 truncate font-semibold text-slate-900 hover:text-brand-700" title={row.documentName}>
          {row.documentName}
        </Link>
        <p className="mt-0.5 max-w-60 truncate text-xs text-slate-500" title={row.description || row.contentType}>
          {row.description || fileKind(row)}
        </p>
      </div>
    </div>
  );
}

/** Short reference of a quotation (the backend has no quotation number). */
const quotationReference = (id) => `Q-${String(id).slice(0, 8).toUpperCase()}`;

function QuotationCell({ row, quotationsById, canOpen }) {
  if (!row.quotationId) return <span className="text-slate-400">—</span>;
  const quotation = quotationsById.get(row.quotationId);
  const label = (
    <span className="min-w-0">
      <span className="block font-mono text-xs font-semibold text-slate-900">{quotationReference(row.quotationId)}</span>
      {quotation?.vendorName && <span className="block max-w-44 truncate text-xs text-slate-500">{quotation.vendorName}{quotation.version ? ` · v${quotation.version}` : ''}</span>}
    </span>
  );
  return canOpen ? (
    <Link to={`/quotations/${row.quotationId}`} onClick={(event) => event.stopPropagation()} className="block hover:text-brand-700">
      {label}
    </Link>
  ) : (
    label
  );
}

export default function DocumentListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can, canAccess } = useAuth();
  const storageEnabled = useDocumentStorage();
  const [searchParams, setSearchParams] = useSearchParams();
  const type = searchParams.get('type') || '';
  const status = searchParams.get('status') || '';
  const category = searchParams.get('category') || '';
  const [keyword, setKeyword] = useState('');
  const debounced = useDebounce(keyword.trim().toLowerCase(), 250);
  const pager = usePagination({ size: 10, sortBy: 'createdAt', direction: 'desc' });
  const [toDelete, setToDelete] = useState(null);

  const query = useQuery({ queryKey: documentKeys.list({ scope: 'all' }), queryFn: ({ signal }) => loadAllDocuments(signal) });
  const all = useMemo(() => query.data || [], [query.data]);
  // Quotation details for the "Related quotation" column (vendor name, version).
  const quotations = useQuery({ queryKey: quotationKeys.list, queryFn: ({ signal }) => quotationService.list(signal), enabled: canAccess('quotations'), meta: { silent: true } });
  const quotationsById = useMemo(() => new Map((quotations.data || []).map((row) => [row.id, row])), [quotations.data]);

  // Built from the current URL, so two changes in a row never overwrite each other.
  const setParam = (key, value) => {
    const next = new URLSearchParams(window.location.search);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
    pager.reset();
  };

  const activeCategory = CATEGORIES.find((option) => option.value === category) || CATEGORIES[0];
  const filtered = useMemo(() => {
    const rows = all.filter(
      (row) =>
        (!type || row.documentType === type) &&
        (!activeCategory.types || activeCategory.types.includes(row.documentType)) &&
        (!status ? row.documentStatus !== 'DELETED' : row.documentStatus === status) &&
        (!debounced || [row.documentName, row.description].some((value) => value?.toLowerCase().includes(debounced))),
    );
    const factor = pager.direction === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const left = a[pager.sortBy] ?? '';
      const right = b[pager.sortBy] ?? '';
      if (typeof left === 'number' || typeof right === 'number') return (Number(left) - Number(right)) * factor;
      return String(left).localeCompare(String(right)) * factor;
    });
  }, [all, type, status, activeCategory, debounced, pager.sortBy, pager.direction]);
  const pageRows = filtered.slice(pager.page * pager.size, (pager.page + 1) * pager.size);

  // KPIs (deleted documents are not counted)
  const live = all.filter((row) => row.documentStatus !== 'DELETED');
  const countTypes = (types) => live.filter((row) => !types || types.includes(row.documentType)).length;
  const storageBytes = live.reduce((sum, row) => sum + (Number(row.fileSize) || 0), 0);
  const figure = (value) => ({ isLoading: query.isLoading, error: query.error, data: query.error ? null : value });

  const refresh = () => queryClient.invalidateQueries({ queryKey: documentKeys.all });
  const download = useMutation({ mutationFn: (row) => openDocumentDownload(row.id) });
  const remove = useMutation({
    mutationFn: (row) => documentService.remove(row.id),
    meta: { successMessage: 'Document deleted' },
    onSuccess: () => {
      setToDelete(null);
      refresh();
    },
  });
  const extract = useMutation({
    mutationFn: (row) => extractionService.start(row.id),
    meta: { successMessage: 'Extraction started' },
    onSuccess: (accepted) => navigate(`/extraction/${accepted.extractionId}`),
  });

  const copyId = async (row) => {
    try {
      await navigator.clipboard.writeText(row.id);
      toast.success('Document ID copied');
    } catch {
      toast.error('Could not copy to the clipboard');
    }
  };
  const exportCsv = () => {
    if (!filtered.length) {
      toast.info('Nothing to export');
      return;
    }
    downloadCsv(`documents-${new Date().toISOString().slice(0, 10)}.csv`, EXPORT_COLUMNS, filtered);
    toast.success(`Exported ${formatNumber(filtered.length)} ${filtered.length === 1 ? 'document' : 'documents'}`);
  };

  const menuItems = (row) => {
    const permissions = documentPermissions(row, can);
    return [
      { key: 'open', label: 'View document', icon: Eye, onClick: () => navigate(`/documents/${row.id}`) },
      ...(permissions.canDownload ? [{ key: 'download', label: 'Download', icon: Download, onClick: () => download.mutate(row) }] : []),
      ...(permissions.canExtract ? [{ key: 'extract', label: 'Start AI extraction', icon: ScanText, disabled: extract.isPending, onClick: () => extract.mutate(row) }] : []),
      ...(row.quotationId && canAccess('quotations') ? [{ key: 'quotation', label: 'Open quotation', icon: FileText, divider: true, onClick: () => navigate(`/quotations/${row.quotationId}`) }] : []),
      ...(row.procurementRequestId && canAccess('procurement')
        ? [{ key: 'request', label: 'Open procurement request', icon: ClipboardList, divider: !(row.quotationId && canAccess('quotations')), onClick: () => navigate(`/procurement/${row.procurementRequestId}`) }]
        : []),
      { key: 'copy', label: 'Copy document ID', icon: Copy, divider: true, onClick: () => copyId(row) },
      ...(permissions.canDelete ? [{ key: 'delete', label: 'Delete', icon: Trash, tone: 'danger', divider: true, onClick: () => setToDelete(row) }] : []),
    ];
  };

  const renderActions = (row) => {
    const { canDownload } = documentPermissions(row, can);
    return (
      <div className="flex items-center justify-end gap-2" onClick={(event) => event.stopPropagation()}>
        <Link to={`/documents/${row.id}`} className={ICON_BUTTON} aria-label={`View ${row.documentName}`} title="View">
          <Eye className="h-4 w-4" aria-hidden="true" />
        </Link>
        <button
          type="button"
          className={ICON_BUTTON}
          onClick={() => download.mutate(row)}
          disabled={!canDownload || download.isPending}
          aria-label={`Download ${row.documentName}`}
          title={canDownload ? 'Download' : storageEnabled ? `Not available while ${humanize(row.documentStatus).toLowerCase()}` : 'Document storage is disabled'}
        >
          <Download className="h-4 w-4" aria-hidden="true" />
        </button>
        <ActionMenu items={menuItems(row)} label={`More actions for ${row.documentName}`} />
      </div>
    );
  };

  const columns = [
    { key: 'documentName', header: 'Document', sortKey: 'documentName', className: 'min-w-64', render: (row) => <DocumentCell row={row} /> },
    {
      key: 'quotationId',
      header: 'Related Quotation',
      render: (row) => <QuotationCell row={row} quotationsById={quotationsById} canOpen={canAccess('quotations')} />,
    },
    { key: 'documentType', header: 'Type', sortKey: 'documentType', className: 'whitespace-nowrap', render: (row) => humanize(row.documentType) },
    { key: 'fileSize', header: 'Size', sortKey: 'fileSize', align: 'right', className: 'whitespace-nowrap', render: (row) => formatFileSize(row.fileSize) },
    { key: 'documentStatus', header: 'Status', sortKey: 'documentStatus', render: (row) => <StatusBadge status={row.documentStatus} /> },
    {
      key: 'createdAt',
      header: 'Uploaded',
      sortKey: 'createdAt',
      className: 'whitespace-nowrap',
      render: (row) => (
        <span className="block leading-tight" title={formatDateTime(row.createdAt)}>
          <span className="block text-slate-800">{formatDate(row.createdAt)}</span>
          <span className="block text-xs text-slate-500">{formatRelative(row.createdAt)}</span>
        </span>
      ),
    },
    { key: 'actions', header: 'Actions', headerClassName: 'text-right', render: (row) => renderActions(row) },
  ];

  const sortValue = `${pager.sortBy}:${pager.direction}`;
  const filteredView = Boolean(keyword || type || status);
  const knownSort = SORTS.some((option) => option.value === sortValue);
  const clearFilters = () => {
    setKeyword('');
    const next = new URLSearchParams();
    if (category) next.set('category', category);
    setSearchParams(next, { replace: true });
    pager.reset();
  };
  const canUpload = can('document.upload');
  const empty = {
    icon: FileText,
    title: filteredView || category ? 'No documents match these filters' : 'No documents available yet',
    detail: filteredView || category ? undefined : 'Documents will appear here when they are linked to quotations or uploaded once document storage is enabled.',
    action: filteredView ? (
      <Button variant="secondary" size="sm" onClick={clearFilters}>
        Clear filters
      </Button>
    ) : (
      canUpload &&
      storageEnabled && (
        <Button to="/documents/upload" size="sm" icon={Upload}>
          Upload document
        </Button>
      )
    ),
  };

  return (
    <>
      {/* Header */}
      <div className="mb-5 flex min-w-0 items-center gap-4">
        <span className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 sm:flex">
          <File className="h-7 w-7" strokeWidth={1.8} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Documents</h1>
          <p className="mt-1 text-sm text-slate-500">Manage quotation files, certificates and supporting documents.</p>
        </div>
      </div>

      {!storageEnabled && (
        <div className="mb-5 flex items-start gap-3 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-13 text-blue-700" role="status">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>{FEATURE_MESSAGES.documentStorage}</p>
        </div>
      )}

      {/* KPIs + upload */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
        <section aria-label="Document figures" className="grid flex-1 grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4" title="Storage used is the sum of the stored file sizes">
          <KpiCard compact icon={File} tone="brand" label="Total Documents" query={figure(live.length)} emptyText="—" onClick={() => setParam('category', '')} active={!category} />
          <KpiCard compact icon={Layers} tone="info" label="Quotation Files" query={figure(countTypes(CATEGORIES[1].types))} emptyText="—" onClick={() => setParam('category', category === 'quotation' ? '' : 'quotation')} active={category === 'quotation'} />
          <KpiCard compact icon={Award} tone="brand" label="Certificates" query={figure(countTypes(CATEGORIES[2].types))} emptyText="—" onClick={() => setParam('category', category === 'certificate' ? '' : 'certificate')} active={category === 'certificate'} />
          <KpiCard
            compact
            icon={Database}
            tone="info"
            label="Storage Used"
            query={figure(live.length ? storageBytes : null)}
            emptyText="—"
            formatValue={(value) => formatFileSize(value)}
          />
        </section>
        {canUpload && (
          <div className="flex items-center gap-2 xl:border-l xl:border-line xl:pl-4">
            <Button to={storageEnabled ? '/documents/upload' : undefined} icon={Upload} size="lg" disabled={!storageEnabled} className="flex-1 xl:flex-none">
              Upload document
            </Button>
            {!storageEnabled && (
              <span className="group relative">
                <button type="button" className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:text-slate-900" aria-label="Why is upload unavailable?" aria-describedby="upload-help">
                  <Info className="h-5 w-5" aria-hidden="true" />
                </button>
                <span
                  id="upload-help"
                  role="tooltip"
                  className="pointer-events-none absolute bottom-full right-0 z-30 mb-2 w-56 rounded-md border border-line bg-surface px-3 py-2 text-xs text-slate-700 opacity-0 shadow-lg transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
                >
                  Document storage is disabled. Uploads are currently unavailable.
                </span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Category tabs, filters and table */}
      <section aria-label="Documents" className="card mt-5">
        <div className="overflow-x-auto px-4 pt-2 sm:px-5">
          <Tabs
            variant="pill"
            label="Document categories"
            value={category}
            onChange={(value) => setParam('category', value)}
            tabs={CATEGORIES.map((option) => ({ value: option.value, label: option.label, icon: option.icon, count: query.data ? countTypes(option.types) : undefined }))}
          />
        </div>
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:px-5 lg:flex-row lg:items-center">
          <SearchInput
            value={keyword}
            onChange={(value) => {
              setKeyword(value);
              pager.reset();
            }}
            placeholder="Search by document name…"
            className="lg:w-80"
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex">
            <Select
              aria-label="Document type"
              value={type}
              onChange={(event) => setParam('type', event.target.value)}
              options={[{ value: '', label: 'All document types' }, ...(activeCategory.types || DOCUMENT_TYPES).map((value) => ({ value, label: humanize(value) }))]}
              className="lg:w-52"
            />
            <Select
              aria-label="Status"
              value={status}
              onChange={(event) => setParam('status', event.target.value)}
              options={[{ value: '', label: 'All statuses' }, ...DOCUMENT_STATUSES.map((value) => ({ value, label: humanize(value) }))]}
              className="lg:w-44"
            />
          </div>
          <div className="flex items-center gap-2 lg:ml-auto">
            {filteredView && (
              <Button variant="ghost" onClick={clearFilters}>
                Clear
              </Button>
            )}
            <div className="relative w-full sm:w-48">
              <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <Select
                aria-label="Sort by"
                value={knownSort ? sortValue : ''}
                placeholder={knownSort ? undefined : 'Custom sort'}
                onChange={(event) => {
                  const [sortBy, direction] = event.target.value.split(':');
                  if (sortBy) pager.setSort(sortBy, direction);
                }}
                options={SORTS}
                selectClassName="pl-9"
              />
            </div>
            <Button variant="secondary" icon={Download} onClick={exportCsv} disabled={query.isLoading || Boolean(query.error) || !filtered.length}>
              Export
            </Button>
          </div>
        </div>

        {/* Desktop / tablet: table */}
        <div className="hidden md:block">
          <DataTable
            roomy
            caption="Documents"
            columns={columns}
            rows={pageRows}
            loading={query.isLoading}
            error={query.error}
            onRetry={query.refetch}
            onRowClick={(row) => navigate(`/documents/${row.id}`)}
            sort={{ sortBy: pager.sortBy, direction: pager.direction, onSort: pager.toggleSort }}
            empty={empty}
          />
        </div>

        {/* Mobile: cards */}
        <div className="md:hidden">
          {query.isLoading ? (
            <div className="divide-y divide-slate-100" aria-hidden="true">
              {[0, 1, 2].map((key) => (
                <div key={key} className="flex gap-3 p-4">
                  <Skeleton className="h-10 w-10 rounded-md" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : query.error ? (
            <ErrorState error={query.error} onRetry={query.refetch} />
          ) : pageRows.length === 0 ? (
            <EmptyState showIcon icon={FileText} title={empty.title} detail={empty.detail} action={empty.action} />
          ) : (
            <ul className="divide-y divide-slate-100">
              {pageRows.map((row) => (
                <li key={row.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <DocumentCell row={row} />
                    <StatusBadge status={row.documentStatus} />
                  </div>
                  <dl className="mt-3 grid grid-cols-3 gap-x-4 gap-y-2 text-13">
                    <div>
                      <dt className="text-xs text-slate-500">Type</dt>
                      <dd className="text-slate-800">{humanize(row.documentType)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Size</dt>
                      <dd className="text-slate-800">{formatFileSize(row.fileSize)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Uploaded</dt>
                      <dd className="text-slate-800">{formatDate(row.createdAt)}</dd>
                    </div>
                  </dl>
                  <div className="mt-3">{renderActions(row)}</div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Pagination
          page={pager.page}
          size={pager.size}
          totalElements={filtered.length}
          totalPages={Math.ceil(filtered.length / pager.size)}
          onPageChange={pager.setPage}
          onSizeChange={pager.setSize}
          noun={['document', 'documents']}
        />
      </section>

      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={() => remove.mutate(toDelete)}
        loading={remove.isPending}
        title="Delete document"
        message={`Delete ${toDelete?.documentName}?`}
        tone="danger"
        confirmLabel="Delete"
      />
    </>
  );
}
