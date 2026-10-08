import { Popup, useMap } from 'react-map-gl/mapbox';
import { LuScanSearch, LuTable2, LuX } from 'react-icons/lu';
import { t } from '../i18n';
import { flyToGeometry } from '../lib/geo';
import { extentGeometry, featureById, layerById } from '../lib/layers';
import { popupModel } from '../lib/popups';
import { useLayout } from '../state/layout';
import { useWorkspace } from '../state/workspace';

const p = t.popup;
const actionBtn = 'flex h-9 flex-1 items-center justify-center gap-1.5 text-xs font-medium text-muted transition-colors hover:bg-hover hover:text-text';

/*
  Feature popup on the main map: a click on any vector feature (MapView) opens it for that
  one feature: layer, name, coloured chips (class, status, type), key values coloured by
  meaning, the other attributes (lib/popups.js) and Zoom to · Show in table. Opens with a
  pop (index.css .hs-popup-card); × or Esc closes it.
*/
export function FeaturePopup() {
  const { main } = useMap();
  const { popup, setPopup, layers, setTableLayer, setTableFilter } = useWorkspace();
  const setDockTab = useLayout((s) => s.setDockTab);
  const item = popup?.item;
  const def = item && layers[item.layer] ? layerById(item.layer) : null;
  if (!def) return null;
  const m = popupModel(def, item.props);
  const id = m.row.id;

  // Tiled layers: the unit's bbox, never the clicked tile's part of it.
  const zoom = () => flyToGeometry(main, extentGeometry(featureById(def, id)) ?? item.geometry);
  const showInTable = () => {
    setTableLayer(def.id);
    setTableFilter(String(id ?? ''));
    setDockTab('table');
  };

  return (
    // Offset: the tip stops a few px short of the clicked spot (areas, lines) or of a point's yellow ring.
    <Popup longitude={popup.lngLat[0]} latitude={popup.lngLat[1]} closeButton={false} closeOnClick={false} maxWidth="none" offset={item.geometry?.type === 'Point' ? 16 : 6} className="hs-popup" onClose={() => setPopup(null)}>
      {/* The key restarts the pop when another feature is clicked. */}
      <div key={`${popup.at}:${item.layer}:${id}`} role="dialog" aria-label={`${def.label}: ${m.title}`} className="hs-popup-card w-max min-w-[19rem] max-w-[28rem] border border-border-strong bg-surface-strong text-text shadow-[var(--shadow-glass)]">
        {/* Header: layer (with its map colour), name, subtitle, chips. */}
        <header className="px-4 pb-3 pt-3.5">
          <div className="flex items-center gap-2">
            <span className="size-2 shrink-0" style={{ background: item.color ?? 'var(--accent)' }} aria-hidden />
            <span className="label-caps min-w-0 flex-1 truncate">{def.label}</span>
            <button type="button" onClick={() => setPopup(null)} aria-label={p.close} title={p.close} className="-mr-1.5 grid size-6 shrink-0 place-items-center text-muted hover:bg-hover hover:text-text">
              <LuX size={14} />
            </button>
          </div>
          <h3 className="mt-2 text-base font-semibold leading-snug text-text [overflow-wrap:anywhere]">{m.title}</h3>
          {m.subtitle && <p className="mt-0.5 text-xs leading-snug text-muted">{m.subtitle}</p>}
          {m.chips.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {m.chips.map((c) => (
                <span key={c.label} className="popup-chip" style={{ '--chip': c.color ?? 'var(--accent)' }}>
                  {c.label}
                </span>
              ))}
            </div>
          )}
        </header>

        {/* Key values: one band, divided columns, values coloured by meaning. */}
        {m.stats.length > 0 && (
          // Values are never cut: each column is at least as wide as its value (the card widens
          // up to its max width); labels wrap under them.
          <div className="grid divide-x divide-border border-y border-border bg-field" style={{ gridTemplateColumns: `repeat(${m.stats.length}, minmax(max-content, 1fr))` }}>
            {m.stats.map((s) => (
              <div key={s.label} className="px-3 py-2.5 first:pl-4 last:pr-4">
                <p className="whitespace-nowrap text-lg font-semibold leading-tight tabular-nums" style={{ color: s.color ?? 'var(--text)' }}>
                  {s.value}
                </p>
                <p className="mt-1 max-w-[9rem] text-2xs leading-snug text-muted">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {m.rows.length > 0 && (
          <dl className={`px-4 py-2 ${m.stats.length ? '' : 'border-t border-border'}`}>
            {m.rows.map((r) => (
              <div key={r.label} className="flex min-h-7 items-center gap-3">
                <dt className="min-w-0 flex-1 truncate text-xs text-muted">{r.label}</dt>
                <dd className="max-w-[58%] truncate text-right text-xs font-medium tabular-nums text-text" title={String(r.value)}>
                  {r.value}
                </dd>
              </div>
            ))}
          </dl>
        )}

        <footer className="flex divide-x divide-border border-t border-border">
          <button type="button" onClick={zoom} className={actionBtn}>
            <LuScanSearch size={13} aria-hidden />
            <span>{p.zoom}</span>
          </button>
          <button type="button" onClick={showInTable} className={actionBtn}>
            <LuTable2 size={13} aria-hidden />
            <span>{p.table}</span>
          </button>
        </footer>
      </div>
    </Popup>
  );
}
