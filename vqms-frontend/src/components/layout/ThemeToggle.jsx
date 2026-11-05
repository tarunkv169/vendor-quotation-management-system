import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/utils/theme';
import { cn } from '@/utils/cn';

/** Round icon button that switches between the light and dark theme (sun = switch to light, moon = switch to dark). */
export default function ThemeToggle({ className }) {
  const { theme, toggleTheme } = useTheme();
  const toLight = theme === 'dark';
  const label = toLight ? 'Switch to light theme' : 'Switch to dark theme';
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line bg-surface text-slate-600 transition-colors hover:border-line-strong hover:text-slate-900',
        className,
      )}
    >
      {toLight ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
    </button>
  );
}
