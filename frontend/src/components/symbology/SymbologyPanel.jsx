import { useRef, useState } from 'react';
import { LuArrowDown, LuArrowUp, LuBox, LuCopy, LuDownload, LuFilter, LuImage, LuMapPin, LuMountain, LuPalette, LuRotateCcw, LuSpline, LuSquare, LuTags, LuUndo2, LuUpload } from 'react-icons/lu';
import { VscCollapseAll } from 'react-icons/vsc';
import { t } from '../../i18n';
import { LAYERS, layerById } from '../../lib/layers';
import { saveFile } from '../../lib/saveFile';
import { renderersFor } from '../../lib/styleModel';
import { useLayout } from '../../state/layout';
import { useSymbology } from '../../state/symbology';
import { Check, Field, NumberField, Section, Select, Slider } from '../controls';
import { PanelHeader } from '../SidePanel';
import { ClassificationSection, RasterBandSection } from './Classification';
import { ExtrudeTab } from './ExtrudeTab';
import { LabelTab } from './LabelTab';
import { QueryTab } from './QueryTab';
import { RulesSection } from './Rules';
import {
  ClusterSection,
  HeatmapSection,
  HillshadeSection,
  LineSymbolSection,
  PointSymbolSection,
  PolygonSymbolSection,
  RasterRenderingSection,
} from './SymbolEditors';

const s = t.symbology;
const GEOMETRY_ICON = { point: LuMapPin, line: LuSpline, polygon: LuSquare, raster: LuImage };
const iconFor = (def) => (def.kind === 'dem' ? LuMountain : GEOMETRY_ICON[def.geometry]);
const TABS = [
  { id: 'style', label: s.tabs.style, Icon: LuPalette },
  { id: 'label', label: s.tabs.label, Icon: LuTags },
  { id: 'query', label: s.tabs.query, Icon: LuFilter },
  { id: 'extrude', label: s.tabs.extrude, Icon: LuBox },
];
const headerBtn = 'grid size-7 place-items-center text-muted hover:bg-hover hover:text-text disabled:opacity-40 disabled:hover:bg-transparent';
const outlineBtn = 'flex h-7 items-center gap-1.5 border border-border px-2 text-xs text-text hover:bg-hover disabled:opacity-40 disabled:hover:bg-transparent';

/*
  Symbology (right panel): styles the layer picked here or from a layer row's paint bucket.
  Tabs Style · Label · Query · 3D. Every change applies to the map at once and is saved (state/symbology.js).
*/
export function SymbologyPanel() {
  const toggleRight = useLayout((st) => st.toggleRight);
  const { editing, edit, tab, setTab, history, undo, reset } = useSymbology();
  const def = layerById(editing) ?? LAYERS[0];
  const canUndo = (history[def.id] ?? []).length > 0;

  return (
    <>
      <PanelHeader
        title={s.title}
        info={s.info}
        actions={
          <>
            <button type="button" onClick={() => undo(def.id)} disabled={!canUndo} aria-label={s.undo} title={s.undo} className={headerBtn}>
              <LuUndo2 size={14} />
            </button>
            <button type="button" onClick={() => reset(def.id)} aria-label={s.reset} title={s.reset} className={headerBtn}>
              <LuRotateCcw size={14} />
            </button>
            <button type="button" onClick={toggleRight} aria-label={s.collapse} title={s.collapse} className={headerBtn}>
              <VscCollapseAll size={15} />
            </button>
          </>
        }
      />
      <div className="shrink-0 border-b border-border px-4 py-2.5">
        <Select
          value={def.id}
          onChange={edit}
          label={s.layer}
          searchable
          options={LAYERS.map((l) => {
            const Icon = iconFor(l);
            return { value: l.id, label: l.label, icon: <Icon size={13} className="shrink-0 text-muted" /> };
          })}
        />
      </div>
      <div role="tablist" aria-label={s.title} className="flex h-9 shrink-0 items-stretch border-b border-border">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`flex flex-1 items-center justify-center gap-1.5 border-r border-border leading-none last:border-r-0 ${
              tab === id ? 'bg-rail-active font-semibold text-rail-active-text shadow-[inset_0_-2px_0_var(--accent)]' : 'bg-surface-strong font-medium text-text/75 hover:bg-hover hover:text-text'
            }`}
          >
            <Icon size={13} className="shrink-0" aria-hidden />
            <span className="text-xs uppercase leading-none tracking-[var(--tracking-caps)]">{label}</span>
          </button>
        ))}
      </div>
      <div role="tabpanel" className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {tab === 'style' && <StyleTab key={def.id} def={def} />}
        {tab === 'label' && <LabelTab key={def.id} def={def} />}
        {tab === 'query' && <QueryTab key={def.id} def={def} />}
        {tab === 'extrude' && <ExtrudeTab key={def.id} def={def} />}
      </div>
    </>
  );
}

function StyleTab({ def }) {
  const id = def.id;
  const style = useSymbology((st) => st.styles[id]);
  const update = useSymbology((st) => st.update);
  const vector = !def.raster && def.kind !== 'dem';

  return (
    <>
      <Section title={s.renderer}>
        <Field label={s.type}>
          <Select value={style.renderer} onChange={(v) => update(id, 'renderer', v)} options={renderersFor(def).map((r) => ({ value: r, label: s.renderers[r] }))} label={s.type} />
        </Field>
      </Section>

      {vector && <ClassificationSection def={def} id={id} style={style} />}
      {style.renderer === 'rules' && <RulesSection def={def} style={style} />}
      {style.renderer === 'heatmap' && <HeatmapSection def={def} id={id} style={style} />}
      {style.renderer === 'cluster' && <ClusterSection id={id} style={style} />}
      {def.geometry === 'point' && style.renderer !== 'heatmap' && <PointSymbolSection id={id} style={style} />}
      {def.geometry === 'line' && <LineSymbolSection id={id} style={style} />}
      {def.geometry === 'polygon' && <PolygonSymbolSection def={def} id={id} style={style} />}

      {def.raster && <RasterBandSection def={def} id={id} style={style} />}
      {def.raster && <RasterRenderingSection id={id} style={style} />}
      {def.kind === 'dem' && <HillshadeSection id={id} style={style} />}

      <LayerSection def={def} style={style} />
      <StyleFileSection def={def} />
    </>
  );
}

/** Layer-wide settings: opacity, visible zoom range, draw order, legend. */
function LayerSection({ def, style }) {
  const { update, order, move } = useSymbology();
  const id = def.id;
  const pos = order.indexOf(id);
  return (
    <Section title={s.layerSettings}>
      <Slider label={s.layerOpacity} value={style.opacity} min={0} max={1} step={0.05} onChange={(v) => update(id, 'opacity', v)} format={(v) => `${Math.round(v * 100)}%`} />
      <Field label={s.zoomRange} hint={s.zoomRangeHint}>
        <NumberField value={style.minZoom} min={0} max={24} step={0.5} label={s.minZoom} onChange={(v) => update(id, 'minZoom', Math.max(0, Math.min(style.maxZoom, v)))} />
        <span className="text-xs text-muted">–</span>
        <NumberField value={style.maxZoom} min={0} max={24} step={0.5} label={s.maxZoom} onChange={(v) => update(id, 'maxZoom', Math.min(24, Math.max(style.minZoom, v)))} />
      </Field>
      <Field label={s.drawOrder}>
        <button type="button" onClick={() => move(id, 1)} disabled={pos === order.length - 1} aria-label={s.moveUp} title={s.moveUp} className={outlineBtn}>
          <LuArrowUp size={12} />
        </button>
        <button type="button" onClick={() => move(id, -1)} disabled={pos === 0} aria-label={s.moveDown} title={s.moveDown} className={outlineBtn}>
          <LuArrowDown size={12} />
        </button>
        <span className="text-xs tabular-nums text-muted">{s.position(order.length - pos, order.length)}</span>
      </Field>
      <Check checked={style.showLegend} onChange={(v) => update(id, 'showLegend', v)} label={s.showLegend} />
    </Section>
  );
}

const sameKind = (a, b) => a.geometry === b.geometry && (a.geometry !== 'raster' || a.kind === b.kind);

/** Save, load and copy styles. */
function StyleFileSection({ def }) {
  const { styles, copyStyle, importStyle } = useSymbology();
  const targets = LAYERS.filter((l) => l.id !== def.id && sameKind(l, def));
  const [target, setTarget] = useState(targets[0]?.id ?? '');
  const [message, setMessage] = useState(null);
  const fileRef = useRef(null);

  const exportStyle = () => {
    const body = JSON.stringify({ format: 'heatscape-style', version: 1, layer: def.id, geometry: def.geometry, kind: def.kind ?? null, style: styles[def.id] }, null, 2);
    saveFile(`${def.id}-style.json`, new Blob([body], { type: 'application/json' }));
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const json = JSON.parse(await file.text());
      if (json.format !== 'heatscape-style' || !json.style) throw new Error(s.importInvalid);
      if (json.geometry !== def.geometry || (def.geometry === 'raster' && json.kind !== (def.kind ?? null))) throw new Error(s.importMismatch);
      importStyle(def.id, json.style);
      setMessage({ ok: true, text: s.importDone });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof SyntaxError ? s.importInvalid : err.message });
    }
  };

  return (
    <Section title={s.styleFile} defaultOpen={false}>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={exportStyle} className={outlineBtn}>
          <LuDownload size={12} />
          <span>{s.exportJson}</span>
        </button>
        <button type="button" onClick={() => fileRef.current?.click()} className={outlineBtn}>
          <LuUpload size={12} />
          <span>{s.importJson}</span>
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={onFile} />
      </div>
      {targets.length > 0 && (
        <Field label={s.copyTo}>
          <Select value={target} onChange={setTarget} options={targets.map((l) => ({ value: l.id, label: l.label }))} label={s.copyTo} className="min-w-0 flex-1" />
          <button
            type="button"
            onClick={() => {
              copyStyle(def.id, target);
              setMessage({ ok: true, text: s.copied(layerById(target).label) });
            }}
            aria-label={s.copy}
            title={s.copy}
            className={outlineBtn}
          >
            <LuCopy size={12} />
          </button>
        </Field>
      )}
      {message && <p className={`text-xs ${message.ok ? 'text-success' : 'text-danger'}`}>{message.text}</p>}
    </Section>
  );
}
