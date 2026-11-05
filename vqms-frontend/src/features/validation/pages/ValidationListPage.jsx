import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePagination } from '@/hooks/usePagination';
import { useRequestOptions, useVendorOptions } from '@/hooks/useLookups';
import PageHeader from '@/components/common/PageHeader';
import { FilterBar } from '@/components/common/Card';
import Button from '@/components/common/Button';
import DataTable from '@/components/common/DataTable';
import Pagination from '@/components/common/Pagination';
import Select from '@/components/common/Select';
import Modal from '@/components/common/Modal';
import Input from '@/components/common/Input';
import Alert from '@/components/common/Alert';
import StatusBadge from '@/components/common/StatusBadge';
import { isUuid } from '@/components/common/EntitySelect';
import { normalizePage } from '@/utils/pagination';
import { formatDateTime } from '@/utils/formatDate';
import { formatCurrency } from '@/utils/formatCurrency';
import { toOptions, VALIDATION_STATUSES } from '@/utils/constants';
import { validationKeys, validationService } from '../validationService';

function RunValidationDialog({ open, onClose }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ quotationId: '', extractionId: '', documentId: '' });
  const [error, setError] = useState(null);
  const run = useMutation({
    mutationFn: () => validationService.run(form),
    meta: { silent: true, successMessage: 'Validation completed' },
    onSuccess: (validation) => {
      queryClient.invalidateQueries({ queryKey: validationKeys.all });
      navigate(`/validation/${validation.id}`);
    },
    onError: (err) => setError(err.message),
  });
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value.trim() }));
  const invalid = !isUuid(form.quotationId) || (form.extractionId && !isUuid(form.extractionId)) || (form.documentId && !isUuid(form.documentId));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Run validation"
      description="Validates a quotation's amounts, dates and vendor against the backend rules."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={run.isPending}>
            Cancel
          </Button>
          <Button onClick={() => run.mutate()} disabled={invalid} loading={run.isPending}>
            Run validation
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <Input label="Quotation ID" required value={form.quotationId} onChange={set('quotationId')} />
        <Input label="Extraction ID" hint="Optional: compare against an AI extraction." value={form.extractionId} onChange={set('extractionId')} />
        <Input label="Document ID" value={form.documentId} onChange={set('documentId')} />
      </div>
    </Modal>
  );
}

export default function ValidationListPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const [filters, setFilters] = useState({ status: '', procurementRequestId: '', vendorId: '' });
  const [running, setRunning] = useState(false);
  const pager = usePagination({ size: 20, sortBy: 'createdAt', direction: 'desc' });
  const vendors = useVendorOptions();
  const requests = useRequestOptions();

  const params = { ...filters, page: pager.page, size: pager.size, sortBy: pager.sortBy, direction: pager.direction };
  const query = useQuery({ queryKey: validationKeys.list(params), queryFn: ({ signal }) => validationService.search(params, signal), placeholderData: keepPreviousData });
  const page = normalizePage(query.data);
  const setFilter = (key) => (event) => {
    setFilters((current) => ({ ...current, [key]: event.target.value }));
    pager.reset();
  };

  return (
    <>
      <PageHeader
        title="Validation"
        description="Automated checks of quotation amounts, dates, vendor and procurement data."
        actions={can('validation.run') && <Button icon={ShieldCheck} onClick={() => setRunning(true)}>Run validation</Button>}
      />
      <div className="card overflow-hidden">
        <FilterBar>
          <Select aria-label="Status" value={filters.status} onChange={setFilter('status')} placeholder="All statuses" options={toOptions(VALIDATION_STATUSES)} className="md:w-48" />
          <Select aria-label="Vendor" value={filters.vendorId} onChange={setFilter('vendorId')} placeholder="All vendors" options={vendors.data || []} className="md:w-56" />
          <Select aria-label="Procurement request" value={filters.procurementRequestId} onChange={setFilter('procurementRequestId')} placeholder="All requests" options={requests.data || []} className="md:w-72" />
        </FilterBar>
        <DataTable
          caption="Validations"
          columns={[
            { key: 'quotationNumber', header: 'Quotation', render: (row) => <span className="font-medium text-slate-900">{row.quotationNumber || row.quotationId?.slice(0, 8)}</span> },
            { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
            { key: 'errorCount', header: 'Errors', align: 'right', render: (row) => <span className={row.errorCount ? 'font-medium text-red-700' : ''}>{row.errorCount}</span> },
            { key: 'warningCount', header: 'Warnings', align: 'right', render: (row) => <span className={row.warningCount ? 'font-medium text-amber-700' : ''}>{row.warningCount}</span> },
            { key: 'quotedTotal', header: 'Quoted total', align: 'right', render: (row) => formatCurrency(row.quotedTotal, row.currencyCode) },
            { key: 'trigger', header: 'Trigger', render: (row) => <StatusBadge status={row.trigger} tone="gray" /> },
            { key: 'createdAt', header: 'Created', sortKey: 'createdAt', render: (row) => formatDateTime(row.createdAt) },
          ]}
          rows={page.items}
          loading={query.isLoading}
          error={query.error}
          onRetry={query.refetch}
          onRowClick={(row) => navigate(`/validation/${row.id}`)}
          sort={{ sortBy: pager.sortBy, direction: pager.direction, onSort: pager.toggleSort }}
          empty={{ title: 'No validations', description: 'Validations run automatically after extraction or manually from here.' }}
        />
        <Pagination {...page} onPageChange={pager.setPage} onSizeChange={pager.setSize} disabled={query.isFetching} />
      </div>
      <RunValidationDialog open={running} onClose={() => setRunning(false)} />
    </>
  );
}
