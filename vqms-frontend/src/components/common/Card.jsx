import { cn } from '@/utils/cn';

/** White panel with optional header (title, description, actions). */
export default function Card({ title, description, actions, children, className, bodyClassName, flush = false }) {
  return (
    <section className={cn('card min-w-0', className)}>
      {(title || actions) && (
        <header className="flex min-h-12 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-line px-5 py-3">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn(!flush && 'p-5', bodyClassName)}>{children}</div>
    </section>
  );
}

/** Filter row above tables. */
export function FilterBar({ children, className }) {
  return <div className={cn('flex flex-col gap-2.5 border-b border-line px-4 py-3 md:flex-row md:flex-wrap md:items-end', className)}>{children}</div>;
}
