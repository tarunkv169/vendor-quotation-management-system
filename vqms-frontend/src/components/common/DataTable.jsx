import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/utils/cn';
import Skeleton from './Skeleton';
import EmptyState, { ErrorState } from './EmptyState';

/**
 * Generic table.
 * columns: [{ key, header, render?(row), className?, headerClassName?, sortKey?, align?: 'right' }]
 * sort: { sortBy, direction, onSort(sortKey) } for server-side sorting.
 * selection: { isSelected(row), onToggle(row), allSelected, someSelected, onToggleAll() } adds a checkbox column.
 * roomy: taller rows with more padding (list pages with an actions column).
 */
export default function DataTable({
  columns,
  rows = [],
  rowKey = 'id',
  loading = false,
  error,
  onRetry,
  empty,
  onRowClick,
  sort,
  caption,
  dense = false,
  roomy = false,
  selection,
}) {
  const cellPadding = dense ? 'px-3 py-1.5' : roomy ? 'px-4 py-3' : 'px-4 py-2';
  const colSpan = columns.length + (selection ? 1 : 0);
  const keyOf = (row, index) => (typeof rowKey === 'function' ? rowKey(row, index) : row[rowKey] ?? index);

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-13">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="border-b border-line bg-slate-50/70">
            {selection && (
              <th scope="col" className="w-10 pl-4 pr-1">
                <input
                  type="checkbox"
                  className="checkbox-base"
                  checked={Boolean(selection.allSelected)}
                  ref={(element) => {
                    if (element) element.indeterminate = Boolean(selection.someSelected && !selection.allSelected);
                  }}
                  onChange={selection.onToggleAll}
                  disabled={loading || rows.length === 0}
                  aria-label="Select all rows on this page"
                />
              </th>
            )}
            {columns.map((column) => {
              const sortable = sort && column.sortKey;
              const active = sortable && sort.sortBy === column.sortKey;
              const SortIcon = active ? (sort.direction === 'asc' ? ArrowUp : ArrowDown) : ChevronsUpDown;
              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}
                  className={cn(
                    'whitespace-nowrap text-left text-xs font-medium text-slate-500',
                    roomy ? 'h-11 font-semibold text-slate-700' : 'h-9',
                    dense ? 'px-3' : 'px-4',
                    column.align === 'right' && 'text-right',
                    column.headerClassName,
                  )}
                >
                  {sortable ? (
                    <button
                      type="button"
                      onClick={() => sort.onSort(column.sortKey)}
                      className={cn(
                        'group inline-flex items-center gap-1 rounded hover:text-slate-900',
                        active && 'text-slate-900',
                      )}
                    >
                      {column.header}
                      <SortIcon className={cn('h-3.5 w-3.5', active ? 'text-slate-700' : 'text-slate-300 group-hover:text-slate-500')} aria-hidden="true" />
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-surface">
          {loading &&
            Array.from({ length: 5 }, (_, index) => (
              <tr key={`skeleton-${index}`} className={roomy ? 'h-16' : 'h-11'}>
                {selection && <td className="pl-4 pr-1" />}
                {columns.map((column) => (
                  <td key={column.key} className={cellPadding}>
                    <Skeleton className={cn('h-3.5', index % 2 ? 'w-3/4 max-w-32' : 'w-full max-w-40', column.align === 'right' && 'ml-auto')} />
                  </td>
                ))}
              </tr>
            ))}

          {!loading && error && (
            <tr>
              <td colSpan={colSpan}>
                <ErrorState error={error} onRetry={onRetry} />
              </td>
            </tr>
          )}

          {!loading && !error && rows.length === 0 && (
            <tr>
              <td colSpan={colSpan}>
                <EmptyState title={empty?.title || 'No records found'} description={empty?.description} action={empty?.action} icon={empty?.icon} />
              </td>
            </tr>
          )}

          {!loading &&
            !error &&
            rows.map((row, index) => (
              <tr
                key={keyOf(row, index)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  roomy ? 'h-16' : 'h-11',
                  'transition-colors',
                  onRowClick && 'cursor-pointer hover:bg-slate-50',
                  selection?.isSelected(row) && 'bg-brand-50/40',
                )}
              >
                {selection && (
                  <td className="w-10 pl-4 pr-1" onClick={(event) => event.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="checkbox-base"
                      checked={selection.isSelected(row)}
                      onChange={() => selection.onToggle(row)}
                      aria-label={`Select row ${index + 1}`}
                    />
                  </td>
                )}
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn('align-middle text-slate-700', cellPadding, column.align === 'right' && 'num text-right', column.className)}
                  >
                    {column.render ? column.render(row, index) : row[column.key] ?? <span className="text-slate-400">—</span>}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
