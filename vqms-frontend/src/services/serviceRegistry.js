// Resolves the base URL of every backend service.
// Default: everything goes through the API Gateway (same origin in dev via the Vite proxy).
// A per-service VITE_*_SERVICE_URL overrides the gateway for local debugging only.

const env = import.meta.env;
const gateway = (env.VITE_API_GATEWAY_URL || '').replace(/\/$/, '');

export const SERVICES = {
  identity: { name: 'Identity Service', url: env.VITE_IDENTITY_SERVICE_URL },
  vendor: { name: 'Vendor Service', url: env.VITE_VENDOR_SERVICE_URL },
  procurement: { name: 'Procurement Service', url: env.VITE_PROCUREMENT_SERVICE_URL },
  quotation: { name: 'Quotation Service', url: env.VITE_QUOTATION_SERVICE_URL },
  document: { name: 'Document Service', url: env.VITE_DOCUMENT_SERVICE_URL },
  extraction: { name: 'AI Extraction Service', url: env.VITE_AI_EXTRACTION_SERVICE_URL },
  validation: { name: 'Validation Service', url: env.VITE_VALIDATION_SERVICE_URL },
  comparison: { name: 'Comparison Service', url: env.VITE_COMPARISON_SERVICE_URL },
  recommendation: { name: 'Recommendation Service', url: env.VITE_RECOMMENDATION_SERVICE_URL },
  approval: { name: 'Approval Service', url: env.VITE_APPROVAL_SERVICE_URL },
  notification: { name: 'Notification Service', url: env.VITE_NOTIFICATION_SERVICE_URL },
  audit: { name: 'Audit Service', url: env.VITE_AUDIT_SERVICE_URL },
  reporting: { name: 'Reporting Service', url: env.VITE_REPORTING_SERVICE_URL },
};

export function resolveBaseUrl(serviceKey) {
  const service = SERVICES[serviceKey];
  if (!service) {
    throw new Error(`Unknown service "${serviceKey}"`);
  }
  return (service.url || gateway).replace(/\/$/, '');
}
