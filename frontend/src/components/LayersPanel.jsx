import { LuCheck } from 'react-icons/lu';
import { t } from '../i18n';
import { useWorkspace } from '../state/workspace';
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
];

export function LayersPanel() {
  const { layers, toggleLayer, sealingOpacity, setSealingOpacity } = useWorkspace();

  return (
    <>
      <PanelHeader title={t.layers.title} />
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {GROUPS.map((g) => (
          <section key={g.title} className="mt-4">
            <h3 className="label-caps mb-2 px-1">{g.title}</h3>
            <ul className="flex flex-col gap-1.5">
              {g.layers.map((l) => (
                <li key={l.id}>
                  <label className="flex h-[38px] cursor-pointer items-center gap-2.5 border border-border bg-field px-2.5 hover:bg-hover">
                    <span className="size-2.5 shrink-0" style={{ background: l.swatch }} aria-hidden />
                    <span className="flex-1 truncate text-sm text-text">{l.label}</span>
                    <Checkbox checked={layers[l.id]} onChange={() => toggleLayer(l.id)} label={l.label} />
                  </label>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <section className="mt-4">
          <h3 className="label-caps mb-2 px-1">{t.layers.sealingRate}</h3>
          <div className="border border-border bg-field px-2.5 pb-3 pt-2.5">
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

/* Square checkbox: a native input kept for keyboard and screen readers, drawn as a box. */
function Checkbox({ checked, onChange, label }) {
  return (
    <span className="relative grid size-4 shrink-0 place-items-center">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        aria-label={label}
        className="absolute inset-0 m-0 cursor-pointer appearance-none border border-border-strong bg-surface-strong checked:border-layer-on checked:bg-layer-on"
      />
      {checked && <LuCheck size={12} strokeWidth={3} className="pointer-events-none relative text-on-accent" />}
    </span>
  );
}
