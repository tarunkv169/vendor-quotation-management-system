import { forwardRef } from 'react';
import { cn } from '@/utils/cn';
import FormField from './FormField';

/** Native select (accessible, keyboard friendly). options: [{ value, label }]. */
const Select = forwardRef(function Select(
  { label, required, error, hint, options = [], placeholder, className, selectClassName, id, ...props },
  ref,
) {
  return (
    <FormField label={label} required={required} error={error} hint={hint} id={id} className={className}>
      {(field) => (
        <select ref={ref} {...field} {...props} required={required} className={cn('input-base select-base', error && 'input-error', selectClassName)}>
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </FormField>
  );
});

export default Select;
