import { isValid, parseISO, startOfMonth } from 'date-fns';

/**
 * Location shown in the list and used by the location filter. The backend stores one free-text
 * address, so the location is its last comma-separated part (usually the city), e.g.
 * "12 MG Road, Pune" → "Pune". Vendors without an address have no location.
 */
export function vendorLocation(vendor) {
  const address = String(vendor?.address || '').trim();
  if (!address) return '';
  const parts = address.split(',').map((part) => part.trim()).filter(Boolean);
  return parts[parts.length - 1] || address;
}

export function vendorInitials(name) {
  return (name || '?')
    .split(/\s+/)
    .filter((part) => /[a-z]/i.test(part))
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || '?';
}

/** Registered in the current calendar month. */
export function registeredThisMonth(vendor, now = new Date()) {
  const date = vendor?.createdAt ? parseISO(vendor.createdAt) : null;
  return Boolean(date && isValid(date) && date >= startOfMonth(now) && date <= now);
}
