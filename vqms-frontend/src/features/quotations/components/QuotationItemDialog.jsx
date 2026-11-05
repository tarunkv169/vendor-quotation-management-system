import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Modal from '@/components/common/Modal';
import Button from '@/components/common/Button';
import Alert from '@/components/common/Alert';
import { applyFieldErrors } from '@/utils/errors';
import QuotationItemFields from './QuotationItemFields';
import { emptyQuotationItem, quotationItemSchema, toQuotationItemPayload } from './quotationSchemas';

const text = (value) => (value === null || value === undefined ? '' : String(value));

export default function QuotationItemDialog({ open, item, currency, onClose, onSave }) {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(quotationItemSchema), defaultValues: emptyQuotationItem });

  useEffect(() => {
    if (!open) return;
    reset(
      item
        ? {
            itemName: text(item.itemName),
            description: text(item.description),
            quantity: text(item.quantity),
            unit: text(item.unit),
            unitPrice: text(item.unitPrice),
            specification: text(item.specification),
            deliveryDays: text(item.deliveryDays),
          }
        : emptyQuotationItem,
    );
  }, [open, item, reset]);

  const submit = handleSubmit(async (values) => {
    try {
      await onSave(toQuotationItemPayload(values, currency));
    } catch (error) {
      if (!applyFieldErrors(error, setError)) setError('root', { message: error.message });
    }
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={item ? 'Edit line item' : 'Add line item'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={submit} loading={isSubmitting}>
            {item ? 'Save item' : 'Add item'}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        {errors.root && <Alert tone="error">{errors.root.message}</Alert>}
        <QuotationItemFields register={register} errors={errors} />
      </form>
    </Modal>
  );
}
