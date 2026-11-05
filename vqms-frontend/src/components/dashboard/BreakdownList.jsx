import { Link } from 'react-router-dom';
import { cn } from '@/utils/cn';
import { formatNumber } from '@/utils/formatCurrency';

/**
 * Ranked counts with proportional bars. Reads correctly with one row or twenty,
 * unlike a pie/donut, which is meaningless with a single category.
 * rows: [{ key, label, value, to?, dot? }]
 */
export default function BreakdownList({ rows, total, unit = ['record', 'records'] }) {
  const sum = total ?? rows.reduce((acc, row) => acc + row.value, 0);
  const max = Math.max(...rows.map((row) => row.value), 1);

  return (
    <div>
      <ul className="space-y-2.5">
        {rows.map((row) => {
          const share = sum ? Math.round((row.value / sum) * 100) : 0;
          const content = (
            <>
              <div className="flex items-baseline justify-between gap-3 text-13">
                <span className="flex min-w-0 items-center gap-2 text-slate-700">
                  {row.dot && <span className={cn('h-2 w-2 shrink-0 rounded-full', row.dot)} aria-hidden="true" />}
                  <span className="truncate">{row.label}</span>
                </span>
                <span className="num shrink-0 text-slate-900">
                  <span className="font-medium">{formatNumber(row.value)}</span>
                  <span className="ml-1.5 inline-block w-9 text-right text-xs text-slate-400">{share}%</span>
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-brand-500/80" style={{ width: `${(row.value / max) * 100}%` }} />
              </div>
            </>
          );
          return (
            <li key={row.key}>
              {row.to ? (
                <Link to={row.to} className="-mx-2 block rounded px-2 py-1 hover:bg-slate-50">
                  {content}
                </Link>
              ) : (
                <div className="py-1">{content}</div>
              )}
            </li>
          );
        })}
      </ul>
      <p className="num mt-3 border-t border-slate-100 pt-2.5 text-xs text-slate-500">
        {formatNumber(sum)} {sum === 1 ? unit[0] : unit[1]} in total
      </p>
    </div>
  );
}
