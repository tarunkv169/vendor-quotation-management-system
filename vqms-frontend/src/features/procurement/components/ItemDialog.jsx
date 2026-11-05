import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Modal from '@/components/common/Modal';
import Button from '@/components/common/Button';
import Alert from '@/components/common/Alert';
import { applyFieldErrors } from '@/utils/errors';
import ItemFields from './ItemFields';
import { emptyItem, itemSchema, toItemPayload } from './procurementSchemas';

/** Add / edit one procurement item. onSave(payload) must return a promise. */
export default function ItemDialog({ open, item, onClose, onSave }) {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(itemSchema), defaultValues: emptyItem });

  useEffect(() => {
    if (!open) return;
    reset(
      item
        ? {
            description: item.description || '',
            quantity: String(item.quantity ?? 1),
            unit: item.unit || '',
            expectedUnitPrice: item.expectedUnitPrice != null ? String(item.expectedUnitPrice) : '',
            category: item.category || '',
            specification: item.specification || '',
            priority: item.priority || '',
          }
        : emptyItem,
    );
  }, [open, item, reset]);

  const submit = handleSubmit(async (values) => {
    try {
      await onSave(toItemPayload(values));
    } catch (error) {
      if (!applyFieldErrors(error, setError)) setError('root', { message: error.message });
    }
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={item ? 'Edit item' : 'Add item'}
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
        <ItemFields register={register} errors={errors} />
      </form>
    </Modal>
  );
}
