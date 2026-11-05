import { ArrowUpDown } from 'lucide-react';
import { cn } from '@/utils/cn';
import Select from './Select';

/** Row above a list: search, sort and filters. Children are laid out in one line on desktop. */
export default function ListToolbar({ children, className }) {
  return <div className={cn('mt-5 flex flex-col gap-3 md:flex-row md:items-center', className)}>{children}</div>;
}

/**
 * "Sort by" menu bound to a usePagination pager. options: [{ value: 'field:dir', label }].
 * Shows "Custom sort" when the user sorted by a table header that is not in the list.
 */
export function SortSelect({ pager, options, className = 'w-48' }) {
  const value = `${pager.sortBy}:${pager.direction}`;
  const known = options.some((option) => option.value === value);
  return (
    <div className="flex items-center gap-2">
      <ArrowUpDown className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
      <Select
        aria-label="Sort by"
        value={known ? value : ''}
        placeholder={known ? undefined : 'Custom sort'}
        onChange={(event) => {
          const [sortBy, direction] = event.target.value.split(':');
          if (sortBy) pager.setSort(sortBy, direction);
        }}
        options={options}
        selectClassName="border-transparent bg-transparent pl-1 shadow-none hover:border-line"
        className={className}
      />
    </div>
  );
}
