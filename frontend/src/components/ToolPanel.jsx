import { useState } from 'react';
import { LuCircleAlert, LuPlay, LuRotateCcw } from 'react-icons/lu';
import { VscCollapseAll } from 'react-icons/vsc';
import { GP_EXTENTS, GP_FORMATS, GP_TOOLS, REGION } from '../data/mock';
import { t } from '../i18n';
import { LAYERS } from '../lib/layers';
import { useJobs } from '../state/jobs';
import { useLayout } from '../state/layout';
import { useWorkspace } from '../state/workspace';
import { Check, NumberField, Section, Select, TextField } from './controls';
import { DatePicker } from './DatePicker';
import { SearchEmpty } from './SearchBar';
import { PanelHeader } from './SidePanel';

const g = t.geoprocessing;
const NAME_RE = /^[A-Za-z0-9_.-]+$/;

// Layers a tool input accepts: polygon / line / point layers, rasters with values, or the DEM.
const fits = (def, geometry) => geometry.some((x) => (x === 'dem' ? def.kind === 'dem' : x === 'raster' ? def.geometry === 'raster' && def.kind !== 'dem' : def.geometry === x));
const layerLabel = (id) => LAYERS.find((d) => d.id === id)?.label ?? id;
const stamp = () => new Date().toISOString().slice(0, 10).replaceAll('-', '');

function initialValues(tool) {
  return {
    inputs: Object.fromEntries(tool.inputs.map((i) => [i.key, i.default])),
    params: Object.fromEntries(tool.params.map((p) => [p.key, p.default])),
    extent: 'study',
    name: `${REGION.name}_${tool.short}_${stamp()}`,
    folder: `/data/outputs/${REGION.name.toLowerCase()}/`,
    format: tool.formats[0],
  };
}

/** Messages for everything that blocks a run (empty list = ready). */
function problems(tool, v) {
  const out = [];
  tool.inputs.forEach((i) => !i.optional && !v.inputs[i.key] && out.push(g.needInput(i.label)));
  tool.params.forEach((p) => {
    const x = v.params[p.key];
    if (p.type === 'number' && (!Number.isFinite(x) || (p.min != null && x < p.min) || (p.max != null && x > p.max))) out.push(g.outOfRange(p.label, p.min, p.max));
  });
  if (tool.id === 'hvi' && v.params.weighting === 'expert') {
    const sum = v.params.wExposure + v.params.wSensitivity + v.params.wCapacity;
    if (Math.abs(sum - 1) > 0.001) out.push(g.weightsSum(sum.toFixed(2)));
  }
  if (tool.id === 'lst' && v.params.from > v.params.to) out.push(g.dateOrder);
  if (!NAME_RE.test(v.name)) out.push(g.badName);
  if (!v.folder.startsWith('/')) out.push(g.badFolder);
  return out;
}

/** Label beside its control; long labels wrap instead of truncating. */
function Row({ label, children }) {
  return (
    <div className="flex min-h-7 items-center gap-3">
      <span className="min-w-0 flex-1 text-xs text-muted">{label}</span>
      <div className="flex w-40 shrink-0 items-center gap-1.5">{children}</div>
    </div>
  );
}

/** Label above a full-width control. */
function Stack({ label, children }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted">{label}</span>
      {children}
    </div>
  );
}

function ParamControl({ p, value, onChange }) {
  if (p.type === 'check') return <Check checked={value} onChange={onChange} label={p.label} />;
  let control;
  if (p.type === 'select') control = <Select value={value} onChange={onChange} label={p.label} options={p.options.map((o) => ({ value: o, label: p.unit ? `${o} ${p.unit}` : (g.optionLabels[o] ?? o) }))} />;
  else if (p.type === 'date') control = <DatePicker value={value} onChange={onChange} label={p.label} />;
  else if (p.type === 'number')
    control = (
      <>
        <NumberField value={value} onChange={onChange} min={p.min} max={p.max} step={p.step} label={p.label} className="min-w-0 flex-1" />
        {p.unit && <span className="w-4 shrink-0 text-xs text-muted">{p.unit}</span>}
      </>
    );
  else control = <TextField value={value} onChange={onChange} label={p.label} />;
  return <Row label={p.label}>{control}</Row>;
}

/*
  Tool form (right view 'tool'), opened from the Geoprocessing list: description, input
  layers, parameters, processing extent and output (name, folder, format → full path).
  Run (bottom right) is enabled once nothing blocks it; it submits the job with this
  configuration and opens Jobs History on it, where the log prints the configuration.
*/
export function ToolPanel() {
  const toolId = useJobs((s) => s.toolId);
  const tool = GP_TOOLS.find((x) => x.id === toolId);
  const toggleRight = useLayout((s) => s.toggleRight);
  return (
    <>
      <PanelHeader
        title={tool ? tool.name : g.toolTitle}
        actions={
          <button type="button" onClick={toggleRight} aria-label={g.collapse} title={g.collapse} className="grid size-7 place-items-center text-muted hover:bg-hover hover:text-text">
            <VscCollapseAll size={15} />
          </button>
        }
      />
      {tool ? <ToolForm key={tool.id} tool={tool} /> : <SearchEmpty>{g.pickTool}</SearchEmpty>}
    </>
  );
}

function ToolForm({ tool }) {
  const [v, setV] = useState(() => initialValues(tool));
  const submit = useJobs((s) => s.submit);
  const setDockTab = useLayout((s) => s.setDockTab);
  const selectedBlock = useWorkspace((s) => s.selectedId);
  const set = (group, key, value) => setV({ ...v, [group]: { ...v[group], [key]: value } });

  const blockers = problems(tool, v);
  const folder = v.folder.endsWith('/') ? v.folder : `${v.folder}/`;
  const path = `${folder}${v.name}.${GP_FORMATS[v.format].ext}`;
  const extentLabel = (value) => (value === 'block' ? g.extentBlock(selectedBlock) : GP_EXTENTS.find((e) => e.value === value).label);
  // Expert weighting shows the three weights; the other methods set them.
  const shown = tool.params.filter((p) => !(tool.id === 'hvi' && p.key.startsWith('w') && p.key !== 'weighting' && v.params.weighting !== 'expert'));

  const run = () => {
    const paramText = (p) => {
      const x = v.params[p.key];
      return p.type === 'check' ? (x ? g.yes : g.no) : `${x}${p.unit ? ` ${p.unit}` : ''}`;
    };
    submit(tool, {
      name: v.name,
      inputs: tool.inputs.filter((i) => v.inputs[i.key]).map((i) => [i.label, layerLabel(v.inputs[i.key])]),
      params: shown.map((p) => [p.label, paramText(p)]),
      extent: extentLabel(v.extent),
      output: { path, format: GP_FORMATS[v.format].label },
    });
    setDockTab('jobs');
  };

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <p className="border-b border-border px-4 py-3 text-xs leading-relaxed text-muted">
          <span className="font-semibold text-text">{tool.category}</span> · {tool.description}
        </p>

        <Section title={g.inputs}>
          {tool.inputs.length === 0 && <p className="text-xs text-muted">{g.noInputs}</p>}
          {tool.inputs.map((i) => (
            <Stack key={i.key} label={i.label}>
              <Select
                value={v.inputs[i.key] ?? ''}
                onChange={(x) => set('inputs', i.key, x || null)}
                label={i.label}
                options={[...(i.optional ? [{ value: '', label: g.none }] : []), ...LAYERS.filter((d) => fits(d, i.geometry)).map((d) => ({ value: d.id, label: d.label }))]}
              />
            </Stack>
          ))}
        </Section>

        <Section title={g.parameters}>
          {shown.map((p) => (
            <ParamControl key={p.key} p={p} value={v.params[p.key]} onChange={(x) => set('params', p.key, x)} />
          ))}
        </Section>

        <Section title={g.extent}>
          <Select value={v.extent} onChange={(x) => setV({ ...v, extent: x })} label={g.extent} options={GP_EXTENTS.map((e) => ({ value: e.value, label: extentLabel(e.value) }))} />
        </Section>

        <Section title={g.output}>
          <Stack label={g.outputName}>
            <TextField value={v.name} onChange={(x) => setV({ ...v, name: x.trim() })} label={g.outputName} />
          </Stack>
          <Stack label={g.outputFolder}>
            <TextField value={v.folder} onChange={(x) => setV({ ...v, folder: x.trim() })} label={g.outputFolder} className="w-full font-mono" />
          </Stack>
          <Stack label={g.format}>
            <Select value={v.format} onChange={(x) => setV({ ...v, format: x })} label={g.format} options={tool.formats.map((f) => ({ value: f, label: GP_FORMATS[f].label }))} />
          </Stack>
          <Stack label={g.path}>
            <p className="break-all border border-border bg-field px-2 py-1.5 font-mono text-2xs text-text">{path}</p>
          </Stack>
        </Section>

        {blockers.length > 0 && (
          <ul className="flex flex-col gap-1.5 px-4 py-3" aria-live="polite">
            {blockers.map((b) => (
              <li key={b} className="flex items-start gap-2 text-xs text-danger">
                <LuCircleAlert size={13} className="icon-cap shrink-0" aria-hidden />
                <span className="text-cap-start">{b}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Actions pinned to the bottom: reset left, run bottom right. */}
      <div className="flex shrink-0 items-center gap-2 border-t border-border px-4 py-3">
        <button type="button" onClick={() => setV(initialValues(tool))} className="flex h-8 items-center gap-1.5 border border-border-strong px-3 text-xs text-text hover:bg-hover">
          <LuRotateCcw size={13} aria-hidden />
          <span>{g.reset}</span>
        </button>
        <button
          type="button"
          onClick={run}
          disabled={blockers.length > 0}
          title={blockers.length ? blockers[0] : g.run(tool.name)}
          className="ml-auto flex h-8 items-center gap-1.5 bg-accent px-4 text-xs font-semibold text-on-accent hover:brightness-110 disabled:opacity-40 disabled:hover:brightness-100"
        >
          <LuPlay size={13} aria-hidden />
          <span>{g.runButton}</span>
        </button>
      </div>
    </>
  );
}
