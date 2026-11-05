import { useMemo } from 'react';

/** Read-only pretty JSON (audit payloads, report data). Accepts an object or a JSON string. */
export default function JsonView({ value, maxHeight = 'max-h-96' }) {
  const text = useMemo(() => {
    if (value === null || value === undefined || value === '') return '';
    if (typeof value === 'string') {
      try {
        return JSON.stringify(JSON.parse(value), null, 2);
      } catch {
        return value;
      }
    }
    return JSON.stringify(value, null, 2);
  }, [value]);

  if (!text) return <p className="text-sm text-slate-400">No data</p>;
  return <pre className={`${maxHeight} overflow-auto rounded-md bg-canvas p-4 font-mono text-xs leading-relaxed text-slate-800`}>{text}</pre>;
}
