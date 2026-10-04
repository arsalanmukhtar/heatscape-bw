import { useEffect, useState } from 'react';

const OPEN_MS = 280;
const CLOSE_MS = 160;

/*
  Panel for a map nav control. It opens from the top of the control column (level with the
  chevron), to the left of the controls, and may use the full map height before scrolling.
  Motion: the panel unrolls downward from its top edge (clip-path) while drifting in from
  the right; rows passed through children(shown) can stagger in. Closing rolls it back up
  quicker. Deliberately different from the column's fold animation.
*/
export function ControlPopover({ open, label, children }) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      // Two frames so the closed state paints first and the transition runs.
      let inner = 0;
      const outer = requestAnimationFrame(() => (inner = requestAnimationFrame(() => setShown(true))));
      return () => {
        cancelAnimationFrame(outer);
        cancelAnimationFrame(inner);
      };
    }
    setShown(false);
    const timer = setTimeout(() => setMounted(false), CLOSE_MS);
    return () => clearTimeout(timer);
  }, [open]);

  if (!mounted) return null;
  return (
    <div
      role="dialog"
      aria-label={label}
      className="absolute right-full top-0 mr-2 flex max-h-full flex-col overflow-hidden border border-border-strong bg-surface-strong shadow-[var(--shadow-glass)] backdrop-blur-md"
      style={{
        pointerEvents: shown ? 'auto' : 'none',
        clipPath: shown ? 'inset(0 0 0 0)' : 'inset(0 0 100% 0)',
        opacity: shown ? 1 : 0,
        transform: shown ? 'none' : 'translateX(8px)',
        transition: `clip-path ${shown ? OPEN_MS : CLOSE_MS}ms cubic-bezier(0.16, 1, 0.3, 1), opacity ${shown ? OPEN_MS : CLOSE_MS}ms ease-out, transform ${shown ? OPEN_MS : CLOSE_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`,
      }}
    >
      {children(shown)}
    </div>
  );
}

/** Style for row i of a popover list: fades and slides in after the panel starts unrolling. */
export const popoverRowStyle = (shown, i) => ({
  opacity: shown ? 1 : 0,
  transform: shown ? 'none' : 'translateX(6px)',
  transition: 'opacity 200ms ease-out, transform 240ms cubic-bezier(0.16, 1, 0.3, 1)',
  transitionDelay: shown ? `${60 + i * 18}ms` : '0ms',
});
