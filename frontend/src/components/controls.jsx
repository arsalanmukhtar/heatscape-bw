import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LuCheck, LuChevronDown, LuChevronRight } from 'react-icons/lu';
import { t } from '../i18n';
import { parseColor, toHex } from '../lib/color';
import { matchesSearch } from '../lib/search';
import { Checkbox } from './Checkbox';
import { CHECKER, ColorPicker } from './ColorPicker';
import { SearchBar, SearchEmpty } from './SearchBar';

/*
  Compact form controls (Symbology panel, dock). Square, 28 px rows, xs text, labels in
  their own spans so the global trim centres them. Menus render in a portal with fixed
  position, so scrolling panels never clip them.
*/

const MENU_MAX = 240;
const SEARCH_H = 38;

/**
 * Compact dropdown. options: [{ value, label, icon?, preview? }]. menuWidth widens the menu
 * beyond the button (e.g. for previews); the tick column is always reserved so rows align.
 * searchable: a search bar above the options narrows them by label (typing goes there).
 */
export function Select({ value, onChange, options, label, className = 'w-full', disabled, renderValue, menuWidth, searchable = false }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [pos, setPos] = useState(null);
  const [query, setQuery] = useState('');
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const listRef = useRef(null);
  const listId = useId();
  const current = options.find((o) => o.value === value);
  const shown = searchable && query ? options.filter((o) => matchesSearch(query, [o.label])) : options;
  const menuMax = MENU_MAX + (searchable ? SEARCH_H : 0);

  const place = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const up = window.innerHeight - r.bottom < menuMax + 8 && r.top > window.innerHeight - r.bottom;
    const width = Math.max(r.width, menuWidth ?? 160);
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
    setPos({ left, width, ...(up ? { bottom: window.innerHeight - r.top + 2 } : { top: r.bottom + 2 }) });
  };

  useLayoutEffect(() => {
    if (open) place();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    const close = (e) => !btnRef.current?.contains(e.target) && !menuRef.current?.contains(e.target) && setOpen(false);
    const away = (e) => !menuRef.current?.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    window.addEventListener('scroll', away, true);
    window.addEventListener('resize', away);
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('scroll', away, true);
      window.removeEventListener('resize', away);
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const pick = (o) => {
    onChange(o.value);
    setOpen(false);
    btnRef.current?.focus();
  };

  // Shared by the button and the search input: arrows move, Enter picks, Esc closes.
  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) return setOpen(true);
      setActive((i) => Math.max(0, Math.min(shown.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1))));
    } else if ((e.key === 'Enter' || (e.key === ' ' && e.target === btnRef.current)) && open && shown[active]) {
      e.preventDefault();
      pick(shown[active]);
    } else if (e.key === 'Escape' && open) {
      e.stopPropagation();
      setOpen(false);
      btnRef.current?.focus();
    }
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={label}
        title={label}
        onClick={() => setOpen(!open)}
        onKeyDown={onKeyDown}
        className={`flex h-7 min-w-0 items-center gap-2 border border-border bg-field px-2 text-left text-xs text-text hover:border-border-strong disabled:opacity-50 ${open ? 'border-accent-line' : ''} ${className}`}
      >
        {current?.icon}
        {renderValue ? renderValue(current) : <span className="min-w-0 flex-1 truncate">{current?.label ?? '–'}</span>}
        <LuChevronDown size={12} className="shrink-0 text-muted" />
      </button>
      {open &&
        pos &&
        createPortal(
          <div ref={menuRef} className="fixed z-[60] flex flex-col border border-border-strong bg-surface-strong shadow-[var(--shadow-glass)]" style={{ ...pos, maxHeight: menuMax }}>
            {searchable && (
              <div className="shrink-0 border-b border-border p-1" style={{ height: SEARCH_H }}>
                <SearchBar
                  value={query}
                  onChange={(q) => {
                    setQuery(q);
                    setActive(0);
                  }}
                  placeholder={t.filter.search}
                  className="w-full"
                  clearOnEscape={false}
                  inputProps={{ autoFocus: true, onKeyDown }}
                />
              </div>
            )}
            <ul ref={listRef} id={listId} role="listbox" aria-label={label} className="min-h-0 overflow-y-auto">
              {shown.map((o, i) => (
                <li
                  key={String(o.value)}
                  role="option"
                  aria-selected={o.value === value}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(o)}
                  className={`flex h-7 cursor-pointer items-center gap-2 px-2 text-xs text-text ${i === active ? 'bg-hover' : ''} ${o.value === value ? 'font-semibold' : ''}`}
                >
                  {o.icon}
                  <span className="min-w-0 flex-1 truncate">{o.label}</span>
                  {o.preview}
                  <span className="grid w-3 shrink-0 place-items-center">{o.value === value && <LuCheck size={12} className="text-accent" />}</span>
                </li>
              ))}
            </ul>
            {shown.length === 0 && <SearchEmpty>{t.filter.noOptions}</SearchEmpty>}
          </div>,
          document.body,
        )}
    </>
  );
}

/** Label + control on one row. */
export function Field({ label, children, hint }) {
  return (
    <div className="flex min-h-7 items-center gap-2" title={hint}>
      <span className="w-[6.5rem] shrink-0 truncate text-xs text-muted">{label}</span>
      <div className="flex min-w-0 flex-1 items-center gap-1.5">{children}</div>
    </div>
  );
}

/** Collapsible group with a caps title. */
export function Section({ title, children, defaultOpen = true, actions }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-border">
      <div className="flex h-9 items-center gap-1 px-4">
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-muted hover:text-text">
          <LuChevronRight size={12} className={`shrink-0 transition-transform duration-150 ${open ? 'rotate-90' : ''}`} />
          <span className="label-caps uppercase truncate">{title}</span>
        </button>
        {actions}
      </div>
      {open && <div className="flex flex-col gap-2 px-4 pb-3">{children}</div>}
    </section>
  );
}

/** Slider with its value; format renders the value text. */
export function Slider({ label, value, min, max, step = 1, onChange, format = (v) => v }) {
  const pct = ((value - min) / (max - min || 1)) * 100;
  return (
    <div>
      <div className="flex h-5 items-center justify-between">
        <span className="text-xs text-muted">{label}</span>
        <span className="text-xs tabular-nums text-text">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        className="hs-range"
        style={{ '--val': `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </div>
  );
}

/**
 * Compact number input; commits on change when the value is a number. onBlurCommit: commits
 * on blur or Enter instead, for values the parent clamps against another field (a zoom
 * range), so a half-typed number is not clamped and written back while typing.
 */
export function NumberField({ value, onChange, min, max, step = 1, label, className = 'w-16', onBlurCommit = false }) {
  const [draft, setDraft] = useState(String(value ?? ''));
  useEffect(() => setDraft(String(value ?? '')), [value]);
  const commit = (text) => {
    const n = Number(text);
    if (text !== '' && Number.isFinite(n)) onChange(n);
    setDraft(String(value ?? ''));
  };
  return (
    <input
      type="number"
      inputMode="decimal"
      value={draft}
      min={min}
      max={max}
      step={step}
      aria-label={label}
      title={label}
      onChange={(e) => {
        setDraft(e.target.value);
        if (onBlurCommit) return;
        const n = Number(e.target.value);
        if (e.target.value !== '' && Number.isFinite(n)) onChange(n);
      }}
      onKeyDown={(e) => onBlurCommit && e.key === 'Enter' && commit(e.currentTarget.value)}
      onBlur={(e) => (onBlurCommit ? commit(e.currentTarget.value) : setDraft(String(value ?? '')))}
      className={`h-7 border border-border bg-field px-2 text-xs tabular-nums text-text outline-none focus:border-accent-line ${className}`}
    />
  );
}

/** Compact text input (labels, expressions). */
export function TextField({ value, onChange, label, placeholder, className = 'w-full', onCommit }) {
  return (
    <input
      type="text"
      value={value ?? ''}
      placeholder={placeholder}
      aria-label={label}
      title={label}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onCommit}
      onKeyDown={(e) => e.key === 'Enter' && onCommit?.()}
      className={`h-7 min-w-0 border border-border bg-field px-2 text-xs text-text outline-none placeholder:text-faint focus:border-accent-line ${className}`}
    />
  );
}

/** Checkbox with its label. */
export function Check({ checked, onChange, label, hint }) {
  return (
    <label className="flex h-7 cursor-pointer items-center gap-2" title={hint}>
      <Checkbox checked={checked} onChange={() => onChange(!checked)} label={label} size="md" />
      <span className="text-xs text-text">{label}</span>
    </label>
  );
}

/** Button group for a few exclusive options. */
export function Segmented({ value, options, onChange, label }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex min-w-0 flex-1 border border-border">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          title={o.title ?? o.label}
          onClick={() => onChange(o.value)}
          className={`flex h-[1.625rem] min-w-0 flex-1 items-center justify-center gap-1 border-r border-border px-1.5 text-xs last:border-r-0 ${
            o.value === value ? 'bg-accent-soft font-semibold text-text' : 'text-muted hover:bg-hover hover:text-text'
          }`}
        >
          {o.icon}
          {o.label && <span className="truncate">{o.label}</span>}
        </button>
      ))}
    </div>
  );
}

/**
 * Colour swatch that opens the colour picker, plus a hex input (compact: swatch only).
 * Keeps an existing alpha when the hex is typed.
 */
export function ColorField({ value, onChange, label, compact = false, size = 'size-7' }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const parsed = parseColor(value);
  const hex = toHex(parsed ?? '#000000');
  const alpha = parsed?.a ?? 1;
  const [draft, setDraft] = useState(hex);
  useEffect(() => setDraft(hex), [hex]);
  const withA = (h) => (alpha < 1 ? `${h}${Math.round(alpha * 255).toString(16).padStart(2, '0')}` : h);
  const commit = () => (/^#[0-9a-f]{6}$/i.test(draft) ? onChange(withA(draft.toLowerCase())) : setDraft(hex));

  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(!open)}
        aria-label={label}
        title={label}
        aria-expanded={open}
        className={`relative block shrink-0 cursor-pointer border ${open ? 'border-accent-line' : 'border-border-strong'} ${size}`}
        style={{ background: CHECKER }}
      >
        <span className="absolute inset-0" style={{ background: parsed ? `rgba(${parsed.r},${parsed.g},${parsed.b},${alpha})` : 'transparent' }} />
      </button>
      {!compact && (
        <input
          type="text"
          value={draft.toUpperCase()}
          aria-label={`${label} (hex)`}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
          className="h-7 w-[4.75rem] border border-border bg-field px-2 font-mono text-xs text-text outline-none focus:border-accent-line"
        />
      )}
      {open && <ColorPicker value={value} onChange={onChange} onClose={() => setOpen(false)} anchor={btnRef.current} label={label} />}
    </span>
  );
}
