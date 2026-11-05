import { cn } from '@/utils/cn';

export default function Skeleton({ className }) {
  return <div className={cn('animate-pulse rounded bg-slate-200/80', className)} aria-hidden="true" />;
}

export function SkeletonText({ lines = 3 }) {
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} className={cn('h-3.5', index === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading">
      <Skeleton className="h-7 w-64" />
      <div className="card grid gap-6 p-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-40" />
          </div>
        ))}
      </div>
      <div className="card p-6">
        <SkeletonText lines={4} />
      </div>
    </div>
  );
}
