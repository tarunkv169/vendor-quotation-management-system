import { humanize } from '@/utils/constants';
import { cn } from '@/utils/cn';

/**
 * Weight editor for comparison / recommendation criteria.
 * value: { [criterion]: { enabled, weight, minimumScore? } }. The backend requires enabled weights to total 100.
 */
export default function CriteriaWeights({ criteria, value, onChange, showMinimum = false, error }) {
  const total = criteria.reduce((sum, criterion) => sum + (value[criterion]?.enabled ? Number(value[criterion].weight) || 0 : 0), 0);
  const update = (criterion, patch) => onChange({ ...value, [criterion]: { ...value[criterion], ...patch } });

  return (
    <fieldset>
      <legend className="sr-only">Criteria weights</legend>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="py-2 pr-4">Criterion</th>
              <th className="py-2 pr-4">Weight (%)</th>
              {showMinimum && <th className="py-2">Minimum score</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {criteria.map((criterion) => {
              const row = value[criterion] || {};
              return (
                <tr key={criterion}>
                  <td className="py-2 pr-4">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={Boolean(row.enabled)}
                        onChange={(event) => update(criterion, { enabled: event.target.checked })}
                        className="h-4 w-4 rounded border-slate-300 text-brand-600"
                      />
                      {humanize(criterion)}
                    </label>
                  </td>
                  <td className="py-2 pr-4">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      aria-label={`${humanize(criterion)} weight`}
                      disabled={!row.enabled}
                      value={row.weight ?? ''}
                      onChange={(event) => update(criterion, { weight: event.target.value })}
                      className="input-base w-28"
                    />
                  </td>
                  {showMinimum && (
                    <td className="py-2">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        aria-label={`${humanize(criterion)} minimum score`}
                        disabled={!row.enabled}
                        value={row.minimumScore ?? ''}
                        placeholder="—"
                        onChange={(event) => update(criterion, { minimumScore: event.target.value })}
                        className="input-base w-28"
                      />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className={cn('mt-3 text-sm', Math.abs(total - 100) < 0.001 ? 'text-slate-500' : 'font-medium text-red-600')}>
        Total weight: {Number(total.toFixed(2))}% {Math.abs(total - 100) >= 0.001 && '— must equal 100%'}
      </p>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </fieldset>
  );
}

export function criteriaTotal(value) {
  return Object.values(value).reduce((sum, row) => sum + (row.enabled ? Number(row.weight) || 0 : 0), 0);
}
