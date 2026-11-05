import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRequestOptions } from '@/hooks/useLookups';
import PageHeader from '@/components/common/PageHeader';
import Button from '@/components/common/Button';
import SummaryPanel from '@/components/common/SummaryPanel';
import Select from '@/components/common/Select';
import EntitySelect, { isUuid } from '@/components/common/EntitySelect';
import Alert from '@/components/common/Alert';
import CriteriaWeights, { criteriaTotal } from '@/components/common/CriteriaWeights';
import { COMPARISON_CRITERIA, CURRENCIES } from '@/utils/constants';
import { comparisonKeys, comparisonService } from '../comparisonService';

const initialCriteria = Object.fromEntries(COMPARISON_CRITERIA.map((criterion) => [criterion, { enabled: criterion === 'PRICE', weight: criterion === 'PRICE' ? '100' : '', minimumScore: '' }]));

export default function ComparisonCreatePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const requests = useRequestOptions();
  const [procurementRequestId, setProcurementRequestId] = useState(searchParams.get('procurementRequestId') || '');
  const [currencyCode, setCurrencyCode] = useState('');
  const [requireAllItems, setRequireAllItems] = useState(false);
  const [criteria, setCriteria] = useState(initialCriteria);
  const [error, setError] = useState(null);

  const enabled = COMPARISON_CRITERIA.filter((criterion) => criteria[criterion].enabled);
  const totalOk = Math.abs(criteriaTotal(criteria) - 100) < 0.001;
  const ready = isUuid(procurementRequestId) && enabled.length > 0 && totalOk;

  const create = useMutation({
    mutationFn: async () => {
      const comparison = await comparisonService.create({
        procurementRequestId,
        currencyCode: currencyCode || undefined,
        requireAllItems,
        criteria: enabled.map((criterion) => ({
          criterion,
          weight: Number(criteria[criterion].weight),
          minimumScore: criteria[criterion].minimumScore === '' ? undefined : Number(criteria[criterion].minimumScore),
        })),
      });
      // Calculate straight away so the user lands on results (calculation is done by the backend).
      try {
        await comparisonService.calculate(comparison.id);
      } catch {
        // The comparison exists; calculation can be retried from its page.
      }
      return comparison;
    },
    meta: { silent: true, successMessage: 'Comparison created' },
    onSuccess: (comparison) => {
      queryClient.invalidateQueries({ queryKey: comparisonKeys.all });
      navigate(`/comparison/${comparison.id}`, { replace: true });
    },
    onError: (err) => setError(Object.keys(err.fieldErrors || {}).length ? Object.values(err.fieldErrors).join(' ') : err.message),
  });

  return (
    <>
      <PageHeader title="New comparison" description="Choose the procurement request and how quotations should be weighted. Scores and ranking are calculated by the Comparison Service." />
      <div className="max-w-3xl space-y-6">
        {error && <Alert tone="error">{error}</Alert>}
        <SummaryPanel title="Scope">
          <div className="grid gap-4 sm:grid-cols-2">
            <EntitySelect
              label="Procurement request"
              required
              options={requests.data}
              loading={requests.isLoading}
              value={procurementRequestId}
              onChange={(event) => setProcurementRequestId(event.target.value)}
              className="sm:col-span-2"
            />
            <Select
              label="Comparison currency"
              value={currencyCode}
              onChange={(event) => setCurrencyCode(event.target.value)}
              placeholder="Quotation currency"
              options={CURRENCIES.map((code) => ({ value: code, label: code }))}
            />
            <label className="mt-6 inline-flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={requireAllItems} onChange={(event) => setRequireAllItems(event.target.checked)} className="h-4 w-4 rounded border-slate-300" />
              Only quotations covering all requested items are eligible
            </label>
          </div>
        </SummaryPanel>
        <SummaryPanel title="Criteria">
          <CriteriaWeights criteria={COMPARISON_CRITERIA} value={criteria} onChange={setCriteria} showMinimum />
        </SummaryPanel>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => navigate(-1)} disabled={create.isPending}>
            Cancel
          </Button>
          <Button onClick={() => create.mutate()} disabled={!ready} loading={create.isPending}>
            Create and calculate
          </Button>
        </div>
      </div>
    </>
  );
}
