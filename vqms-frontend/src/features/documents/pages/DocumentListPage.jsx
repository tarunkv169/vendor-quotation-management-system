import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { Download, FileText, Upload } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePagination } from '@/hooks/usePagination';
import PageHeader from '@/components/common/PageHeader';
import ListToolbar, { SortSelect } from '@/components/common/ListToolbar';
import Button from '@/components/common/Button';
import DataTable from '@/components/common/DataTable';
import Pagination from '@/components/common/Pagination';
import Select from '@/components/common/Select';
import StatusBadge from '@/components/common/StatusBadge';
import { FEATURES, FEATURE_MESSAGES } from '@/utils/features';
import Alert from '@/components/common/Alert';
import { normalizePage } from '@/utils/pagination';
import { formatDateTime, formatRelative } from '@/utils/formatDate';
import { formatFileSize } from '@/utils/formatCurrency';
import { DOCUMENT_STATUSES, DOCUMENT_TYPES, humanize, toOptions } from '@/utils/constants';
import { documentKeys, documentService, openDocumentDownload } from '../documentService';

const SORTS = [
  { value: 'createdAt:desc', label: 'Newest first' },
  { value: 'createdAt:asc', label: 'Oldest first' },
  { value: 'documentName:asc', label: 'Name (A–Z)' },
];

export default function DocumentListPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const [filters, setFilters] = useState({ documentType: '', status: '' });
  const pager = usePagination({ size: 20, sortBy: 'createdAt', direction: 'desc' });

  const params = { ...filters, page: pager.page, size: pager.size, sortBy: pager.sortBy, direction: pager.direction };
  const query = useQuery({
    queryKey: documentKeys.list(params),
    queryFn: ({ signal }) => documentService.search(params, signal),
    placeholderData: keepPreviousData,
  });
  const page = normalizePage(query.data);
  const download = useMutation({ mutationFn: (id) => openDocumentDownload(id) });

  const setFilter = (key) => (event) => {
    setFilters((current) => ({ ...current, [key]: event.target.value }));
    pager.reset();
  };

  return (
    <>
      <PageHeader
        title="Documents"
        description="Quotation files, vendor certificates and supporting documents, stored by the Document Service."
        actions={FEATURES.documentStorage && can('document.upload') && <Button to="/documents/upload" icon={Upload}>Upload document</Button>}
      />
      {!FEATURES.documentStorage && <Alert tone="info" className="mb-5">{FEATURE_MESSAGES.documentStorage}</Alert>}
      <ListToolbar className="mt-0">
        <Select aria-label="Document type" value={filters.documentType} onChange={setFilter('documentType')} placeholder="All document types" options={toOptions(DOCUMENT_TYPES)} className="md:w-60" />
        <Select aria-label="Status" value={filters.status} onChange={setFilter('status')} placeholder="All statuses" options={toOptions(DOCUMENT_STATUSES)} className="md:w-52" />
        <SortSelect pager={pager} options={SORTS} />
      </ListToolbar>
      <div className="card mt-4 overflow-hidden">
        <DataTable
          caption="Documents"
          columns={[
            {
              key: 'documentName',
              header: 'Document',
              sortKey: 'documentName',
              className: 'min-w-64',
              render: (row) => (
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-canvas text-slate-500" aria-hidden="true">
                    <FileText className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{row.documentName}</p>
                    <p className="truncate text-xs text-slate-500">{humanize(row.documentType)}</p>
                  </div>
                </div>
              ),
            },
            { key: 'fileSize', header: 'Size', align: 'right', className: 'whitespace-nowrap', render: (row) => formatFileSize(row.fileSize) },
            { key: 'documentStatus', header: 'Status', render: (row) => <StatusBadge status={row.documentStatus} /> },
            { key: 'createdAt', header: 'Uploaded', sortKey: 'createdAt', className: 'whitespace-nowrap text-slate-500', render: (row) => <span title={formatDateTime(row.createdAt)}>{formatRelative(row.createdAt)}</span> },
            {
              key: 'actions',
              header: <span className="sr-only">Actions</span>,
              align: 'right',
              render: (row) =>
                FEATURES.documentStorage && ['ACTIVE', 'PROCESSING', 'PROCESSED'].includes(row.documentStatus) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Download}
                    aria-label={`Download ${row.documentName}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      download.mutate(row.id);
                    }}
                  >
                    Download
                  </Button>
                ),
            },
          ]}
          rows={page.items}
          loading={query.isLoading}
          error={query.error}
          onRetry={query.refetch}
          onRowClick={(row) => navigate(`/documents/${row.id}`)}
          sort={{ sortBy: pager.sortBy, direction: pager.direction, onSort: pager.toggleSort }}
          empty={{
            title: filters.documentType || filters.status ? 'No matching documents' : 'No documents yet',
            description: filters.documentType || filters.status ? 'Try a different type or status.' : 'Quotation files, certificates and supporting documents appear here once uploaded.',
          }}
        />
        <Pagination {...page} onPageChange={pager.setPage} onSizeChange={pager.setSize} disabled={query.isFetching} />
      </div>
    </>
  );
}
