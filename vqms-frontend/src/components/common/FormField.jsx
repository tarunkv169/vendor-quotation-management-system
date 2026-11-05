import { useId } from 'react';

/** Label + control + hint/error. Children receive the generated id via render prop or cloneless id. */
export default function FormField({ label, required, error, hint, id, className, children }) {
  const generated = useId();
  const fieldId = id || generated;
  const describedBy = error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined;

  return (
    <div className={className}>
      {label && (
        <label htmlFor={fieldId} className="label-base">
          {label}
          {required && (
            <span className="ml-0.5 text-red-600" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      {typeof children === 'function' ? children({ id: fieldId, 'aria-describedby': describedBy, 'aria-invalid': Boolean(error) }) : children}
      {error ? (
        <p id={`${fieldId}-error`} className="mt-1 text-xs text-red-600">
          {error}
        </p>
      ) : hint ? (
        <p id={`${fieldId}-hint`} className="mt-1 text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
