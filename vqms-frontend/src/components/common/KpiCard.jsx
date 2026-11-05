import { cn } from '@/utils/cn';
import { formatNumber } from '@/utils/formatCurrency';
import Skeleton from './Skeleton';

const TONES = {
  brand: 'bg-brand-50 text-brand-600',
  warning: 'bg-amber-50 text-warning',
  success: 'bg-emerald-50 text-success',
  danger: 'bg-red-50 text-danger',
  neutral: 'bg-slate-100 text-slate-600',
};

/**
 * Figure card: round icon, label, value and an optional caption.
 * `query` is a React Query result whose data is the number; onClick makes the card a filter button.
 */
export default function KpiCard({ icon: Icon, tone = 'brand', label, query, caption, onClick, active = false }) {
  const Element = onClick ? 'button' : 'div';
  return (
    <Element
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      aria-pressed={onClick ? active : undefined}
      className={cn(
        'card flex w-full items-center gap-3 p-3 text-left transition-shadow sm:gap-4 sm:p-5',
        onClick && 'hover:shadow-md focus-visible:shadow-md',
        active && 'border-brand-600 ring-1 ring-brand-600',
      )}
    >
      <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full sm:h-14 sm:w-14', TONES[tone])}>
        <Icon className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={1.8} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-13 text-slate-600">{label}</span>
        {query.isLoading ? (
          <Skeleton className="mt-1.5 h-7 w-12" />
        ) : query.error ? (
          <span className="mt-1 block text-sm text-slate-400" title={query.error.message}>
            Unavailable
          </span>
        ) : (
          <span className="num mt-0.5 block text-xl font-semibold leading-tight sm:text-2xl text-slate-900">{formatNumber(query.data ?? 0)}</span>
        )}
        {caption && !query.isLoading && !query.error && <span className="mt-0.5 block truncate text-xs text-slate-500">{caption}</span>}
      </span>
    </Element>
  );
}
