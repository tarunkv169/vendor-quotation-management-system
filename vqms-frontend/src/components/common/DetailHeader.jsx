import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

/**
 * Summary card at the top of a detail page: back link, identity (icon or initials), title with
 * badges, a meta line, an optional key figure on the right, optional body (timeline, alerts) and
 * an action bar with a "what happens next" sentence.
 */
export default function DetailHeader({
  backTo,
  backLabel,
  // icon, initials and next are accepted for compatibility; the plain header does not show them.
  title,
  badges,
  meta,
  links,
  figure,
  figureLabel,
  figureNote,
  children,
  actions,
}) {
  return (
    <>
      {backTo && (
        <Link to={backTo} className="mb-4 inline-flex items-center gap-1.5 text-13 text-slate-500 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {backLabel}
        </Link>
      )}
      <section className="card p-4 sm:p-5">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="break-words text-xl font-semibold leading-tight tracking-[-0.01em]">{title}</h1>
                {badges}
              </div>
              {meta && <p className="mt-1 text-13 text-slate-500">{meta}</p>}
              {links && <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">{links}</div>}
            </div>
          </div>
          {figure !== undefined && (
            <div className="shrink-0 sm:text-right">
              <p className="num text-2xl font-semibold leading-none tracking-tight text-slate-900">{figure}</p>
              {figureLabel && <p className="mt-1.5 text-13 text-slate-500">{figureLabel}</p>}
              {figureNote && <div className="mt-1 text-xs text-slate-500">{figureNote}</div>}
            </div>
          )}
        </div>

        {children && <div className="mt-4 space-y-3">{children}</div>}

        {actions && <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">{actions}</div>}
      </section>
    </>
  );
}

/** Text link with an arrow, for the links row of a DetailHeader. */
export function HeaderLink({ to, children }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1 text-13 font-medium text-brand-700 hover:text-brand-800">
      {children} <span aria-hidden="true">→</span>
    </Link>
  );
}
