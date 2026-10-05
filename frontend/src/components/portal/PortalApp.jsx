import { useEffect } from 'react';
import { MapProvider } from 'react-map-gl/mapbox';
import { LuChevronLeft, LuChevronRight } from 'react-icons/lu';
import { portalText } from '../../i18n';
import { useMediaQuery } from '../../lib/useMediaQuery';
import { usePortal } from '../../state/portal';
import { BottomSheet } from './BottomSheet';
import { PortalMap } from './PortalMap';
import { PortalNav } from './PortalNav';
import { PortalPanel } from './PortalPanel';

const PANEL_ID = 'portal-panel';

/*
  Public Heat Portal (/portal): the citizen view, no sign-in. Desktop: collapsible
  information panel beside the map. Below 768 px: full-screen map with a bottom sheet.
  Same tokens and square design as the workspace; its own EN/DE switch.
*/
export default function PortalApp() {
  const wide = useMediaQuery('(min-width: 768px)');
  const { lang, panelOpen, togglePanel, sheet } = usePortal();
  const p = portalText[lang];

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = `${p.portal} ${p.region} · ${p.brand}`;
  }, [lang, p]);

  // Keep fly-to targets above the sheet on phones.
  const padBottom = wide ? 0 : sheet === 'peek' ? 132 : sheet === 'half' ? window.innerHeight * 0.45 : 0;

  return (
    <MapProvider>
      <div className="flex h-full flex-col bg-bg text-text">
        <a href={`#${PANEL_ID}`} className="sr-only z-50 bg-accent px-4 py-3 font-semibold text-on-accent focus:not-sr-only focus:absolute focus:left-2 focus:top-2">
          {p.skip}
        </a>
        <PortalNav wide={wide} />
        <div className="relative flex min-h-0 flex-1">
          {wide ? (
            <>
              <aside
                id={PANEL_ID}
                aria-label={p.nav.neighbourhood}
                inert={!panelOpen}
                className={`shrink-0 overflow-hidden border-r border-border bg-surface transition-[width] duration-300 ease-out motion-reduce:transition-none ${panelOpen ? 'w-[min(420px,45vw)]' : 'w-0 border-r-0'}`}
              >
                <div className="h-full w-[min(420px,45vw)] overflow-y-auto">
                  <PortalPanel />
                </div>
              </aside>
              <main className="relative min-w-0 flex-1">
                <PortalMap />
                <button
                  type="button"
                  onClick={togglePanel}
                  aria-controls={PANEL_ID}
                  aria-expanded={panelOpen}
                  aria-label={panelOpen ? p.panelHide : p.panelShow}
                  title={panelOpen ? p.panelHide : p.panelShow}
                  className="absolute bottom-8 left-0 z-10 grid h-14 w-11 place-items-center border border-l-0 border-border-strong bg-surface-strong text-text shadow-[var(--shadow-glass)] hover:text-accent"
                >
                  {panelOpen ? <LuChevronLeft size={18} /> : <LuChevronRight size={18} />}
                </button>
              </main>
            </>
          ) : (
            <main className="relative min-w-0 flex-1">
              <PortalMap padBottom={padBottom} />
              <BottomSheet id={PANEL_ID} label={p.nav.neighbourhood}>
                <PortalPanel />
              </BottomSheet>
            </main>
          )}
        </div>
      </div>
    </MapProvider>
  );
}
