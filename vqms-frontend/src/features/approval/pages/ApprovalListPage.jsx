import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { keepPreviousData, useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpDown, BadgeCheck, Settings2, UserRoundCog } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePagination } from '@/hooks/usePagination';
import { useVendorNames } from '@/hooks/useVendorNames';
import { useRequestTitles } from '@/hooks/useLookups';
import PageHeader from '@/components/common/PageHeader';
import Button from '@/components/common/Button';
import Pagination from '@/components/common/Pagination';
import SearchInput from '@/components/common/SearchInput';
import Select from '@/components/common/Select';
import Tabs from '@/components/common/Tabs';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import EmptyState, { ErrorState } from '@/components/common/EmptyState';
import { normalizePage } from '@/utils/pagination';
import { formatCurrency, formatNumber } from '@/utils/formatCurrency';
import { APPROVAL_STATUSES, toOptions } from '@/utils/constants';
import { dashboardService } from '@/features/dashboard/dashboardService';
import ApprovalCard from '../components/ApprovalCard';
import { waitingDays } from '../approvalUtils';
import { approvalKeys, approvalService } from '../approvalService';

// Status counts (totalElements of the search endpoint). Same query keys as the dashboard.
const COUNT_STATES = ['', 'PENDING', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'CANCELLED'];

const PENDING_SORTS = [
  { value: 'wait', label: 'Wait time (longest)' },
  { value: 'newest', label: 'Newest first' },
  { value: 'amount', label: 'Amount (highest)' },
];
const HISTORY_SORTS = [
  { value: 'createdAt:desc', label: 'Newest first' },
  { value: 'createdAt:asc', label: 'Oldest first' },
];

function SkeletonCards() {
  return (
    <div className="space-y-4" aria-hidden="true">
      {[0, 1].map((key) => (
        <div key={key} className="card h-56 animate-pulse bg-slate-50" />
      ))}
    </div>
  );
}

export default function ApprovalListPage() {
  const queryClient = useQueryClient();
  const { user, can } = useAuth();
  const vendorName = useVendorNames();
  const requestTitle = useRequestTitles();
  const [searchParams, setSearchParams] = useSearchParams();
  // 'completed' is the older URL used by dashboard links; it now opens the Approved tab.
  const rawView = searchParams.get('view') || 'pending';
  const view = rawView === 'completed' ? 'approved' : rawView;
  const [status, setStatus] = useState('');
  const [keyword, setKeyword] = useState('');
  const [pendingSort, setPendingSort] = useState('wait');
  const [decision, setDecision] = useState(null); // { approval, key }
  const pager = usePagination({ size: 10, sortBy: 'createdAt', direction: 'desc' });

  const pending = useQuery({ queryKey: approvalKeys.pending, queryFn: ({ signal }) => approvalService.pending(signal) });
  const counts = useQueries({
    queries: COUNT_STATES.map((value) => ({
      queryKey: ['dashboard', 'approval-count', value],
      queryFn: ({ signal }) => dashboardService.approvalCount(value, signal),
      meta: { silent: true },
    })),
  });
  const count = (value) => counts[COUNT_STATES.indexOf(value)]?.data;

  const searchStatus = view === 'approved' ? 'APPROVED' : view === 'rejected' ? 'REJECTED' : status;
  const params = { status: searchStatus, page: pager.page, size: pager.size, sortBy: pager.sortBy, direction: pager.direction };
  const history = useQuery({
    queryKey: approvalKeys.list(params),
    queryFn: ({ signal }) => approvalService.search(params, signal),
    enabled: view !== 'pending',
    placeholderData: keepPreviousData,
  });
  const page = normalizePage(history.data);
  const query = view === 'pending' ? pending : history;

  const decide = useMutation({
    mutationFn: ({ approval, key, comment }) => approvalService[key](approval.id, comment),
    meta: { successMessage: 'Decision recorded' },
    onSuccess: () => {
      setDecision(null);
      queryClient.invalidateQueries({ queryKey: approvalKeys.all });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'approval-count'] });
    },
  });

  const pendingList = useMemo(() => pending.data || [], [pending.data]);

  // Rows for the active tab: filtered by the search text, and sorted for the pending tab.
  const rows = useMemo(() => {
    const source = view === 'pending' ? pendingList : page.items;
    const text = keyword.trim().toLowerCase();
    const filtered = text
      ? source.filter((approval) =>
          [approval.approvalNumber, approval.recommendationNumber, approval.vendorId && vendorName(approval.vendorId), requestTitle(approval.procurementRequestId)]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(text)),
        )
      : source;
    if (view !== 'pending') return filtered;
    const sorted = [...filtered];
    if (pendingSort === 'wait') sorted.sort((a, b) => (waitingDays(b) ?? 0) - (waitingDays(a) ?? 0));
    if (pendingSort === 'newest') sorted.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    if (pendingSort === 'amount') sorted.sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0));
    return sorted;
  }, [view, pendingList, page.items, keyword, pendingSort, vendorName, requestTitle]);

  // ---- Figures above the list: real counts and the amounts waiting for this user. ----
  const countsLoading = counts.some((entry) => entry.isLoading);

  // Sum of the pending amounts per currency (never adds different currencies together).
  const valueByCurrency = useMemo(() => {
    const map = new Map();
    pendingList.forEach((approval) => {
      const code = approval.currencyCode || 'USD';
      const entry = map.get(code) || { total: 0 };
      entry.total += Number(approval.amount) || 0;
      map.set(code, entry);
    });
    return [...map.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [pendingList]);

  const decided = (count('APPROVED') ?? 0) + (count('REJECTED') ?? 0);
  const approvalRate = decided ? Math.round(((count('APPROVED') ?? 0) / decided) * 100) : null;

  const tabs = [
    { value: 'pending', label: 'Pending', count: pending.data?.length },
    { value: 'approved', label: 'Approved', count: count('APPROVED') },
    { value: 'rejected', label: 'Rejected', count: count('REJECTED') },
    { value: 'all', label: 'All', count: count('') },
  ];

  const changeView = (next) => {
    setSearchParams(next === 'pending' ? {} : { view: next }, { replace: true });
    setStatus('');
    setKeyword('');
    pager.reset();
  };

  const emptyState =
    view === 'pending'
      ? {
          title: 'Nothing waiting for your decision',
          description: 'When a recommendation reaches an approval step assigned to your role, it appears here with its amount, steps and due date.',
        }
      : {
          title: keyword ? 'No matching approvals on this page' : 'No approvals found',
          description: keyword ? 'Clear the search or open another page.' : 'Approval workflows start when a recommendation is submitted for approval.',
        };

  return (
    <>
      <PageHeader
        title="Approvals"
        description="Review and decide on recommended quotations awaiting approval."
        actions={
          <>
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
          </>
        }
      />

      <Tabs variant="pill" label="Approval views" value={view} onChange={changeView} tabs={tabs} />

      <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-13">
        <div className="flex gap-2">
          <dt className="text-slate-500">Waiting for you</dt>
          <dd className="num font-medium text-slate-900">{pending.data ? formatNumber(pending.data.length) : '–'}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-slate-500">Pending value</dt>
          <dd className="num font-medium text-slate-900">
            {valueByCurrency.length ? valueByCurrency.map(([code, entry]) => formatCurrency(entry.total, code)).join(' + ') : '—'}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-slate-500">Approved</dt>
          <dd className="num font-medium text-slate-900">{countsLoading ? '–' : formatNumber(count('APPROVED') ?? 0)}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-slate-500">Rejected</dt>
          <dd className="num font-medium text-slate-900">{countsLoading ? '–' : formatNumber(count('REJECTED') ?? 0)}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-slate-500">Approval rate</dt>
          <dd className="num font-medium text-slate-900">{approvalRate != null ? `${approvalRate}%` : '—'}</dd>
        </div>
      </dl>

      {/* Toolbar */}
      <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
        <SearchInput
          value={keyword}
          onChange={setKeyword}
          placeholder={view === 'pending' ? 'Search by request, vendor or reference' : 'Filter this page by request, vendor or reference'}
          className="md:w-96"
        />
        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          {view === 'pending' ? (
            <Select
              aria-label="Sort by"
              value={pendingSort}
              onChange={(event) => setPendingSort(event.target.value)}
              options={PENDING_SORTS}
              selectClassName="border-transparent bg-transparent pl-1 shadow-none hover:border-line"
              className="w-52"
            />
          ) : (
            <Select
              aria-label="Sort by"
              value={`${pager.sortBy}:${pager.direction}`}
              onChange={(event) => {
                const [sortBy, direction] = event.target.value.split(':');
                pager.setSort(sortBy, direction);
              }}
              options={HISTORY_SORTS}
              selectClassName="border-transparent bg-transparent pl-1 shadow-none hover:border-line"
              className="w-44"
            />
          )}
        </div>
        {view === 'all' && (
          <Select
            aria-label="Status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              pager.reset();
            }}
            placeholder="All statuses"
            options={toOptions(APPROVAL_STATUSES)}
            className="md:ml-auto md:w-48"
          />
        )}
      </div>

      {/* Cards */}
      <div className="mt-4">
        {query.isLoading ? (
          <SkeletonCards />
        ) : query.error ? (
          <div className="card">
            <ErrorState error={query.error} onRetry={query.refetch} />
          </div>
        ) : rows.length === 0 ? (
          <div className="card">
            <EmptyState icon={BadgeCheck} {...emptyState} />
          </div>
        ) : (
          <div className="space-y-4">
            {rows.map((approval) => (
              <ApprovalCard
                key={approval.id}
                approval={approval}
                vendorName={vendorName}
                requestTitle={requestTitle}
                user={user}
                actionable={view === 'pending'}
                onDecide={(target, key) => setDecision({ approval: target, key })}
              />
            ))}
          </div>
        )}
        {view !== 'pending' && page.totalElements > 0 && (
          <div className="card mt-4 overflow-hidden">
            <Pagination {...page} onPageChange={pager.setPage} onSizeChange={pager.setSize} disabled={history.isFetching} />
          </div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(decision)}
        onClose={() => setDecision(null)}
        onConfirm={(comment) => decide.mutate({ approval: decision.approval, key: decision.key, comment })}
        loading={decide.isPending}
        title={decision?.key === 'reject' ? 'Reject approval' : 'Approve'}
        message={
          decision
            ? `${decision.key === 'reject' ? 'Reject' : 'Approve'} ${decision.approval.approvalNumber} for ${formatCurrency(decision.approval.amount, decision.approval.currencyCode)}?`
            : undefined
        }
        tone={decision?.key === 'reject' ? 'danger' : 'primary'}
        confirmLabel={decision?.key === 'reject' ? 'Reject' : 'Approve'}
        reasonLabel={decision?.key === 'reject' ? 'Reason for rejection' : 'Comment (optional)'}
        reasonRequired={decision?.key === 'reject'}
      />
    </>
  );
}
