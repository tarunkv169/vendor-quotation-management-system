import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BadgeCheck, ClipboardList, Copy, Download, Eye, Hourglass, Lightbulb, Percent, RefreshCw, Settings2, ShieldAlert, ThumbsDown, ThumbsUp, TriangleAlert, UserRoundCog } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useDebounce } from '@/hooks/useDebounce';
import { usePagination } from '@/hooks/usePagination';
import { useVendorNames } from '@/hooks/useVendorNames';
import { useRequestOptions, useRequestTitles } from '@/hooks/useLookups';
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
import { cn } from '@/utils/cn';
import { normalizePage } from '@/utils/pagination';
import { formatDate, formatDateTime } from '@/utils/formatDate';
import { formatCurrency, formatNumber } from '@/utils/formatCurrency';
import { humanize } from '@/utils/constants';
import { downloadCsv } from '@/utils/exportCsv';
import { DECISIONS, approvalPermissions, isOpenApproval } from '../approvalActions';
import { currentStep, waitingDays } from '../approvalUtils';
import { approvalKeys, approvalService } from '../approvalService';

// GET /approvals is paged (max 100 per page) without keyword search, so the page loads every
// approval the user may see once and filters, counts and pages it in the browser.
// "Waiting for me" comes from GET /approvals/pending (the backend's routing by role, limit and delegation).
const PAGE_SIZE = 100;
const MAX_PAGES = 20;

async function loadAllApprovals(signal) {
  let rows = [];
  for (let index = 0; index < MAX_PAGES; index += 1) {
    const result = normalizePage(await approvalService.search({ page: index, size: PAGE_SIZE, sortBy: 'createdAt', direction: 'desc' }, signal));
    rows = rows.concat(result.items);
    if (index + 1 >= result.totalPages) break;
  }
  return rows;
}

// Tabs: "Waiting for me", then the statuses (old dashboard links use ?view=approved / completed).
const VIEW_STATUS = { approved: 'APPROVED', rejected: 'REJECTED', open: 'PENDING', in_progress: 'IN_PROGRESS', cancelled: 'CANCELLED' };
const RISKS = {
  LOW: 'bg-emerald-50 text-success',
  MEDIUM: 'bg-amber-50 text-warning',
  HIGH: 'bg-red-50 text-danger',
  CRITICAL: 'bg-danger text-white',
};
const RISK_ORDER = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

const ICON_BUTTON =
  'flex h-9 w-9 items-center justify-center rounded-md border border-line bg-surface text-slate-600 transition-colors hover:border-line-strong hover:text-slate-900';

const EXPORT_COLUMNS = (requestTitle, vendorName) => [
  { header: 'Approval', value: (row) => row.approvalNumber },
  { header: 'Recommendation', value: (row) => row.recommendationNumber },
  { header: 'Procurement request', value: (row) => requestTitle(row.procurementRequestId) || row.procurementRequestId },
  { header: 'Vendor', value: (row) => (row.vendorId ? vendorName(row.vendorId) : '') },
  { header: 'Amount', value: (row) => row.amount },
  { header: 'Currency', value: (row) => row.currencyCode },
  { header: 'Risk', value: (row) => humanize(row.riskLevel) },
  { header: 'Mode', value: (row) => humanize(row.mode) },
  { header: 'Policy', value: (row) => row.policyCode },
  { header: 'Status', value: (row) => humanize(row.status) },
  { header: 'Current step', value: (row) => (currentStep(row) ? humanize(currentStep(row).requiredRole) : '') },
  { header: 'Created', value: (row) => row.createdAt },
  { header: 'Decided', value: (row) => row.decidedAt },
  { header: 'Final comment', value: (row) => row.finalComment },
];

function ApprovalCell({ row, requestTitle }) {
  const title = requestTitle(row.procurementRequestId);
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600">
        <BadgeCheck className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <Link to={`/approvals/${row.id}`} onClick={(event) => event.stopPropagation()} className="block whitespace-nowrap font-mono text-xs font-semibold text-slate-900 hover:text-brand-700">
          {row.approvalNumber}
        </Link>
        <p className="mt-0.5 max-w-40 truncate text-xs text-slate-500" title={title || 'Request not visible to your account'}>
          {title || 'Request not visible'}
        </p>
      </div>
    </div>
  );
}

function RiskBadge({ level }) {
  if (!level) return <span className="text-slate-400">—</span>;
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium', RISKS[level] || 'bg-slate-100 text-slate-600')}>
      {(level === 'HIGH' || level === 'CRITICAL') && <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />}
      {humanize(level)}
    </span>
  );
}

/** Level progress: one segment per step, plus the role the current step waits for. */
function StepsCell({ row, user }) {
  const steps = [...(row.steps || [])].sort((a, b) => a.levelNumber - b.levelNumber);
  if (!steps.length) return <span className="text-slate-400">—</span>;
  const done = steps.filter((step) => step.status === 'APPROVED').length;
  const step = currentStep(row);
  const role = step ? (step.escalated ? step.escalationRole : step.requiredRole) : null;
  const mine = role && user?.role === role;
  return (
    <div className="min-w-28">
      <div className="flex gap-1" aria-hidden="true">
        {steps.map((item) => (
          <span
            key={item.id || item.levelNumber}
            className={cn(
              'h-1.5 flex-1 rounded-full',
              item.status === 'APPROVED' ? 'bg-success' : item.status === 'REJECTED' ? 'bg-danger' : item.status === 'PENDING' ? 'bg-brand-600' : 'bg-slate-200',
            )}
          />
        ))}
      </div>
      <p className="mt-1 whitespace-nowrap text-xs text-slate-500">
        {step ? (
          <>
            {humanize(role)}
            {mine && <span className="font-medium text-brand-700"> · you</span>}
          </>
        ) : (
          `${done} of ${steps.length} approved`
        )}
      </p>
    </div>
  );
}

function TimingCell({ row }) {
  if (isOpenApproval(row)) {
    const days = waitingDays(row);
    const step = currentStep(row);
    return (
      <span className="block whitespace-nowrap leading-tight">
        <span className={cn('block', step?.overdue ? 'font-medium text-danger' : 'text-slate-800')}>
          {days == null ? '—' : days === 0 ? 'Today' : `${days} ${days === 1 ? 'day' : 'days'}`}
        </span>
        <span className={cn('block text-xs', step?.overdue ? 'text-danger' : 'text-slate-500')}>
          {step?.overdue ? 'Overdue' : step?.dueAt ? `Due ${formatDate(step.dueAt)}` : 'Waiting'}
        </span>
      </span>
    );
  }
  return (
    <span className="block whitespace-nowrap leading-tight">
      <span className="block text-slate-800">{row.decidedAt ? formatDate(row.decidedAt) : '—'}</span>
      <span className="block text-xs text-slate-500">Decided</span>
    </span>
  );
}

export default function ApprovalListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, can, canAccess } = useAuth();
  const vendorName = useVendorNames();
  const requests = useRequestOptions();
  const requestTitle = useRequestTitles();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawView = searchParams.get('view') || 'pending';
  const view = rawView === 'completed' ? 'approved' : rawView; // 'completed' = older dashboard URL
  const requestId = searchParams.get('request') || '';
  const [risk, setRisk] = useState('');
  const [keyword, setKeyword] = useState('');
  const debounced = useDebounce(keyword.trim().toLowerCase(), 250);
  const pager = usePagination({ size: 10, sortBy: 'waiting', direction: 'desc' });
  const [decision, setDecision] = useState(null); // { approval, key }

  const pending = useQuery({ queryKey: approvalKeys.pending, queryFn: ({ signal }) => approvalService.pending(signal) });
  const history = useQuery({ queryKey: approvalKeys.list({ scope: 'all' }), queryFn: ({ signal }) => loadAllApprovals(signal) });
  const pendingList = useMemo(() => pending.data || [], [pending.data]);
  const all = useMemo(() => history.data || [], [history.data]);
  const waitingIds = useMemo(() => new Set(pendingList.map((row) => row.id)), [pendingList]);
  const query = view === 'pending' ? pending : history;

  const setParam = (key, value) => {
    const next = new URLSearchParams(window.location.search);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
    pager.reset();
  };
  const changeView = (next) => setParam('view', next === 'pending' ? '' : next);

  const vendorOf = (row) => (row.vendorId ? vendorName(row.vendorId) : '');
  const source = view === 'pending' ? pendingList : view === 'all' ? all : all.filter((row) => row.status === VIEW_STATUS[view]);
  const filtered = useMemo(() => {
    const rows = source.filter(
      (row) =>
        (!risk || row.riskLevel === risk) &&
        (!requestId || row.procurementRequestId === requestId) &&
        (!debounced ||
          [row.approvalNumber, row.recommendationNumber, vendorOf(row), requestTitle(row.procurementRequestId)].some((value) => value?.toLowerCase().includes(debounced))),
    );
    const valueOf = (row) => {
      if (pager.sortBy === 'waiting') return isOpenApproval(row) ? waitingDays(row) ?? 0 : -1;
      if (pager.sortBy === 'vendor') return vendorOf(row);
      if (pager.sortBy === 'riskLevel') return RISK_ORDER[row.riskLevel] || 0;
      if (pager.sortBy === 'amount') return Number(row.amount) || 0;
      return row[pager.sortBy];
    };
    const factor = pager.direction === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const left = valueOf(a) ?? '';
      const right = valueOf(b) ?? '';
      if (typeof left === 'number' || typeof right === 'number') return (Number(left) - Number(right)) * factor;
      return String(left).localeCompare(String(right)) * factor;
    });
    // vendorOf depends on vendorName
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, risk, requestId, debounced, requestTitle, vendorName, pager.sortBy, pager.direction]);
  const pageRows = filtered.slice(pager.page * pager.size, (pager.page + 1) * pager.size);

  // ---- KPIs ----
  const statusCount = (value) => all.filter((row) => row.status === value).length;
  const approvedCount = statusCount('APPROVED');
  const rejectedCount = statusCount('REJECTED');
  const decided = approvedCount + rejectedCount;
  const valueByCurrency = useMemo(() => {
    const map = new Map();
    pendingList.forEach((row) => {
      const code = row.currencyCode || 'USD';
      map.set(code, (map.get(code) || 0) + (Number(row.amount) || 0));
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [pendingList]);
  const overdueMine = pendingList.filter((row) => currentStep(row)?.overdue).length;
  const historyFigure = (value) => ({ isLoading: history.isLoading, error: history.error, data: value });

  const tabs = [
    { value: 'pending', label: 'Waiting for me', count: pending.data?.length },
    { value: 'all', label: 'All', count: history.data ? all.length : undefined },
    { value: 'open', label: 'Pending', count: history.data ? statusCount('PENDING') : undefined },
    ...(statusCount('IN_PROGRESS') || view === 'in_progress' ? [{ value: 'in_progress', label: 'In progress', count: statusCount('IN_PROGRESS') }] : []),
    { value: 'approved', label: 'Approved', count: history.data ? approvedCount : undefined },
    { value: 'rejected', label: 'Rejected', count: history.data ? rejectedCount : undefined },
    ...(statusCount('CANCELLED') || view === 'cancelled' ? [{ value: 'cancelled', label: 'Cancelled', count: statusCount('CANCELLED') }] : []),
  ];

  // ---- Actions ----
  const decide = useMutation({
    mutationFn: ({ approval, key, comment }) => approvalService[key](approval.id, comment),
    meta: { successMessage: 'Decision recorded' },
    onSuccess: () => {
      setDecision(null);
      queryClient.invalidateQueries({ queryKey: approvalKeys.all });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'approval-count'] });
    },
  });
  const refreshAll = () => {
    pending.refetch();
    history.refetch();
  };

  const copyNumber = async (row) => {
    try {
      await navigator.clipboard.writeText(row.approvalNumber);
      toast.success('Approval ID copied');
    } catch {
      toast.error('Could not copy to the clipboard');
    }
  };

  const exportCsv = () => {
    if (!filtered.length) {
      toast.info('Nothing to export');
      return;
    }
    downloadCsv(`approvals-${new Date().toISOString().slice(0, 10)}.csv`, EXPORT_COLUMNS(requestTitle, vendorName), filtered);
    toast.success(`Exported ${formatNumber(filtered.length)} ${filtered.length === 1 ? 'approval' : 'approvals'}`);
  };

  const menuItems = (row) => {
    const permissions = approvalPermissions(row, can, { waitingForMe: waitingIds.has(row.id) });
    return [
      { key: 'open', label: 'View details', icon: Eye, onClick: () => navigate(`/approvals/${row.id}`) },
      ...(permissions.canDecide
        ? [
            { key: 'approve', label: 'Approve', icon: DECISIONS.approve.icon, onClick: () => setDecision({ approval: row, key: 'approve' }) },
            { key: 'reject', label: 'Reject', icon: DECISIONS.reject.icon, tone: 'danger', onClick: () => setDecision({ approval: row, key: 'reject' }) },
          ]
        : []),
      ...(permissions.canEscalate ? [{ key: 'escalate', label: 'Escalate', icon: DECISIONS.escalate.icon, divider: permissions.canDecide, onClick: () => setDecision({ approval: row, key: 'escalate' }) }] : []),
      ...(permissions.canCancel ? [{ key: 'cancel', label: 'Cancel approval', icon: DECISIONS.cancel.icon, tone: 'danger', onClick: () => setDecision({ approval: row, key: 'cancel' }) }] : []),
      ...(row.recommendationId && canAccess('recommendations') ? [{ key: 'rec', label: 'Open recommendation', icon: Lightbulb, divider: true, onClick: () => navigate(`/recommendations/${row.recommendationId}`) }] : []),
      ...(row.procurementRequestId && canAccess('procurement')
        ? [{ key: 'request', label: 'Open procurement request', icon: ClipboardList, divider: !(row.recommendationId && canAccess('recommendations')), onClick: () => navigate(`/procurement/${row.procurementRequestId}`) }]
        : []),
      { key: 'copy', label: 'Copy approval ID', icon: Copy, divider: true, onClick: () => copyNumber(row) },
    ];
  };

  const renderActions = (row) => {
    const { canDecide } = approvalPermissions(row, can, { waitingForMe: waitingIds.has(row.id) });
    return (
      <div className="flex items-center justify-end gap-2" onClick={(event) => event.stopPropagation()}>
        {/* Inline Approve / Reject on the "Waiting for me" tab; elsewhere they are in the menu. */}
        {canDecide && view === 'pending' && (
          <>
            <button
              type="button"
              className={cn(ICON_BUTTON, 'text-success hover:border-success hover:text-success')}
              onClick={() => setDecision({ approval: row, key: 'approve' })}
              aria-label={`Approve ${row.approvalNumber}`}
              title="Approve"
            >
              <ThumbsUp className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              className={cn(ICON_BUTTON, 'text-danger hover:border-danger hover:text-danger')}
              onClick={() => setDecision({ approval: row, key: 'reject' })}
              aria-label={`Reject ${row.approvalNumber}`}
              title="Reject"
            >
              <ThumbsDown className="h-4 w-4" aria-hidden="true" />
            </button>
          </>
        )}
        <Link to={`/approvals/${row.id}`} className={ICON_BUTTON} aria-label={`View details of ${row.approvalNumber}`} title="View details">
          <Eye className="h-4 w-4" aria-hidden="true" />
        </Link>
        <ActionMenu items={menuItems(row)} label={`More actions for ${row.approvalNumber}`} />
      </div>
    );
  };

  const columns = [
    { key: 'approvalNumber', header: 'Approval', sortKey: 'approvalNumber', className: 'min-w-52', render: (row) => <ApprovalCell row={row} requestTitle={requestTitle} /> },
    { key: 'vendor', header: 'Vendor', sortKey: 'vendor', render: (row) => <span className="block max-w-36 truncate font-medium text-slate-800" title={vendorOf(row)}>{vendorOf(row) || '—'}</span> },
    { key: 'amount', header: 'Amount', sortKey: 'amount', align: 'right', className: 'whitespace-nowrap', render: (row) => <span className="font-semibold text-slate-900">{formatCurrency(row.amount, row.currencyCode)}</span> },
    { key: 'riskLevel', header: 'Risk', sortKey: 'riskLevel', render: (row) => <RiskBadge level={row.riskLevel} /> },
    { key: 'steps', header: 'Approval Steps', render: (row) => <StepsCell row={row} user={user} /> },
    {
      key: 'status',
      header: 'Status',
      sortKey: 'status',
      render: (row) => (
        <div className="flex flex-col items-start gap-1">
          <StatusBadge status={row.status} />
          {row.requiresReview && (
            <span className="inline-flex items-center gap-1 text-2xs font-medium text-warning" title={(row.reviewReasons || []).join('; ')}>
              <ShieldAlert className="h-3 w-3" aria-hidden="true" />
              Review flagged
            </span>
          )}
        </div>
      ),
    },
    { key: 'waiting', header: view === 'pending' || VIEW_STATUS[view] === 'PENDING' ? 'Waiting' : 'Waiting / Decided', sortKey: 'waiting', render: (row) => <TimingCell row={row} /> },
    { key: 'actions', header: 'Actions', headerClassName: 'text-right', render: (row) => renderActions(row) },
  ];

  const filteredView = Boolean(keyword || risk || requestId);
  const clearFilters = () => {
    setKeyword('');
    setRisk('');
    setParam('request', '');
  };
  const empty =
    view === 'pending' && !filteredView
      ? { title: 'Nothing is waiting for your decision' }
      : {
          title: filteredView ? 'No approvals match these filters' : 'No approvals here yet',
          action: filteredView ? (
            <Button variant="secondary" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          ) : null,
        };

  const active = decision && DECISIONS[decision.key];

  return (
    <>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <span className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 sm:flex">
            <BadgeCheck className="h-7 w-7" strokeWidth={1.8} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Approvals</h1>
            <p className="mt-1 text-sm text-slate-500">Review and decide on recommended quotations awaiting approval.</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {can('approval.delegate') && (
            <Button variant="secondary" icon={UserRoundCog} to="/approvals/delegations">
              Delegations
            </Button>
          )}
          {can('approvalPolicy.view') && (
            <Button variant="secondary" icon={Settings2} to="/approvals/policies">
              Policies
            </Button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <section aria-label="Approval figures" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KpiCard
          icon={Hourglass}
          tone="brand"
          label="Waiting for You"
          query={{ isLoading: pending.isLoading, error: pending.error, data: pendingList.length }}
          caption={
            pending.data
              ? valueByCurrency.length
                ? `${valueByCurrency.map(([code, total]) => formatCurrency(total, code)).join(' + ')}${overdueMine ? ` · ${overdueMine} overdue` : ''}`
                : 'Nothing pending'
              : undefined
          }
          onClick={() => changeView('pending')}
          active={view === 'pending'}
        />
        <KpiCard icon={ThumbsUp} tone="success" label="Approved" query={historyFigure(approvedCount)} onClick={() => changeView(view === 'approved' ? 'all' : 'approved')} active={view === 'approved'} />
        <KpiCard icon={ThumbsDown} tone="danger" label="Rejected" query={historyFigure(rejectedCount)} onClick={() => changeView(view === 'rejected' ? 'all' : 'rejected')} active={view === 'rejected'} />
        <KpiCard
          icon={Percent}
          tone="info"
          label="Approval Rate"
          query={historyFigure(decided ? Math.round((approvedCount / decided) * 100) : null)}
          emptyText="—"
          suffix="%"
          caption={history.data ? (decided ? `${formatNumber(approvedCount)} of ${formatNumber(decided)} decided` : 'No decisions yet') : undefined}
        />
      </section>

      {/* Tabs, filters and table */}
      <section aria-label="Approvals" className="card mt-5 overflow-hidden">
        <div className="overflow-x-auto px-4 pt-2 sm:px-5">
          <Tabs variant="pill" label="Approval views" value={view} onChange={changeView} tabs={tabs} />
        </div>

        <div className="flex flex-col gap-3 border-b border-line p-4 sm:px-5 lg:flex-row lg:items-center">
          <SearchInput
            value={keyword}
            onChange={(value) => {
              setKeyword(value);
              pager.reset();
            }}
            placeholder="Search approval, vendor or request…"
            className="lg:w-80"
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex">
            <Select
              aria-label="Risk"
              value={risk}
              onChange={(event) => {
                setRisk(event.target.value);
                pager.reset();
              }}
              options={[{ value: '', label: 'All risk levels' }, ...['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((value) => ({ value, label: `${humanize(value)} risk` }))]}
              className="lg:w-48"
            />
            <div className="relative lg:w-72">
              <ClipboardList className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <Select
                aria-label="Procurement request"
                value={requestId}
                onChange={(event) => setParam('request', event.target.value)}
                options={[{ value: '', label: 'All requests' }, ...(requests.data || []).map((option) => ({ value: option.value, label: option.title }))]}
                selectClassName="pl-9"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 lg:ml-auto">
            {filteredView && (
              <Button variant="ghost" onClick={clearFilters}>
                Clear
              </Button>
            )}
            <button type="button" className={ICON_BUTTON} onClick={refreshAll} aria-label="Refresh" title="Refresh">
              <RefreshCw className={cn('h-4 w-4', (pending.isFetching || history.isFetching) && 'animate-spin')} aria-hidden="true" />
            </button>
            <Button variant="secondary" icon={Download} onClick={exportCsv} disabled={query.isLoading || Boolean(query.error)}>
              Export
            </Button>
          </div>
        </div>

        {/* Desktop / tablet: table */}
        <div className="hidden md:block">
          <DataTable
            roomy
            caption="Approvals"
            columns={columns}
            rows={pageRows}
            loading={query.isLoading}
            error={query.error}
            onRetry={query.refetch}
            onRowClick={(row) => navigate(`/approvals/${row.id}`)}
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
            <EmptyState title={empty.title} action={empty.action} />
          ) : (
            <ul className="divide-y divide-slate-100">
              {pageRows.map((row) => (
                <li key={row.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <ApprovalCell row={row} requestTitle={requestTitle} />
                    <StatusBadge status={row.status} />
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-13">
                    <div>
                      <dt className="text-xs text-slate-500">Amount</dt>
                      <dd className="num font-semibold text-slate-900">{formatCurrency(row.amount, row.currencyCode)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Risk</dt>
                      <dd className="mt-0.5">
                        <RiskBadge level={row.riskLevel} />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Vendor</dt>
                      <dd className="truncate text-slate-800">{vendorOf(row) || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">{isOpenApproval(row) ? 'Waiting' : 'Decided'}</dt>
                      <dd className="text-slate-800">{isOpenApproval(row) ? `${waitingDays(row) ?? 0} days` : row.decidedAt ? formatDateTime(row.decidedAt) : '—'}</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-xs text-slate-500">Approval steps</dt>
                      <dd className="mt-1">
                        <StepsCell row={row} user={user} />
                      </dd>
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
          noun={['approval', 'approvals']}
        />
      </section>

      <ConfirmDialog
        open={Boolean(active)}
        onClose={() => setDecision(null)}
        onConfirm={(comment) => decide.mutate({ approval: decision.approval, key: decision.key, comment })}
        loading={decide.isPending}
        title={active ? `${active.label}: ${decision.approval.approvalNumber}` : ''}
        message={
          decision
            ? decision.key === 'approve' || decision.key === 'reject'
              ? `${active.label} ${decision.approval.approvalNumber} for ${formatCurrency(decision.approval.amount, decision.approval.currencyCode)}?`
              : decision.key === 'escalate'
                ? 'Escalate the current level to its escalation role?'
                : 'Cancel this approval workflow? The recommendation will need a new approval.'
            : undefined
        }
        tone={active?.tone}
        confirmLabel={active?.label}
        reasonLabel={active?.reasonLabel}
        reasonRequired={active?.reasonRequired}
      />
    </>
  );
}
