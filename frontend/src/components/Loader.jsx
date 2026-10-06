import { t } from '../i18n';
import { SNAPSHOT_EXCLUDE } from '../lib/mapSnapshot';
import { LIVE_LAYERS, useLive } from '../state/live';
import { useWorkspace } from '../state/workspace';

/**
 * The app's loader for data fetched from the backend (index.css .loader): an outer ring in
 * the theme's main ink (light on dark, dark on light) and an inner orange ring turning the
 * other way. size: diameter in px at the 16 px base (scales with the UI).
 */
export function Loader({ size = 48, label = t.loading }) {
  return <span role="status" aria-label={label} title={label} className="loader shrink-0" style={{ '--size': `${size / 48 / 16}rem` }} />;
}

/** Loader centred in its (relative) container, no backdrop: tables, cards, panels. */
export function LoaderBlock({ label }) {
  return (
    <div className="grid min-h-24 flex-1 place-items-center">
      <Loader label={label} />
    </div>
  );
}

/**
 * Map overlay while a switched-on live layer loads for the first time: the loader centred
 * over the map on a light dark blur. Later refreshes (and retries of not-yet-imported layers)
 * load quietly. Not in map snapshots; the map stays usable underneath.
 */
export function MapLoader() {
  const layers = useWorkspace((s) => s.layers);
  const status = useLive((s) => s.status);
  const data = useLive((s) => s.data);
  const busy = Object.keys(LIVE_LAYERS).some((id) => layers[id] && status[id] === 'loading' && !data[id]);
  if (!busy) return null;
  return (
    <div className="pop-in pointer-events-none absolute inset-0 z-20 grid place-items-center bg-black/25 backdrop-blur-[2px]" {...SNAPSHOT_EXCLUDE}>
      <Loader label={t.layers.live.loading} />
    </div>
  );
}
