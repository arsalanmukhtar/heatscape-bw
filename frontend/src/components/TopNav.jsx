import { useEffect, useRef, useState } from 'react';
import { LuBell, LuCalendar, LuChartLine, LuChevronDown, LuFileText, LuFlame, LuMap, LuMoon, LuSun } from 'react-icons/lu';
import { REGION, SEASON, USER } from '../data/mock';
import { t } from '../i18n';
import { useTheme } from '../state/theme';

const REGIONS = ['Mannheim', 'Stuttgart', 'Karlsruhe'];

export function TopNav() {
  const [region, setRegion] = useState(REGION.name);
  const [view, setView] = useState('gis');
  const { resolved, toggle } = useTheme();
  const themeLabel = resolved === 'dark' ? t.nav.themeToLight : t.nav.themeToDark;

  const views = [
    { id: 'gis', label: t.nav.gisView },
    { id: 'analytics', label: t.nav.analytics, icon: <LuChartLine size={13} /> },
    { id: 'reports', label: t.nav.reports, icon: <LuFileText size={13} /> },
  ];

  return (
    <header className="flex shrink-0 items-center border-b border-nav-border bg-nav px-4 text-nav-text" style={{ height: 'var(--nav-h)' }}>
      <div className="flex items-center gap-2.5">
        <span className="grid size-6 place-items-center bg-accent text-on-accent">
          <LuFlame size={14} />
        </span>
        <span className="whitespace-nowrap text-[15px] font-semibold tracking-[0.01em]">{t.appName}</span>
      </div>

      <span className="mx-4 h-6 w-px bg-nav-border lg:mx-6" aria-hidden />

      <RegionMenu value={region} onChange={setRegion} />

      <nav className="ml-4 flex h-[34px] items-stretch border border-nav-border bg-bg-deep p-[3px]" aria-label="Views">
        {views.map((v) => {
          const active = v.id === view;
          return (
            <button
              key={v.id}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => setView(v.id)}
              className={`flex items-center gap-1.5 whitespace-nowrap px-3 text-sm transition-colors ${
                active
                  ? 'border border-accent-line bg-accent-soft text-accent'
                  : 'border border-transparent text-nav-muted hover:bg-nav-hover hover:text-nav-text'
              }`}
            >
              {v.icon}
              <span>{v.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="ml-auto flex items-center gap-3">
        <div
          className="flex h-[30px] items-center gap-2 whitespace-nowrap border border-nav-border bg-bg-deep px-2 text-xs text-nav-text lg:px-3"
          title={`${t.nav.season}: ${SEASON.label} (${SEASON.range})`}
        >
          <LuCalendar size={13} className="text-nav-muted" />
          <span className="hidden lg:inline">
            {t.nav.season}: {SEASON.label}
          </span>
          <span className="hidden text-2xs text-nav-muted lg:inline">({SEASON.range})</span>
        </div>

        <button
          type="button"
          onClick={toggle}
          aria-label={themeLabel}
          title={themeLabel}
          className="grid size-[30px] place-items-center text-nav-muted hover:bg-nav-hover hover:text-nav-text"
        >
          {resolved === 'dark' ? <LuSun size={15} /> : <LuMoon size={15} />}
        </button>

        <button
          type="button"
          aria-label={t.nav.notifications}
          title={t.nav.notifications}
          className="grid size-[30px] place-items-center text-nav-muted hover:bg-nav-hover hover:text-nav-text"
        >
          <LuBell size={15} />
        </button>

        <button
          type="button"
          aria-label={t.nav.account}
          className="ml-1 grid size-[30px] place-items-center border border-nav-border-strong bg-surface-raised text-2xs font-semibold text-nav-text"
        >
          {USER.initials}
        </button>
      </div>
    </header>
  );
}

function RegionMenu({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t.nav.region}
        onClick={() => setOpen(!open)}
        style={{ width: 'var(--region-menu-w)' }}
        className="flex h-[30px] items-center gap-2 border border-nav-border bg-bg-deep px-3 text-sm text-nav-text hover:border-nav-border-strong"
      >
        <LuMap size={13} className="shrink-0 text-nav-muted" />
        <span className="min-w-0 flex-1 truncate text-left">{value}</span>
        <LuChevronDown size={13} className="shrink-0 text-nav-muted" />
      </button>
      {open && (
        <ul role="listbox" className="absolute left-0 top-[calc(100%+4px)] z-50 w-full border border-border-strong bg-surface-strong shadow-[var(--shadow-glass)]">
          {REGIONS.map((r) => (
            <li key={r}>
              <button
                type="button"
                role="option"
                aria-selected={r === value}
                onClick={() => {
                  onChange(r);
                  setOpen(false);
                }}
                className={`flex h-7 w-full items-center px-3 text-left text-xs text-text ${r === value ? 'bg-accent-soft font-semibold' : 'hover:bg-hover'}`}
              >
                <span>{r}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
