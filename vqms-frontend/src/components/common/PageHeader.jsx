/**
 * Page title with right-aligned actions. `description` is accepted for compatibility but not shown:
 * screens are self-explanatory, a sentence under every title only adds noise.
 */
export default function PageHeader({ title, actions, meta }) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-wrap items-center gap-2.5">
        <h1 className="truncate text-xl font-semibold tracking-[-0.01em]">{title}</h1>
        {meta}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
