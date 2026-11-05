import Input, { Textarea } from '@/components/common/Input';

/**
 * Fields of one procurement item, used by the request form (field array, `prefix` = "items.0.")
 * and by the item dialog on the detail page (prefix = "").
 */
export default function ItemFields({ register, errors = {}, prefix = '' }) {
  const field = (name) => `${prefix}${name}`;
  return (
    <div className="grid gap-3 sm:grid-cols-6">
      <Input label="Description" required error={errors.description?.message} {...register(field('description'))} className="sm:col-span-6" />
      <Input label="Quantity" type="number" min="1" step="1" required error={errors.quantity?.message} {...register(field('quantity'))} className="sm:col-span-2" />
      <Input label="Unit" required placeholder="e.g. pcs" error={errors.unit?.message} {...register(field('unit'))} className="sm:col-span-2" />
      <Input
        label="Expected unit price"
        type="number"
        min="0"
        step="0.01"
        required
        error={errors.expectedUnitPrice?.message}
        {...register(field('expectedUnitPrice'))}
        className="sm:col-span-2"
      />
      <Input label="Category" error={errors.category?.message} {...register(field('category'))} className="sm:col-span-3" />
      <Input label="Priority" error={errors.priority?.message} {...register(field('priority'))} className="sm:col-span-3" />
      <Textarea label="Specification" rows={2} error={errors.specification?.message} {...register(field('specification'))} className="sm:col-span-6" />
    </div>
  );
}
