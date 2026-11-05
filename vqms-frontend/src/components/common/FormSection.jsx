import Button from './Button';

/** Settings-style row: heading and guidance on the left, fields on the right. Use inside `card divide-y`. */
export default function FormSection({ title, description, aside, children }) {
  return (
    <section className="grid gap-x-8 gap-y-4 px-5 py-6 md:grid-cols-[220px_1fr]">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && <p className="mt-1 text-xs leading-relaxed text-slate-500">{description}</p>}
        {aside && <div className="mt-3">{aside}</div>}
      </div>
      <div className="min-w-0 space-y-4">{children}</div>
    </section>
  );
}

/** Sticky footer of a sectioned form: note on the left, Cancel + submit on the right. */
export function FormActions({ note, onCancel, submitLabel, loading, disabled }) {
  return (
    <div className="sticky bottom-0 flex flex-col-reverse gap-2 rounded-b-md bg-surface/95 px-5 py-3 backdrop-blur sm:flex-row sm:items-center sm:justify-end">
      {note && <p className="text-xs text-slate-500 sm:mr-auto">{note}</p>}
      <Button variant="secondary" onClick={onCancel} disabled={loading}>
        Cancel
      </Button>
      <Button type="submit" loading={loading} disabled={disabled}>
        {submitLabel}
      </Button>
    </div>
  );
}
