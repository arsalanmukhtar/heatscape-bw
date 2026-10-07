import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LuChevronDown, LuSearch } from 'react-icons/lu';
import { t } from '../../i18n';
import { Checkbox } from '../Checkbox';

const v = t.symbology.query.picker;
const SHOWN = 300; // rows rendered at most; typing narrows the rest

/** Options whose label or raw value contains the text (case-insensitive). */
const filterOptions = (options, text) => {
  const s = text.trim().toLowerCase();
  return s ? options.filter((o) => o.label.toLowerCase().includes(s) || o.value.toLowerCase().includes(s)) : options;
};

/** Round single-choice mark (UI override: the user asked for radios here). */
function Radio({ on }) {
  return (
    <span className={`grid size-3.5 shrink-0 place-items-center [clip-path:circle(50%)] ${on ? 'bg-layer-on' : 'bg-border-strong'}`} aria-hidden>
      <span className={`grid size-2.5 place-items-center bg-surface-strong [clip-path:circle(50%)]`}>{on && <span className="size-1.5 bg-layer-on [clip-path:circle(50%)]" />}</span>
    </span>
  );
}

/** Fixed popover under (or above) its anchor, inside the window; closes on outside press or Esc. */
function Popover({ anchor, open, onClose, children }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = anchor.current?.getBoundingClientRect();
      if (!r) return;
      const below = window.innerHeight - r.bottom - 8;
      const up = below < 240 && r.top > below;
      setPos({ left: Math.min(r.left, window.innerWidth - Math.max(r.width, 224) - 8), width: Math.max(r.width, 224), ...(up ? { bottom: window.innerHeight - r.top + 2 } : { top: r.bottom + 2 }), maxHeight: Math.min(320, Math.max(160, up ? r.top - 8 : below)) });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, anchor]);
  useEffect(() => {
    if (!open) return;
    const down = (e) => !ref.current?.contains(e.target) && !anchor.current?.contains(e.target) && onClose();
    const key = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('pointerdown', down);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', down);
      document.removeEventListener('keydown', key);
    };
  }, [open, anchor, onClose]);
  if (!open || !pos) return null;
  return createPortal(
    <div ref={ref} className="pop-in fixed z-[60] flex flex-col border border-border-strong bg-surface-strong text-xs shadow-[var(--shadow-glass)]" style={pos}>
      {children}
    </div>,
    document.body,
  );
}

/** List rows with a "N more" note when capped. */
function Rows({ items, render }) {
  return (
    <>
      {items.slice(0, SHOWN).map(render)}
      {items.length > SHOWN && <li className="px-3 py-1.5 text-2xs text-muted">{v.more(items.length - SHOWN)}</li>}
    </>
  );
}

/*
  Value of a query condition, picked from the field's distinct values (sorted) or typed.
  single: a combobox: the box filters the list as you type (a typed value is kept as is, for
  "contains", "less than" …); a row with a radio mark picks it. multi (IN / NOT IN): the box
  opens a list with a search field and checkboxes; the SQL gets the values comma-separated in
  brackets, text quoted. options: [{ value, label }].
*/
export function ValuePicker({ options, mode = 'single', value = '', values = [], onChange, label, placeholder }) {
  const anchor = useRef(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [active, setActive] = useState(-1);
  const close = () => {
    setOpen(false);
    setSearch('');
    setActive(-1);
  };

  if (mode === 'multi') {
    const chosen = new Set(values);
    const shown = filterOptions(options, search);
    const labelOf = (x) => options.find((o) => o.value === x)?.label ?? x;
    const summary = values.length ? v.summary(values.slice(0, 3).map(labelOf).join(', '), Math.max(0, values.length - 3)) : '';
    const toggle = (x) => onChange(chosen.has(x) ? values.filter((y) => y !== x) : [...values, x]);
    return (
      <>
        <button
          ref={anchor}
          type="button"
          onClick={() => (open ? close() : setOpen(true))}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={label}
          title={values.length ? values.map(labelOf).join(', ') : label}
          className={`flex h-7 min-w-0 flex-1 items-center gap-1.5 border bg-field px-2 text-left text-xs ${open ? 'border-accent-line' : 'border-border'}`}
        >
          <span className={`min-w-0 flex-1 truncate ${values.length ? 'text-text' : 'text-faint'}`}>{summary || placeholder || v.pickMany}</span>
          {values.length > 0 && <span className="shrink-0 tabular-nums text-2xs text-accent">{values.length}</span>}
          <LuChevronDown size={12} className="shrink-0 text-muted" aria-hidden />
        </button>
        <Popover anchor={anchor} open={open} onClose={close}>
          <label className="flex h-8 shrink-0 items-center gap-2 border-b border-border px-2.5">
            <LuSearch size={12} className="shrink-0 text-muted" aria-hidden />
            <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder={v.search} aria-label={v.search} className="min-w-0 flex-1 bg-transparent text-xs text-text outline-none placeholder:text-faint" />
          </label>
          <div className="flex shrink-0 divide-x divide-border border-b border-border">
            <button type="button" onClick={() => onChange([...new Set([...values, ...shown.map((o) => o.value)])])} disabled={!shown.length} className="h-7 flex-1 text-2xs text-muted hover:bg-hover hover:text-text disabled:opacity-40">
              {v.all}
            </button>
            <button type="button" onClick={() => onChange([])} disabled={!values.length} className="h-7 flex-1 text-2xs text-muted hover:bg-hover hover:text-text disabled:opacity-40">
              {v.none}
            </button>
          </div>
          <ul role="listbox" aria-multiselectable="true" aria-label={label} className="min-h-0 flex-1 overflow-y-auto py-1">
            {shown.length === 0 && <li className="px-3 py-1.5 text-muted">{v.empty}</li>}
            <Rows
              items={shown}
              render={(o) => (
                <li key={o.value} role="option" aria-selected={chosen.has(o.value)}>
                  <label className="flex h-7 cursor-pointer items-center gap-2 px-2.5 hover:bg-hover">
                    <Checkbox checked={chosen.has(o.value)} onChange={() => toggle(o.value)} label={o.label} />
                    <span className="min-w-0 flex-1 truncate text-text" title={o.label}>
                      {o.label}
                    </span>
                  </label>
                </li>
              )}
            />
          </ul>
          <p className="shrink-0 border-t border-border px-2.5 py-1.5 text-2xs tabular-nums text-muted">
            {v.selected(values.length)} · {v.values(options.length)}
          </p>
        </Popover>
      </>
    );
  }

  // single: the typed text is the value and the filter at once.
  const shown = filterOptions(options, open && value === search ? search : '');
  const pick = (x) => {
    onChange(x);
    close();
  };
  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, Math.min(shown.length, SHOWN) - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && open) {
      e.preventDefault();
      if (active >= 0 && shown[active]) pick(shown[active].value);
      else close();
    } else if (e.key === 'Tab') close();
  };
  return (
    <>
      <label ref={anchor} className={`flex h-7 min-w-0 flex-1 items-center border bg-field pr-1.5 ${open ? 'border-accent-line' : 'border-border'}`}>
        <input
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setSearch(e.target.value);
            setActive(-1);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder || v.pickOne}
          aria-label={label}
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          className="h-full min-w-0 flex-1 bg-transparent px-2 text-xs text-text outline-none placeholder:text-faint"
        />
        <LuChevronDown size={12} className="shrink-0 text-muted" aria-hidden />
      </label>
      <Popover anchor={anchor} open={open && options.length > 0} onClose={close}>
        <ul role="listbox" aria-label={label} className="min-h-0 flex-1 overflow-y-auto py-1">
          {shown.length === 0 && <li className="px-3 py-1.5 text-muted">{value ? v.typed(value) : v.empty}</li>}
          <Rows
            items={shown}
            render={(o, i) => (
              <li
                key={o.value}
                role="option"
                aria-selected={o.value === value}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => pick(o.value)}
                className={`flex h-7 cursor-pointer items-center gap-2 px-2.5 ${i === active ? 'bg-hover' : 'hover:bg-hover'}`}
              >
                <Radio on={o.value === value} />
                <span className="min-w-0 flex-1 truncate text-text" title={o.label}>
                  {o.label}
                </span>
              </li>
            )}
          />
        </ul>
        <p className="shrink-0 border-t border-border px-2.5 py-1.5 text-2xs tabular-nums text-muted">{v.values(options.length)}</p>
      </Popover>
    </>
  );
}
