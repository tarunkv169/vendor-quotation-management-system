import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, House } from 'lucide-react';
import { SEGMENT_LABELS } from '@/routes/navigation';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function Breadcrumbs() {
  const { pathname } = useLocation();
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return null;

  const crumbs = segments.map((segment, index) => ({
    to: `/${segments.slice(0, index + 1).join('/')}`,
    label: UUID.test(segment) ? 'Details' : SEGMENT_LABELS[segment] || decodeURIComponent(segment),
  }));

  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex items-center gap-1.5 overflow-hidden text-13 text-slate-500">
        <li className="flex shrink-0 items-center">
          <Link to="/dashboard" className="rounded p-0.5 text-slate-500 hover:text-slate-900" aria-label="Home">
            <House className="h-4 w-4" aria-hidden="true" />
          </Link>
        </li>
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          return (
            <li key={crumb.to} className="flex min-w-0 items-center gap-1.5">
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
              {last ? (
                <span aria-current="page" className="truncate font-semibold text-slate-900">
                  {crumb.label}
                </span>
              ) : (
                <Link to={crumb.to} className="truncate hover:text-slate-800">
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
