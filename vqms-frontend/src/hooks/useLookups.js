import { useQuery } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { vendorService } from '@/features/vendors/vendorService';
import { loadRequestOptions } from '@/features/procurement/procurementService';

// Select options shared by several forms. Failures (e.g. 403 for a role) yield an empty list so the
// form can fall back to typing an ID.

export function useVendorOptions({ activeOnly = true, enabled = true } = {}) {
  const { canAccess } = useAuth();
  return useQuery({
    queryKey: ['lookup', 'vendors', activeOnly],
    queryFn: async ({ signal }) => {
      const data = await vendorService.list({ status: activeOnly ? 'ACTIVE' : '', page: 0, size: 100, sortBy: 'name', direction: 'asc' }, signal);
      return (data?.content || []).map((vendor) => ({ value: vendor.id, label: vendor.name }));
    },
    enabled: enabled && canAccess('vendors'),
    staleTime: 5 * 60_000,
    meta: { silent: true },
  });
}

/** id → request title for requests the user can see (others fall back to the caller's default). */
export function useRequestTitles() {
  const requests = useRequestOptions();
  const titles = new Map((requests.data || []).map((option) => [option.value, option.title]));
  return (id) => titles.get(id);
}

export function useRequestOptions({ enabled = true } = {}) {
  const { can, canAccess } = useAuth();
  const canViewAll = can('procurement.viewAll');
  return useQuery({
    queryKey: ['lookup', 'procurement', canViewAll],
    queryFn: ({ signal }) => loadRequestOptions(canViewAll, signal),
    enabled: enabled && canAccess('procurement'),
    staleTime: 60_000,
    meta: { silent: true },
  });
}
