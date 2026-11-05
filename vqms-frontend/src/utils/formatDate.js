import { format, formatDistanceToNowStrict, isValid, parseISO } from 'date-fns';

// Monolith sends LocalDateTime ("2026-11-03T16:20:56.83") = server local time;
// microservices send Instant ("...Z"). parseISO handles both.
function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return isValid(value) ? value : null;
  const date = parseISO(String(value));
  return isValid(date) ? date : null;
}

export function formatDate(value, pattern = 'dd MMM yyyy') {
  const date = toDate(value);
  return date ? format(date, pattern) : '—';
}

export function formatDateTime(value) {
  return formatDate(value, 'dd MMM yyyy, HH:mm');
}

export function formatRelative(value) {
  const date = toDate(value);
  return date ? `${formatDistanceToNowStrict(date)} ago` : '—';
}

// Value for <input type="date"> / "datetime-local".
export function toInputDate(value) {
  const date = toDate(value);
  return date ? format(date, 'yyyy-MM-dd') : '';
}

export function toInputDateTime(value) {
  const date = toDate(value);
  return date ? format(date, "yyyy-MM-dd'T'HH:mm") : '';
}
