import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PAGE_SIZES } from '@/utils/constants';
import { formatNumber } from '@/utils/formatCurrency';
import { cn } from '@/utils/cn';

/** Page numbers to show: first, last, and a window around the current page, with gaps as null. */
function pageWindow(page, totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index);
  const pages = new Set([0, totalPages - 1, page - 1, page, page + 1]);
  if (page <= 2) [1, 2, 3].forEach((value) => pages.add(value));
  if (page >= totalPages - 3) [totalPages - 4, totalPages - 3, totalPages - 2].forEach((value) => pages.add(value));
  const sorted = [...pages].filter((value) => value >= 0 && value < totalPages).sort((a, b) => a - b);
  return sorted.flatMap((value, index) => (index > 0 && value - sorted[index - 1] > 1 ? [null, value] : [value]));
}

const PAGE_BUTTON = 'num flex h-9 min-w-9 items-center justify-center rounded-md border px-2 text-13 transition-colors disabled:cursor-not-allowed disabled:opacity-40';

/**
 * Server-side pagination: "Showing 1 to 10 of 42 requests", rows per page, numbered pages.
 * page is 0-based. `noun` is [singular, plural].
 */
export default function Pagination({ page, size, totalElements, totalPages, onPageChange, onSizeChange, disabled, noun = ['record', 'records'] }) {
  if (!totalElements) return null;
  const from = page * size + 1;
  const to = Math.min((page + 1) * size, totalElements);
  const pages = Math.max(totalPages || Math.ceil(totalElements / size), 1);

  return (
    <nav className="flex flex-col gap-3 border-t border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5" aria-label="Pagination">
      <p className="num text-13 text-slate-600">
        Showing <span className="font-semibold text-slate-900">{formatNumber(from)}</span> to <span className="font-semibold text-slate-900">{formatNumber(to)}</span> of{' '}
        <span className="font-semibold text-slate-900">{formatNumber(totalElements)}</span> {totalElements === 1 ? noun[0] : noun[1]}
      </p>
      <div className="flex flex-wrap items-center gap-3 sm:gap-4">
        {onSizeChange && (
          <label className="flex items-center gap-2 text-13 text-slate-600">
            <span className="hidden sm:inline">Rows per page:</span>
            <span className="sm:hidden">Rows</span>
            <select
              value={size}
              onChange={(event) => onSizeChange(Number(event.target.value))}
              className="input-base select-base h-9 w-20 pl-3 text-13"
              disabled={disabled}
            >
              {PAGE_SIZES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className={cn(PAGE_BUTTON, 'border-line bg-surface text-slate-600 hover:border-line-strong hover:text-slate-900')}
            onClick={() => onPageChange(page - 1)}
            disabled={disabled || page <= 0}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          {pageWindow(page, pages).map((value, index) =>
            value == null ? (
              <span key={`gap-${index}`} className="px-1 text-slate-400" aria-hidden="true">
                …
              </span>
            ) : (
              <button
                key={value}
                type="button"
                onClick={() => onPageChange(value)}
                disabled={disabled && value !== page}
                aria-current={value === page ? 'page' : undefined}
                aria-label={`Page ${value + 1}`}
                className={cn(
                  PAGE_BUTTON,
                  value === page ? 'border-brand-600 bg-brand-600 font-semibold text-white' : 'border-line bg-surface text-slate-700 hover:border-line-strong',
                )}
              >
                {value + 1}
              </button>
            ),
          )}
          <button
            type="button"
            className={cn(PAGE_BUTTON, 'border-line bg-surface text-slate-600 hover:border-line-strong hover:text-slate-900')}
            onClick={() => onPageChange(page + 1)}
            disabled={disabled || page + 1 >= pages}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </nav>
  );
}
