import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail, MapPin, Pencil, Phone, Power, Trash } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import Button from '@/components/common/Button';
import DetailHeader from '@/components/common/DetailHeader';
import SummaryPanel from '@/components/common/SummaryPanel';
import StatusBadge from '@/components/common/StatusBadge';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import DataTable from '@/components/common/DataTable';
import { DetailSkeleton } from '@/components/common/Skeleton';
import { ErrorState } from '@/components/common/EmptyState';
import { formatDate, formatDateTime, formatRelative } from '@/utils/formatDate';
import { formatCurrency, formatNumber } from '@/utils/formatCurrency';
import { normalizePage } from '@/utils/pagination';
import { quotationKeys, quotationService } from '@/features/quotations/quotationService';
import { vendorKeys, vendorService } from '../vendorService';

function ContactRow({ icon: Icon, label, children }) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <div className="mt-0.5 break-words text-13 text-slate-900">{children || <span className="text-slate-400">Not provided</span>}</div>
      </div>
    </div>
  );
}

export default function VendorDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const canManage = can('vendor.manage');
  const [dialog, setDialog] = useState(null); // 'toggle' | 'delete'

  const vendor = useQuery({ queryKey: vendorKeys.one(id), queryFn: ({ signal }) => vendorService.get(id, signal) });
  const quotations = useQuery({
    queryKey: quotationKeys.byVendor(id, 0),
    queryFn: ({ signal }) => quotationService.byVendor(id, { page: 0, size: 10 }, signal),
  });

  const toggle = useMutation({
    mutationFn: () => (vendor.data.status === 'ACTIVE' ? vendorService.deactivate(id) : vendorService.activate(id)),
    meta: { successMessage: 'Vendor status updated' },
    onSuccess: (data) => {
      queryClient.setQueryData(vendorKeys.one(id), data);
      queryClient.invalidateQueries({ queryKey: vendorKeys.all });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'vendor-count'] });
      setDialog(null);
    },
  });
  const remove = useMutation({
    mutationFn: () => vendorService.remove(id),
    meta: { successMessage: 'Vendor deleted' },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vendorKeys.all });
      navigate('/vendors', { replace: true });
    },
  });

  if (vendor.isLoading) return <DetailSkeleton />;
  if (vendor.error) return <ErrorState error={vendor.error} onRetry={vendor.refetch} />;
  const data = vendor.data;
  const active = data.status === 'ACTIVE';
  const vendorQuotes = normalizePage(quotations.data);

  return (
    <>
      <DetailHeader
        backTo="/vendors"
        backLabel="Vendors"
        initials={data.name}
        title={data.name}
        badges={<StatusBadge status={data.status} />}
        meta={`${data.email} · Registered ${formatDate(data.createdAt)}${data.updatedAt ? ` · Updated ${formatRelative(data.updatedAt)}` : ''}`}
        figure={quotations.data ? formatNumber(vendorQuotes.totalElements) : '—'}
        figureLabel="Quotations submitted"
        next={active ? 'Active. This vendor can be selected for new quotations.' : 'Inactive. This vendor cannot be selected for new quotations.'}
        actions={
          canManage && (
            <>
              <Button variant={active ? 'danger-outline' : 'success'} icon={Power} onClick={() => setDialog('toggle')}>
                {active ? 'Deactivate' : 'Activate'}
              </Button>
              <Button variant="secondary" icon={Pencil} to={`/vendors/${id}/edit`}>
                Edit
              </Button>
              <Button variant="ghost" icon={Trash} onClick={() => setDialog('delete')}>
                Delete
              </Button>
            </>
          )
        }
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <SummaryPanel title="Contact">
          <div className="space-y-4">
            <ContactRow icon={Mail} label="Email">
              <a href={`mailto:${data.email}`} className="text-brand-700 hover:underline">
                {data.email}
              </a>
            </ContactRow>
            <ContactRow icon={Phone} label="Phone">
              {data.phone}
            </ContactRow>
            <ContactRow icon={MapPin} label="Address">
              {data.address && <span className="whitespace-pre-line">{data.address}</span>}
            </ContactRow>
          </div>
          <p className="mt-5 border-t border-line pt-3 text-xs text-slate-500">
            Registered {formatDateTime(data.createdAt)}
            {data.updatedAt && ` · last updated ${formatDateTime(data.updatedAt)}`}
          </p>
        </SummaryPanel>

        <SummaryPanel title="Recent quotations" className="lg:col-span-2" bodyClassName="overflow-hidden p-0">
          <DataTable
            dense
            caption="Recent quotations from this vendor"
            columns={[
              { key: 'quotationDate', header: 'Date', className: 'whitespace-nowrap', render: (row) => formatDate(row.quotationDate) },
              {
                key: 'fileName',
                header: 'Source',
                render: (row) => (!row.fileName || row.fileName === 'manual_entry' ? <span className="text-slate-500">Manual entry</span> : <span className="block max-w-48 truncate">{row.fileName}</span>),
              },
              { key: 'version', header: 'Version', align: 'right', render: (row) => `v${row.version ?? 1}` },
              { key: 'totalAmount', header: 'Total', align: 'right', className: 'whitespace-nowrap', render: (row) => <span className="font-medium text-slate-900">{formatCurrency(row.totalAmount, row.currency)}</span> },
              { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
            ]}
            rows={vendorQuotes.items}
            loading={quotations.isLoading}
            error={quotations.error}
            onRetry={quotations.refetch}
            onRowClick={(row) => navigate(`/quotations/${row.id}`)}
            empty={{ title: 'No quotations yet', description: 'Quotations this vendor submits appear here.' }}
          />
        </SummaryPanel>
      </div>

      <ConfirmDialog
        open={dialog === 'toggle'}
        onClose={() => setDialog(null)}
        onConfirm={() => toggle.mutate()}
        loading={toggle.isPending}
        title={active ? 'Deactivate vendor' : 'Activate vendor'}
        message={active ? 'The vendor will no longer be available for new quotations.' : 'The vendor will be available for quotations again.'}
        tone={active ? 'danger' : 'primary'}
        confirmLabel={active ? 'Deactivate' : 'Activate'}
      />
      <ConfirmDialog
        open={dialog === 'delete'}
        onClose={() => setDialog(null)}
        onConfirm={() => remove.mutate()}
        loading={remove.isPending}
        title="Delete vendor"
        message={`Delete ${data.name}? This cannot be undone.`}
        tone="danger"
        confirmLabel="Delete"
      />
    </>
  );
}
