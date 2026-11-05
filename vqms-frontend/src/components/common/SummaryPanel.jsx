import { cn } from '@/utils/cn';
import Skeleton from './Skeleton';
import { ErrorState } from './EmptyState';

/**
 * Section of a page: one bordered box with a header row (title + optional action) and the content.
 * `footer` is shown as a small line under the content; keep it for data (counts, totals), not explanations.
 */
export default function SummaryPanel({ title, action, footer, loading, error, onRetry, children, className, bodyClassName }) {
  return (
    <section className={cn('panel flex flex-col', className)}>
      <header className="flex min-h-10 items-center justify-between gap-3 border-b border-line px-4 py-2">
        <h2 className="text-13 font-semibold text-slate-900">{title}</h2>
        {action && <div className="shrink-0 text-xs">{action}</div>}
      </header>
      <div className={cn('panel-body flex-1', bodyClassName ?? 'p-4')}>
        {loading ? (
          <div className="space-y-3" aria-hidden="true">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        ) : error ? (
          <ErrorState error={error} onRetry={onRetry} className="py-4" />
        ) : (
          children
        )}
      </div>
      {footer && <p className="border-t border-line px-4 py-2 text-xs text-slate-500">{footer}</p>}
    </section>
  );
}
