import { forwardRef } from 'react';
import Select from './Select';
import Input from './Input';

const UUID_PATTERN = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';

/**
 * Select of related records (vendor, procurement request…). When the lookup returns nothing
 * (no permission to list, or still empty) it becomes a UUID text field so the user can paste an ID.
 */
const EntitySelect = forwardRef(function EntitySelect({ options, loading, placeholder = 'Select…', hint, ...props }, ref) {
  if (!loading && (!options || options.length === 0)) {
    return <Input ref={ref} placeholder="Paste the ID" pattern={UUID_PATTERN} hint={hint || 'No records available to choose from — enter the ID.'} {...props} />;
  }
  return <Select ref={ref} options={options || []} placeholder={loading ? 'Loading…' : placeholder} hint={hint} {...props} />;
});

export default EntitySelect;

export const isUuid = (value) => new RegExp(`^${UUID_PATTERN}$`).test(value || '');
