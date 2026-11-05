import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  BadgeCheck,
  CalendarDays,
  CircleSlash,
  ClipboardList,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Eye,
  Layers,
  Lightbulb,
  Plus,
  RefreshCw,
  Scale,
  Send,
  TriangleAlert,
  Trophy,
  UserCheck,
} from 'lucide-react';
import { endOfDay, parseISO, startOfDay, startOfYear } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { useDebounce } from '@/hooks/useDebounce';
import { usePagination } from '@/hooks/usePagination';
import { useRequestOptions, useRequestTitles } from '@/hooks/useLookups';
import { useVendorNames } from '@/hooks/useVendorNames';
import Button from '@/components/common/Button';
import DataTable from '@/components/common/DataTable';
import Pagination from '@/components/common/Pagination';
import SearchInput from '@/components/common/SearchInput';
import Select from '@/components/common/Select';
import Input from '@/components/common/Input';
import Tabs from '@/components/common/Tabs';
import KpiCard from '@/components/common/KpiCard';
import ActionMenu from '@/components/common/ActionMenu';
import Skeleton from '@/components/common/Skeleton';
import EmptyState, { ErrorState } from '@/components/common/EmptyState';
import { cn } from '@/utils/cn';
import { normalizePage } from '@/utils/pagination';
import { formatDateTime } from '@/utils/formatDate';
import { formatNumber } from '@/utils/formatCurrency';
import { humanize } from '@/utils/constants';
import { downloadCsv } from '@/utils/exportCsv';
import { approvalKeys, approvalService } from '@/features/approval/approvalService';
import { recommendationKeys, recommendationService } from '../recommendationService';
import { APPROVAL_STAGES, approvalStage, latestApprovalByRecommendation, recommendationPermissions } from '../recommendationActions';
import SubmitForApprovalDialog from '../components/SubmitForApprovalDialog';
import GenerateRecommendationDialog from '../components/GenerateRecommendationDialog';

// GET /recommendations and GET /approvals are paged (max 100 per page) and have no keyword search, so the
// page loads both lists once and searches, filters, counts and pages in the browser.
const PAGE_SIZE = 100;
const MAX_PAGES = 20;

async function loadAll(search, sortBy, signal) {
  let rows = [];
  for (let index = 0; index < MAX_PAGES; index += 1) {
    const result = normalizePage(await search({ page: index, size: PAGE_SIZE, sortBy, direction: 'desc' }, signal));
    rows = rows.concat(result.items);
    if (index + 1 >= result.totalPages) break;
  }
  return rows;
}

const ICON_BUTTON =
  'flex h-9 w-9 items-center justify-center rounded-md border border-line bg-surface text-slate-600 transition-colors hover:border-line-strong hover:text-slate-900';
const PILL = 'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium';

const OUTCOMES = {
  BEST_VALUE: { label: 'Best value', icon: Trophy, className: 'bg-emerald-50 text-success' },
  SINGLE_ELIGIBLE_VENDOR: { label: 'Single vendor', title: 'Single eligible vendor', icon: UserCheck, className: 'bg-violet-50 text-violet-800' },
  NO_QUALIFYING_VENDOR: { label: 'No qualifier', title: 'No qualifying vendor', icon: CircleSlash, className: 'bg-red-50 text-danger' },
};
const RISKS = {
  LOW: { label: 'Low', className: 'bg-emerald-50 text-success', dot: 'bg-emerald-500' },
  MEDIUM: { label: 'Medium', className: 'bg-amber-50 text-amber-800', dot: 'bg-amber-500' },
  HIGH: { label: 'High', className: 'bg-red-50 text-danger', dot: 'bg-red-500' },
  CRITICAL: { label: 'Critical', className: 'bg-danger text-white', dot: 'bg-white' },
};
const RISK_ORDER = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
const HIGH_RISK = ['HIGH', 'CRITICAL'];
const STAGE_ORDER = ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED', 'SUPERSEDED'];

const DATE_RANGES = [
  { value: '', label: 'Generated: any' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: 'year', label: 'This year' },
  { value: 'custom', label: 'Custom range…' },
];

function rangeBounds(range, from, to) {
  const now = new Date();
  if (!range) return null;
  if (range === 'year') return [startOfYear(now), endOfDay(now)];
  if (range === 'custom') {
    const start = from ? startOfDay(parseISO(from)) : null;
    const end = to ? endOfDay(parseISO(to)) : null;
    return start || end ? [start, end] : null;
  }
  return [startOfDay(new Date(now.getTime() - Number(range) * 86400000)), endOfDay(now)];
}

function Outcome({ type }) {
  const config = OUTCOMES[type];
  if (!config) return type ? <span className={cn(PILL, 'bg-slate-100 text-slate-600')}>{humanize(type)}</span> : <span className="text-slate-400">—</span>;
  const Icon = config.icon;
  return (
    <span className={cn(PILL, config.className)} title={config.title}>
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {config.label}
    </span>
  );
}

function Dotted({ config, fallback }) {
  if (!config) return fallback ? <span className={cn(PILL, 'bg-slate-100 text-slate-600')}>{humanize(fallback)}</span> : <span className="text-slate-400">—</span>;
  return (
    <span className={cn(PILL, config.className)}>
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', config.dot)} aria-hidden="true" />
      {config.label}
    </span>
  );
}

/** Score out of 100 (the backend's weighted score scale) with a bar. */
function Score({ value }) {
  if (value == null) return <span className="text-slate-400">—</span>;
  const score = Number(value);
  const tone = score >= 75 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="w-24" title={`${formatNumber(score, 2)} of 100`}>
      <span className="num font-semibold text-slate-900">{score.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
      <div className="mt-1 h-1.5 rounded-full bg-slate-100" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={score} aria-label="Score">
        <div className={cn('h-full rounded-full', tone)} style={{ width: `${Math.max(0, Math.min(100, score))}%` }} />
      </div>
    </div>
  );
}

function RequestCell({ row, requestTitle }) {
  const title = requestTitle(row.procurementRequestId);
  return (
    <div className="min-w-0">
      <Link
        to={`/recommendations/${row.id}`}
        onClick={(event) => event.stopPropagation()}
        className="block max-w-52 truncate font-semibold text-slate-900 hover:text-brand-700"
        title={title || 'Request not visible to your account'}
      >
        {title || 'Request not visible'}
      </Link>
      <p className="mt-0.5 whitespace-nowrap font-mono text-xs text-slate-500">{row.recommendationNumber}</p>
    </div>
  );
}

/** Date on the first line, time below (keeps eight columns inside a laptop-width table). */
function DateTime({ value }) {
  if (!value) return <span className="text-slate-400">—</span>;
  const [date, time] = formatDateTime(value).split(', ');
  return (
    <span className="block whitespace-nowrap leading-tight" title={formatDateTime(value)}>
      <span className="block text-slate-800">{date}</span>
      {time && <span className="block text-xs text-slate-500">{time}</span>}
    </span>
  );
}

export default function RecommendationListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can, canAccess } = useAuth();
  const vendorName = useVendorNames();
  const requests = useRequestOptions();
  const requestTitle = useRequestTitles();
  const [searchParams, setSearchParams] = useSearchParams();
  const stage = searchParams.get('status') || '';
  const requestId = searchParams.get('request') || '';
  const risk = searchParams.get('risk') || '';
  const range = searchParams.get('generated') || '';
  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';
  const [keyword, setKeyword] = useState('');
  const debounced = useDebounce(keyword.trim().toLowerCase(), 250);
  const pager = usePagination({ size: 20, sortBy: 'generatedAt', direction: 'desc' });
  const [submitTarget, setSubmitTarget] = useState(null);
  const [generateOpen, setGenerateOpen] = useState(false);

  const query = useQuery({ queryKey: recommendationKeys.list({ scope: 'all' }), queryFn: ({ signal }) => loadAll(recommendationService.search, 'generatedAt', signal) });
  // Approval outcomes (approved / rejected) live in the approval service; without access the stage stops at "submitted".
  const approvals = useQuery({
    queryKey: approvalKeys.list({ scope: 'all' }),
    queryFn: ({ signal }) => loadAll(approvalService.search, 'createdAt', signal),
    enabled: canAccess('approvals'),
  });
  const approvalOf = useMemo(() => latestApprovalByRecommendation(approvals.data), [approvals.data]);
  const all = useMemo(() => (query.data || []).map((row) => ({ ...row, stage: approvalStage(row, approvalOf.get(row.id)), approval: approvalOf.get(row.id) })), [query.data, approvalOf]);

  const setParam = (key, value) => {
    const next = new URLSearchParams(window.location.search);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key === 'generated' && value !== 'custom') {
      next.delete('from');
      next.delete('to');
    }
    setSearchParams(next, { replace: true });
    pager.reset();
  };

  const vendorOf = (row) => (row.recommendedVendorId ? vendorName(row.recommendedVendorId) : '');
  const filtered = useMemo(() => {
    const bounds = rangeBounds(range, from, to);
    const rows = all.filter((row) => {
      if (stage && row.stage !== stage) return false;
      if (requestId && row.procurementRequestId !== requestId) return false;
      if (risk && (risk === 'HIGH' ? !HIGH_RISK.includes(row.riskLevel) : row.riskLevel !== risk)) return false;
      if (bounds) {
        const generated = row.generatedAt ? new Date(row.generatedAt) : null;
        if (!generated || (bounds[0] && generated < bounds[0]) || (bounds[1] && generated > bounds[1])) return false;
      }
      return (
        !debounced ||
        [row.recommendationNumber, row.comparisonNumber, row.procurementRequestId, vendorOf(row), requestTitle(row.procurementRequestId)].some((value) => value?.toLowerCase().includes(debounced))
      );
    });
    const valueOf = (row) => {
      if (pager.sortBy === 'request') return requestTitle(row.procurementRequestId) || '';
      if (pager.sortBy === 'vendor') return vendorOf(row);
      if (pager.sortBy === 'riskLevel') return RISK_ORDER[row.riskLevel] || 0;
      if (pager.sortBy === 'stage') return STAGE_ORDER.indexOf(row.stage);
      if (pager.sortBy === 'overallScore') return row.overallScore == null ? -1 : Number(row.overallScore);
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
  }, [all, stage, requestId, risk, range, from, to, debounced, requestTitle, vendorName, pager.sortBy, pager.direction]);
  const pageRows = filtered.slice(pager.page * pager.size, (pager.page + 1) * pager.size);

  const stageCount = (value) => all.filter((row) => row.stage === value).length;
  const figure = (value) => ({ isLoading: query.isLoading, error: query.error, data: value });

  const refresh = () => queryClient.invalidateQueries({ queryKey: recommendationKeys.all });
  const regenerate = useMutation({
    mutationFn: (row) => recommendationService.regenerate(row.id),
    meta: { successMessage: 'Recommendation regenerated' },
    onSuccess: (next) => {
      refresh();
      navigate(`/recommendations/${next.id}`);
    },
  });
  const submit = useMutation({
    mutationFn: ({ row, payload }) => recommendationService.submitForApproval(row.id, payload),
    meta: { successMessage: 'Submitted for approval' },
    onSuccess: () => {
      setSubmitTarget(null);
      refresh();
    },
  });
  const startApproval = useMutation({
    mutationFn: (row) => approvalService.create(row.id),
    meta: { successMessage: 'Approval workflow started' },
    onSuccess: (approval) => {
      queryClient.invalidateQueries({ queryKey: approvalKeys.all });
      navigate(`/approvals/${approval.id}`);
    },
  });
  const busy = regenerate.isPending || submit.isPending || startApproval.isPending;

  const copyNumber = async (row) => {
    try {
      await navigator.clipboard.writeText(row.recommendationNumber);
      toast.success('Recommendation ID copied');
    } catch {
      toast.error('Could not copy to the clipboard');
    }
  };

  const exportCsv = () => {
    if (!filtered.length) {
      toast.info('Nothing to export');
      return;
    }
    downloadCsv(
      `recommendations-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        { header: 'Recommendation', value: (row) => row.recommendationNumber },
        { header: 'Comparison', value: (row) => row.comparisonNumber },
        { header: 'Procurement request', value: (row) => requestTitle(row.procurementRequestId) || row.procurementRequestId },
        { header: 'Recommended vendor', value: (row) => vendorOf(row) },
        { header: 'Outcome', value: (row) => OUTCOMES[row.type]?.title || OUTCOMES[row.type]?.label || humanize(row.type) },
        { header: 'Score', value: (row) => row.overallScore },
        { header: 'Risk', value: (row) => humanize(row.riskLevel) },
        { header: 'Approval status', value: (row) => APPROVAL_STAGES[row.stage]?.label },
        { header: 'Recommendation status', value: (row) => humanize(row.status) },
        { header: 'Needs review', value: (row) => (row.requiresReview ? 'Yes' : 'No') },
        { header: 'Approval', value: (row) => row.approval?.approvalNumber },
        { header: 'Generated', value: (row) => row.generatedAt },
        { header: 'Submitted', value: (row) => row.submittedAt },
      ],
      filtered,
    );
    toast.success(`Exported ${formatNumber(filtered.length)} ${filtered.length === 1 ? 'recommendation' : 'recommendations'}`);
  };

  const canComparison = canAccess('comparison');
  const menuItems = (row) => {
    const permissions = recommendationPermissions(row, can);
    const hasComparison = Boolean(row.comparisonId) && canComparison;
    return [
      { key: 'open', label: 'View details', icon: Eye, onClick: () => navigate(`/recommendations/${row.id}`) },
      ...(hasComparison ? [{ key: 'comparison', label: 'View comparison', icon: Scale, onClick: () => navigate(`/comparison/${row.comparisonId}`) }] : []),
      ...(row.approval && canAccess('approvals') ? [{ key: 'approval-open', label: 'Open approval', icon: BadgeCheck, onClick: () => navigate(`/approvals/${row.approval.id}`) }] : []),
      ...(permissions.canSubmit ? [{ key: 'submit', label: 'Submit for approval', icon: Send, divider: true, disabled: busy, onClick: () => setSubmitTarget(row) }] : []),
      ...(permissions.canStartApproval && (!row.approval || row.approval.status === 'CANCELLED') ? [{ key: 'approval', label: 'Start approval', icon: BadgeCheck, divider: true, disabled: busy, onClick: () => startApproval.mutate(row) }] : []),
      ...(permissions.canRegenerate ? [{ key: 'regenerate', label: 'Regenerate', icon: RefreshCw, disabled: busy, onClick: () => regenerate.mutate(row) }] : []),
      ...(canAccess('procurement') ? [{ key: 'request', label: 'Open procurement request', icon: ClipboardList, divider: true, onClick: () => navigate(`/procurement/${row.procurementRequestId}`) }] : []),
      { key: 'copy', label: 'Copy recommendation ID', icon: Copy, divider: !canAccess('procurement'), onClick: () => copyNumber(row) },
    ];
  };

  const renderActions = (row) => (
    <div className="flex items-center justify-end gap-2" onClick={(event) => event.stopPropagation()}>
      <Link to={`/recommendations/${row.id}`} className={ICON_BUTTON} aria-label={`View details of ${row.recommendationNumber}`} title="View details">
        <Eye className="h-4 w-4" aria-hidden="true" />
      </Link>
      <ActionMenu items={menuItems(row)} label={`More actions for ${row.recommendationNumber}`} />
    </div>
  );

  const stageBadge = (row) => (
    <div className="flex flex-col items-start gap-1">
      <Dotted config={APPROVAL_STAGES[row.stage]} />
      {row.stage === 'DRAFT' && row.requiresReview && (
        <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-warning">
          <TriangleAlert className="h-3 w-3" aria-hidden="true" /> Needs review
        </span>
      )}
    </div>
  );

  const columns = [
    { key: 'request', header: 'Procurement Request', sortKey: 'request', className: 'min-w-44', render: (row) => <RequestCell row={row} requestTitle={requestTitle} /> },
    {
      key: 'vendor',
      header: 'Recommended Vendor',
      sortKey: 'vendor',
      render: (row) => (row.recommendedVendorId ? <span className="block max-w-36 truncate font-medium text-slate-800" title={vendorOf(row)}>{vendorOf(row)}</span> : <span className="text-slate-400">None</span>),
    },
    { key: 'type', header: 'Outcome', sortKey: 'type', render: (row) => <Outcome type={row.type} /> },
    { key: 'overallScore', header: 'Score', sortKey: 'overallScore', render: (row) => <Score value={row.overallScore} /> },
    { key: 'riskLevel', header: 'Risk', sortKey: 'riskLevel', render: (row) => <Dotted config={RISKS[row.riskLevel]} fallback={row.riskLevel} /> },
    { key: 'stage', header: 'Approval Status', sortKey: 'stage', render: stageBadge },
    { key: 'generatedAt', header: 'Generated', sortKey: 'generatedAt', render: (row) => <DateTime value={row.generatedAt} /> },
    { key: 'actions', header: 'Actions', headerClassName: 'text-right', render: (row) => renderActions(row) },
  ];

  const filteredView = Boolean(keyword || requestId || risk || range);
  const clearFilters = () => {
    setKeyword('');
    const next = new URLSearchParams();
    if (stage) next.set('status', stage);
    setSearchParams(next, { replace: true });
    pager.reset();
  };
  const canGenerate = can('recommendation.generate');
  const stageEmpty = {
    DRAFT: { icon: Lightbulb, title: 'No draft recommendations', detail: 'Every current recommendation has been submitted for approval.' },
    SUBMITTED: { icon: Clock, title: 'Nothing is waiting for approval', detail: 'Recommendations appear here after they are submitted for approval.' },
    APPROVED: { icon: BadgeCheck, title: 'No approved recommendations yet', detail: 'A recommendation shows here once its approval workflow is approved.' },
    REJECTED: { icon: CircleSlash, title: 'No rejected recommendations', detail: 'Rejected approval workflows are listed here.' },
  };
  const empty = filteredView
    ? {
        icon: Lightbulb,
        title: 'No recommendations match these filters',
        detail: 'Try a different search term or clear the filters.',
        action: (
          <Button variant="secondary" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        ),
      }
    : stage
      ? stageEmpty[stage] || { icon: Lightbulb, title: 'No recommendations in this status' }
      : {
          icon: Lightbulb,
          title: 'No recommendations yet',
          detail: 'Recommendations are generated from completed quotation comparisons.',
          action: canGenerate && (
            <Button size="sm" icon={Plus} onClick={() => setGenerateOpen(true)}>
              Generate recommendation
            </Button>
          ),
        };

  // "View comparison" in the header: the comparison behind the selected request's latest recommendation,
  // otherwise the comparison list.
  const focus = requestId ? all.filter((row) => row.procurementRequestId === requestId && row.comparisonId).sort((a, b) => String(b.generatedAt).localeCompare(String(a.generatedAt)))[0] : null;
  const comparisonTarget = focus ? `/comparison/${focus.comparisonId}` : '/comparison';

  const current = all.filter((row) => row.status !== 'SUPERSEDED');
  const tabs = [
    { value: '', label: 'All', count: query.data ? all.length : undefined },
    ...['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'].map((value) => ({ value, label: APPROVAL_STAGES[value].label, count: query.data ? stageCount(value) : undefined })),
    ...['CANCELLED', 'SUPERSEDED'].filter((value) => stageCount(value) || stage === value).map((value) => ({ value, label: APPROVAL_STAGES[value].label, count: stageCount(value) })),
  ];

  return (
    <>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <span className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 sm:flex">
            <Lightbulb className="h-7 w-7" strokeWidth={1.8} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Recommendations</h1>
            <p className="mt-1 text-sm text-slate-500">AI-assisted vendor recommendations generated from completed quotation comparisons.</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 self-start sm:self-auto">
          {canComparison && (
            <Button to={comparisonTarget} variant="secondary" icon={ExternalLink} size="lg" title={focus ? `Open comparison ${focus.comparisonNumber}` : 'Open the comparison list'}>
              View comparison
            </Button>
          )}
          {canGenerate && (
            <Button icon={Plus} size="lg" onClick={() => setGenerateOpen(true)}>
              Generate recommendation
            </Button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <section aria-label="Recommendation figures" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KpiCard
          icon={Layers}
          tone="brand"
          label="Total Recommendations"
          query={figure(all.length)}
          emptyText="—"
          caption={query.data && all.length - current.length ? `${formatNumber(all.length - current.length)} superseded` : undefined}
          onClick={() => setParam('status', '')}
          active={!stage}
        />
        <KpiCard icon={Trophy} tone="success" label="Best Value" query={figure(current.filter((row) => row.type === 'BEST_VALUE').length)} emptyText="—" caption={query.data ? 'Current recommendations' : undefined} />
        <KpiCard
          icon={Clock}
          tone="warning"
          label="Pending Approval"
          query={figure(stageCount('SUBMITTED'))}
          emptyText="—"
          onClick={() => setParam('status', stage === 'SUBMITTED' ? '' : 'SUBMITTED')}
          active={stage === 'SUBMITTED'}
        />
        <KpiCard
          icon={TriangleAlert}
          tone="danger"
          label="High Risk"
          query={figure(current.filter((row) => HIGH_RISK.includes(row.riskLevel)).length)}
          emptyText="—"
          caption={query.data ? 'High or critical risk' : undefined}
          onClick={() => setParam('risk', risk === 'HIGH' ? '' : 'HIGH')}
          active={risk === 'HIGH'}
        />
      </section>

      {/* Tabs, filters and table */}
      <section aria-label="Recommendations" className="card mt-5">
        <div className="overflow-x-auto px-4 pt-2 sm:px-5">
          <Tabs variant="pill" label="Filter by approval status" value={stage} onChange={(value) => setParam('status', value)} tabs={tabs} />
        </div>
        <div className="border-b border-line p-4 sm:px-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <SearchInput
              value={keyword}
              onChange={(value) => {
                setKeyword(value);
                pager.reset();
              }}
              placeholder="Search request, vendor or ID…"
              className="xl:min-w-40 xl:flex-1"
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:flex">
              <Select
                aria-label="Approval status"
                value={stage}
                onChange={(event) => setParam('status', event.target.value)}
                options={[{ value: '', label: 'All statuses' }, ...STAGE_ORDER.map((value) => ({ value, label: query.data ? `${APPROVAL_STAGES[value].label} (${stageCount(value)})` : APPROVAL_STAGES[value].label }))]}
                className="xl:w-40"
              />
              <div className="relative xl:w-44">
                <ClipboardList className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <Select
                  aria-label="Procurement request"
                  value={requestId}
                  onChange={(event) => setParam('request', event.target.value)}
                  options={[{ value: '', label: 'All requests' }, ...(requests.data || []).map((option) => ({ value: option.value, label: option.title }))]}
                  selectClassName="pl-9"
                />
              </div>
              <Select
                aria-label="Risk"
                value={risk}
                onChange={(event) => setParam('risk', event.target.value)}
                options={[
                  { value: '', label: 'All risks' },
                  { value: 'LOW', label: 'Low' },
                  { value: 'MEDIUM', label: 'Medium' },
                  { value: 'HIGH', label: 'High or critical' },
                  { value: 'CRITICAL', label: 'Critical only' },
                ]}
                className="xl:w-32"
              />
              <div className="relative xl:w-44">
                <CalendarDays className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <Select aria-label="Generated date range" value={range} onChange={(event) => setParam('generated', event.target.value)} options={DATE_RANGES} selectClassName="pl-9" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              {filteredView && (
                <Button variant="ghost" onClick={clearFilters}>
                  Clear
                </Button>
              )}
              <button
                type="button"
                className={ICON_BUTTON}
                onClick={() => {
                  query.refetch();
                  if (canAccess('approvals')) approvals.refetch();
                }}
                aria-label="Refresh"
                title="Refresh"
              >
                <RefreshCw className={cn('h-4 w-4', (query.isFetching || approvals.isFetching) && 'animate-spin')} aria-hidden="true" />
              </button>
              <Button variant="secondary" icon={Download} onClick={exportCsv} disabled={query.isLoading || Boolean(query.error)}>
                Export
              </Button>
            </div>
          </div>
          {range === 'custom' && (
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
              <Input label="Generated from" type="date" value={from} max={to || undefined} onChange={(event) => setParam('from', event.target.value)} className="sm:w-48" />
              <Input label="Generated to" type="date" value={to} min={from || undefined} onChange={(event) => setParam('to', event.target.value)} className="sm:w-48" />
            </div>
          )}
          {approvals.error && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
              <TriangleAlert className="h-3.5 w-3.5 text-warning" aria-hidden="true" />
              Approval outcomes could not be loaded; submitted recommendations show as “Submitted for approval”.
            </p>
          )}
        </div>

        {/* Desktop / tablet: table */}
        <div className="hidden md:block">
          <DataTable
            roomy
            caption="Recommendations"
            columns={columns}
            rows={pageRows}
            loading={query.isLoading}
            error={query.error}
            onRetry={query.refetch}
            onRowClick={(row) => navigate(`/recommendations/${row.id}`)}
            sort={{ sortBy: pager.sortBy, direction: pager.direction, onSort: pager.toggleSort }}
            empty={empty}
          />
        </div>

        {/* Mobile: cards */}
        <div className="md:hidden">
          {query.isLoading ? (
            <div className="divide-y divide-slate-100" aria-hidden="true">
              {[0, 1, 2].map((key) => (
                <div key={key} className="space-y-2 p-4">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          ) : query.error ? (
            <ErrorState error={query.error} onRetry={query.refetch} />
          ) : pageRows.length === 0 ? (
            <EmptyState showIcon icon={empty.icon} title={empty.title} description={empty.detail} action={empty.action} />
          ) : (
            <ul className="divide-y divide-slate-100">
              {pageRows.map((row) => (
                <li key={row.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <RequestCell row={row} requestTitle={requestTitle} />
                    {stageBadge(row)}
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-13">
                    <div className="col-span-2">
                      <dt className="text-xs text-slate-500">Recommended vendor</dt>
                      <dd className="truncate font-medium text-slate-800">{vendorOf(row) || 'None'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Outcome</dt>
                      <dd className="mt-0.5">
                        <Outcome type={row.type} />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Risk</dt>
                      <dd className="mt-0.5">
                        <Dotted config={RISKS[row.riskLevel]} fallback={row.riskLevel} />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Score</dt>
                      <dd className="mt-0.5">
                        <Score value={row.overallScore} />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Generated</dt>
                      <dd className="text-slate-800">{row.generatedAt ? formatDateTime(row.generatedAt) : '—'}</dd>
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
          noun={['recommendation', 'recommendations']}
        />
      </section>

      {submitTarget && (
        <SubmitForApprovalDialog
          key={submitTarget.id}
          open
          onClose={() => setSubmitTarget(null)}
          requiresReview={submitTarget.requiresReview}
          reviewReasons={submitTarget.reviewReasons}
          onSubmit={(payload) => submit.mutate({ row: submitTarget, payload })}
          loading={submit.isPending}
        />
      )}
      {generateOpen && <GenerateRecommendationDialog open onClose={() => setGenerateOpen(false)} />}
    </>
  );
}
