import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedLayout from '@/components/layout/ProtectedLayout';
import { PageLoader } from '@/components/common/LoadingSpinner';
import RoleBasedRoute from './RoleBasedRoute';

// Every page is lazy-loaded (one chunk per page).
const page = (loader, name = 'default') => lazy(() => loader().then((module) => ({ default: module[name] })));

const LoginPage = page(() => import('@/features/auth/pages/LoginPage'));
const RegisterPage = page(() => import('@/features/auth/pages/RegisterPage'));
const ProfilePage = page(() => import('@/features/auth/pages/ProfilePage'));
const AccessDeniedPage = page(() => import('@/features/auth/pages/AccessDeniedPage'));
const NotFoundPage = page(() => import('@/features/auth/pages/AccessDeniedPage'), 'NotFoundPage');

const DashboardPage = page(() => import('@/features/dashboard/pages/DashboardPage'));

const VendorListPage = page(() => import('@/features/vendors/pages/VendorListPage'));
const VendorFormPage = page(() => import('@/features/vendors/pages/VendorFormPage'));
const VendorDetailPage = page(() => import('@/features/vendors/pages/VendorDetailPage'));

const ProcurementListPage = page(() => import('@/features/procurement/pages/ProcurementListPage'));
const ProcurementFormPage = page(() => import('@/features/procurement/pages/ProcurementFormPage'));
const ProcurementDetailPage = page(() => import('@/features/procurement/pages/ProcurementDetailPage'));

const QuotationListPage = page(() => import('@/features/quotations/pages/QuotationListPage'));
const QuotationFormPage = page(() => import('@/features/quotations/pages/QuotationFormPage'));
const QuotationDetailPage = page(() => import('@/features/quotations/pages/QuotationDetailPage'));

const DocumentListPage = page(() => import('@/features/documents/pages/DocumentListPage'));
const DocumentUploadPage = page(() => import('@/features/documents/pages/DocumentUploadPage'));
const DocumentDetailPage = page(() => import('@/features/documents/pages/DocumentDetailPage'));

const ExtractionPage = page(() => import('@/features/extraction/pages/ExtractionPage'));
const ExtractionDetailPage = page(() => import('@/features/extraction/pages/ExtractionDetailPage'));

const ValidationListPage = page(() => import('@/features/validation/pages/ValidationListPage'));
const ValidationDetailPage = page(() => import('@/features/validation/pages/ValidationDetailPage'));

const ComparisonListPage = page(() => import('@/features/comparison/pages/ComparisonListPage'));
const ComparisonCreatePage = page(() => import('@/features/comparison/pages/ComparisonCreatePage'));
const ComparisonDetailPage = page(() => import('@/features/comparison/pages/ComparisonDetailPage'));

const RecommendationListPage = page(() => import('@/features/recommendation/pages/RecommendationListPage'));
const RecommendationDetailPage = page(() => import('@/features/recommendation/pages/RecommendationDetailPage'));

const ApprovalListPage = page(() => import('@/features/approval/pages/ApprovalListPage'));
const ApprovalDetailPage = page(() => import('@/features/approval/pages/ApprovalDetailPage'));
const DelegationsPage = page(() => import('@/features/approval/pages/DelegationsPage'));
const ApprovalPoliciesPage = page(() => import('@/features/approval/pages/ApprovalPoliciesPage'));

const NotificationsPage = page(() => import('@/features/notifications/pages/NotificationsPage'));

const AuditLogPage = page(() => import('@/features/audit/pages/AuditLogPage'));
const AuditDetailPage = page(() => import('@/features/audit/pages/AuditDetailPage'));
const EntityHistoryPage = page(() => import('@/features/audit/pages/AuditDetailPage'), 'EntityHistoryPage');

const ReportsPage = page(() => import('@/features/reports/pages/ReportsPage'));
const ReportDetailPage = page(() => import('@/features/reports/pages/ReportDetailPage'));

const SettingsPage = page(() => import('@/features/settings/pages/SettingsPage'));

export default function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route element={<ProtectedLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="access-denied" element={<AccessDeniedPage />} />

          <Route element={<RoleBasedRoute module="vendors" />}>
            <Route path="vendors" element={<VendorListPage />} />
            <Route path="vendors/:id" element={<VendorDetailPage />} />
            <Route element={<RoleBasedRoute action="vendor.manage" />}>
              <Route path="vendors/new" element={<VendorFormPage />} />
              <Route path="vendors/:id/edit" element={<VendorFormPage />} />
            </Route>
          </Route>

          <Route element={<RoleBasedRoute module="procurement" />}>
            <Route path="procurement" element={<ProcurementListPage />} />
            <Route path="procurement/new" element={<ProcurementFormPage />} />
            <Route path="procurement/:id" element={<ProcurementDetailPage />} />
            <Route path="procurement/:id/edit" element={<ProcurementFormPage />} />
          </Route>

          <Route element={<RoleBasedRoute module="quotations" />}>
            <Route path="quotations" element={<QuotationListPage />} />
            <Route path="quotations/:id" element={<QuotationDetailPage />} />
            <Route element={<RoleBasedRoute action="quotation.manage" />}>
              <Route path="quotations/new" element={<QuotationFormPage />} />
              <Route path="quotations/:id/edit" element={<QuotationFormPage />} />
            </Route>
          </Route>

          <Route element={<RoleBasedRoute module="documents" />}>
            <Route path="documents" element={<DocumentListPage />} />
            <Route path="documents/:id" element={<DocumentDetailPage />} />
            <Route element={<RoleBasedRoute action="document.upload" />}>
              <Route path="documents/upload" element={<DocumentUploadPage />} />
            </Route>
          </Route>

          <Route element={<RoleBasedRoute module="extraction" />}>
            <Route path="extraction" element={<ExtractionPage />} />
            <Route path="extraction/:id" element={<ExtractionDetailPage />} />
          </Route>

          <Route element={<RoleBasedRoute module="validation" />}>
            <Route path="validation" element={<ValidationListPage />} />
            <Route path="validation/:id" element={<ValidationDetailPage />} />
          </Route>

          <Route element={<RoleBasedRoute module="comparison" />}>
            <Route path="comparison" element={<ComparisonListPage />} />
            <Route path="comparison/:id" element={<ComparisonDetailPage />} />
            <Route element={<RoleBasedRoute action="comparison.manage" />}>
              <Route path="comparison/new" element={<ComparisonCreatePage />} />
            </Route>
          </Route>

          <Route element={<RoleBasedRoute module="recommendations" />}>
            <Route path="recommendations" element={<RecommendationListPage />} />
            <Route path="recommendations/:id" element={<RecommendationDetailPage />} />
          </Route>

          <Route element={<RoleBasedRoute module="approvals" />}>
            <Route path="approvals" element={<ApprovalListPage />} />
            <Route path="approvals/delegations" element={<DelegationsPage />} />
            <Route element={<RoleBasedRoute action="approvalPolicy.view" />}>
              <Route path="approvals/policies" element={<ApprovalPoliciesPage />} />
            </Route>
            <Route path="approvals/:id" element={<ApprovalDetailPage />} />
          </Route>

          <Route path="notifications" element={<NotificationsPage />} />

          <Route element={<RoleBasedRoute module="audit" />}>
            <Route path="audit" element={<AuditLogPage />} />
            <Route path="audit/entity/:type/:id" element={<EntityHistoryPage />} />
            <Route path="audit/:id" element={<AuditDetailPage />} />
          </Route>

          <Route element={<RoleBasedRoute module="reports" />}>
            <Route path="reports" element={<ReportsPage />} />
            <Route path="reports/:id" element={<ReportDetailPage />} />
          </Route>

          <Route element={<RoleBasedRoute module="settings" />}>
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
