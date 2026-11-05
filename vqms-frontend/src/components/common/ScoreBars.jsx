import { cn } from '@/utils/cn';
import { formatNumber } from '@/utils/formatCurrency';
import { humanize } from '@/utils/constants';

/** One 0–100 score with a thin bar. Scores are shown exactly as the backend returns them. */
export function ScoreBar({ label, value, emphasis = false }) {
  const known = value !== null && value !== undefined;
  const width = known ? Math.max(0, Math.min(100, Number(value))) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-13">
        <span className="truncate text-slate-600">{label}</span>
        <span className={cn('num shrink-0', known ? 'font-medium text-slate-900' : 'text-slate-400')}>{known ? formatNumber(value, 1) : 'No data'}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className={cn('h-full rounded-full', emphasis ? 'bg-brand-600' : 'bg-slate-500')} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

/** Per-criterion scores, in the order of the configured weights. */
export function CriterionScores({ criteria, scores, missing = [] }) {
  if (!criteria.length) return null;
  return (
    <div className="space-y-2.5">
      {criteria.map((criterion) => (
        <ScoreBar key={criterion} label={humanize(criterion)} value={missing.includes(criterion) ? null : scores?.[criterion]} />
      ))}
    </div>
  );
}

/** Large overall score out of 100. */
export function OverallScore({ value, label = 'Overall score' }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="num mt-0.5 text-2xl font-semibold leading-none tracking-tight text-slate-900">
        {value != null ? formatNumber(value, 1) : '—'}
        <span className="ml-1 text-13 font-normal text-slate-400">/ 100</span>
      </p>
    </div>
  );
}
