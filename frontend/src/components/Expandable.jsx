import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LuExpand, LuShrink } from 'react-icons/lu';
import { t } from '../i18n';
import { useLayout } from '../state/layout';

export const MAP_OVERLAY_ID = 'map-overlay';

/* Mounted slots per id. A view restores only when its last slot unmounts, so the dock can
   hand an expanded tab from its body slot to an overlay-only slot without closing it. */
const mounted = new Map();

// Placeholder crossfade: default state fades out, hover/focus state fades in.
const SWAP_OUT = 'transition-opacity duration-200 ease-out group-hover:opacity-0 group-focus-visible:opacity-0';
const SWAP_IN = 'opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-100 group-focus-visible:opacity-100';

/*
  Universal expand for compact elements (tables, charts). Put ExpandButton in the element's
  header and wrap its body in ExpandSlot with the same id. Expanded, the body moves into
  an overlay that covers the map container edge to edge; the element's own button, the
  placeholder's Restore button or Esc restores it. One element at a time.
*/
export function ExpandButton({ id, className = '' }) {
  const expanded = useLayout((s) => s.expanded === id);
  const toggle = useLayout((s) => s.toggleExpanded);
  const label = expanded ? t.expand.close : t.expand.open;
  return (
    <button
      type="button"
      onClick={() => toggle(id)}
      aria-label={label}
      title={label}
      aria-pressed={expanded}
      className={`grid size-7 shrink-0 place-items-center hover:bg-hover ${expanded ? 'text-accent' : 'text-muted hover:text-text'} ${className}`}
    >
      {expanded ? <LuShrink size={13} /> : <LuExpand size={13} />}
    </button>
  );
}

/**
 * Renders children(large) inline, or in the map overlay when this id is expanded.
 * large is true in the overlay so charts can draw at a bigger internal size.
 * actions: extra controls for the overlay header (e.g. filter, export).
 * overlayOnly: render nothing in place, only the overlay while expanded.
 * placeholderOnly: render inline, or the placeholder while expanded, never the overlay.
 * The dock pairs them: one stable overlayOnly slot for the focused tab and a
 * placeholderOnly slot for the active tab, so switching tabs never remounts the overlay.
 */
export function ExpandSlot({ id, title, actions, overlayOnly = false, placeholderOnly = false, children }) {
  const expanded = useLayout((s) => s.expanded === id);
  const close = useLayout((s) => s.closeExpanded);
  const [target, setTarget] = useState(() => document.getElementById(MAP_OVERLAY_ID));
  const [shown, setShown] = useState(false);
  const boxRef = useRef(null);
  const inlineHeight = useRef(0);

  // Remember the inline height so the placeholder keeps the element's footprint.
  useLayoutEffect(() => {
    if (!expanded && boxRef.current) inlineHeight.current = boxRef.current.offsetHeight;
  });

  useEffect(() => {
    if (!expanded) return setShown(false);
    setTarget(document.getElementById(MAP_OVERLAY_ID));
    const frame = requestAnimationFrame(() => setShown(true));
    const esc = (e) => e.key === 'Escape' && close();
    document.addEventListener('keydown', esc);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', esc);
    };
  }, [expanded, close]);

  // Restore when the last slot for this id goes away (e.g. the panel holding it closes).
  useEffect(() => {
    mounted.set(id, (mounted.get(id) ?? 0) + 1);
    return () => {
      mounted.set(id, mounted.get(id) - 1);
      queueMicrotask(() => {
        if (!mounted.get(id) && useLayout.getState().expanded === id) close();
      });
    };
  }, [id, close]);

  if (overlayOnly && (!expanded || !target)) return null;
  if (!expanded || !target) {
    return (
      <div ref={boxRef} className="flex min-h-0 flex-1 flex-col">
        {children(false)}
      </div>
    );
  }

  return (
    <>
      {/* Keeps the element's footprint: one short line and the restore control. */}
      {!overlayOnly && (
        <div
          className="flex min-h-10 flex-1 items-center justify-center gap-3 border border-dashed border-border-strong bg-field px-3"
          style={{ height: inlineHeight.current || undefined }}
        >
          {/* One text control: IN FOCUS crossfades to an orange RESTORE on hover or focus. Both
              words share a grid cell (centred), so the swap never shifts the layout; all caps,
              so cap-height trimming centres them exactly. */}
          <button
            type="button"
            onClick={close}
            aria-label={t.expand.close}
            className="group grid cursor-pointer place-items-center text-xs font-bold uppercase tracking-[var(--tracking-caps)]"
          >
            <span className={`${SWAP_OUT} text-trim col-start-1 row-start-1 text-text`} aria-hidden>
              {t.expand.focused}
            </span>
            <span className={`${SWAP_IN} text-trim col-start-1 row-start-1 text-accent`} aria-hidden>
              {t.expand.restore}
            </span>
          </button>
        </div>
      )}
      {!placeholderOnly &&
        createPortal(
          <section
            aria-label={title}
            className="pointer-events-auto absolute inset-0 flex flex-col bg-surface-strong backdrop-blur-md"
            style={{
              opacity: shown ? 1 : 0,
              transform: shown ? 'none' : 'scale(0.98)',
              transformOrigin: 'center',
              transition: 'opacity 200ms ease-out, transform 240ms cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {/* Same height as PanelHeader (h-11) so its bottom border lines up with both side panels. */}
            <header className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-4">
              <h2 className="text-xs font-medium uppercase tracking-[var(--tracking-caps)] text-text">{title}</h2>
              {actions && <div className="ml-auto flex items-center gap-1">{actions}</div>}
            </header>
            <div className="flex min-h-0 flex-1 flex-col overflow-auto p-4">{children(true)}</div>
          </section>,
          target,
        )}
    </>
  );
}
