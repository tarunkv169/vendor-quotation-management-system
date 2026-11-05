import { TriangleAlert, Inbox, Lock, PlugZap } from 'lucide-react';
import { cn } from '@/utils/cn';
import Button from './Button';

/** Empty list/section: one short line (plus an action). Long explanations are left out on purpose. */
// `showIcon` adds the icon in a circle with a bolder title (for page-level empty states).
export default function EmptyState({ icon: Icon = Inbox, title = 'Nothing here yet', description, detail, action, className, showIcon = false }) {
  if (showIcon) {
    return (
      <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <Icon className="h-7 w-7" strokeWidth={1.7} aria-hidden="true" />
        </span>
        <p className="mt-4 text-base font-semibold text-slate-900">{title}</p>
        {(detail || description) && <div className="mt-1 max-w-md text-13 text-slate-500">{detail || description}</div>}
        {action && <div className="mt-4">{action}</div>}
      </div>
    );
  }
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-8 text-center', className)}>
      <p className="text-13 text-slate-500">{title}</p>
      {detail && <div className="mt-1 max-w-md text-xs text-slate-500">{detail}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/** Error with retry. `error` is an ApiError (status + message + correlationId). 403 is shown as "Access denied". */
export function ErrorState({ error, onRetry, title, className }) {
  const forbidden = error?.status === 403;
  const Icon = forbidden ? Lock : TriangleAlert;
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-10 text-center', className)} role="alert">
      <span className={cn('flex h-16 w-16 items-center justify-center rounded-full', forbidden ? 'bg-brand-50 text-brand-600' : 'bg-red-50 text-danger')}>
        <Icon className="h-7 w-7" strokeWidth={1.7} aria-hidden="true" />
      </span>
      <p className="mt-4 text-base font-semibold text-slate-900">{title || (forbidden ? 'Access denied' : 'Could not load data')}</p>
      <p className="mt-1 max-w-md text-13 text-slate-500">{error?.message || 'Something went wrong.'}</p>
      {error?.correlationId && (
        <p className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-500">
          Reference:
          <code className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-slate-700">{error.correlationId}</code>
        </p>
      )}
      {onRetry && !forbidden && (
        <Button variant="secondary" size="sm" onClick={onRetry} className="mt-4">
          Try again
        </Button>
      )}
    </div>
  );
}

/** Feature that the backend does not provide yet. */
export function PendingIntegration({ title = 'Pending backend integration', description, className }) {
  return (
    <div className={cn('card', className)}>
      <EmptyState icon={PlugZap} title={title} description={description} />
    </div>
  );
}
