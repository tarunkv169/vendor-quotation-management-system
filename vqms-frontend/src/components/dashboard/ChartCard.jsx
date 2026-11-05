import Card from '@/components/common/Card';
import Skeleton from '@/components/common/Skeleton';
import EmptyState, { ErrorState } from '@/components/common/EmptyState';
import { ChartColumn } from 'lucide-react';

/**
 * Card that shows a visualisation, or a loading / error / empty state instead.
 * `height` applies to chart children; pass `autoHeight` for content that sizes itself (lists).
 */
export default function ChartCard({
  title,
  description,
  loading,
  error,
  onRetry,
  empty,
  emptyText = 'No data yet',
  emptyDescription,
  height = 'h-56',
  autoHeight = false,
  children,
  actions,
  className,
}) {
  return (
    <Card title={title} description={description} actions={actions} className={className}>
      {loading ? (
        <Skeleton className={`${autoHeight ? 'h-32' : height} w-full`} />
      ) : error ? (
        <ErrorState error={error} onRetry={onRetry} className="py-6" />
      ) : empty ? (
        <EmptyState icon={ChartColumn} title={emptyText} description={emptyDescription} className="py-6" />
      ) : (
        <div className={autoHeight ? undefined : height}>{children}</div>
      )}
    </Card>
  );
}

/** Tooltip body for Recharts, styled like the rest of the UI. */
export function ChartTooltip({ active, payload, label, unit }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-line bg-surface px-3 py-2 text-xs shadow-md">
      {label && <p className="mb-1 font-medium text-slate-900">{label}</p>}
      {payload.map((entry) => (
        <p key={entry.dataKey} className="num flex items-center gap-2 text-slate-600">
          <span className="h-2 w-2 rounded-sm" style={{ background: entry.color || entry.fill }} aria-hidden="true" />
          {entry.name}: <span className="font-medium text-slate-900">{entry.value}</span>
          {unit && <span className="text-slate-400">{unit}</span>}
        </p>
      ))}
    </div>
  );
}
