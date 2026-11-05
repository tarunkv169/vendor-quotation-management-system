import { cn } from '@/utils/cn';
import { formatNumber } from '@/utils/formatCurrency';
import Skeleton from './Skeleton';

const TONES = {
  brand: 'bg-brand-50 text-brand-600',
  warning: 'bg-amber-50 text-warning',
  success: 'bg-emerald-50 text-success',
  danger: 'bg-red-50 text-danger',
  info: 'bg-blue-50 text-blue-700',
  neutral: 'bg-slate-100 text-slate-600',
};

/**
 * Figure card: round icon, label, value and an optional caption.
 * `query` is a React Query result whose data is the number; onClick makes the card a filter button.
 * `digits`: decimals to show; `emptyText`: shown instead of 0 when there is no value (e.g. an average of nothing).
 */
export default function KpiCard({ icon: Icon, tone = 'brand', label, query, caption, onClick, active = false, digits = 0, emptyText, suffix = '', formatValue, compact = false }) {
  const Element = onClick ? 'button' : 'div';
  return (
    <Element
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      aria-pressed={onClick ? active : undefined}
      className={cn(
        'card flex w-full items-center text-left transition-shadow',
        compact ? 'gap-2.5 px-3 py-3' : 'gap-3 p-3 sm:gap-4 sm:p-5',
        onClick && 'hover:shadow-md focus-visible:shadow-md',
        active && 'border-brand-600 ring-1 ring-brand-600',
      )}
    >
      <span className={cn('flex shrink-0 items-center justify-center rounded-full', compact ? 'h-9 w-9 2xl:h-10 2xl:w-10' : 'h-10 w-10 sm:h-12 sm:w-12 2xl:h-14 2xl:w-14', TONES[tone])}>
        <Icon className={compact ? 'h-4.5 w-4.5' : 'h-5 w-5 sm:h-6 sm:w-6'} strokeWidth={1.8} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block leading-snug text-slate-600', compact ? 'text-xs leading-tight' : 'text-13')} title={compact ? label : undefined}>
          {label}
        </span>
        {query.isLoading ? (
          <Skeleton className="mt-1.5 h-7 w-12" />
        ) : query.error ? (
          <span className="mt-1 block text-sm text-slate-400" title={query.error.message}>
            Unavailable
          </span>
        ) : (
          <span className={cn('num mt-0.5 block whitespace-nowrap font-semibold leading-tight text-slate-900', compact ? 'text-xl' : 'text-xl sm:text-2xl')}>{query.data == null && emptyText ? emptyText : formatValue ? formatValue(query.data) : `${formatNumber(query.data ?? 0, digits)}${suffix}`}</span>
        )}
        {caption && !query.isLoading && !query.error && <span className="mt-0.5 block truncate text-xs text-slate-500">{caption}</span>}
      </span>
    </Element>
  );
}
