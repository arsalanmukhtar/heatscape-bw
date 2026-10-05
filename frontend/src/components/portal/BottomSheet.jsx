import { useRef, useState } from 'react';
import { portalText } from '../../i18n';
import { usePortal } from '../../state/portal';

// Snap heights as a share of the area under the nav (peek: a fixed strip).
const PEEK_PX = 132;
const SNAPS = ['peek', 'half', 'full'];
export const sheetHeight = (snap, total) => (snap === 'peek' ? PEEK_PX : snap === 'half' ? total * 0.5 : total - 12);
// The same stops as CSS, so the sheet follows window resizes and rotation without measuring.
const SNAP_CSS = { peek: `${PEEK_PX}px`, half: '50%', full: 'calc(100% - 12px)' };

/*
  Mobile bottom sheet over the full-screen map: peek / half / full. Drag the handle (it
  follows the finger and snaps to the nearest stop on release) or press it to step
  through the stops; Enter/Space and the arrow keys work on the handle too.
*/
export function BottomSheet({ id, label, children }) {
  const { sheet, setSheet, lang } = usePortal();
  const p = portalText[lang];
  const ref = useRef(null);
  const drag = useRef(null);
  const [live, setLive] = useState(null); // px while dragging
  const total = () => ref.current?.parentElement?.getBoundingClientRect().height ?? window.innerHeight;

  const onDown = (e) => {
    drag.current = { y: e.clientY, h: sheetHeight(sheet, total()), moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e) => {
    if (!drag.current) return;
    const dy = drag.current.y - e.clientY;
    if (Math.abs(dy) > 4) drag.current.moved = true;
    setLive(Math.max(PEEK_PX, Math.min(total() - 12, drag.current.h + dy)));
  };
  const onUp = () => {
    if (!drag.current) return;
    const { moved } = drag.current;
    drag.current = null;
    if (!moved) {
      setSheet(SNAPS[(SNAPS.indexOf(sheet) + 1) % SNAPS.length]);
    } else if (live != null) {
      const h = total();
      setSheet(SNAPS.reduce((best, s) => (Math.abs(sheetHeight(s, h) - live) < Math.abs(sheetHeight(best, h) - live) ? s : best), 'peek'));
    }
    setLive(null);
  };
  const onKey = (e) => {
    const i = SNAPS.indexOf(sheet);
    if (e.key === 'ArrowUp') setSheet(SNAPS[Math.min(2, i + 1)]);
    else if (e.key === 'ArrowDown') setSheet(SNAPS[Math.max(0, i - 1)]);
    else return;
    e.preventDefault();
  };

  return (
    <section
      ref={ref}
      id={id}
      aria-label={label}
      className={`absolute inset-x-0 bottom-0 z-20 flex flex-col border-t border-border-strong bg-surface-strong shadow-[var(--shadow-glass)] ${live == null ? 'transition-[height] duration-300 ease-out motion-reduce:transition-none' : ''}`}
      style={{ height: live ?? SNAP_CSS[sheet] }}
    >
      <button
        type="button"
        aria-label={p.sheet.handle}
        title={p.sheet.handle}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onKeyDown={onKey}
        // Enter / Space fire a click without pointer events (detail 0): step to the next stop.
        onClick={(e) => e.detail === 0 && setSheet(SNAPS[(SNAPS.indexOf(sheet) + 1) % SNAPS.length])}
        className="grid h-11 w-full shrink-0 touch-none place-items-center"
      >
        <span className="block h-1.5 w-12 bg-border-strong" aria-hidden />
      </button>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
    </section>
  );
}
