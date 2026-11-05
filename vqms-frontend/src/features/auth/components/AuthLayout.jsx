import { APP_NAME } from '@/utils/constants';
import ThemeToggle from '@/components/layout/ThemeToggle';

/**
 * Sign-in / registration shell: the application's warm frame with one white card, the same
 * surface language as the signed-in workspace. No marketing panel or illustration.
 */
export default function AuthLayout({ title, description, children, footer }) {
  return (
    <div className="relative flex min-h-screen flex-col bg-frame px-4 py-10 sm:py-16">
      <ThemeToggle className="absolute right-4 top-4 sm:right-6 sm:top-6" />
      <main className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center">
        <div className="mb-7 flex items-center justify-center gap-2.5">
          <img src="/favicon.svg" alt="" className="h-9 w-9" />
          <div className="leading-tight">
            <p className="text-base font-semibold tracking-tight text-slate-900">{APP_NAME}</p>
            <p className="text-2xs text-slate-500">Vendor Quotation Management System</p>
          </div>
        </div>

        <div className="panel">
          <div className="panel-body px-6 py-7 sm:px-8">
            <h1 className="text-xl font-semibold tracking-[-0.01em]">{title}</h1>
            {description && <p className="mt-1 text-13 text-slate-500">{description}</p>}
            <div className="mt-6">{children}</div>
          </div>
          {footer && <div className="px-4 pb-2 pt-3 text-center text-13 text-slate-500">{footer}</div>}
        </div>
      </main>
      <p className="mt-8 text-center text-xs text-slate-400">© {new Date().getFullYear()} {APP_NAME}</p>
    </div>
  );
}
