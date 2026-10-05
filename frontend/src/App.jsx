import { useEffect } from 'react';
import { MapProvider } from 'react-map-gl/mapbox';
import { LuPanelRightOpen } from 'react-icons/lu';
import { BottomDock } from './components/BottomDock';
import { CopilotPanel } from './components/CopilotPanel';
import { GeoprocessingPanel } from './components/GeoprocessingPanel';
import { InspectorPanel } from './components/InspectorPanel';
import { LayersPanel } from './components/LayersPanel';
import { LeftRail } from './components/LeftRail';
import { MapView } from './components/MapView';
import { EffectPanel } from './components/measures/EffectPanel';
import { MeasuresPanel } from './components/measures/MeasuresPanel';
import { FiltersPanel, ReportsPanel, SettingsPanel } from './components/SecondaryPanels';
import { RankingPanel } from './components/RankingPanel';
import { ScenariosPanel } from './components/ScenariosPanel';
import { SidePanel } from './components/SidePanel';
import { SymbologyPanel } from './components/symbology/SymbologyPanel';
import { TopNav } from './components/TopNav';
import { t } from './i18n';
import { useMediaQuery } from './lib/useMediaQuery';
import { useLayout } from './state/layout';

const SECTIONS = {
  layers: LayersPanel,
  geoprocessing: GeoprocessingPanel,
  scenarios: ScenariosPanel,
  measures: MeasuresPanel,
  filters: FiltersPanel,
  reports: ReportsPanel,
  settings: SettingsPanel,
};

// Right panel views: content and title. All share one width (--panel-w).
const VIEWS = {
  inspector: { Panel: InspectorPanel, title: t.inspector.title, expand: t.inspector.expand },
  copilot: { Panel: CopilotPanel, title: t.copilot.title, expand: t.copilot.expand },
  ranking: { Panel: RankingPanel, title: t.ranking.title, expand: t.ranking.expand },
  symbology: { Panel: SymbologyPanel, title: t.symbology.title, expand: t.symbology.expand },
  effect: { Panel: EffectPanel, title: t.effect.title, expand: t.effect.expand },
};

export default function App() {
  const layout = useLayout();
  const narrow = useMediaQuery('(max-width: 1023px)');
  const Section = SECTIONS[layout.leftSection] ?? LayersPanel;
  const view = VIEWS[layout.rightView] ?? VIEWS.inspector;

  // "[" left panel, "]" inspector, "`" attribute table, Esc closes a floating panel.
  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.target.closest?.('input, textarea, select, [contenteditable]')) return;
      const s = useLayout.getState();
      if (e.key === '[') s.toggleLeft();
      else if (e.key === ']') s.toggleRight();
      else if (e.key === '`') s.toggleDock();
      else if (e.key === 'Escape' && narrow) {
        if (s.rightOpen) s.toggleRight();
        else if (s.leftOpen) s.toggleLeft();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [narrow]);

  return (
    <MapProvider>
      <div className="flex h-full flex-col">
        <TopNav />
        <div className="relative flex min-h-0 flex-1">
          <LeftRail />
          <SidePanel
            side="left"
            open={layout.leftOpen}
            width={layout.panelW}
            defaultWidth="var(--panel-w)"
            onResize={layout.setPanelW}
            overlay={narrow}
            label={t.layers.title}
          >
            <Section />
          </SidePanel>

          <main className="flex min-w-0 flex-1 flex-col">
            <MapView />
            <BottomDock />
          </main>

          {!layout.rightOpen && !narrow && (
            <button
              type="button"
              onClick={layout.toggleRight}
              aria-label={view.expand}
              title={view.expand}
              className="flex w-8 shrink-0 flex-col items-center gap-3 border-l border-border bg-surface pt-3 text-muted hover:bg-hover hover:text-text"
            >
              <LuPanelRightOpen size={15} />
              {/* Vertical label. Sideways text (writing-mode) cannot be cap-trimmed, so it sits
                  off centre; instead an invisible sideways copy sizes the slot and the visible
                  label is horizontal, cap-trimmed and rotated 90° about the slot's centre. */}
              <span className="relative">
                <span className="label-caps invisible block [writing-mode:vertical-rl]" aria-hidden>
                  {view.title}
                </span>
                <span className="label-caps text-trim absolute left-1/2 top-1/2 block -translate-x-1/2 -translate-y-1/2 rotate-90 whitespace-nowrap" aria-hidden>
                  {view.title}
                </span>
              </span>
            </button>
          )}
          <SidePanel
            side="right"
            open={layout.rightOpen}
            width={layout.panelW}
            defaultWidth="var(--panel-w)"
            onResize={layout.setPanelW}
            overlay={narrow}
            label={view.title}
          >
            <view.Panel />
          </SidePanel>

          {narrow && (layout.leftOpen || layout.rightOpen) && (
            <div aria-hidden className="absolute inset-0 z-20 bg-bg-deep/50" onClick={() => useLayout.setState({ leftOpen: false, rightOpen: false })} />
          )}
        </div>
      </div>
    </MapProvider>
  );
}
