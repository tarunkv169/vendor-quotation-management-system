import { cn } from '@/utils/cn';
import { humanize } from '@/utils/constants';

// [badge, dot]
const TONES = {
  gray: ['bg-slate-100 text-slate-700', 'bg-slate-400'],
  blue: ['bg-blue-50 text-blue-800', 'bg-blue-500'],
  amber: ['bg-amber-50 text-amber-800', 'bg-amber-500'],
  green: ['bg-emerald-50 text-emerald-800', 'bg-emerald-500'],
  red: ['bg-red-50 text-red-800', 'bg-red-500'],
  violet: ['bg-violet-50 text-violet-800', 'bg-violet-500'],
  brand: ['bg-brand-50 text-brand-800', 'bg-brand-500'],
};

// Status values from every service, grouped by meaning.
const STATUS_TONE = {
  gray: ['DRAFT', 'CREATED', 'CANCELLED', 'INACTIVE', 'DELETED', 'WAITING', 'SUPERSEDED', 'NOT_REQUESTED', 'UPLOADED', 'INFO', 'LOW', 'WITHDRAWN', 'EXPIRED'],
  blue: ['SUBMITTED', 'QUEUED', 'PROCESSING', 'IN_PROGRESS', 'UPLOADING', 'PENDING_SCAN', 'QUOTATION_REQUESTED', 'CALCULATED', 'GENERATED', 'EXTRACTED', 'NORMAL', 'PRIMARY'],
  amber: ['PENDING', 'NEEDS_REVIEW', 'UNDER_EVALUATION', 'UNDER_REVIEW', 'SUBMITTED_FOR_APPROVAL', 'WARNING', 'MEDIUM', 'ALTERNATIVE', 'PARTIAL'],
  green: ['ACTIVE', 'APPROVED', 'COMPLETED', 'PASSED', 'VALIDATED', 'PROCESSED', 'SENT', 'SUCCESS', 'ACCEPTED', 'RANKED', 'BEST_VALUE'],
  red: ['REJECTED', 'FAILED', 'UPLOAD_FAILED', 'QUARANTINED', 'ERROR', 'FAILURE', 'HIGH', 'CRITICAL', 'INELIGIBLE', 'NOT_RECOMMENDED', 'NO_QUALIFYING_VENDOR'],
  violet: ['ESCALATED', 'INCOMPARABLE', 'SINGLE_ELIGIBLE_VENDOR'],
};

const LOOKUP = Object.entries(STATUS_TONE).reduce((map, [tone, values]) => {
  values.forEach((value) => {
    map[value] = tone;
  });
  return map;
}, {});

/** Dot colour class for a status value (charts and lists that need the badge colour without the badge). */
export function statusDotClass(status) {
  return (TONES[LOOKUP[String(status).toUpperCase()]] || TONES.gray)[1];
}

// Same tones as hex, for chart marks (Recharts / inline styles).
const TONE_HEX = { gray: '#8c8c8c', blue: '#60a5fa', amber: '#f59e0b', green: '#22a559', red: '#ef4444', violet: '#a78bfa' };

export function statusColor(status) {
  return TONE_HEX[LOOKUP[String(status).toUpperCase()]] || TONE_HEX.gray;
}

export default function StatusBadge({ status, tone, label, className }) {
  if (!status && !label) return <span className="text-slate-400">—</span>;
  const resolved = tone || LOOKUP[String(status).toUpperCase()] || 'gray';
  const [badge, dot] = TONES[resolved] || TONES.gray;
  return (
    <span className={cn('inline-flex h-5.5 items-center gap-1.5 whitespace-nowrap rounded px-1.5 text-xs font-medium', badge, className)}>
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dot)} aria-hidden="true" />
      {label || humanize(status)}
    </span>
  );
}
