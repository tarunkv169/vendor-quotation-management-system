import { useMemo } from 'react';
import { useVendorOptions } from './useLookups';

/** id → vendor name map for services that only return vendorId. Falls back to a short id. */
export function useVendorNames() {
  const vendors = useVendorOptions({ activeOnly: false });
  return useMemo(() => {
    const map = new Map((vendors.data || []).map((option) => [option.value, option.label]));
    return (id) => (id ? map.get(id) || `Vendor ${String(id).slice(0, 8)}` : '—');
  }, [vendors.data]);
}
