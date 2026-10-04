import { useRef } from 'react';
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
      <h2 className="text-xs font-medium uppercase tracking-[var(--tracking-caps)] text-muted">{title}</h2>
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

function PanelInfo({ text }) {
  return (
    <span className="group relative">
      <button
        type="button"
        aria-label={text}
        className="grid size-7 place-items-center text-muted hover:bg-hover hover:text-text group-hover:text-text"
      >
        <LuInfo size={14} />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none invisible absolute right-0 top-full z-40 mt-1 w-64 translate-y-1 border border-border-strong bg-surface-strong px-3 py-2.5 text-xs leading-relaxed text-text opacity-0 shadow-[var(--shadow-glass)] transition-[opacity,transform,visibility] duration-150 ease-out group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-has-[:focus-visible]:visible group-has-[:focus-visible]:translate-y-0 group-has-[:focus-visible]:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}
