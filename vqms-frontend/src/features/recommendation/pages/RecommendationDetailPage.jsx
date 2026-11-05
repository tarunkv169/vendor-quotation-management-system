import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, BadgeCheck, Lightbulb, RefreshCw, Send } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useVendorNames } from '@/hooks/useVendorNames';
import { useRequestTitles } from '@/hooks/useLookups';
import SummaryPanel from '@/components/common/SummaryPanel';
import StepTimeline from '@/components/common/StepTimeline';
import { ScoreBar } from '@/components/common/ScoreBars';
import Button from '@/components/common/Button';
import DataTable from '@/components/common/DataTable';
import StatusBadge from '@/components/common/StatusBadge';
import Modal from '@/components/common/Modal';
import { Textarea } from '@/components/common/Input';
import Alert from '@/components/common/Alert';
import { DetailSkeleton } from '@/components/common/Skeleton';
import { ErrorState } from '@/components/common/EmptyState';
import { formatDate, formatDateTime } from '@/utils/formatDate';
import { formatCurrency, formatNumber } from '@/utils/formatCurrency';
import { humanize } from '@/utils/constants';
import { approvalKeys, approvalService } from '@/features/approval/approvalService';
import { recommendationKeys, recommendationService } from '../recommendationService';

function SubmitDialog({ open, onClose, requiresReview, reviewReasons, onSubmit, loading }) {
  const [comment, setComment] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Submit for approval"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={() => onSubmit({ comment: comment.trim() || undefined, reviewAcknowledged: acknowledged })} disabled={requiresReview && !acknowledged} loading={loading}>
            Submit
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {requiresReview && (
          <Alert tone="warning" title="This recommendation needs review">
            <ul className="list-disc pl-4">
              {(reviewReasons || []).map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </Alert>
        )}
        <Textarea label="Comment" maxLength={1000} value={comment} onChange={(event) => setComment(event.target.value)} />
        {requiresReview && (
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300" />I reviewed the flagged points and still want to submit.
          </label>
        )}
      </div>
    </Modal>
  );
}


function recommendationSteps(data) {
  const at = (value) => (value ? formatDate(value) : undefined);
  const superseded = data.status === 'SUPERSEDED';
  const submitted = data.status === 'SUBMITTED_FOR_APPROVAL' || Boolean(data.submittedAt);
  return [
    { key: 'generated', label: 'Generated', meta: at(data.generatedAt), state: 'done' },
    {
      key: 'review',
      label: data.requiresReview ? 'Review flagged' : 'Ready',
      meta: data.requiresReview ? `${data.reviewReasons?.length || 0} point(s)` : undefined,
      state: submitted ? 'done' : superseded ? 'upcoming' : 'current',
    },
    superseded
      ? { key: 'superseded', label: 'Superseded', state: 'rejected' }
      : { key: 'submitted', label: 'Submitted for approval', meta: at(data.submittedAt), state: submitted ? 'done' : 'upcoming' },
  ];
}

export default function RecommendationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const vendorName = useVendorNames();
  const requestTitle = useRequestTitles();
  const [submitOpen, setSubmitOpen] = useState(false);

  const recommendation = useQuery({ queryKey: recommendationKeys.one(id), queryFn: ({ signal }) => recommendationService.get(id, signal) });
  const ranking = useQuery({ queryKey: recommendationKeys.ranking(id), queryFn: ({ signal }) => recommendationService.ranking(id, signal) });
  const explanation = useQuery({ queryKey: recommendationKeys.explanation(id), queryFn: ({ signal }) => recommendationService.explanation(id, signal) });

  const regenerate = useMutation({
    mutationFn: () => recommendationService.regenerate(id),
    meta: { successMessage: 'Recommendation regenerated' },
    onSuccess: (next) => {
      queryClient.invalidateQueries({ queryKey: recommendationKeys.all });
      navigate(`/recommendations/${next.id}`);
    },
  });
  const submit = useMutation({
    mutationFn: (payload) => recommendationService.submitForApproval(id, payload),
    meta: { successMessage: 'Submitted for approval' },
    onSuccess: (data) => {
      setSubmitOpen(false);
      queryClient.setQueryData(recommendationKeys.one(id), data);
      queryClient.invalidateQueries({ queryKey: ['recommendations', 'list'] });
    },
  });
  const startApproval = useMutation({
    mutationFn: () => approvalService.create(id),
    meta: { successMessage: 'Approval workflow started' },
    onSuccess: (approval) => {
      queryClient.invalidateQueries({ queryKey: approvalKeys.all });
      navigate(`/approvals/${approval.id}`);
    },
  });

  if (recommendation.isLoading) return <DetailSkeleton />;
  if (recommendation.error) return <ErrorState error={recommendation.error} onRetry={recommendation.refetch} />;

  const data = recommendation.data;
  const rankingRows = [...(ranking.data || [])].sort((a, b) => (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER));
  const primary = rankingRows.find((row) => row.role === 'PRIMARY');
  const alternatives = rankingRows.filter((row) => row.role === 'ALTERNATIVE');
  const criteria = Object.keys(data.criteriaWeights || {});
  const submittable = ['GENERATED', 'NEEDS_REVIEW'].includes(data.status);
  const title = requestTitle(data.procurementRequestId);
  const vendorOfQuotation = new Map(rankingRows.map((row) => [row.quotationId, row.vendorId]));
  // "Strongest criteria": the recommended vendor's highest criterion scores as returned by the backend.
  const strengths = primary
    ? Object.entries(primary.criterionScores || {})
        .filter(([, score]) => score != null)
        .sort((a, b) => Number(b[1]) - Number(a[1]))
        .slice(0, 3)
    : [];

  return (
    <>
      <Link to="/recommendations" className="mb-4 inline-flex items-center gap-1.5 text-13 text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Recommendations
      </Link>

      <section className="card p-4 sm:p-5">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl font-semibold leading-tight tracking-[-0.01em]">
                  {data.recommendedVendorId ? vendorName(data.recommendedVendorId) : 'No vendor recommended'}
                </h1>
                <StatusBadge status={data.status} />
                <StatusBadge status={data.type} />
              </div>
              <p className="mt-1 text-13 text-slate-500">
                <span className="font-mono text-xs">{data.recommendationNumber}</span>
                {title && ` · ${title}`} · Generated {formatDate(data.generatedAt)}
                {data.policyCode && ` · Policy ${data.policyCode}`}
              </p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                {data.recommendedQuotationId && (
                  <Link to={`/quotations/${data.recommendedQuotationId}`} className="inline-flex items-center gap-1 text-13 font-medium text-brand-700 hover:text-brand-800">
                    Recommended quotation <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                )}
                <Link to={`/comparison/${data.comparisonId}`} className="inline-flex items-center gap-1 text-13 font-medium text-brand-700 hover:text-brand-800">
                  Comparison {data.comparisonNumber} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
          <div className="shrink-0 sm:text-right">
            <p className="num text-2xl font-semibold leading-none tracking-tight text-slate-900">
              {data.overallScore != null ? formatNumber(data.overallScore, 1) : '—'}
              <span className="ml-1 text-13 font-normal text-slate-400">/ 100</span>
            </p>
            <p className="mt-1.5 text-13 text-slate-500">Overall score</p>
            <div className="mt-1.5 flex sm:justify-end">
              <StatusBadge status={data.riskLevel} label={`${humanize(data.riskLevel)} risk`} />
            </div>
          </div>
        </div>

        <StepTimeline className="mt-5" steps={recommendationSteps(data)} label="Recommendation progress" />

        {data.status === 'SUPERSEDED' && (
          <Alert tone="info" className="mt-4">
            A newer recommendation replaced this one.
          </Alert>
        )}
        {data.requiresReview && (
          <Alert tone="warning" title="Review required before approval" className="mt-4">
            <ul className="list-disc pl-4">
              {(data.reviewReasons || []).map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </Alert>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <div className="flex flex-wrap items-center gap-2">
            {can('recommendation.generate') && data.status !== 'SUPERSEDED' && (
              <Button variant="secondary" icon={RefreshCw} onClick={() => regenerate.mutate()} loading={regenerate.isPending}>
                Regenerate
              </Button>
            )}
            {can('recommendation.submit') && submittable && data.recommendedQuotationId && (
              <Button icon={Send} onClick={() => setSubmitOpen(true)}>
                Submit for approval
              </Button>
            )}
            {can('approval.create') && data.status === 'SUBMITTED_FOR_APPROVAL' && (
              <Button icon={BadgeCheck} onClick={() => startApproval.mutate()} loading={startApproval.isPending}>
                Start approval
              </Button>
            )}
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <SummaryPanel title="Why this vendor" className="lg:col-span-2" loading={ranking.isLoading} error={ranking.error} onRetry={ranking.refetch}>
          {primary ? (
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-slate-500">Strongest criteria</p>
                <div className="mt-2.5 space-y-2.5">
                  {strengths.length ? strengths.map(([criterion, score]) => <ScoreBar key={criterion} label={humanize(criterion)} value={score} emphasis />) : <p className="text-13 text-slate-500">No criterion scores.</p>}
                </div>
                <dl className="mt-4 space-y-1.5 border-t border-line pt-3 text-13">
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Quoted total</dt>
                    <dd className="num font-medium text-slate-900">{formatCurrency(primary.totalAmount, data.currencyCode)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Eligibility</dt>
                    <dd className={primary.eligible ? 'text-success' : 'text-danger'}>{primary.eligible ? 'Eligible' : 'Not eligible'}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Rank</dt>
                    <dd className="num text-slate-900">#{primary.rank ?? '—'}</dd>
                  </div>
                </dl>
                {primary.eligibilityReasons?.length > 0 && <p className="mt-2 text-xs text-slate-500">{primary.eligibilityReasons.join('; ')}</p>}
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">Risks</p>
                {primary.riskFactors?.length ? (
                  <ul className="mt-2.5 space-y-2">
                    {primary.riskFactors.map((risk) => (
                      <li key={`${risk.category}-${risk.description}`} className="rounded-lg border border-line px-3 py-2">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={risk.level} />
                          <span className="text-xs text-slate-500">{humanize(risk.category)}</span>
                        </div>
                        <p className="mt-1 text-13 text-slate-700">{risk.description}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2.5 text-13 text-slate-500">No specific risks were reported for this vendor.</p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-13 text-slate-500">No vendor qualified ({humanize(data.type)}).</p>
          )}
        </SummaryPanel>

        <SummaryPanel title="Scoring basis" footer={data.submittedAt ? `Submitted ${formatDateTime(data.submittedAt)}` : undefined}>
          {criteria.length ? (
            <ul className="space-y-2">
              {criteria.map((criterion) => (
                <li key={criterion} className="flex items-baseline justify-between gap-3 text-13">
                  <span className="text-slate-600">{humanize(criterion)}</span>
                  <span className="num font-medium text-slate-900">{formatNumber(data.criteriaWeights[criterion], 0)}%</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-13 text-slate-500">No weights recorded.</p>
          )}
          {data.excludedCriteria?.length > 0 && <p className="mt-3 text-xs text-slate-500">Excluded for lack of data: {data.excludedCriteria.map(humanize).join(', ')}</p>}
        </SummaryPanel>
      </div>

      <SummaryPanel className="mt-4" title="Explanation" loading={explanation.isLoading} error={explanation.error} onRetry={explanation.refetch}>
        {explanation.data && (
          <div className="space-y-4">
            <p className="max-w-4xl whitespace-pre-line text-sm leading-relaxed text-slate-700">{explanation.data.summary}</p>
            {(explanation.data.items || []).length > 0 && (
              <ol className="grid gap-3 md:grid-cols-2">
                {explanation.data.items.map((item) => (
                  <li key={item.quotationId} className="rounded-lg border border-line p-3">
                    <div className="flex items-center gap-2">
                      <span className="num flex h-6 w-6 items-center justify-center rounded-full border border-line-strong text-xs font-semibold text-slate-700">{item.rank ?? '–'}</span>
                      <Link className="truncate text-13 font-medium text-slate-900 hover:text-brand-700" to={`/quotations/${item.quotationId}`}>
                        {vendorOfQuotation.has(item.quotationId) ? vendorName(vendorOfQuotation.get(item.quotationId)) : 'Quotation'}
                      </Link>
                    </div>
                    <p className="mt-1.5 text-13 leading-relaxed text-slate-600">{item.explanation}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </SummaryPanel>

      {alternatives.length > 0 && (
        <SummaryPanel className="mt-4" title={`Alternatives (${alternatives.length})`} bodyClassName="p-0">
          <ul className="divide-y divide-slate-100">
            {alternatives.map((row) => (
              <li key={row.quotationId}>
                <Link to={`/quotations/${row.quotationId}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-slate-50">
                  <span className="num flex h-7 w-7 items-center justify-center rounded-full border border-line-strong text-xs font-semibold text-slate-700">{row.rank ?? '–'}</span>
                  <span className="min-w-40 flex-1 font-medium text-slate-900">{vendorName(row.vendorId)}</span>
                  <StatusBadge status={row.riskLevel} label={`${humanize(row.riskLevel)} risk`} />
                  <span className="num w-20 text-right text-13 text-slate-600">{formatNumber(row.overallScore, 1)} / 100</span>
                  <span className="num w-32 text-right text-13 font-medium text-slate-900">{formatCurrency(row.totalAmount, data.currencyCode)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </SummaryPanel>
      )}

      <SummaryPanel className="mt-4" title="Full ranking" bodyClassName="overflow-hidden p-0">
        <DataTable
          dense
          caption="Full vendor ranking"
          rowKey="quotationId"
          loading={ranking.isLoading}
          error={ranking.error}
          onRetry={ranking.refetch}
          columns={[
            { key: 'rank', header: 'Rank', align: 'right', render: (row) => row.rank ?? '—' },
            { key: 'vendor', header: 'Vendor', className: 'min-w-40', render: (row) => <span className="font-medium text-slate-900">{vendorName(row.vendorId)}</span> },
            { key: 'role', header: 'Role', render: (row) => (row.role ? <StatusBadge status={row.role} /> : '—') },
            {
              key: 'eligible',
              header: 'Eligibility',
              render: (row) => (row.eligible ? <span className="text-success">Eligible</span> : <span className="text-danger">{row.eligibilityReasons?.join('; ') || 'Not eligible'}</span>),
            },
            { key: 'totalAmount', header: 'Total', align: 'right', className: 'whitespace-nowrap', render: (row) => formatCurrency(row.totalAmount, data.currencyCode) },
            ...criteria.map((criterion) => ({ key: criterion, header: humanize(criterion), align: 'right', render: (row) => formatNumber(row.criterionScores?.[criterion], 1) })),
            { key: 'overallScore', header: 'Overall', align: 'right', render: (row) => <span className="font-semibold text-slate-900">{formatNumber(row.overallScore, 1)}</span> },
            { key: 'riskLevel', header: 'Risk', render: (row) => <StatusBadge status={row.riskLevel} /> },
          ]}
          rows={rankingRows}
          empty={{ title: 'No vendors ranked' }}
        />
      </SummaryPanel>

      <SubmitDialog
        open={submitOpen}
        onClose={() => setSubmitOpen(false)}
        requiresReview={data.requiresReview}
        reviewReasons={data.reviewReasons}
        onSubmit={(payload) => submit.mutate(payload)}
        loading={submit.isPending}
      />
    </>
  );
}
