import { useState } from 'react';
import Button from '@/components/common/Button';
import Modal from '@/components/common/Modal';
import { Textarea } from '@/components/common/Input';
import Alert from '@/components/common/Alert';

/**
 * POST /recommendations/{id}/submit-for-approval body: { comment?, reviewAcknowledged }.
 * A recommendation that needs review can only be submitted after the user acknowledges the flagged points.
 * Mount it with a `key` per recommendation so the form starts empty each time.
 */
export default function SubmitForApprovalDialog({ open, onClose, requiresReview, reviewReasons, onSubmit, loading }) {
  const [comment, setComment] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Submit for approval"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={() => onSubmit({ comment: comment.trim() || undefined, reviewAcknowledged: acknowledged })} disabled={requiresReview && !acknowledged} loading={loading}>
            Submit
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {requiresReview && (
          <Alert tone="warning" title="This recommendation needs review">
            <ul className="list-disc pl-4">
              {(reviewReasons || []).map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </Alert>
        )}
        <Textarea label="Comment" maxLength={1000} value={comment} onChange={(event) => setComment(event.target.value)} />
        {requiresReview && (
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} className="checkbox-base mt-0.5" />I reviewed the flagged points and still want to submit.
          </label>
        )}
      </div>
    </Modal>
  );
}
