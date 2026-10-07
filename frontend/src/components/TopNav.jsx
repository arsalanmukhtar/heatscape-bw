import { useEffect, useRef, useState } from 'react';
import { LuArchive, LuArrowRightLeft, LuBell, LuCalendar, LuChartLine, LuChevronDown, LuCircleAlert, LuCircleCheck, LuFileText, LuFlame, LuGlobe, LuLogIn, LuLogOut, LuMap, LuMoon, LuPlus, LuSettings, LuShieldCheck, LuSun, LuUser } from 'react-icons/lu';
import { REGION, SEASON } from '../data/mock';
import { t } from '../i18n';
import { isAdmin, useSession } from '../state/auth';
import { useJobs } from '../state/jobs';
import { useLayout } from '../state/layout';
import { useMeasures } from '../state/measures';
import { useNotifications } from '../state/notifications';
import { useMapInfo } from '../state/mapInfo';
import { fmtLatLon } from '../lib/coords';
import { useTheme } from '../state/theme';

const REGIONS = ['Mannheim', 'Stuttgart', 'Karlsruhe'];

export function TopNav() {
  const [region, setRegion] = useState(REGION.name);
  const { view, setView } = useLayout();
  const { resolved, toggle } = useTheme();
  const themeLabel = resolved === 'dark' ? t.nav.themeToLight : t.nav.themeToDark;

  const views = [
    { id: 'gis', label: t.nav.gisView },
    { id: 'analytics', label: t.nav.analytics, icon: <LuChartLine size={13} /> },
    { id: 'reports', label: t.nav.reports, icon: <LuFileText size={13} /> },
  ];

  return (
    <header className="flex shrink-0 items-center border-b border-nav-border bg-nav pr-4 text-nav-text" style={{ height: 'var(--nav-h)' }}>
      <Brand />

      <span className="mx-4 h-6 w-px bg-nav-border lg:mx-6" aria-hidden />

      <RegionMenu value={region} onChange={setRegion} />

      <nav className="ml-4 flex h-[2.125rem] items-stretch border border-nav-border bg-bg-deep p-[0.1875rem]" aria-label="Views">
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
        <MapReadout />
        <div
          className="flex h-[1.875rem] items-center gap-2 whitespace-nowrap border border-nav-border bg-bg-deep px-2 text-xs text-nav-text lg:px-3"
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
          className="grid size-[1.875rem] place-items-center text-nav-muted hover:bg-nav-hover hover:text-nav-text"
        >
          {resolved === 'dark' ? <LuSun size={15} /> : <LuMoon size={15} />}
        </button>

        <NotificationsMenu />

        <AccountMenu />
      </div>
    </header>
  );
}

/* Brand: the mark fills the nav cell above the left rail (rail width × nav height, solid
   accent), so its right edge continues the rail's border line; the name follows. Shared by
   the workspace and the admin console. */
export function Brand() {
  return (
    <div className="flex items-center gap-4 self-stretch" aria-label={t.appName}>
      <span className="grid shrink-0 place-items-center self-stretch bg-accent text-on-accent" style={{ width: 'var(--rail-w)' }} aria-hidden>
        <LuFlame size={20} strokeWidth={2.25} />
      </span>
      <span className="flex items-baseline gap-1.5 whitespace-nowrap" aria-hidden>
        <span className="text-base font-bold tracking-[-0.01em] text-nav-text">{t.appBrand}</span>
        <span className="text-xs font-bold uppercase tracking-[var(--tracking-caps)] text-accent">{t.appRegion}</span>
      </span>
    </div>
  );
}

/* Map readout (between the view tabs and the season): zoom, and the pointer position while
   it is over the map, else the map centre. Click copies the coordinates (lat, lon). Fixed
   size (monospace, every part in ch) so neither it nor its neighbours shift as the values
   change; dashes until the map reports its first view. */
function MapReadout() {
  const view = useLayout((s) => s.view);
  const { zoom, center, pointer } = useMapInfo();
  const [copied, setCopied] = useState(false);
  if (view !== 'gis') return null;
  const at = pointer ?? center;
  const copy = () => {
    if (!at) return;
    navigator.clipboard?.writeText(`${at[1].toFixed(6)}, ${at[0].toFixed(6)}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  };
  const r = t.nav.readout;
  return (
    <button
      type="button"
      onClick={copy}
      title={copied ? r.copied : r.copy}
      className="hidden h-[1.875rem] shrink-0 items-center gap-2.5 overflow-hidden whitespace-nowrap border border-nav-border bg-bg-deep px-3 font-mono text-2xs tabular-nums text-nav-muted hover:text-nav-text xl:flex"
    >
      <span className="flex shrink-0 gap-[1ch]">
        <span className="w-[4ch] text-nav-muted">{r.zoom}</span>
        <span className="w-[5ch] text-right text-nav-text">{zoom == null ? '–' : zoom.toFixed(2)}</span>
      </span>
      <span className="h-3.5 w-px shrink-0 bg-nav-border" aria-hidden />
      <span className="flex shrink-0 gap-[1ch]">
        <span className="w-[6ch] text-nav-muted">{pointer ? r.pointer : r.center}</span>
        <span className={`w-[25ch] text-left ${copied ? 'text-accent' : 'text-nav-text'}`}>{copied ? r.copied : at ? fmtLatLon(at) : '–'}</span>
      </span>
    </button>
  );
}

const KIND = {
  jobDone: { Icon: LuCircleCheck, color: 'var(--success)' },
  jobFailed: { Icon: LuCircleAlert, color: 'var(--danger)' },
  measureAdded: { Icon: LuPlus, color: 'var(--accent)' },
  measureStatus: { Icon: LuArrowRightLeft, color: 'var(--accent-2)' },
  measureDeprecated: { Icon: LuArchive, color: 'var(--text-muted)' },
};

function ago(at) {
  const min = Math.round((Date.now() - at) / 60000);
  const n = t.notifications;
  if (min < 1) return n.justNow;
  if (min < 60) return n.minutes(min);
  if (min < 24 * 60) return n.hours(Math.round(min / 60));
  return new Date(at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/* Notifications: job and measure events (state/notifications.js). The badge counts unread
   items; an item opens what it is about (the job in the Jobs dock, the measure's effect). */
function NotificationsMenu() {
  const { open, setOpen, ref } = useMenu();
  const { items, markRead, markAllRead, clear } = useNotifications();
  const unread = items.filter((x) => !x.read).length;
  const n = t.notifications;
  const label = unread ? n.unread(unread) : t.nav.notifications;

  const go = (x) => {
    markRead(x.key);
    setOpen(false);
    const L = useLayout.getState();
    if (L.view !== 'gis') L.setView('gis');
    if (x.target.type === 'job') {
      L.setDockTab('jobs');
      useJobs.getState().select(x.target.id);
    } else if (x.kind === 'measureDeprecated') {
      // Archived measures are not selectable: open the register instead (openSection toggles).
      if (!(L.leftOpen && L.leftSection === 'measures')) L.openSection('measures');
    } else {
      useMeasures.getState().select(x.target.id);
      L.showRightView('effect');
    }
  };
  const textBtn = 'h-6 px-1.5 text-2xs text-muted hover:bg-hover hover:text-text disabled:opacity-40 disabled:hover:bg-transparent';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        onClick={() => setOpen(!open)}
        className={`relative grid size-[1.875rem] place-items-center hover:bg-nav-hover hover:text-nav-text ${open ? 'bg-nav-hover text-nav-text' : 'text-nav-muted'}`}
      >
        <LuBell size={15} />
        {unread > 0 && (
          // Round by clip-path: the square-UI rule zeroes every border-radius (index.css).
          <span
            className="absolute -right-0.5 -top-0.5 grid size-3.5 place-items-center bg-[var(--destructive)] text-[0.5625rem] font-semibold tabular-nums leading-none tracking-[-0.02em] text-[var(--on-destructive)]"
            style={{ clipPath: 'circle(50%)' }}
            aria-hidden
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div role="menu" aria-label={t.nav.notifications} className="absolute right-0 top-[calc(100%+4px)] z-50 w-80 border border-border-strong bg-surface-strong shadow-[var(--shadow-glass)]">
          <div className="flex h-9 items-center gap-1 border-b border-border pl-3 pr-1.5">
            <span className="label-caps mr-auto">{t.nav.notifications}</span>
            <button type="button" onClick={markAllRead} disabled={!unread} className={textBtn}>
              <span>{n.markAllRead}</span>
            </button>
            <button type="button" onClick={clear} disabled={!items.length} className={textBtn}>
              <span>{n.clear}</span>
            </button>
          </div>
          {items.length ? (
            <ul className="max-h-96 overflow-y-auto">
              {items.map((x) => {
                const { Icon, color } = KIND[x.kind] ?? KIND.jobDone;
                return (
                  <li key={x.key}>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => go(x)}
                      className={`grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-1 border-b border-l-2 border-b-border px-3 py-2 text-left hover:bg-hover ${x.read ? 'border-l-transparent' : 'border-l-accent bg-accent-soft'}`}
                    >
                      <span className="row-span-2 grid size-7 place-items-center border border-border" style={{ color }} aria-hidden>
                        <Icon size={13} />
                      </span>
                      <span className={`truncate text-xs text-text ${x.read ? '' : 'font-semibold'}`}>{x.title}</span>
                      <span className="justify-self-end whitespace-nowrap text-2xs tabular-nums text-muted">{ago(x.at)}</span>
                      <span className="col-start-2 col-end-4 truncate text-2xs text-muted">{x.text}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-3 py-6 text-center text-xs text-muted">{n.empty}</p>
          )}
        </div>
      )}
    </div>
  );
}

/** Open state of a nav menu; closes on an outside click or Esc. */
function useMenu() {
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

  return { open, setOpen, ref };
}

/* Account menu: the signed-in user (session from the middleware), account settings, the
   other apps (public portal; admin console only for the Admin role) and sign out. Signed
   out: a sign-in link back to this page. Shared by the workspace and the admin console. */
export function AccountMenu() {
  const { open, setOpen, ref } = useMenu();
  const { status, user, signOut } = useSession();
  const here = `${location.pathname}${location.search}`;
  const links = [
    { href: '/portal', label: t.nav.portal, Icon: LuGlobe },
    ...(isAdmin(user) ? [{ href: '/admin', label: t.nav.admin, Icon: LuShieldCheck }] : []),
  ];
  const item = 'flex h-8 w-full items-center gap-2 px-3 text-left text-xs text-text hover:bg-hover';
  return (
    <div ref={ref} className="relative ml-1">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={user ? `${t.nav.account}: ${user.name}` : t.nav.account}
        title={user ? user.name : t.nav.account}
        onClick={() => setOpen(!open)}
        className={`grid size-[1.875rem] place-items-center border bg-surface-raised text-2xs font-semibold text-nav-text ${open ? 'border-accent-line' : 'border-nav-border-strong hover:border-nav-text'}`}
      >
        {user ? <span>{user.initials}</span> : <LuUser size={14} className="text-nav-muted" aria-hidden />}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-[calc(100%+4px)] z-50 w-60 border border-border-strong bg-surface-strong shadow-[var(--shadow-glass)]">
          {user ? (
            <>
              <div className="border-b border-border px-3 py-2">
                <p className="truncate text-xs font-semibold text-text">{user.name}</p>
                <p className="truncate text-2xs text-muted">{user.email}</p>
              </div>
              <a href="/account" role="menuitem" className={`${item} mt-1`}>
                <LuSettings size={13} className="shrink-0 text-muted" aria-hidden />
                <span>{t.nav.accountSettings}</span>
              </a>
            </>
          ) : (
            status !== 'loading' && (
              <a href={`/signin?next=${encodeURIComponent(here)}`} role="menuitem" className={`${item} mt-1`}>
                <LuLogIn size={13} className="shrink-0 text-muted" aria-hidden />
                <span>{t.nav.signIn}</span>
              </a>
            )
          )}
          <p className="px-3 pb-1 pt-2 text-2xs uppercase tracking-[var(--tracking-caps)] text-muted">{t.nav.apps}</p>
          {links.map(({ href, label, Icon }) => (
            <a key={href} href={href} role="menuitem" className={item}>
              <Icon size={13} className="shrink-0 text-muted" aria-hidden />
              <span>{label}</span>
            </a>
          ))}
          {user && (
            <button
              type="button"
              role="menuitem"
              onClick={async () => {
                await signOut();
                location.assign('/signin');
              }}
              className={`${item} mt-1 border-t border-border`}
            >
              <LuLogOut size={13} className="shrink-0 text-muted" aria-hidden />
              <span>{t.nav.signOut}</span>
            </button>
          )}
          <div className="h-1" />
        </div>
      )}
    </div>
  );
}

function RegionMenu({ value, onChange }) {
  const { open, setOpen, ref } = useMenu();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t.nav.region}
        onClick={() => setOpen(!open)}
        style={{ width: 'var(--region-menu-w)' }}
        className="flex h-[1.875rem] items-center gap-2 border border-nav-border bg-bg-deep px-3 text-sm text-nav-text hover:border-nav-border-strong"
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
