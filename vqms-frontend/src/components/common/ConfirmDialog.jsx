import { useEffect, useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import { Textarea } from './Input';

/**
 * Confirmation dialog. With `reasonLabel` it asks for a text (e.g. rejection reason) and passes it
 * to onConfirm(reason). `reasonRequired` blocks confirming with an empty text.
 */
export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  tone = 'primary',
  loading = false,
  reasonLabel,
  reasonRequired = false,
  reasonPlaceholder,
  children,
}) {
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) {
      setReason('');
      setTouched(false);
    }
  }, [open]);

  const missingReason = reasonLabel && reasonRequired && !reason.trim();

  const submit = (event) => {
    event.preventDefault();
    setTouched(true);
    if (missingReason) return;
    onConfirm(reasonLabel ? reason.trim() : undefined);
  };

  return (
    <Modal
      open={open}
      onClose={loading ? undefined : onClose}
      dismissible={!loading}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={submit} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {message && <p className="text-sm text-slate-600">{message}</p>}
        {children}
        {reasonLabel && (
          <Textarea
            label={reasonLabel}
            required={reasonRequired}
            value={reason}
            placeholder={reasonPlaceholder}
            onChange={(event) => setReason(event.target.value)}
            error={touched && missingReason ? `${reasonLabel} is required` : undefined}
            data-autofocus
          />
        )}
      </form>
    </Modal>
  );
}
