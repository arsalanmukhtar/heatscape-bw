import { useEffect, useRef } from 'react';
import { LuTriangleAlert } from 'react-icons/lu';

/*
  Modal confirmation on the native <dialog> (focus stays inside, Esc and the backdrop
  cancel). The cancel button has focus first, so an accidental Enter never confirms.
  tone: danger (destructive action, solid --destructive button) | default (accent).
*/
export function ConfirmDialog({ open, title, children, confirmLabel, cancelLabel, onConfirm, onCancel, tone = 'danger' }) {
  const ref = useRef(null);
  const cancelRef = useRef(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      cancelRef.current?.focus();
    } else if (!open && d.open) d.close();
  }, [open]);

  const danger = tone === 'danger';
  return (
    <dialog
      ref={ref}
      aria-labelledby="confirm-title"
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      onClick={(e) => e.target === ref.current && onCancel()}
      className="m-auto w-[min(26rem,calc(100vw-2rem))] border border-border-strong bg-surface-strong p-0 text-text shadow-[var(--shadow-glass)] backdrop:bg-bg-deep/60"
    >
      <div className="flex items-start gap-3 px-5 pb-4 pt-5">
        {danger && (
          <span className="grid size-9 shrink-0 place-items-center" style={{ color: 'var(--danger)', background: 'var(--danger-soft)' }} aria-hidden>
            <LuTriangleAlert size={17} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2 id="confirm-title" className="text-md font-semibold text-text">
            {title}
          </h2>
          <div className="mt-1.5 text-justify text-sm text-muted">{children}</div>
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
        <button ref={cancelRef} type="button" onClick={onCancel} className="flex h-8 items-center border border-border-strong px-3 text-xs text-text hover:bg-hover">
          <span>{cancelLabel}</span>
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={`flex h-8 items-center px-3 text-xs font-semibold hover:brightness-110 ${danger ? 'bg-[var(--destructive)] text-[var(--on-destructive)]' : 'bg-accent text-on-accent'}`}
        >
          <span>{confirmLabel}</span>
        </button>
      </div>
    </dialog>
  );
}
