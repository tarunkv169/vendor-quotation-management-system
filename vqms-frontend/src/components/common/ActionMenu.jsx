import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Ellipsis } from 'lucide-react';
import { cn } from '@/utils/cn';

const MENU_WIDTH = 208;

/**
 * "More actions" button with a dropdown menu. The menu is rendered in a portal with fixed
 * positioning, so it is not clipped by scrolling tables.
 * items: [{ key, label, icon?, onClick, tone?: 'danger', disabled?, divider? }]
 */
export default function ActionMenu({ items, label = 'More actions', className }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const menuHeight = menuRef.current?.offsetHeight || items.length * 36 + 8;
    const below = rect.bottom + 6 + menuHeight <= window.innerHeight;
    setPosition({
      top: below ? rect.bottom + 6 : Math.max(8, rect.top - 6 - menuHeight),
      left: Math.min(Math.max(8, rect.right - MENU_WIDTH), window.innerWidth - MENU_WIDTH - 8),
    });
  }, [open, items.length]);

  useEffect(() => {
    if (!open) return undefined;
    const close = () => setOpen(false);
    const onPointer = (event) => {
      if (!menuRef.current?.contains(event.target) && !buttonRef.current?.contains(event.target)) close();
    };
    const onKey = (event) => {
      if (event.key === 'Escape') {
        close();
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    menuRef.current?.querySelector('button:not([disabled])')?.focus();
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  const onMenuKey = (event) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const buttons = [...(menuRef.current?.querySelectorAll('button:not([disabled])') || [])];
    const index = buttons.indexOf(document.activeElement);
    const next = event.key === 'ArrowDown' ? (index + 1) % buttons.length : (index - 1 + buttons.length) % buttons.length;
    buttons[next]?.focus();
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-md border border-line bg-surface text-slate-600 transition-colors hover:border-line-strong hover:text-slate-900',
          open && 'border-line-strong text-slate-900',
          className,
        )}
      >
        <Ellipsis className="h-4 w-4" aria-hidden="true" />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            onKeyDown={onMenuKey}
            onClick={(event) => event.stopPropagation()}
            style={{ top: position?.top ?? -9999, left: position?.left ?? -9999, width: MENU_WIDTH }}
            className="fixed z-50 rounded-md border border-line bg-surface py-1 shadow-lg"
          >
            {items.map((item) => (
              <div key={item.key}>
                {item.divider && <div className="my-1 border-t border-line" role="separator" />}
                <button
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={() => {
                    setOpen(false);
                    item.onClick();
                  }}
                  className={cn(
                    'flex w-full items-center gap-2.5 px-3 py-2 text-left text-13 outline-none transition-colors focus:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50',
                    item.tone === 'danger' ? 'text-danger hover:bg-danger/10' : 'text-slate-700 hover:bg-slate-50',
                  )}
                >
                  {item.icon && <item.icon className={cn('h-4 w-4 shrink-0', item.tone === 'danger' ? 'text-danger' : 'text-slate-400')} aria-hidden="true" />}
                  {item.label}
                </button>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
