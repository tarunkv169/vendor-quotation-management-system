import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Calculator, Check, Lightbulb, Scale } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useVendorNames } from '@/hooks/useVendorNames';
import { useRequestTitles } from '@/hooks/useLookups';
import Button from '@/components/common/Button';
import DataTable from '@/components/common/DataTable';
import StatusBadge from '@/components/common/StatusBadge';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import Alert from '@/components/common/Alert';
import SummaryPanel from '@/components/common/SummaryPanel';
import StepTimeline from '@/components/common/StepTimeline';
import EmptyState from '@/components/common/EmptyState';
import { CriterionScores, OverallScore } from '@/components/common/ScoreBars';
import { DetailSkeleton } from '@/components/common/Skeleton';
import { ErrorState } from '@/components/common/EmptyState';
import { cn } from '@/utils/cn';
import { formatDate, formatDateTime } from '@/utils/formatDate';
import { formatCurrency, formatNumber, formatPercent } from '@/utils/formatCurrency';
import { humanize } from '@/utils/constants';
import { recommendationService } from '@/features/recommendation/recommendationService';
import { comparisonKeys, comparisonService } from '../comparisonService';
import { comparisonPermissions } from '../comparisonActions';

// Neutral, distinguishable tones for criteria weights (no status meaning).


function comparisonSteps(data) {
  const at = (value) => (value ? formatDate(value) : undefined);
  const failed = data.status === 'FAILED';
  return [
    { key: 'created', label: 'Created', meta: at(data.createdAt), state: 'done' },
    {
      key: 'calculated',
      label: 'Calculated',
      meta: failed ? 'Failed' : at(data.calculatedAt) || (data.status === 'CREATED' ? 'Next' : undefined),
      state: failed ? 'rejected' : ['CALCULATED', 'COMPLETED'].includes(data.status) ? 'done' : 'current',
    },
    {
      key: 'completed',
      label: 'Completed',
      meta: at(data.completedAt) || (data.status === 'CALCULATED' ? 'Next' : undefined),
      state: data.status === 'COMPLETED' ? 'done' : data.status === 'CALCULATED' ? 'current' : 'upcoming',
    },
  ];
}

function Money({ label, value, currency, strong = false, negative = false }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-13">
      <dt className={strong ? 'font-medium text-slate-900' : 'text-slate-500'}>{label}</dt>
      <dd className={cn('num', strong ? 'text-base font-semibold text-slate-900' : 'text-slate-800')}>
        {negative && value ? `− ${formatCurrency(value, currency)}` : formatCurrency(value, currency)}
      </dd>
    </div>
  );
}

/** One vendor's result. Ranking and scores come from the Comparison Service; the card only presents them. */
function VendorResultCard({ row, criteria, currency, vendorName }) {
  const ineligible = row.resultType === 'INELIGIBLE';
  const topRanked = row.rank === 1 && !ineligible;
  const code = row.currencyCode || currency;
  return (
    <article className={cn('card flex flex-col p-5', topRanked && 'border-brand-200 ring-1 ring-brand-200', ineligible && 'bg-slate-50/60')}>
      <header className="flex items-start gap-3">
        <span
          className={cn(
            'num flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-13 font-semibold',
            topRanked ? 'border-brand-600 bg-brand-600 text-white' : 'border-line-strong bg-surface text-slate-700',
          )}
          aria-label={row.rank ? `Rank ${row.rank}` : 'Not ranked'}
        >
          {row.rank ?? '–'}
        </span>
        <div className="min-w-0 flex-1">
          <Link to={`/quotations/${row.quotationId}`} className="block truncate text-[15px] font-semibold text-slate-900 hover:text-brand-700">
            {vendorName(row.vendorId)}
          </Link>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <StatusBadge status={row.resultType} />
            {topRanked && <StatusBadge status="RANKED" tone="brand" label="Highest ranked" />}
            {row.lowestPrice && <StatusBadge status="LOWEST" tone="gray" label="Lowest price" />}
          </div>
        </div>
      </header>

      <div className="mt-4 flex items-end justify-between gap-4">
        <OverallScore value={row.overallScore} />
        <div className="text-right">
          <p className="text-xs text-slate-500">Quoted total</p>
          <p className="num mt-0.5 text-lg font-semibold text-slate-900">{formatCurrency(row.totalAmount, code)}</p>
        </div>
      </div>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
        <div className={cn('h-full rounded-full', topRanked ? 'bg-brand-600' : 'bg-slate-500')} style={{ width: `${Math.max(0, Math.min(100, Number(row.overallScore) || 0))}%` }} />
      </div>

      <dl className="mt-4 space-y-1.5 border-t border-line pt-3">
        <Money label="Subtotal" value={row.subtotal} currency={code} />
        <Money label="Discount" value={row.discountAmount} currency={code} negative />
        <Money label="Tax" value={row.taxAmount} currency={code} />
        <div className="flex items-baseline justify-between gap-3 text-13">
          <dt className="text-slate-500">Versus lowest</dt>
          <dd className="num text-slate-800">{row.lowestPrice ? 'Lowest' : row.differencePercent != null ? `+${formatPercent(row.differencePercent)}` : '—'}</dd>
        </div>
      </dl>

      <dl className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-canvas p-3 text-center">
        <div>
          <dt className="text-2xs text-slate-500">Delivery</dt>
          <dd className="num mt-0.5 text-13 font-medium text-slate-900">{row.maxDeliveryDays != null ? `${row.maxDeliveryDays} d` : '—'}</dd>
        </div>
        <div>
          <dt className="text-2xs text-slate-500">Warranty</dt>
          <dd className="num mt-0.5 text-13 font-medium text-slate-900">{row.minWarrantyMonths != null ? `${row.minWarrantyMonths} mo` : '—'}</dd>
        </div>
        <div>
          <dt className="text-2xs text-slate-500">Item coverage</dt>
          <dd className="num mt-0.5 text-13 font-medium text-slate-900">{formatPercent(row.itemCoveragePercent, 0)}</dd>
        </div>
      </dl>

      {criteria.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-slate-500">Criterion scores</p>
          <CriterionScores criteria={criteria} scores={row.criterionScores} missing={row.missingCriteria || []} />
        </div>
      )}

      {row.eligibilityReasons?.length > 0 && (
        <div className={cn('mt-4 rounded-lg px-3 py-2 text-xs', ineligible ? 'bg-red-50 text-red-800' : 'bg-slate-50 text-slate-600')}>
          <p className="font-medium">{ineligible ? 'Not eligible' : 'Notes'}</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {row.eligibilityReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

export default function ComparisonDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const vendorName = useVendorNames();
  const requestTitle = useRequestTitles();
  const [confirm, setConfirm] = useState(null); // 'complete'

  const comparison = useQuery({ queryKey: comparisonKeys.one(id), queryFn: ({ signal }) => comparisonService.get(id, signal) });
  const status = comparison.data?.status;
  const results = useQuery({
    queryKey: comparisonKeys.results(id),
    queryFn: ({ signal }) => comparisonService.results(id, signal),
    enabled: status === 'CALCULATED' || status === 'COMPLETED',
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: comparisonKeys.one(id) });
    queryClient.invalidateQueries({ queryKey: comparisonKeys.results(id) });
    queryClient.invalidateQueries({ queryKey: ['comparisons', 'list'] });
  };
  const calculate = useMutation({ mutationFn: () => comparisonService.calculate(id), meta: { successMessage: 'Comparison calculated' }, onSuccess: invalidate });
  const complete = useMutation({
    mutationFn: () => comparisonService.complete(id),
    meta: { successMessage: 'Comparison completed' },
    onSuccess: () => {
      setConfirm(null);
      invalidate();
    },
  });
  const recommend = useMutation({
    mutationFn: () => recommendationService.generate({ comparisonId: id }),
    meta: { successMessage: 'Recommendation generated' },
    onSuccess: (recommendation) => navigate(`/recommendations/${recommendation.id}`),
  });

  if (comparison.isLoading) return <DetailSkeleton />;
  if (comparison.error) return <ErrorState error={comparison.error} onRetry={comparison.refetch} />;

  const data = comparison.data;
  const permissions = comparisonPermissions(data, can);
  // Ranked first (by backend rank), unranked/ineligible last.
  const rows = [...(results.data?.results || [])].sort((a, b) => (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER));
  const lines = results.data?.lineComparisons || [];
  const criteria = Object.keys(data.criteriaWeights || {});
  const currency = data.currencyCode;
  const weightTotal = criteria.reduce((sum, key) => sum + (Number(data.criteriaWeights[key]) || 0), 0);
  const weightShare = (key) => (weightTotal ? Math.round(((Number(data.criteriaWeights[key]) || 0) / weightTotal) * 100) : 0);
  const title = requestTitle(data.procurementRequestId);

  return (
    <>
      <Link to="/comparison" className="mb-4 inline-flex items-center gap-1.5 text-13 text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Comparisons
      </Link>

      <section className="card p-4 sm:p-5">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl font-semibold leading-tight tracking-[-0.01em]">{title || data.comparisonNumber}</h1>
                <StatusBadge status={data.status} />
                {data.requiresReview && <StatusBadge status="NEEDS_REVIEW" />}
                {data.stale && <StatusBadge status="STALE" tone="amber" label="Out of date" />}
              </div>
              <p className="mt-1 text-13 text-slate-500">
                {title && (
                  <>
                    <span className="font-mono text-xs">{data.comparisonNumber}</span> ·{' '}
                  </>
                )}
                Created {formatDate(data.createdAt)}
                {currency && ` · ${currency}`}
              </p>
              <Link to={`/procurement/${data.procurementRequestId}`} className="mt-2 inline-flex items-center gap-1 text-13 font-medium text-brand-700 hover:text-brand-800">
                View procurement request <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          </div>
          <div className="shrink-0 sm:text-right">
            <p className="num text-2xl font-semibold leading-none tracking-tight text-slate-900">{formatNumber(data.eligibleCount ?? 0)}</p>
            <p className="mt-1.5 text-13 text-slate-500">Eligible quotations</p>
            <p className="mt-1 text-xs text-slate-500">{data.requireAllItems ? 'All requested items must be quoted' : 'Partial quotations allowed'}</p>
          </div>
        </div>

        <StepTimeline className="mt-5" steps={comparisonSteps(data)} label="Comparison progress" />

        {data.failureReason && (
          <Alert tone="error" title="Calculation failed" className="mt-4">
            {data.failureReason}
          </Alert>
        )}
        {data.stale && (
          <Alert tone="warning" title="Results are out of date" className="mt-4">
            A quotation changed after the last calculation. Recalculate to refresh the ranking.
          </Alert>
        )}
        {data.requiresReview && (
          <Alert tone="warning" className="mt-4">
            The Comparison Service flagged these results for manual review.
          </Alert>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <div className="flex flex-wrap items-center gap-2">
            {permissions.canCalculate && (
              <Button variant={data.status === 'CREATED' || data.stale ? 'primary' : 'secondary'} icon={Calculator} onClick={() => calculate.mutate()} loading={calculate.isPending}>
                {permissions.calculateLabel}
              </Button>
            )}
            {permissions.canComplete && (
              <Button variant="success" icon={Check} onClick={() => setConfirm('complete')}>
                Complete
              </Button>
            )}
            {permissions.canRecommend && (
              <Button icon={Lightbulb} onClick={() => recommend.mutate()} loading={recommend.isPending}>
                Generate recommendation
              </Button>
            )}
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <SummaryPanel title="Scoring weights" className="lg:col-span-2">
          {criteria.length ? (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-13 sm:grid-cols-3">
              {criteria.map((criterion) => (
                <div key={criterion} className="flex justify-between gap-3 border-b border-slate-100 pb-1.5">
                  <dt className="text-slate-600">{humanize(criterion)}</dt>
                  <dd className="num font-medium text-slate-900">{weightShare(criterion)}%</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-13 text-slate-500">No weights configured.</p>
          )}
          {data.excludedCriteria?.length > 0 && (
            <p className="mt-3 text-xs text-slate-500">Excluded for lack of data: {data.excludedCriteria.map(humanize).join(', ')}</p>
          )}
        </SummaryPanel>
        <SummaryPanel title="Timeline">
          <dl className="space-y-2.5 text-13">
            {[
              ['Created', data.createdAt],
              ['Calculated', data.calculatedAt],
              ['Completed', data.completedAt],
            ].map(([label, date]) => (
              <div key={label} className="flex justify-between gap-4">
                <dt className="text-slate-500">{label}</dt>
                <dd className="text-slate-900">{date ? formatDateTime(date) : '—'}</dd>
              </div>
            ))}
          </dl>
        </SummaryPanel>
      </div>

      {data.status === 'CREATED' ? (
        <div className="card mt-4">
          <EmptyState icon={Calculator} title="Not calculated yet" description="Calculate the comparison to see each vendor's score, ranking and item-wise prices." />
        </div>
      ) : results.isLoading ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1].map((key) => (
            <div key={key} className="card h-96 animate-pulse bg-slate-50" />
          ))}
        </div>
      ) : results.error ? (
        <div className="card mt-4">
          <ErrorState error={results.error} onRetry={results.refetch} />
        </div>
      ) : (
        <>
          <div className="mt-8 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <h2 className="text-[17px] font-semibold">Vendors side by side</h2>
            <p className="text-xs text-slate-500">Ordered by the backend ranking. The lowest price is one criterion, not the deciding factor.</p>
          </div>
          {rows.length ? (
            <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {rows.map((row) => (
                <VendorResultCard key={row.quotationId} row={row} criteria={criteria} currency={currency} vendorName={vendorName} />
              ))}
            </div>
          ) : (
            <div className="card mt-3">
              <EmptyState title="No quotations to compare" />
            </div>
          )}

          <SummaryPanel
            className="mt-6"
            title="Item-wise unit prices"
            bodyClassName="overflow-hidden p-0"
          >
            <DataTable
              dense
              caption="Item-wise unit prices"
              rowKey={(row, index) => row.procurementItemId || index}
              columns={[
                {
                  key: 'description',
                  header: 'Item',
                  className: 'min-w-48',
                  render: (row) => (
                    <div>
                      <p className="font-medium text-slate-900">{row.description}</p>
                      <p className="text-xs text-slate-500">
                        {formatNumber(row.requestedQuantity)} {row.requestedUnit}
                      </p>
                    </div>
                  ),
                },
                ...rows.map((vendorRow) => ({
                  key: vendorRow.quotationId,
                  header: vendorName(vendorRow.vendorId),
                  align: 'right',
                  className: 'whitespace-nowrap',
                  render: (line) => {
                    const quote = (line.quotes || []).find((entry) => entry.quotationId === vendorRow.quotationId);
                    if (!quote) return <span className="text-slate-400">Not quoted</span>;
                    const lowest = quote.quotationId === line.lowestQuotationId;
                    return (
                      <span className={cn(!quote.comparable && 'text-slate-400', lowest && 'font-semibold text-success')}>
                        {formatCurrency(quote.unitPrice, currency)}
                        {!quote.comparable && ' n/c'}
                        {lowest && <span className="ml-1.5 rounded bg-green-50 px-1 text-2xs font-medium">Lowest</span>}
                      </span>
                    );
                  },
                })),
              ]}
              rows={lines}
              empty={{ title: 'No item-level data' }}
            />
          </SummaryPanel>
        </>
      )}

      <ConfirmDialog
        open={confirm === 'complete'}
        onClose={() => setConfirm(null)}
        onConfirm={() => complete.mutate()}
        loading={complete.isPending}
        title="Complete comparison"
        message="Lock this comparison? It can then be used for the final recommendation."
        confirmLabel="Complete"
      />
    </>
  );
}
