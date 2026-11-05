import { procurementService } from '@/features/procurement/procurementService';
import { vendorService } from '@/features/vendors/vendorService';
import { approvalService } from '@/features/approval/approvalService';
import { normalizePage } from '@/utils/pagination';

// No KPI endpoint is reachable through the gateway, so every KPI is the `totalElements`
// of an existing list endpoint (requested with size=1) — always a backend number.

export const dashboardService = {
  procurementCount: async ({ scope, status }, signal) =>
    normalizePage(await procurementService.list({ scope, status, page: 0, size: 1 }, signal)).totalElements,
  vendorCount: async (status, signal) => normalizePage(await vendorService.list({ status, page: 0, size: 1 }, signal)).totalElements,
  approvalCount: async (status, signal) => normalizePage(await approvalService.search({ status, page: 0, size: 1 }, signal)).totalElements,
  recentProcurement: async (scope, size, signal) =>
    normalizePage(await procurementService.list({ scope, page: 0, size, sortBy: 'createdAt', direction: 'desc' }, signal)).items,
};
