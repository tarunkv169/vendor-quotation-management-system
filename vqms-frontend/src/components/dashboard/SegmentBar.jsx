import { Link } from 'react-router-dom';
import { formatNumber } from '@/utils/formatCurrency';

/**
 * Legend (label, count, share) above one horizontal bar split into segments.
 * segments: [{ key, label, value, color, to? }] — zero-value segments are hidden.
 */
export default function SegmentBar({ segments }) {
  const visible = segments.filter((segment) => segment.value > 0);
  const total = visible.reduce((sum, segment) => sum + segment.value, 0);
  if (!total) return null;

  return (
    <div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3">
        {visible.map((segment) => {
          const body = (
            <>
              <span className="flex items-center gap-1.5 text-13 text-slate-700">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: segment.color }} aria-hidden="true" />
                <span className="truncate">{segment.label}</span>
              </span>
              <span className="num mt-0.5 block pl-3.5 text-xs text-slate-500">
                {formatNumber(segment.value)} · {Math.round((segment.value / total) * 100)}%
              </span>
            </>
          );
          return (
            <li key={segment.key} className="min-w-0">
              {segment.to ? (
                <Link to={segment.to} className="block rounded hover:opacity-80">
                  {body}
                </Link>
              ) : (
                body
              )}
            </li>
          );
        })}
      </ul>
      <div className="mt-4 flex h-2.5 gap-1" role="img" aria-label={visible.map((s) => `${s.label} ${s.value}`).join(', ')}>
        {visible.map((segment) => (
          <span key={segment.key} className="h-full rounded-full" style={{ flexGrow: segment.value, flexBasis: 0, background: segment.color }} />
        ))}
      </div>
    </div>
  );
}
