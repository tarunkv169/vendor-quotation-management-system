import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Play } from 'lucide-react';
import { usePagination } from '@/hooks/usePagination';
import { useRequestOptions } from '@/hooks/useLookups';
import PageHeader from '@/components/common/PageHeader';
import { FilterBar } from '@/components/common/Card';
import Button from '@/components/common/Button';
import SummaryPanel from '@/components/common/SummaryPanel';
import DataTable from '@/components/common/DataTable';
import Pagination from '@/components/common/Pagination';
import Select from '@/components/common/Select';
import Input from '@/components/common/Input';
import Alert from '@/components/common/Alert';
import StatusBadge from '@/components/common/StatusBadge';
import { normalizePage } from '@/utils/pagination';
import { formatDateTime } from '@/utils/formatDate';
import { formatNumber } from '@/utils/formatCurrency';
import { CURRENCIES, humanize, REPORT_TYPES, toOptions } from '@/utils/constants';
import { reportKeys, reportingService } from '../reportingService';

const DESCRIPTIONS = {
  PROCUREMENT_SUMMARY: 'Quotations, validation status and approvals of one procurement request.',
  APPROVAL_SPEND: 'Approved spend per vendor and currency for a period.',
  VALIDATION_QUALITY: 'Validation pass rate, errors and warnings for a period or request.',
};

function GenerateForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const requests = useRequestOptions();
  // Period reports require from/to (at most 366 days, PeriodReportSupport); default: last 30 days.
  const [form, setForm] = useState(() => {
    const to = new Date();
    const from = new Date(to.getTime() - 30 * 86_400_000);
    return { type: 'APPROVAL_SPEND', procurementRequestId: '', from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10), currencyCode: '' };
  });
  const [error, setError] = useState(null);
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const needsRequest = form.type === 'PROCUREMENT_SUMMARY';

  const generate = useMutation({
    mutationFn: () => reportingService.generate(needsRequest ? { type: form.type, procurementRequestId: form.procurementRequestId, currencyCode: form.currencyCode } : form),
    meta: { silent: true, successMessage: 'Report generated' },
    onSuccess: (report) => {
      queryClient.invalidateQueries({ queryKey: reportKeys.all });
      navigate(`/reports/${report.id}`);
    },
    onError: (err) => setError(Object.keys(err.fieldErrors || {}).length ? Object.values(err.fieldErrors).join(' ') : err.message),
  });

  const spanDays = form.from && form.to ? (new Date(form.to) - new Date(form.from)) / 86_400_000 : 0;
  const invalidRange = form.from && form.to && (form.from > form.to ? 'Must be after From' : spanDays > 366 ? 'At most 366 days' : null);
  const ready = form.type && (needsRequest ? form.procurementRequestId : form.from && form.to && !invalidRange);

  return (
    <SummaryPanel title="Generate report" footer={DESCRIPTIONS[form.type]}>
      <form
        className="grid gap-4 md:grid-cols-6"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          generate.mutate();
        }}
      >
        {error && <Alert tone="error" className="md:col-span-6">{error}</Alert>}
        <Select label="Report type" required options={toOptions(REPORT_TYPES)} value={form.type} onChange={set('type')} className="md:col-span-2" />
        {needsRequest ? (
          <Select label="Procurement request" required placeholder="Select…" options={requests.data || []} value={form.procurementRequestId} onChange={set('procurementRequestId')} className="md:col-span-3" />
        ) : (
          <>
            <Input label="From" type="date" required value={form.from} onChange={set('from')} className="md:col-span-1" />
            <Input label="To" type="date" required value={form.to} onChange={set('to')} error={invalidRange || undefined} className="md:col-span-1" />
            <Select label="Currency" placeholder="All" options={CURRENCIES.map((code) => ({ value: code, label: code }))} value={form.currencyCode} onChange={set('currencyCode')} className="md:col-span-1" />
          </>
        )}
        <div className="flex items-end md:col-span-1">
          <Button type="submit" icon={Play} disabled={!ready} loading={generate.isPending} className="w-full justify-center">
            Generate
          </Button>
        </div>
      </form>
    </SummaryPanel>
  );
}

export default function ReportsPage() {
  const navigate = useNavigate();
  const [type, setType] = useState('');
  const pager = usePagination({ size: 20, sortBy: 'generatedAt', direction: 'desc' });
  const params = { type, page: pager.page, size: pager.size, sortBy: pager.sortBy, direction: pager.direction };
  const query = useQuery({ queryKey: reportKeys.list(params), queryFn: ({ signal }) => reportingService.list(params, signal), placeholderData: keepPreviousData });
  const page = normalizePage(query.data);
  const exportCsv = useMutation({ mutationFn: (report) => reportingService.exportCsv(report.id, `${report.reportNumber}.csv`) });

  return (
    <>
      <PageHeader title="Reports" description="Reports are generated on demand from live data. Export is available as CSV." />
      <div className="space-y-6">
        <GenerateForm />
        <SummaryPanel title="Report history" bodyClassName="overflow-hidden p-0">
          <FilterBar>
            <Select
              aria-label="Report type"
              value={type}
              onChange={(event) => {
                setType(event.target.value);
                pager.reset();
              }}
              placeholder="All types"
              options={toOptions(REPORT_TYPES)}
              className="md:w-64"
            />
          </FilterBar>
          <DataTable
            caption="Reports"
            columns={[
              { key: 'reportNumber', header: 'Report', render: (row) => <span className="font-medium text-slate-900">{row.reportNumber}</span> },
              { key: 'reportType', header: 'Type', render: (row) => humanize(row.reportType) },
              { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
              { key: 'rowCount', header: 'Rows', align: 'right', render: (row) => formatNumber(row.rowCount) },
              { key: 'parameters', header: 'Parameters', render: (row) => Object.entries(row.parameters || {}).map(([key, value]) => `${key}: ${value}`).join(', ') || '—' },
              { key: 'generatedAt', header: 'Generated', sortKey: 'generatedAt', render: (row) => formatDateTime(row.generatedAt) },
              {
                key: 'actions',
                header: <span className="sr-only">Actions</span>,
                align: 'right',
                render: (row) =>
                  row.status !== 'FAILED' && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      icon={Download}
                      aria-label={`Export ${row.reportNumber} as CSV`}
                      onClick={(event) => {
                        event.stopPropagation();
                        exportCsv.mutate(row);
                      }}
                    />
                  ),
              },
            ]}
            rows={page.items}
            loading={query.isLoading}
            error={query.error}
            onRetry={query.refetch}
            onRowClick={(row) => navigate(`/reports/${row.id}`)}
            sort={{ sortBy: pager.sortBy, direction: pager.direction, onSort: pager.toggleSort }}
            empty={{ title: 'No reports generated yet' }}
          />
          <Pagination {...page} onPageChange={pager.setPage} onSizeChange={pager.setSize} disabled={query.isFetching} />
        </SummaryPanel>
      </div>
    </>
  );
}
