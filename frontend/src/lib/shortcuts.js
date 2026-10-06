import { t } from '../i18n';
import { useLayout } from '../state/layout';
import { useMeasures } from '../state/measures';
import { useReports, ZOOMS } from '../state/reports';
import { useScenarios } from '../state/scenarios';
import { useTheme } from '../state/theme';
import { useWorkspace } from '../state/workspace';
import { BW_BOUNDS, WORLD_VIEW } from './geo';
import { captureMap } from './mapSnapshot';

/*
  Keyboard shortcuts: one registry for the key handler (App) and the searchable list in
  Settings, where clicking a row runs it. Single keys without Ctrl/Alt/Cmd, ignored while
  typing in a field. combo: lower-case key ('l', '[', '`'), 'shift+<key>' for letters and
  digits (digits by physical key, so Shift+1 works on every layout). on(): current state of
  a toggle (shown as On). when(): the shortcut only applies (and takes the key) while it returns
  true, so Esc falls through to other handlers when nothing is selected. Report actions are sent to the open Report Builder as an event.
*/
let mainMap = null;
/** The main map (set by MapView), for zoom and extent shortcuts. */
export const setShortcutMap = (map) => {
  mainMap = map;
};
export const REPORT_ACTION = 'hs:report-action';
const report = (action) => () => window.dispatchEvent(new CustomEvent(REPORT_ACTION, { detail: action }));

const L = () => useLayout.getState();
const W = () => useWorkspace.getState();
const FLY = { duration: 1200, essential: true };
const s = t.shortcuts.labels;

const section = (id) => ({ run: () => L().openSection(id), on: () => L().leftOpen && L().leftSection === id });
const view = (id) => ({ run: () => L().openRightView(id), on: () => L().rightOpen && L().rightView === id });
const dockTab = (id) => ({ run: () => L().setDockTab(id), on: () => L().dockOpen && L().dockTab === id });
const tool = (id) => ({ run: () => W().toggleTool(id), on: () => W().tools[id] });
// Esc belongs to an open menu, popover or dialog first, and to footprint drafting.
const overlayOpen = () => !!document.querySelector('dialog[open], [aria-expanded="true"], [aria-modal="true"]');
const M = () => useMeasures.getState();
const hasSelection = () => !!(W().pixel || M().selectedId) && !M().drawing && !M().shaping && !overlayOpen();

const reportZoom = (dir) => () => {
  const r = useReports.getState();
  const next = ZOOMS[ZOOMS.indexOf(r.zoom) + dir];
  if (next) r.setZoom(next);
};

export const SHORTCUTS = [
  // General
  { id: 'shortcuts', group: 'general', combo: '?', label: s.shortcuts, ...section('settings') },
  { id: 'theme', group: 'general', combo: 't', label: s.theme, run: () => useTheme.getState().toggle() },
  // Navbar
  { id: 'gis', group: 'navbar', combo: '1', label: s.gis, run: () => L().setView('gis'), on: () => L().view === 'gis' },
  { id: 'analytics', group: 'navbar', combo: '2', label: s.analytics, run: () => L().setView('analytics'), on: () => L().view === 'analytics' },
  { id: 'reports', group: 'navbar', combo: '3', label: s.reports, run: () => L().setView('reports'), on: () => L().view === 'reports' },
  // Left panel
  { id: 'left', group: 'left', combo: '[', label: s.left, run: () => L().toggleLeft(), on: () => L().leftOpen },
  { id: 'layers', group: 'left', combo: 'l', label: s.layers, ...section('layers') },
  { id: 'geoprocessing', group: 'left', combo: 'g', label: s.geoprocessing, ...section('geoprocessing') },
  { id: 'scenarios', group: 'left', combo: 's', label: s.scenarios, ...section('scenarios') },
  { id: 'measures', group: 'left', combo: 'm', label: s.measures, ...section('measures') },
  { id: 'filters', group: 'left', combo: 'f', label: s.filters, ...section('filters') },
  { id: 'reportsPanel', group: 'left', combo: 'r', label: s.reportsPanel, ...section('reports') },
  { id: 'settings', group: 'left', combo: ',', label: s.settings, ...section('settings') },
  // Right panel
  { id: 'right', group: 'right', combo: ']', label: s.right, run: () => L().toggleRight(), on: () => L().rightOpen },
  { id: 'inspector', group: 'right', combo: 'i', label: s.inspector, ...view('inspector') },
  { id: 'copilot', group: 'right', combo: 'c', label: s.copilot, ...view('copilot') },
  { id: 'ranking', group: 'right', combo: 'k', label: s.ranking, ...view('ranking') },
  { id: 'effect', group: 'right', combo: 'e', label: s.effect, ...view('effect') },
  { id: 'symbology', group: 'right', combo: 'y', label: s.symbology, ...view('symbology') },
  // Dock
  { id: 'dock', group: 'dock', combo: '`', label: s.dock, run: () => L().toggleDock(), on: () => L().dockOpen },
  { id: 'dockMax', group: 'dock', combo: '\\', label: s.dockMax, run: () => L().toggleDockMax(), on: () => L().dockMax },
  { id: 'table', group: 'dock', combo: 'shift+1', label: s.table, ...dockTab('table') },
  { id: 'jobs', group: 'dock', combo: 'shift+2', label: s.jobs, ...dockTab('jobs') },
  { id: 'charts', group: 'dock', combo: 'shift+3', label: s.charts, ...dockTab('charts') },
  { id: 'summary', group: 'dock', combo: 'shift+4', label: s.summary, ...dockTab('summary') },
  // Map
  { id: 'zoomIn', group: 'map', combo: '=', label: s.zoomIn, run: () => mainMap?.zoomIn() },
  { id: 'zoomOut', group: 'map', combo: '-', label: s.zoomOut, run: () => mainMap?.zoomOut() },
  { id: 'north', group: 'map', combo: 'shift+n', label: s.north, run: () => mainMap?.getMap().resetNorthPitch({ duration: 500 }) },
  { id: 'world', group: 'map', combo: 'w', label: s.world, run: () => mainMap?.flyTo({ ...WORLD_VIEW, ...FLY }) },
  { id: 'bw', group: 'map', combo: 'b', label: s.bw, run: () => mainMap?.fitBounds(BW_BOUNDS, { padding: 40, ...FLY }) },
  { id: 'controls', group: 'map', combo: 'h', label: s.controls, run: () => L().toggleMapControls(), on: () => L().mapControlsOpen },
  { id: 'ruler', group: 'map', combo: 'd', label: s.ruler, ...tool('measure') },
  { id: 'snap', group: 'map', combo: 'n', label: s.snap, run: () => W().toggleSnap(), on: () => W().snap },
  { id: 'select', group: 'map', combo: 'p', label: s.select, ...tool('select') },
  { id: 'grid', group: 'map', combo: 'shift+g', label: s.grid, ...tool('grid') },
  { id: 'hideAll', group: 'map', combo: 'shift+h', label: s.hideAll, run: () => W().setAllLayers(!Object.values(W().layers).some(Boolean)) },
  { id: 'compare', group: 'map', combo: 'shift+c', label: s.compare, run: () => useScenarios.getState().toggleCompare(), on: () => useScenarios.getState().compare },
  { id: 'snapshot', group: 'map', combo: 'shift+s', label: s.snapshot, run: () => captureMap() },
  {
    id: 'deselect',
    group: 'map',
    combo: 'Escape',
    label: s.deselect,
    when: hasSelection,
    run: () => {
      W().setPixel(null);
      M().select(null);
    },
  },
  // Measures
  {
    id: 'addMeasure',
    group: 'measures',
    combo: 'a',
    label: s.addMeasure,
    run: () => {
      if (!(L().leftOpen && L().leftSection === 'measures')) L().openSection('measures');
      useMeasures.getState().openForm();
    },
  },
  // Reports
  { id: 'reportPdf', group: 'reports', combo: 'shift+p', label: s.reportPdf, run: () => (L().view === 'reports' ? useReports.getState().setPrinting(true) : undefined) },
  { id: 'reportDocx', group: 'reports', combo: 'shift+w', label: s.reportDocx, run: report('docx') },
  { id: 'reportShare', group: 'reports', combo: 'shift+k', label: s.reportShare, run: report('share') },
  { id: 'reportZoomIn', group: 'reports', combo: 'shift+=', label: s.reportZoomIn, run: reportZoom(1) },
  { id: 'reportZoomOut', group: 'reports', combo: 'shift+-', label: s.reportZoomOut, run: reportZoom(-1) },
];
export const SHORTCUT_GROUPS = ['general', 'navbar', 'left', 'right', 'dock', 'map', 'measures', 'reports'];

/** Key combo of a keyboard event, in the registry's notation. */
function comboOf(e) {
  if (e.shiftKey && e.code?.startsWith('Digit')) return `shift+${e.code.slice(5)}`;
  if (e.shiftKey && e.code === 'Equal') return 'shift+=';
  if (e.shiftKey && e.code === 'Minus') return 'shift+-';
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  return e.shiftKey && /^[a-z]$/.test(key) ? `shift+${key}` : key;
}
const BY_COMBO = new Map(SHORTCUTS.map((x) => [x.combo, x]));

/** Runs the shortcut for a keydown event; true if one ran. */
export function handleShortcut(e) {
  if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return false;
  if (e.target.closest?.('input, textarea, select, [contenteditable="true"], [contenteditable=""]')) return false;
  const sc = BY_COMBO.get(comboOf(e));
  if (!sc || (sc.when && !sc.when())) return false;
  e.preventDefault();
  sc.run();
  return true;
}

/** Keys of a combo for display: 'shift+1' → ['Shift', '1']. */
export const comboKeys = (combo) => (combo.startsWith('shift+') ? ['Shift', combo.slice(6).toUpperCase()] : [combo === 'Escape' ? 'Esc' : combo.length === 1 ? combo.toUpperCase() : combo]);
