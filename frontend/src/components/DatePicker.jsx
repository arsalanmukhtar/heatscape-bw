import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LuCalendar, LuChevronDown, LuChevronLeft, LuChevronRight } from 'react-icons/lu';
import { t } from '../i18n';

const d = t.datePicker;
const POP_W = 264;
const POP_H = 318;
const YEARS_PER_PAGE = 12;
const MONTHS = Array.from({ length: 12 }, (_, m) => new Date(2000, m, 1).toLocaleString('en-GB', { month: 'short' }));

const pad = (n) => String(n).padStart(2, '0');
const toIso = (y, m, day) => `${y}-${pad(m + 1)}-${pad(day)}`;
/** 'YYYY-MM-DD' → { y, m (0–11), day }, or null. */
function parseIso(value) {
  const hit = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  return hit ? { y: Number(hit[1]), m: Number(hit[2]) - 1, day: Number(hit[3]) } : null;
}
const fmt = (p) => new Date(p.y, p.m, p.day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** The 42 days (6 weeks, Monday first) shown for a month. */
function monthGrid(y, m) {
  const lead = (new Date(y, m, 1).getDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(y, m, i - lead + 1);
    return { y: date.getFullYear(), m: date.getMonth(), day: date.getDate(), outside: date.getMonth() !== m };
  });
}

const cell = 'grid place-items-center text-xs tabular-nums';
const navBtn = 'grid size-7 place-items-center text-muted hover:text-accent';

/*
  Date field with a themed calendar (tokens, so light and dark follow the theme). The
  header title steps up a level: days → months (click the month) → years (click the
  year); picking a year or month steps back down. value: 'YYYY-MM-DD' or ''.
*/
export function DatePicker({ value, onChange, label, className = 'min-w-0 flex-1' }) {
  const picked = parseIso(value);
  const now = new Date();
  const today = { y: now.getFullYear(), m: now.getMonth(), day: now.getDate() };
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const [view, setView] = useState('days'); // days | months | years
  const [shown, setShown] = useState({ y: today.y, m: today.m });
  const btnRef = useRef(null);
  const popRef = useRef(null);

  const openPicker = () => {
    const base = picked ?? today;
    setShown({ y: base.y, m: base.m });
    setView('days');
    setOpen(true);
  };
  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) btnRef.current?.focus();
  };

  useLayoutEffect(() => {
    if (!open) return;
    const r = btnRef.current.getBoundingClientRect();
    const up = window.innerHeight - r.bottom < POP_H + 8 && r.top > window.innerHeight - r.bottom;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - POP_W - 8));
    setPos({ left, ...(up ? { bottom: window.innerHeight - r.top + 2 } : { top: r.bottom + 2 }) });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const outside = (e) => !btnRef.current?.contains(e.target) && !popRef.current?.contains(e.target) && close(false);
    const away = (e) => !popRef.current?.contains(e.target) && close(false);
    document.addEventListener('mousedown', outside);
    window.addEventListener('scroll', away, true);
    window.addEventListener('resize', away);
    return () => {
      document.removeEventListener('mousedown', outside);
      window.removeEventListener('scroll', away, true);
      window.removeEventListener('resize', away);
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (p) => {
    onChange(toIso(p.y, p.m, p.day));
    close();
  };
  const step = (dir) => {
    if (view === 'days') {
      const date = new Date(shown.y, shown.m + dir, 1);
      setShown({ y: date.getFullYear(), m: date.getMonth() });
    } else setShown({ ...shown, y: shown.y + dir * (view === 'years' ? YEARS_PER_PAGE : 1) });
  };
  const pageStart = shown.y - (((shown.y % YEARS_PER_PAGE) + YEARS_PER_PAGE) % YEARS_PER_PAGE);
  const title = view === 'days' ? `${new Date(shown.y, shown.m, 1).toLocaleString('en-GB', { month: 'long' })} ${shown.y}` : view === 'months' ? String(shown.y) : `${pageStart} – ${pageStart + YEARS_PER_PAGE - 1}`;
  const same = (a, b) => a && b && a.y === b.y && a.m === b.m && a.day === b.day;
  const tone = (on, now) => (on ? 'bg-accent font-semibold text-on-accent' : now ? 'border border-accent-line text-text hover:bg-hover' : 'text-text hover:bg-hover');

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => (open ? close() : openPicker())}
        onKeyDown={(e) => e.key === 'Escape' && open && (e.stopPropagation(), close())}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label}
        title={label}
        className={`flex h-7 items-center gap-2 border bg-field px-2 text-left text-xs hover:border-border-strong ${open ? 'border-accent-line' : 'border-border'} ${className}`}
      >
        <span className={`min-w-0 flex-1 truncate ${picked ? 'text-text' : 'text-faint'}`}>{picked ? fmt(picked) : d.placeholder}</span>
        <LuCalendar size={13} className="shrink-0 text-muted" aria-hidden />
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            ref={popRef}
            role="dialog"
            aria-label={label}
            onKeyDown={(e) => e.key === 'Escape' && (e.stopPropagation(), close())}
            className="pop-in fixed z-[60] flex flex-col border border-border-strong bg-surface-strong p-2 shadow-[var(--shadow-glass)]"
            style={{ ...pos, width: POP_W }}
          >
            <div className="flex h-8 items-center gap-1">
              <button
                type="button"
                onClick={() => setView(view === 'days' ? 'months' : 'years')}
                disabled={view === 'years'}
                aria-label={view === 'days' ? d.chooseMonth : d.chooseYear}
                title={view === 'days' ? d.chooseMonth : view === 'months' ? d.chooseYear : undefined}
                className="flex h-7 min-w-0 flex-1 items-center gap-1.5 px-1.5 text-sm font-semibold text-text hover:bg-hover disabled:hover:bg-transparent"
              >
                <span className="truncate">{title}</span>
                {view !== 'years' && <LuChevronDown size={13} className="shrink-0 text-muted" aria-hidden />}
              </button>
              <button type="button" onClick={() => step(-1)} aria-label={d.prev[view]} title={d.prev[view]} className={navBtn}>
                <LuChevronLeft size={15} />
              </button>
              <button type="button" onClick={() => step(1)} aria-label={d.next[view]} title={d.next[view]} className={navBtn}>
                <LuChevronRight size={15} />
              </button>
            </div>

            {view === 'days' && (
              <div className="mt-1 grid grid-cols-7 gap-0.5">
                {d.weekdays.map((w) => (
                  <span key={w} className={`${cell} h-7 text-2xs font-medium uppercase text-muted`}>
                    {w}
                  </span>
                ))}
                {monthGrid(shown.y, shown.m).map((p) => (
                  <button
                    key={toIso(p.y, p.m, p.day)}
                    type="button"
                    onClick={() => pick(p)}
                    aria-label={fmt(p)}
                    aria-pressed={same(p, picked)}
                    className={`${cell} h-8 ${same(p, picked) ? tone(true) : p.outside ? 'text-faint hover:bg-hover' : tone(false, same(p, today))}`}
                  >
                    {p.day}
                  </button>
                ))}
              </div>
            )}

            {view === 'months' && (
              <div className="mt-1 grid flex-1 grid-cols-3 gap-1">
                {MONTHS.map((name, m) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => {
                      setShown({ y: shown.y, m });
                      setView('days');
                    }}
                    className={`${cell} h-[3.625rem] ${tone(picked?.y === shown.y && picked?.m === m, today.y === shown.y && today.m === m)}`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}

            {view === 'years' && (
              <div className="mt-1 grid flex-1 grid-cols-3 gap-1">
                {Array.from({ length: YEARS_PER_PAGE }, (_, i) => pageStart + i).map((y) => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => {
                      setShown({ ...shown, y });
                      setView('months');
                    }}
                    className={`${cell} h-[3.625rem] ${tone(picked?.y === y, today.y === y)}`}
                  >
                    {y}
                  </button>
                ))}
              </div>
            )}

            <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  close();
                }}
                className="flex h-7 items-center px-2 text-xs text-muted hover:text-accent"
              >
                {d.clear}
              </button>
              <button type="button" onClick={() => pick(today)} className="flex h-7 items-center border border-border px-2.5 text-xs text-text hover:border-accent-line hover:text-accent">
                {d.today}
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
