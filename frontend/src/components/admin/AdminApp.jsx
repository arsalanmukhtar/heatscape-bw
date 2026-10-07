import { useEffect } from 'react';
import { LuArrowLeft, LuBot, LuDatabase, LuGauge, LuHeartPulse, LuMap, LuMoon, LuScrollText, LuSun, LuUsers, LuWorkflow } from 'react-icons/lu';
import { VscCollapseAll } from 'react-icons/vsc';
import { t } from '../../i18n';
import { useMediaQuery } from '../../lib/useMediaQuery';
import { useAdmin } from '../../state/admin';
import { isAdmin, useSession } from '../../state/auth';
import { useTheme } from '../../state/theme';
import { MAP_OVERLAY_ID } from '../Expandable';
import { RailButton } from '../LeftRail';
import { PanelHeader, SidePanel } from '../SidePanel';
import { AccountMenu, Brand } from '../TopNav';
import { AdminAudit } from './AdminAudit';
import { AdminCatalog } from './AdminCatalog';
import { AdminCopilot } from './AdminCopilot';
import { AdminHealth } from './AdminHealth';
import { AdminLogs } from './AdminLogs';
import { AdminOverview } from './AdminOverview';
import { AdminPipelines } from './AdminPipelines';
import { AdminRegions } from './AdminRegions';
import { AdminUsers } from './AdminUsers';

const a = t.admin;
const SECTIONS = {
  overview: { Icon: LuGauge, Page: AdminOverview },
  pipelines: { Icon: LuWorkflow, Page: AdminPipelines },
  catalog: { Icon: LuDatabase, Page: AdminCatalog },
  regions: { Icon: LuMap, Page: AdminRegions },
  users: { Icon: LuUsers, Page: AdminUsers },
  copilot: { Icon: LuBot, Page: AdminCopilot },
  health: { Icon: LuHeartPulse, Page: AdminHealth },
  audit: { Icon: LuScrollText, Page: AdminAudit },
};

/*
  Admin role only. The gateway already refuses /admin without it (decision 36); this
  check covers the Vite host-only dev server and a session that ends while the page is open.
*/
export default function AdminApp() {
  const { status, user } = useSession();
  const allowed = status === 'in' && isAdmin(user);

  useEffect(() => {
    if (status === 'out') location.replace('/signin?next=/admin');
    else if (status === 'in' && !isAdmin(user)) location.replace('/signin?next=/admin&denied=admin');
  }, [status, user]);

  if (status === 'error') {
    return (
      <div className="grid h-full place-items-center bg-bg px-6 text-center text-sm text-muted">
        <span>{a.authError}</span>
      </div>
    );
  }
  return allowed ? <AdminConsole /> : null;
}

/*
  Admin & operations console (/admin): the workspace shell without the map. Top bar,
  left rail (sections), left navigation panel (labels, hints, live badges), main page,
  bottom dock with the log stream. Expanded tables and charts cover the main page.
*/
function AdminConsole() {
  const { section, setSection, navOpen, toggleNav, navW, setNavW, pipelines, alerts, dismissed } = useAdmin();
  const { resolved, toggle } = useTheme();
  const narrow = useMediaQuery('(max-width: 1023px)');
  const { Page } = SECTIONS[section] ?? SECTIONS.overview;
  const failed = pipelines.filter((p) => p.status === 'failed').length;
  const openAlerts = alerts.filter((x) => !dismissed.includes(x.id)).length;
  const badges = { overview: openAlerts, pipelines: failed };

  useEffect(() => {
    document.title = `${a.title} · ${t.appName}`;
  }, []);
  // Live pipelines and runs while the console is open.
  useEffect(() => useAdmin.getState().startPolling(), []);

  // Rail: clicking the active section folds the panel, any other opens it there.
  const open = (id) => {
    if (id === section && navOpen) return toggleNav();
    setSection(id);
    if (!navOpen) toggleNav();
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center border-b border-nav-border bg-nav pr-4 text-nav-text" style={{ height: 'var(--nav-h)' }}>
        <Brand />
        <span className="mx-4 h-6 w-px bg-nav-border lg:mx-6" aria-hidden />
        <span className="text-sm font-semibold text-nav-text">{a.title}</span>
        <span className="ml-3 level-chip" style={{ '--chip': 'var(--warning)' }}>
          {a.mock}
        </span>
        <div className="ml-auto flex items-center gap-3">
          <a href="/" className="flex h-[1.875rem] items-center gap-2 border border-nav-border bg-bg-deep px-3 text-xs text-nav-text hover:border-nav-border-strong">
            <LuArrowLeft size={13} className="shrink-0 text-nav-muted" aria-hidden />
            <span>{a.back}</span>
          </a>
          <button type="button" onClick={toggle} aria-label={resolved === 'dark' ? t.nav.themeToLight : t.nav.themeToDark} title={resolved === 'dark' ? t.nav.themeToLight : t.nav.themeToDark} className="grid size-[1.875rem] place-items-center text-nav-muted hover:bg-nav-hover hover:text-nav-text">
            {resolved === 'dark' ? <LuSun size={15} /> : <LuMoon size={15} />}
          </button>
          <AccountMenu />
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        <aside className="flex shrink-0 flex-col items-center border-r border-border bg-bg-deep py-2" style={{ width: 'var(--rail-w)' }} aria-label={a.navTitle}>
          <div role="toolbar" aria-orientation="vertical" className="flex flex-col items-center gap-1">
            {Object.entries(SECTIONS).map(([id, { Icon }]) => (
              <RailButton key={id} label={a.sections[id]} active={section === id} onClick={() => open(id)}>
                <Icon size={16} />
              </RailButton>
            ))}
          </div>
        </aside>

        <SidePanel side="left" open={navOpen} width={navW} defaultWidth="var(--panel-w)" onResize={setNavW} overlay={narrow} label={a.navTitle}>
          <PanelHeader
            title={a.navTitle}
            info={a.navInfo}
            actions={
              <button type="button" onClick={toggleNav} aria-label={a.collapse} title={a.collapse} className="grid size-7 place-items-center text-muted hover:bg-hover hover:text-text">
                <VscCollapseAll size={15} />
              </button>
            }
          />
          <nav aria-label={a.navTitle} className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-2">
            {Object.entries(SECTIONS).map(([id, { Icon }]) => {
              const active = section === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setSection(id);
                    if (narrow) toggleNav();
                  }}
                  aria-current={active ? 'page' : undefined}
                  className={`flex min-h-12 items-center gap-3 border px-3 py-2 text-left ${active ? 'border-accent-line bg-accent-soft' : 'border-transparent hover:bg-hover'}`}
                >
                  <Icon size={16} className={`shrink-0 ${active ? 'text-accent' : 'text-muted'}`} aria-hidden />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm text-text">{a.sections[id]}</span>
                    <span className="truncate text-2xs text-muted">{a.hints[id]}</span>
                  </span>
                  {badges[id] > 0 && (
                    <span className="level-chip shrink-0 tabular-nums" style={{ '--chip': 'var(--danger)', width: 'var(--chip-compact-w)' }}>
                      {badges[id]}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </SidePanel>

        <main className="relative flex min-w-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1">
            <div className="absolute inset-0 overflow-y-auto bg-bg">
              <Page />
            </div>
            {/* Expanded tables and charts cover the page here (see Expandable). */}
            <div id={MAP_OVERLAY_ID} className="pointer-events-none absolute inset-0 z-30" />
          </div>
          <AdminLogs />
        </main>

        {narrow && navOpen && <div aria-hidden className="absolute inset-0 z-20 bg-bg-deep/50" onClick={toggleNav} />}
      </div>
    </div>
  );
}
