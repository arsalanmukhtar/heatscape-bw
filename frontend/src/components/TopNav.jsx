import { useEffect, useRef, useState } from 'react';
import { LuBell, LuCalendar, LuChartLine, LuChevronDown, LuFileText, LuFlame, LuGlobe, LuLogIn, LuLogOut, LuMap, LuMoon, LuSettings, LuShieldCheck, LuSun, LuUser } from 'react-icons/lu';
import { REGION, SEASON } from '../data/mock';
import { t } from '../i18n';
import { isAdmin, useSession } from '../state/auth';
import { useLayout } from '../state/layout';
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

        <button
          type="button"
          aria-label={t.nav.notifications}
          title={t.nav.notifications}
          className="grid size-[1.875rem] place-items-center text-nav-muted hover:bg-nav-hover hover:text-nav-text"
        >
          <LuBell size={15} />
        </button>

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
