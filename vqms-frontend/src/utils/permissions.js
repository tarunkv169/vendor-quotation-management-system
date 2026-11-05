// Role → capability map mirrored from the backend @PreAuthorize rules and controller checks.
// It only decides what the UI shows; the backend remains the authority and still answers 403.

export const ROLES = {
  ADMIN: 'ADMIN',
  PROCUREMENT_ADMIN: 'PROCUREMENT_ADMIN',
  PROCUREMENT_MANAGER: 'PROCUREMENT_MANAGER',
  PROCUREMENT_REVIEWER: 'PROCUREMENT_REVIEWER',
  EMPLOYEE: 'EMPLOYEE',
  VENDOR: 'VENDOR',
};

export const ROLE_LABELS = {
  ADMIN: 'Administrator',
  PROCUREMENT_ADMIN: 'Procurement admin',
  PROCUREMENT_MANAGER: 'Procurement manager',
  PROCUREMENT_REVIEWER: 'Procurement reviewer',
  EMPLOYEE: 'Employee',
  VENDOR: 'Vendor',
};

// Roles a person may pick on the public registration form.
export const SELF_REGISTER_ROLES = [ROLES.EMPLOYEE, ROLES.VENDOR];

const { ADMIN, PROCUREMENT_ADMIN: PA, PROCUREMENT_MANAGER: PM, PROCUREMENT_REVIEWER: PR, EMPLOYEE, VENDOR } = ROLES;
const ALL = [ADMIN, PA, PM, PR, EMPLOYEE, VENDOR];

// Which roles may open each module (sidebar + route guard).
export const MODULE_ACCESS = {
  dashboard: ALL,
  procurement: [ADMIN, PA, PM, PR, EMPLOYEE],
  vendors: [ADMIN, PA, PM, PR],
  quotations: ALL,
  documents: [ADMIN, PA, PM, VENDOR],
  extraction: [ADMIN, PA, PM],
  validation: [ADMIN, PA, PM],
  comparison: [ADMIN, PA, PM, EMPLOYEE],
  recommendations: [ADMIN, PA, PM, EMPLOYEE],
  approvals: [ADMIN, PA, PM, EMPLOYEE],
  notifications: ALL,
  audit: [ADMIN, PA],
  reports: [ADMIN, PA, PM],
  settings: [ADMIN],
  profile: ALL,
};

// Fine-grained actions (buttons). Names describe the backend operation.
export const ACTION_ACCESS = {
  'vendor.manage': [ADMIN, PA],
  'procurement.viewAll': [ADMIN, PA],
  'procurement.decide': [ADMIN, PA],
  'procurement.workflow': [ADMIN, PA],
  'quotation.manage': [ADMIN, PA, PM, VENDOR],
  'quotation.review': [ADMIN, PA, PM, PR],
  'document.upload': [ADMIN, PA, VENDOR],
  'document.changeStatus': [ADMIN, PA],
  'extraction.start': [ADMIN, PA, PM],
  'validation.run': [ADMIN, PA],
  'comparison.manage': [ADMIN, PA, PM],
  'comparison.complete': [ADMIN, PA],
  'recommendation.generate': [ADMIN, PA, PM],
  'recommendation.submit': [ADMIN, PA],
  'approval.create': [ADMIN, PA],
  'approval.escalate': [ADMIN, PA],
  'approval.delegate': [ADMIN, PA, PM, EMPLOYEE],
  'approvalPolicy.manage': [ADMIN],
  'approvalPolicy.view': [ADMIN, PA, PM],
  'audit.verify': [ADMIN],
  'notification.send': [ADMIN, PA],
  'users.manage': [ADMIN],
};

export function hasAnyRole(role, roles) {
  return Boolean(role) && Array.isArray(roles) && roles.includes(role);
}

export function canAccessModule(role, module) {
  return hasAnyRole(role, MODULE_ACCESS[module]);
}

export function can(role, action) {
  return hasAnyRole(role, ACTION_ACCESS[action]);
}
