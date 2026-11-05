import StatusBadge from '@/components/common/StatusBadge';
import { humanize } from '@/utils/constants';

/** Value of an ExtractedField ({ value, rawText, confidence, ambiguous }); null when the field was not found. */
const fieldValue = (field) => (field && (field.value !== null && field.value !== undefined ? field.value : field.rawText)) ?? null;

function ConfidenceDot({ field }) {
  const level = field?.confidence?.level;
  if (!level) return null;
  const tone = level === 'HIGH' ? 'bg-success' : level === 'MEDIUM' ? 'bg-warning' : 'bg-danger';
  return <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${tone}`} title={`${humanize(level)} confidence${field.ambiguous ? ' · ambiguous' : ''}`} aria-label={`${humanize(level)} confidence`} />;
}

function Row({ label, field }) {
  const value = fieldValue(field);
  if (value === null || value === '') return null; // only fields the service actually returned
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-13">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd className="flex min-w-0 items-center gap-2 text-right font-medium text-slate-900">
        <span className="break-words">{String(value)}</span>
        <ConfidenceDot field={field} />
      </dd>
    </div>
  );
}

/**
 * Compact, structured view of an extraction result (the full page is /extraction/:id).
 * Shows only the fields returned by the AI Extraction Service; nothing is computed here.
 */
export default function ExtractionResult({ extraction }) {
  const q = extraction?.quotation;
  if (!q) return <p className="text-13 text-slate-500">The service returned no quotation data for this attempt.</p>;
  const items = (q.items || []).filter((item) => fieldValue(item.productName) !== null || fieldValue(item.unitPrice) !== null);

  return (
    <div className="space-y-4">
      <dl className="divide-y divide-slate-100">
        <Row label="Vendor" field={q.vendor?.name} />
        <Row label="Vendor email" field={q.vendor?.email} />
        <Row label="Vendor tax ID" field={q.vendor?.taxId} />
        <Row label="Quotation number" field={q.quotationNumber} />
        <Row label="Quotation date" field={q.quotationDate} />
        <Row label="Valid until" field={q.validUntil} />
        <Row label="Currency" field={q.financials?.currencyCode} />
        <Row label="Subtotal (stated)" field={q.financials?.subtotalStated} />
        <Row label="Tax (stated)" field={q.financials?.taxAmountStated} />
        <Row label="Total (stated)" field={q.financials?.totalAmountStated} />
      </dl>

      {items.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-line">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-50/70 text-left text-slate-500">
              <tr>
                <th className="px-2.5 py-2 font-medium">Item</th>
                <th className="px-2.5 py-2 text-right font-medium">Qty</th>
                <th className="px-2.5 py-2 text-right font-medium">Unit price</th>
                <th className="px-2.5 py-2 text-right font-medium">Tax %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item, index) => (
                <tr key={item.lineNumber ?? index}>
                  <td className="max-w-40 truncate px-2.5 py-1.5 text-slate-800" title={String(fieldValue(item.productName) ?? '')}>
                    {fieldValue(item.productName) ?? '—'}
                  </td>
                  <td className="num px-2.5 py-1.5 text-right text-slate-800">{fieldValue(item.quantity) ?? '—'}</td>
                  <td className="num px-2.5 py-1.5 text-right text-slate-800">{fieldValue(item.unitPrice) ?? '—'}</td>
                  <td className="num px-2.5 py-1.5 text-right text-slate-800">{fieldValue(item.taxRatePercent) ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {extraction.requiresHumanReview && <StatusBadge status="NEEDS_REVIEW" label="Human review required" />}
    </div>
  );
}
