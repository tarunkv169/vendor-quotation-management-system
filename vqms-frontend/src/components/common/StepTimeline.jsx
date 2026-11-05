import { Fragment } from 'react';
import { Check, X } from 'lucide-react';
import { cn } from '@/utils/cn';

const MARKERS = {
  done: 'border-success bg-success text-white',
  current: 'border-warning bg-warning text-white',
  rejected: 'border-danger bg-danger text-white',
  upcoming: 'border-line-strong bg-surface text-slate-500',
};

/**
 * Horizontal step indicator (vertical on small screens), e.g. Draft → Submitted → Approved.
 * steps: [{ key, label, meta?, state: 'done' | 'current' | 'rejected' | 'upcoming' }]
 * Only pass steps that the backend actually reports; this component does not infer workflow.
 */
export default function StepTimeline({ steps, className, label = 'Progress' }) {
  return (
    <ol aria-label={label} className={cn('flex flex-col gap-3 rounded-xl bg-canvas px-4 py-3.5 md:flex-row md:items-center md:gap-0', className)}>
      {steps.map((step, index) => (
        <Fragment key={step.key}>
          {index > 0 && (
            <li aria-hidden="true" className="hidden min-w-6 flex-1 items-center px-3 md:flex">
              <span className={cn('h-px flex-1', steps[index - 1].state === 'done' ? 'bg-success/60' : 'bg-line-strong')} />
              <span className={cn('-ml-1 h-1.5 w-1.5 rotate-45 border-r border-t', steps[index - 1].state === 'done' ? 'border-success/60' : 'border-line-strong')} />
            </li>
          )}
          <li className="flex min-w-0 items-center gap-2.5" aria-current={step.state === 'current' ? 'step' : undefined}>
            <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold', MARKERS[step.state] || MARKERS.upcoming)}>
              {step.state === 'done' ? <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" /> : step.state === 'rejected' ? <X className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" /> : index + 1}
            </span>
            <span className="min-w-0 leading-tight">
              <span className={cn('block truncate text-13 font-medium', step.state === 'upcoming' ? 'text-slate-500' : 'text-slate-900')}>{step.label}</span>
              {step.meta && <span className="mt-0.5 block truncate text-xs text-slate-500">{step.meta}</span>}
            </span>
            <span className="sr-only">({step.state})</span>
          </li>
        </Fragment>
      ))}
    </ol>
  );
}
