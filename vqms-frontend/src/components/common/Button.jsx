import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/utils/cn';
import LoadingSpinner from './LoadingSpinner';

const VARIANTS = {
  primary: 'bg-brand-600 text-white shadow-xs hover:bg-brand-700 active:bg-brand-800 disabled:bg-brand-600/60',
  secondary: 'border border-line-strong bg-surface text-slate-700 shadow-xs hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900 disabled:text-slate-400',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-600/60',
  // Decision buttons (approve / reject), as in the approval workspace.
  success: 'bg-success text-white shadow-xs hover:bg-green-700 disabled:bg-success/60',
  'danger-outline': 'border border-line-strong bg-surface text-danger shadow-xs hover:border-red-300 hover:bg-red-50 disabled:text-red-300',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:text-slate-400',
  link: 'text-brand-700 hover:text-brand-800 hover:underline px-0 py-0',
};

const SIZES = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-9 px-3.5 text-sm gap-2',
  lg: 'h-10 px-4 text-sm font-semibold gap-2',
  icon: 'h-9 w-9 justify-center',
  'icon-sm': 'h-8 w-8 justify-center',
};

/** Button / link button. `to` renders a router Link. `loading` disables and shows a spinner. */
const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', loading = false, icon: Icon, to, className, children, disabled, type = 'button', ...props },
  ref,
) {
  const classes = cn(
    'inline-flex shrink-0 items-center rounded-md font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed',
    VARIANTS[variant],
    variant !== 'link' && SIZES[size],
    className,
  );
  const content = (
    <>
      {loading ? <LoadingSpinner size="sm" /> : Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
      {children}
    </>
  );

  if (to) {
    return (
      <Link ref={ref} to={to} className={classes} {...props}>
        {content}
      </Link>
    );
  }
  return (
    <button ref={ref} type={type} className={classes} disabled={disabled || loading} {...props}>
      {content}
    </button>
  );
});

export default Button;
