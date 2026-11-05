import { cn } from '@/utils/cn';

/** Read-only label/value grid. items: [{ label, value, full? }] (falsy items are skipped). */
export default function DetailList({ items, columns = 3, className }) {
  // Two per row already on phones (short label/value pairs); `full` items span the whole row.
  const grid = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-2 lg:grid-cols-3', 4: 'grid-cols-2 lg:grid-cols-4' }[columns];
  return (
    <dl className={cn('grid gap-x-6 gap-y-4', grid, className)}>
      {items.filter(Boolean).map((item) => (
        <div key={item.label} className={cn('min-w-0', item.full && 'col-span-full')}>
          <dt className="text-xs font-medium text-slate-500">{item.label}</dt>
          <dd className="mt-1 break-words text-sm text-slate-900">
            {item.value === null || item.value === undefined || item.value === '' ? '—' : item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Monospace short UUID with full value in the title attribute. */
export function IdText({ value, className }) {
  if (!value) return <span className="text-slate-400">—</span>;
  return (
    <span title={value} className={cn('font-mono text-xs text-slate-600', className)}>
      {String(value).slice(0, 8)}
    </span>
  );
}
