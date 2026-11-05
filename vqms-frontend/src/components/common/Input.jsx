import { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/utils/cn';
import FormField from './FormField';

/** Text input with label/error. Works with react-hook-form `register()` (ref forwarded). */
const Input = forwardRef(function Input({ label, required, error, hint, className, inputClassName, id, ...props }, ref) {
  return (
    <FormField label={label} required={required} error={error} hint={hint} id={id} className={className}>
      {(field) => (
        <input ref={ref} {...field} {...props} required={required} className={cn('input-base', error && 'input-error', inputClassName)} />
      )}
    </FormField>
  );
});

/** Password input with a show/hide toggle. Same API as Input. */
export const PasswordInput = forwardRef(function PasswordInput({ label, required, error, hint, className, inputClassName, id, ...props }, ref) {
  const [visible, setVisible] = useState(false);
  return (
    <FormField label={label} required={required} error={error} hint={hint} id={id} className={className}>
      {(field) => (
        <div className="relative">
          <input
            ref={ref}
            {...field}
            {...props}
            type={visible ? 'text' : 'password'}
            required={required}
            className={cn('input-base pr-10', error && 'input-error', inputClassName)}
          />
          <button
            type="button"
            onClick={() => setVisible((value) => !value)}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-slate-400 hover:text-slate-700"
            aria-label={visible ? 'Hide password' : 'Show password'}
            aria-pressed={visible}
          >
            {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>
      )}
    </FormField>
  );
});

export const Textarea = forwardRef(function Textarea({ label, required, error, hint, className, rows = 3, id, ...props }, ref) {
  return (
    <FormField label={label} required={required} error={error} hint={hint} id={id} className={className}>
      {(field) => (
        <textarea ref={ref} rows={rows} {...field} {...props} required={required} className={cn('input-base', error && 'input-error')} />
      )}
    </FormField>
  );
});

export default Input;
