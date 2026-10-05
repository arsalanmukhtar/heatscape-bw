import { useId, useState } from 'react';
import { LuEye, LuEyeOff, LuFilter, LuGrid2X2, LuImage, LuMapPin, LuMountain, LuScanSearch, LuSpline, LuSquare, LuSquareDashed, LuTable2, LuTarget } from 'react-icons/lu';
import { LiaPaletteSolid } from 'react-icons/lia';
import { useMap } from 'react-map-gl/mapbox';
import { blockBounds, blockById } from '../data/mock';
import { t } from '../i18n';
import { isVector, LAYER_GROUPS, LAYERS, layerBounds, layerData } from '../lib/layers';
import { useLayout } from '../state/layout';
import { useSymbology } from '../state/symbology';
import { useWorkspace } from '../state/workspace';
import { LayerLegend, LegendSwatch } from './LayerLegend';
import { SearchBar, SearchEmpty } from './SearchBar';
import { PanelHeader } from './SidePanel';

const GEOMETRY_ICON = { point: LuMapPin, line: LuSpline, polygon: LuSquare, raster: LuImage };
const FLY = { padding: 40, duration: 800 };

// Overlays: not styleable, toggled (and zoomed) only. Priority shows its fixed class key.
const PRIORITY_LEGEND = [1, 2, 3, 4, 5].map((p, i) => ({
  label: t.layers.priorityClass(p),
  swatch: { geometry: 'raster', color: `var(--vuln-${[2, 4, 5, 7, 9][i]})` },
}));

export function LayersPanel() {
  const { layers, setAllLayers, tools } = useWorkspace();
  const [query, setQuery] = useState('');
  const anyOn = tools.grid || Object.values(layers).some(Boolean);
  const allLabel = anyOn ? t.layers.hideAll : t.layers.showAll;
  const q = query.trim().toLowerCase();
  const match = (label) => !q || label.toLowerCase().includes(q);
  const groups = LAYER_GROUPS.map((g) => ({ ...g, layers: LAYERS.filter((l) => l.group === g.id && match(l.label)) })).filter((g) => g.layers.length);
  const k = t.layers.kinds;
  const overlays = [
    { id: 'selection', label: t.layers.selection, Icon: LuTarget, kind: { type: k.overlayPolygon, detail: k.selectionDetail } },
    { id: 'priority', label: t.layers.priority, Icon: LuSquareDashed, title: t.layers.priorityHint, kind: { type: k.overlayPolygon, detail: k.priorityDetail } },
    { id: 'grid', label: t.layers.grid, Icon: LuGrid2X2, kind: { type: k.overlayLine, detail: k.gridDetail } },
  ].filter((o) => match(o.label));

  return (
    <>
      <PanelHeader
        title={t.layers.title}
        actions={
          <button
            type="button"
            onClick={() => setAllLayers(!anyOn)}
            aria-label={allLabel}
            title={allLabel}
            className="grid size-7 place-items-center text-muted hover:bg-hover hover:text-text"
          >
            {anyOn ? <LuEyeOff size={14} /> : <LuEye size={14} />}
          </button>
        }
      />
      <div className="shrink-0 px-3 pt-3">
        <SearchBar value={query} onChange={setQuery} placeholder={t.layers.search} size="md" className="w-full" />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {groups.map((g) => (
          <section key={g.id} className="mt-4">
            <h3 className="label-caps mb-2 px-1">{g.label}</h3>
            <ul className="flex flex-col gap-1.5">
              {g.layers.map((def) => (
                <LayerItem key={def.id} def={def} />
              ))}
            </ul>
          </section>
        ))}
        {overlays.length > 0 && (
          <section className="mt-4">
            <h3 className="label-caps mb-2 px-1">{t.layers.overlays}</h3>
            <ul className="flex flex-col gap-1.5">
              {overlays.map((o) => (
                <OverlayItem key={o.id} {...o} />
              ))}
            </ul>
          </section>
        )}
        {!groups.length && !overlays.length && <SearchEmpty>{t.layers.noMatch}</SearchEmpty>}
      </div>
    </>
  );
}

function ActionButton({ label, active, disabled, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={`grid size-7 shrink-0 place-items-center transition-colors duration-150 disabled:opacity-30 ${active ? 'text-accent' : 'text-muted hover:text-accent disabled:hover:text-muted'}`}
    >
      {children}
    </button>
  );
}

const KNOB_MOTION = 'transition-transform duration-200 ease-out';

function Toggle({ on, label, onClick }) {
  // useId contains characters (: « ») that do not belong in a url(#…) reference.
  const maskId = `toggle-${useId().replace(/[^\w-]/g, '')}`;
  const knob = { transform: on ? 'translateX(8px)' : 'none' };
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      title={on ? t.layers.turnOff : t.layers.turnOn}
      onClick={onClick}
      className={`grid size-7 shrink-0 place-items-center transition-colors duration-200 ${on ? 'text-accent' : 'text-muted hover:text-accent'}`}
    >
      {/* Same geometry as RiToggleFill / RiToggleLine (24-unit box), drawn as one SVG so the
          change animates. On: a filled pill with the knob cut out (a mask, so whatever is
          behind shows through, like the icon's hole). Off: the outline with a solid knob.
          The knob and the cut-out slide together. */}
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
        <defs>
          <mask id={maskId}>
            <rect width="24" height="24" fill="white" />
            <circle cx="8" cy="12" r="3" fill="black" className={KNOB_MOTION} style={knob} />
          </mask>
        </defs>
        <rect x="2" y="6" width="20" height="12" rx="6" fill="none" stroke="currentColor" strokeWidth="2" />
        <rect x="2" y="6" width="20" height="12" rx="6" fill="currentColor" mask={`url(#${maskId})`} className="transition-opacity duration-200 ease-out" style={{ opacity: on ? 1 : 0 }} />
        <circle cx="8" cy="12" r="3" fill="currentColor" className="transition-[transform,opacity] duration-200 ease-out" style={{ ...knob, opacity: on ? 0 : 1 }} />
      </svg>
    </button>
  );
}

/** What kind of layer a row is: type plus a short detail, shown on the geometry icon. */
function layerKind(def) {
  const k = t.layers.kinds;
  if (def.kind === 'dem') return { type: k.dem, detail: k.demDetail };
  if (def.raster) return { type: def.kind === 'classified' ? k.rasterClassified : k.raster, detail: k.cells(def.raster.cols, def.raster.rows) };
  return { type: k[def.geometry], detail: k.features(layerData(def).features.length) };
}

function Row({ Icon, label, title, kind, active, actions, children, badge }) {
  return (
    <li className={`border bg-field ${active ? 'border-accent-line' : 'border-border'}`}>
      <div className="flex items-start gap-2.5 py-1.5 pl-2 pr-1">
        {/* Geometry icon; hover or keyboard focus shows the layer kind beside it. */}
        <span
          tabIndex={0}
          aria-label={kind.detail ? `${kind.type}, ${kind.detail}` : kind.type}
          className="group/kind relative mt-0.5 grid size-6 shrink-0 cursor-default place-items-center border border-border bg-surface-raised text-muted hover:border-border-strong hover:text-text"
        >
          <Icon size={13} aria-hidden />
          <span
            role="tooltip"
            className="pointer-events-none invisible absolute left-full top-1/2 z-40 ml-2 flex -translate-x-1 -translate-y-1/2 flex-col gap-0.5 whitespace-nowrap border border-border-strong bg-surface-strong px-2.5 py-1.5 opacity-0 shadow-[var(--shadow-glass)] transition-[opacity,transform,visibility] duration-150 ease-out group-hover/kind:visible group-hover/kind:translate-x-0 group-hover/kind:opacity-100 group-focus-visible/kind:visible group-focus-visible/kind:translate-x-0 group-focus-visible/kind:opacity-100"
          >
            <span className="text-xs font-semibold text-text">{kind.type}</span>
            {kind.detail && <span className="text-2xs text-muted">{kind.detail}</span>}
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex h-7 items-center gap-0.5">
            <span className="flex min-w-0 flex-1 items-center gap-1.5">
              <span className="min-w-0 truncate text-sm text-text" title={title}>
                {label}
              </span>
              {badge}
            </span>
            {actions}
          </div>
          {children}
        </div>
      </div>
    </li>
  );
}

function LayerItem({ def }) {
  const { main } = useMap();
  const { layers, toggleLayer, tableLayer, setTableLayer } = useWorkspace();
  const style = useSymbology((s) => s.styles[def.id]);
  const editing = useSymbology((s) => s.editing === def.id);
  const edit = useSymbology((s) => s.edit);
  const { rightOpen, rightView, showRightView, toggleRight, dockOpen, dockTab, setDockTab } = useLayout();
  const on = !!layers[def.id];
  const styling = editing && rightOpen && rightView === 'symbology';
  const tabling = tableLayer === def.id && dockOpen && dockTab === 'table';
  const Icon = def.kind === 'dem' ? LuMountain : GEOMETRY_ICON[def.geometry];

  const openSymbology = () => {
    if (styling) return toggleRight();
    edit(def.id);
    showRightView('symbology');
  };
  // The open table toggles off (the dock shows an empty state); otherwise open this layer's table.
  const openTable = () => {
    if (tabling) return setTableLayer(null);
    setTableLayer(def.id);
    setDockTab('table');
  };

  return (
    <Row
      Icon={Icon}
      label={def.label}
      kind={layerKind(def)}
      badge={
        style.query?.applied && (
          <button
            type="button"
            onClick={() => {
              edit(def.id);
              useSymbology.getState().setTab('query');
              showRightView('symbology');
            }}
            aria-label={t.layers.queryActive[style.query.mode](style.query.applied)}
            title={t.layers.queryActive[style.query.mode](style.query.applied)}
            className="grid size-5 shrink-0 place-items-center text-accent"
          >
            <LuFilter size={12} />
          </button>
        )
      }
      active={styling}
      actions={
        <>
          <ActionButton label={def.raster || def.kind === 'dem' ? t.layers.noTable : t.layers.openTable} active={tabling} disabled={!isVector(def)} onClick={openTable}>
            <LuTable2 size={13} />
          </ActionButton>
          <ActionButton label={t.layers.zoomTo} onClick={() => main?.fitBounds(layerBounds(def), FLY)}>
            <LuScanSearch size={13} />
          </ActionButton>
          <ActionButton label={t.layers.symbology} active={styling} onClick={openSymbology}>
            <LiaPaletteSolid size={15} />
          </ActionButton>
          <Toggle on={on} label={def.label} onClick={() => toggleLayer(def.id)} />
        </>
      }
    >
      {style.showLegend && (
        <>
          <StyledField def={def} style={style} dim={!on} />
          <LayerLegend def={def} style={style} dim={!on} />
        </>
      )}
    </Row>
  );
}

const fieldLabel = (def, key) => def.fields?.find((f) => f.key === key)?.label ?? key;

/** The attribute a classed renderer reads ("Temp (°C)", "Capacity ÷ Pop. Density", heatmap weight). */
function StyledField({ def, style, dim }) {
  let text = null;
  if (['categorized', 'graduated', 'graduatedSize'].includes(style.renderer) && style.field) {
    text = style.normalizeBy ? `${fieldLabel(def, style.field)} ÷ ${fieldLabel(def, style.normalizeBy)}` : fieldLabel(def, style.field);
  } else if (style.renderer === 'heatmap' && style.heatmap.weightField) {
    text = t.layers.weightedBy(fieldLabel(def, style.heatmap.weightField));
  }
  if (!text) return null;
  return <p className={`mt-0.5 truncate text-xs font-medium text-accent-2 transition-[opacity,filter] duration-200 ${dim ? 'opacity-25 grayscale' : ''}`}>{text}</p>;
}

function OverlayItem({ id, label, Icon, title, kind }) {
  const { main } = useMap();
  const { layers, toggleLayer, tools, toggleTool, selectedId } = useWorkspace();
  const on = id === 'grid' ? tools.grid : !!layers[id];
  const zoom = id === 'selection' ? () => main?.fitBounds(blockBounds(blockById(selectedId)), { ...FLY, padding: 140, maxZoom: 14 }) : null;

  return (
    <Row
      Icon={Icon}
      label={label}
      title={title}
      kind={kind}
      actions={
        <>
          {zoom && (
            <ActionButton label={t.layers.zoomTo} onClick={zoom}>
              <LuScanSearch size={13} />
            </ActionButton>
          )}
          <Toggle on={on} label={label} onClick={() => (id === 'grid' ? toggleTool('grid') : toggleLayer(id))} />
        </>
      }
    >
      {id === 'priority' && (
        <ul className={`mt-1 flex flex-col transition-[opacity,filter] duration-200 ${on ? '' : 'opacity-25 grayscale'}`}>
          {PRIORITY_LEGEND.map((item) => (
            <li key={item.label} className="flex h-5 items-center gap-2">
              <LegendSwatch swatch={item.swatch} />
              <span className="min-w-0 flex-1 truncate text-xs text-muted">{item.label}</span>
            </li>
          ))}
        </ul>
      )}
    </Row>
  );
}
