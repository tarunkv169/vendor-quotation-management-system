import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Building, ClipboardList, CornerDownLeft, Search } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useDebounce } from '@/hooks/useDebounce';
import { NAV_SECTIONS } from '@/routes/navigation';
import { cn } from '@/utils/cn';
import { procurementService } from '@/features/procurement/procurementService';
import { vendorService } from '@/features/vendors/vendorService';
import StatusBadge from '@/components/common/StatusBadge';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
export const SHORTCUT_LABEL = isMac ? '⌘K' : 'Ctrl+K';

/**
 * Global search (Ctrl+K / ⌘K): jumps to pages the user can open, and searches procurement
 * requests and vendors through the existing search endpoints.
 */
export default function CommandPalette({ open, onClose }) {
  const navigate = useNavigate();
  const { can, canAccess } = useAuth();
  const [text, setText] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef(null);
  const keyword = useDebounce(text.trim(), 250);
  const searchable = keyword.length >= 2;

  const pages = useMemo(
    () =>
      NAV_SECTIONS.flatMap((section) => section.items.filter((item) => canAccess(item.module)).map((item) => ({ ...item, section: section.label }))),
    [canAccess],
  );

  const requests = useQuery({
    queryKey: ['palette', 'procurement', keyword],
    queryFn: ({ signal }) => procurementService.list({ scope: can('procurement.viewAll') ? 'all' : 'mine', keyword, size: 5 }, signal),
    enabled: open && searchable && canAccess('procurement'),
    meta: { silent: true },
  });
  const vendors = useQuery({
    queryKey: ['palette', 'vendors', keyword],
    queryFn: ({ signal }) => vendorService.list({ keyword, size: 5 }, signal),
    enabled: open && searchable && canAccess('vendors'),
    meta: { silent: true },
  });

  const results = useMemo(() => {
    const lower = text.trim().toLowerCase();
    const pageHits = pages
      .filter((item) => !lower || item.label.toLowerCase().includes(lower) || item.section.toLowerCase().includes(lower))
      .map((item) => ({ key: `page:${item.to}`, group: 'Pages', icon: item.icon, label: item.label, hint: item.section, to: item.to }));
    const requestHits = searchable
      ? (requests.data?.content || []).map((row) => ({ key: `pr:${row.id}`, group: 'Procurement requests', icon: ClipboardList, label: row.title, status: row.status, to: `/procurement/${row.id}` }))
      : [];
    const vendorHits = searchable
      ? (vendors.data?.content || []).map((row) => ({ key: `v:${row.id}`, group: 'Vendors', icon: Building, label: row.name, hint: row.email, to: `/vendors/${row.id}` }))
      : [];
    return [...pageHits, ...requestHits, ...vendorHits];
  }, [pages, text, searchable, requests.data, vendors.data]);

  useEffect(() => {
    if (!open) return undefined;
    setText('');
    setCursor(0);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    document.body.style.overflow = 'hidden';
    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => setCursor(0), [text]);

  if (!open) return null;

  const go = (item) => {
    onClose();
    navigate(item.to);
  };

  const onKeyDown = (event) => {
    if (event.key === 'Escape') onClose();
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setCursor((value) => Math.min(value + 1, results.length - 1));
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setCursor((value) => Math.max(value - 1, 0));
    }
    if (event.key === 'Enter' && results[cursor]) go(results[cursor]);
  };

  const loading = searchable && (requests.isFetching || vendors.isFetching);
  let lastGroup = null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]" role="presentation">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-label="Search" className="relative w-full max-w-xl overflow-hidden rounded-lg border border-line bg-surface shadow-2xl" onKeyDown={onKeyDown}>
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          <input
            ref={inputRef}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Search pages, requests and vendors…"
            className="h-12 w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
            aria-label="Search"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-results"
            aria-activedescendant={results[cursor] ? `palette-${cursor}` : undefined}
          />
          <kbd className="rounded border border-line px-1.5 py-0.5 text-2xs text-slate-500">Esc</kbd>
        </div>
        <ul id="palette-results" role="listbox" className="max-h-[50vh] overflow-y-auto py-1.5">
          {results.length === 0 && (
            <li className="px-4 py-8 text-center text-13 text-slate-500">{loading ? 'Searching…' : `No results for "${text.trim()}"`}</li>
          )}
          {results.map((item, index) => {
            const header = item.group !== lastGroup ? item.group : null;
            lastGroup = item.group;
            const Icon = item.icon;
            return (
              <li key={item.key} role="presentation">
                {header && <p className="px-4 pb-1 pt-2.5 text-2xs font-semibold uppercase tracking-[0.06em] text-slate-400">{header}</p>}
                <button
                  id={`palette-${index}`}
                  type="button"
                  role="option"
                  aria-selected={index === cursor}
                  onMouseEnter={() => setCursor(index)}
                  onClick={() => go(item)}
                  className={cn('flex w-full items-center gap-3 px-4 py-2 text-left text-13', index === cursor ? 'bg-slate-100 text-slate-900' : 'text-slate-700')}
                >
                  <Icon className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.status && <StatusBadge status={item.status} />}
                  {item.hint && <span className="hidden max-w-48 truncate text-xs text-slate-400 sm:block">{item.hint}</span>}
                  {index === cursor && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />}
                </button>
              </li>
            );
          })}
          {loading && results.length > 0 && <li className="px-4 py-2 text-xs text-slate-400">Searching…</li>}
        </ul>
      </div>
    </div>,
    document.body,
  );
}
