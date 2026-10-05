import { LuEye, LuEyeOff } from 'react-icons/lu';
import { t } from '../i18n';
import { useWorkspace } from '../state/workspace';
import { Checkbox } from './Checkbox';
import { PanelHeader } from './SidePanel';

/* Swatch colours come from the data tokens, so the panel matches the map layers. */
const GROUPS = [
  {
    title: t.layers.heatIslands,
    layers: [
      { id: 'surfaceTemp', label: t.layers.surfaceTemp, swatch: 'var(--heat-6)' },
      { id: 'airTemp', label: t.layers.airTemp, swatch: 'var(--heat-3)' },
    ],
  },
  {
    title: t.layers.infrastructure,
    layers: [
      { id: 'hospitals', label: t.layers.hospitals, swatch: 'var(--level-high)' },
      { id: 'water', label: t.layers.water, swatch: 'var(--accent-2)' },
    ],
  },
  {
    title: t.layers.overlays,
    layers: [
      { id: 'selection', label: t.layers.selection, swatch: 'var(--accent)' },
      { id: 'priority', label: t.layers.priority, swatch: 'var(--vuln-7)', title: t.layers.priorityHint },
      { id: 'grid', label: t.layers.grid, swatch: 'var(--text-muted)' },
    ],
  },
];

/** One toggle row: swatch, name, checkbox. */
function LayerRow({ label, swatch, title, checked, onChange }) {
  return (
    <label title={title} className="flex h-[38px] cursor-pointer items-center gap-2.5 border border-border bg-field px-2.5 hover:bg-hover">
      <span className="size-2.5 shrink-0" style={{ background: swatch }} aria-hidden />
      <span className="flex-1 truncate text-sm text-text">{label}</span>
      <Checkbox checked={checked} onChange={onChange} label={label} />
    </label>
  );
}

export function LayersPanel() {
  const { layers, toggleLayer, setAllLayers, tools, toggleTool, sealingOpacity, setSealingOpacity } = useWorkspace();
  // The grid lives in tools (shared with the map controls); everything else in layers.
  const isOn = (id) => (id === 'grid' ? tools.grid : layers[id]);
  const toggle = (id) => (id === 'grid' ? toggleTool('grid') : toggleLayer(id));
  const anyOn = tools.grid || Object.values(layers).some(Boolean);
  const allLabel = anyOn ? t.layers.hideAll : t.layers.showAll;

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
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {GROUPS.map((g) => (
          <section key={g.title} className="mt-4">
            <h3 className="label-caps mb-2 px-1">{g.title}</h3>
            <ul className="flex flex-col gap-1.5">
              {g.layers.map((l) => (
                <li key={l.id}>
                  <LayerRow {...l} checked={isOn(l.id)} onChange={() => toggle(l.id)} />
                </li>
              ))}
            </ul>
          </section>
        ))}

        <section className="mt-4">
          <h3 className="label-caps mb-2 px-1">{t.layers.sealingRate}</h3>
          <LayerRow label={t.layers.sealing} swatch="var(--seal-4)" checked={layers.sealing} onChange={() => toggleLayer('sealing')} />
          <div className={`border border-t-0 border-border bg-field px-2.5 pb-3 pt-2.5 ${layers.sealing ? '' : 'opacity-50'}`}>
            <div className="mb-2 flex items-center justify-between">
              <label htmlFor="sealing-opacity" className="text-sm text-text">
                {t.layers.opacity}
              </label>
              <span className="text-xs tabular-nums text-muted">{sealingOpacity}%</span>
            </div>
            <input
              id="sealing-opacity"
              type="range"
              min={0}
              max={100}
              value={sealingOpacity}
              disabled={!layers.sealing}
              onChange={(e) => setSealingOpacity(Number(e.target.value))}
              className="hs-range"
              style={{ '--val': `${sealingOpacity}%` }}
            />
          </div>
        </section>
      </div>
    </>
  );
}

