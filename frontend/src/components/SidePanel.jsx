import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LuInfo } from 'react-icons/lu';
import { PANEL_MAX, PANEL_MIN, useLayout } from '../state/layout';
import { ResizeHandle } from './ResizeHandle';

/*
  Animates its width between 0 and the target so the map flexes smoothly. The inner box
  keeps the full width during the animation, so content never reflows.
  width: px or null (null = defaultWidth token). overlay: below 1024px the panel floats
  over the map instead of shrinking it.
*/
export function SidePanel({ side, open, width, defaultWidth, onResize, overlay, label, children }) {
  const ref = useRef(null);
  const dragging = useLayout((s) => s.dragging);
  const target = width != null ? `${width}px` : defaultWidth;

  return (
    <aside
      ref={ref}
      aria-label={label}
      aria-hidden={!open}
      inert={!open}
      className={`shrink-0 overflow-visible bg-surface ${dragging ? '' : 'layout-transition'} ${
        side === 'left' ? 'border-r' : 'border-l'
      } ${open ? 'border-border' : 'border-transparent'} ${
        overlay ? `absolute bottom-0 top-0 z-30 ${side === 'left' ? 'left-[var(--rail-w)]' : 'right-0'} shadow-[var(--shadow-glass)]` : 'relative'
      }`}
      style={{ width: open ? target : 0 }}
    >
      <div className="h-full overflow-hidden">
        <div className="flex h-full flex-col" style={{ width: target }}>
          {children}
        </div>
      </div>
      {open && !overlay && (
        <ResizeHandle
          edge={side === 'left' ? 'right' : 'left'}
          label={`Resize ${label}`}
          getSize={() => ref.current?.getBoundingClientRect().width ?? 0}
          onResize={(w) => onResize(Math.max(PANEL_MIN, Math.min(PANEL_MAX, w)))}
          onReset={() => onResize(null)}
        />
      )}
    </aside>
  );
}

/* Panel header. info: panel-specific note (caveats, disclaimers) shown from an ⓘ button
   left of the actions, on hover or keyboard focus, instead of a strip inside the panel. */
export function PanelHeader({ title, meta, actions, info }) {
  return (
    <div className="flex h-11 shrink-0 items-center border-b border-border px-4">
      <h2 className="text-trim shrink-0 text-xs font-medium uppercase tracking-[var(--tracking-caps)] text-muted">{title}</h2>
      {meta && <div className="ml-2.5 min-w-0">{meta}</div>}
      {(actions || info) && (
        <div className="ml-auto flex items-center gap-1">
          {info && <PanelInfo text={info} />}
          {actions}
        </div>
      )}
    </div>
  );
}

const NOTE_W = 256;

/* The note renders in a portal at fixed position, kept inside the window, so a panel's
   overflow never clips it (panels near the left edge open it rightwards). */
function PanelInfo({ text }) {
  const btnRef = useRef(null);
  const [pos, setPos] = useState(null);
  const show = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    setPos({ top: r.bottom + 4, left: Math.max(8, Math.min(r.right - NOTE_W, window.innerWidth - NOTE_W - 8)) });
  };
  const hide = () => setPos(null);
  return (
    <span className="flex" onMouseEnter={show} onMouseLeave={hide}>
      <button
        ref={btnRef}
        type="button"
        aria-label={text}
        onFocus={show}
        onBlur={hide}
        className={`grid size-7 place-items-center hover:bg-hover hover:text-text ${pos ? 'text-text' : 'text-muted'}`}
      >
        <LuInfo size={14} />
      </button>
      {pos &&
        createPortal(
          <span
            role="tooltip"
            className="pop-in pointer-events-none fixed z-[70] border border-border-strong bg-surface-strong px-3 py-2.5 text-justify text-xs leading-relaxed text-text hyphens-auto shadow-[var(--shadow-glass)]"
            style={{ ...pos, width: NOTE_W }}
          >
            {text}
          </span>,
          document.body,
        )}
    </span>
  );
}
