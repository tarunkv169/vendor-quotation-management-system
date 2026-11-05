import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import SummaryPanel from '@/components/common/SummaryPanel';
import Skeleton from '@/components/common/Skeleton';

/**
 * Compact activity list in a summary panel.
 * items: [{ id, to, title, subtitle, amount, trailing }]
 */
export default function RecentActivity({ title, viewAllTo, items = [], loading, error, onRetry, emptyText = 'Nothing yet', emptyDescription, className }) {
  return (
    <SummaryPanel
      title={title}
      className={className}
      error={error}
      onRetry={onRetry}
      bodyClassName="p-0"
      action={
        viewAllTo && (
          <Link to={viewAllTo} className="inline-flex items-center gap-1 font-medium text-slate-600 hover:text-slate-900">
            View all <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </Link>
        )
      }
    >
      {loading ? (
        <ul className="divide-y divide-slate-100">
          {Array.from({ length: 3 }, (_, index) => (
            <li key={index} className="space-y-1.5 px-4 py-3">
              <Skeleton className="h-3.5 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </li>
          ))}
        </ul>
      ) : items.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <p className="text-13 text-slate-700">{emptyText}</p>
          {emptyDescription && <p className="mx-auto mt-1 max-w-xs text-xs text-slate-500">{emptyDescription}</p>}
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((item) => (
            <li key={item.id}>
              <Link to={item.to} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 transition-colors first:rounded-t-lg last:rounded-b-lg hover:bg-slate-50 sm:flex-nowrap">
                <span className="min-w-0 basis-full sm:flex-1 sm:basis-auto">
                  <span className="block truncate text-13 font-medium text-slate-900">{item.title}</span>
                  {item.subtitle && <span className="mt-0.5 block truncate text-xs text-slate-500">{item.subtitle}</span>}
                </span>
                {item.amount && <span className="num shrink-0 text-13 font-medium text-slate-900">{item.amount}</span>}
                {item.trailing && <span className="shrink-0">{item.trailing}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SummaryPanel>
  );
}
