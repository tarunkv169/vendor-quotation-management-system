import { http } from '@/services/apiClient';
import { API } from '@/services/apiEndpoints';
import { compactParams, pageableParams } from '@/utils/pagination';

const api = http('reporting');

export const reportingService = {
  // ReportRequest { type, procurementRequestId?, from?, to?, currencyCode? } → ReportResponse (generated synchronously)
  generate: (payload) => api.post(API.reports.root, compactParams(payload), { timeout: 120000 }),
  list: ({ type, page = 0, size = 20, sortBy, direction } = {}, signal) =>
    api.get(API.reports.root, { ...compactParams({ type }), ...pageableParams({ page, size, sortBy, direction }) }, { signal }),
  get: (id, signal) => api.get(API.reports.one(id), undefined, { signal }),
  // CSV export (the only export format the backend provides).
  exportCsv: async (id, fileName) => {
    const response = await api.raw.get(API.reports.export(id), { responseType: 'blob', headers: { Accept: 'text/csv' } });
    const url = URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName || `report-${id}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },
};

export const reportKeys = {
  all: ['reports'],
  list: (params) => ['reports', 'list', params],
  one: (id) => ['reports', id],
};
