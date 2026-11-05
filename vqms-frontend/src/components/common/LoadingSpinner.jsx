import { cn } from '@/utils/cn';

const SIZES = { sm: 'h-4 w-4 border-2', md: 'h-6 w-6 border-2', lg: 'h-10 w-10 border-[3px]' };

export default function LoadingSpinner({ size = 'md', label, className }) {
  return (
    <span role="status" className={cn('inline-flex items-center gap-2', className)}>
      <span className={cn('animate-spin rounded-full border-current border-r-transparent', SIZES[size])} aria-hidden="true" />
      {label ? <span className="text-sm text-slate-500">{label}</span> : <span className="sr-only">Loading</span>}
    </span>
  );
}

export function PageLoader({ label = 'Loading…' }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-brand-600">
      <LoadingSpinner size="lg" label={label} />
    </div>
  );
}
