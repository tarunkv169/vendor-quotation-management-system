import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Button from '@/components/common/Button';
import Modal from '@/components/common/Modal';
import Select from '@/components/common/Select';
import Skeleton from '@/components/common/Skeleton';
import { ErrorState } from '@/components/common/EmptyState';
import { useRequestTitles } from '@/hooks/useLookups';
import { normalizePage } from '@/utils/pagination';
import { formatDateTime } from '@/utils/formatDate';
import { comparisonKeys, comparisonService } from '@/features/comparison/comparisonService';
import { recommendationKeys, recommendationService } from '../recommendationService';

/**
 * Generates a recommendation with the existing POST /recommendations { comparisonId }.
 * The backend only accepts COMPLETED comparisons, so only those are offered.
 */
export default function GenerateRecommendationDialog({ open, onClose }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const requestTitle = useRequestTitles();
  const [comparisonId, setComparisonId] = useState('');

  const params = { status: 'COMPLETED', page: 0, size: 100, sortBy: 'createdAt', direction: 'desc' };
  const comparisons = useQuery({
    queryKey: comparisonKeys.list(params),
    queryFn: ({ signal }) => comparisonService.search(params, signal),
    enabled: open,
  });
  const options = normalizePage(comparisons.data).items.map((row) => ({
    value: row.id,
    label: `${row.comparisonNumber} · ${requestTitle(row.procurementRequestId) || 'request not visible'} · ${row.eligibleCount} eligible`,
    row,
  }));
  const selected = options.find((option) => option.value === comparisonId)?.row;

  const generate = useMutation({
    mutationFn: () => recommendationService.generate({ comparisonId }),
    meta: { successMessage: 'Recommendation generated' },
    onSuccess: (recommendation) => {
      queryClient.invalidateQueries({ queryKey: recommendationKeys.all });
      onClose();
      navigate(`/recommendations/${recommendation.id}`);
    },
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Generate recommendation"
      description="Pick a completed comparison. The recommendation is calculated from its scores and the active policy."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={generate.isPending}>
            Cancel
          </Button>
          <Button onClick={() => generate.mutate()} disabled={!comparisonId} loading={generate.isPending}>
            Generate
          </Button>
        </>
      }
    >
      {comparisons.isLoading ? (
        <div className="space-y-2" aria-hidden="true">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-9 w-full" />
        </div>
      ) : comparisons.error ? (
        <ErrorState error={comparisons.error} onRetry={comparisons.refetch} />
      ) : options.length === 0 ? (
        <div className="space-y-2 text-sm text-slate-600">
          <p>There are no completed comparisons yet.</p>
          <p>
            Complete a comparison on the{' '}
            <Link to="/comparison" onClick={onClose} className="font-medium text-brand-700 hover:underline">
              Comparisons
            </Link>{' '}
            page first.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <Select label="Completed comparison" required value={comparisonId} onChange={(event) => setComparisonId(event.target.value)} placeholder="Select a comparison" options={options} />
          {selected && (
            <p className="text-xs text-slate-500">
              Completed {formatDateTime(selected.completedAt || selected.calculatedAt)} · {selected.currencyCode}
              {selected.requiresReview ? ' · flagged for review' : ''}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
