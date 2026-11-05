import Input, { Textarea } from '@/components/common/Input';

/** Fields of one quotation line (prefix "items.0." inside the form array, "" in the item dialog). */
export default function QuotationItemFields({ register, errors = {}, prefix = '' }) {
  const field = (name) => `${prefix}${name}`;
  return (
    <div className="grid gap-3 sm:grid-cols-6">
      <Input label="Item name" required error={errors.itemName?.message} {...register(field('itemName'))} className="sm:col-span-3" />
      <Input label="Unit" required placeholder="e.g. pcs" error={errors.unit?.message} {...register(field('unit'))} className="sm:col-span-3" />
      <Input label="Quantity" type="number" min="1" step="1" required error={errors.quantity?.message} {...register(field('quantity'))} className="sm:col-span-2" />
      <Input label="Unit price" type="number" min="0" step="0.01" required error={errors.unitPrice?.message} {...register(field('unitPrice'))} className="sm:col-span-2" />
      <Input label="Delivery days" type="number" min="0" step="1" error={errors.deliveryDays?.message} {...register(field('deliveryDays'))} className="sm:col-span-2" />
      <Textarea label="Description" rows={2} error={errors.description?.message} {...register(field('description'))} className="sm:col-span-3" />
      <Textarea label="Specification" rows={2} error={errors.specification?.message} {...register(field('specification'))} className="sm:col-span-3" />
    </div>
  );
}
