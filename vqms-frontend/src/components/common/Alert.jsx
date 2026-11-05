import { CircleCheck, Info, TriangleAlert, CircleX } from 'lucide-react';
import { cn } from '@/utils/cn';

const TONES = {
  info: { box: 'border-blue-200 bg-blue-50 text-blue-800', icon: Info },
  success: { box: 'border-emerald-200 bg-emerald-50 text-emerald-800', icon: CircleCheck },
  warning: { box: 'border-amber-200 bg-amber-50 text-amber-900', icon: TriangleAlert },
  error: { box: 'border-red-200 bg-red-50 text-red-800', icon: CircleX },
};

export default function Alert({ tone = 'info', title, children, className }) {
  const { box, icon: Icon } = TONES[tone];
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cn('flex gap-3 rounded-md border px-4 py-3 text-sm', box, className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cn(title && 'mt-0.5', 'opacity-90')}>{children}</div>}
      </div>
    </div>
  );
}
