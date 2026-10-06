import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Single-line text that truncates with an ellipsis; when it is cut off, hovering it shows
 * the full text in a tooltip below it. The tooltip is portalled to the body (fixed), so
 * scrolling panels do not clip it.
 */
export function OverflowText({ children, className = '', tip }) {
  const ref = useRef(null);
  const [at, setAt] = useState(null);
  const show = () => {
    const el = ref.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    const r = el.getBoundingClientRect();
    setAt({ left: r.left, top: r.bottom + 6 });
  };
  return (
    <>
      <span ref={ref} onMouseEnter={show} onMouseLeave={() => setAt(null)} className={`min-w-0 truncate ${className}`}>
        {children}
      </span>
      {at &&
        createPortal(
          <span
            role="tooltip"
            className="pop-in pointer-events-none fixed z-[60] max-w-[min(24rem,calc(100vw-2rem))] whitespace-normal border border-border-strong bg-surface-strong px-2.5 py-1.5 text-xs text-text shadow-[var(--shadow-glass)]"
            style={{ left: at.left, top: at.top }}
          >
            {tip ?? children}
          </span>,
          document.body,
        )}
    </>
  );
}
