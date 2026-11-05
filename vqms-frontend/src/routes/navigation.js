import {
  BadgeCheck,
  Bell,
  ChartColumn,
  ClipboardList,
  FileText,
  FolderOpen,
  LayoutDashboard,
  Lightbulb,
  Scale,
  ScanText,
  ScrollText,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react';

// Sidebar entries; `module` is checked against MODULE_ACCESS in utils/permissions.js.
export const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, module: 'dashboard' },
    ],
  },
  {
    label: 'Sourcing',
    items: [
      { to: '/procurement', label: 'Procurement', icon: ClipboardList, module: 'procurement' },
      { to: '/vendors', label: 'Vendors', icon: Users, module: 'vendors' },
      { to: '/quotations', label: 'Quotations', icon: FileText, module: 'quotations' },
      { to: '/documents', label: 'Documents', icon: FolderOpen, module: 'documents' },
    ],
  },
  {
    label: 'Evaluation',
    items: [
      { to: '/extraction', label: 'AI Extraction', icon: ScanText, module: 'extraction' },
      { to: '/validation', label: 'Validation', icon: ShieldCheck, module: 'validation' },
      { to: '/comparison', label: 'Comparison', icon: Scale, module: 'comparison' },
      { to: '/recommendations', label: 'Recommendations', icon: Lightbulb, module: 'recommendations' },
      { to: '/approvals', label: 'Approvals', icon: BadgeCheck, module: 'approvals', badge: 'pendingApprovals' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { to: '/notifications', label: 'Notifications', icon: Bell, module: 'notifications', badge: 'unread' },
      { to: '/audit', label: 'Audit Logs', icon: ScrollText, module: 'audit' },
      { to: '/reports', label: 'Reports', icon: ChartColumn, module: 'reports' },
      { to: '/settings', label: 'Settings', icon: Settings, module: 'settings' },
    ],
  },
];

// Breadcrumb labels for path segments.
export const SEGMENT_LABELS = {
  dashboard: 'Dashboard',
  procurement: 'Procurement',
  vendors: 'Vendors',
  quotations: 'Quotations',
  documents: 'Documents',
  extraction: 'AI Extraction',
  validation: 'Validation',
  comparison: 'Comparison',
  recommendations: 'Recommendations',
  approvals: 'Approvals',
  notifications: 'Notifications',
  audit: 'Audit Logs',
  reports: 'Reports',
  settings: 'Settings',
  users: 'Users',
  profile: 'Profile',
  'access-denied': 'Access denied',
  new: 'New',
  edit: 'Edit',
  upload: 'Upload',
  policies: 'Policies',
  delegations: 'Delegations',
  entity: 'Entity history',
  preferences: 'Preferences',
};
