import { cn } from '@/utils/cn';

/**
 * Tabs. tabs: [{ value, label, count? }]
 * variant="underline" (default): sits on top of a card / table.
 * variant="pill": rounded segmented filters with counts; the active one is filled dark.
 */
export default function Tabs({ tabs, value, onChange, className, label = 'Views', variant = 'underline' }) {
  if (variant === 'pill') {
    return (
      <div role="tablist" aria-label={label} className={cn('flex gap-5 overflow-x-auto border-b border-line', className)}>
        {tabs.map((tab) => {
          const active = tab.value === value;
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(tab.value)}
              className={cn(
                '-mb-px inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 text-13 font-medium transition-colors',
                active ? 'border-brand-600 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-900',
              )}
            >
              {tab.label}
              {tab.count !== undefined && tab.count !== null && <span className="num rounded bg-slate-100 px-1.5 text-xs text-slate-600">{tab.count}</span>}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div role="tablist" aria-label={label} className={cn('flex gap-4 overflow-x-auto border-b border-line px-4', className)}>
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={cn(
              '-mb-px inline-flex h-11 items-center whitespace-nowrap border-b-2 text-13 font-medium transition-colors',
              active ? 'border-brand-600 text-slate-900' : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800',
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className={cn('num ml-1.5 rounded px-1.5 text-xs', active ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-500')}>{tab.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
