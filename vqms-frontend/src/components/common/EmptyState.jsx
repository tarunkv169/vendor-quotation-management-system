import { TriangleAlert, Inbox, PlugZap } from 'lucide-react';
import { cn } from '@/utils/cn';
import Button from './Button';

/** Empty list/section: one short line (plus an action). Long explanations are left out on purpose. */
// eslint-disable-next-line no-unused-vars
export default function EmptyState({ icon: Icon = Inbox, title = 'Nothing here yet', description, detail, action, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-8 text-center', className)}>
      <p className="text-13 text-slate-500">{title}</p>
      {detail && <div className="mt-1 max-w-md text-xs text-slate-500">{detail}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/** Error with retry. `error` is an ApiError (status + message + correlationId). */
export function ErrorState({ error, onRetry, title, className }) {
  const forbidden = error?.status === 403;
  return (
    <EmptyState
      className={className}
      icon={TriangleAlert}
      title={title || (forbidden ? 'Access denied' : 'Could not load data')}
      detail={
        <>
          {error?.message || 'Something went wrong.'}
          {error?.correlationId && (
            <span className="mt-1 block font-mono text-xs text-slate-400">Reference: {error.correlationId}</span>
          )}
        </>
      }
      action={
        onRetry && !forbidden ? (
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Try again
          </Button>
        ) : null
      }
    />
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
