import { useLayout } from '../state/layout';

/**
 * A 1px border with a 6px invisible hit area. Transitions pause while dragging.
 * edge: 'right' | 'left' | 'top' — the panel edge it sits on, which sets the drag direction.
 * getSize(): current size in px; onResize(px); onReset(): double-click restores the token default.
 */
export function ResizeHandle({ edge, getSize, onResize, onReset, label }) {
  const setDragging = useLayout((s) => s.setDragging);
  const vertical = edge === 'top';

  const onPointerDown = (e) => {
    e.preventDefault();
    const start = vertical ? e.clientY : e.clientX;
    const startSize = getSize();
    const sign = edge === 'right' ? 1 : -1;
    setDragging(true);
    document.body.style.cursor = vertical ? 'row-resize' : 'col-resize';

    const move = (ev) => onResize(startSize + sign * ((vertical ? ev.clientY : ev.clientX) - start));
    const up = () => {
      setDragging(false);
      document.body.style.cursor = '';
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const position = vertical
    ? 'left-0 right-0 -top-[3px] h-1.5 cursor-row-resize'
    : `top-0 bottom-0 w-1.5 cursor-col-resize ${edge === 'right' ? '-right-[3px]' : '-left-[3px]'}`;

  return (
    <div
      role="separator"
      aria-orientation={vertical ? 'horizontal' : 'vertical'}
      aria-label={label}
      onPointerDown={onPointerDown}
      onDoubleClick={onReset}
      className={`group absolute z-20 ${position}`}
    >
      <span
        className={`absolute bg-transparent transition-colors group-hover:bg-accent-line ${
          vertical ? 'inset-x-0 top-[2px] h-0.5' : 'inset-y-0 left-[2px] w-0.5'
        }`}
      />
    </div>
  );
}
