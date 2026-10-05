import { useRef, useState } from 'react';
import { useMap } from 'react-map-gl/mapbox';
import { LuArrowLeft, LuCheck, LuCircleAlert, LuFileUp, LuPaperclip, LuPencil, LuPenTool, LuSave, LuTrash2, LuUndo2, LuX } from 'react-icons/lu';
import { FUNDING_PROGRAMMES, RESPONSIBLE_OFFICES } from '../../data/mock';
import { t } from '../../i18n';
import { readFootprint } from '../../lib/footprintFile';
import { MEASURE_STATUSES, MEASURE_TYPES } from '../../lib/measures';
import { editableCorners, useMeasures } from '../../state/measures';
import { Field, NumberField, Segmented, Select, TextField } from '../controls';
import { DatePicker } from '../DatePicker';
import { PanelHeader } from '../SidePanel';
import { fmtInt, measureBounds } from './format';

const m = t.measures;
const f = t.measures.form;
const btn = 'flex h-7 items-center gap-1.5 border border-border px-2.5 text-xs text-text hover:bg-hover disabled:opacity-40 disabled:hover:bg-transparent';

/** Add-measure form (left panel). Geometry is drawn on the map or read from GeoJSON or a Shapefile. */
export function MeasureForm() {
  const { draft, setDraft, closeForm, save, drawing, startDrawing, undoVertex, finishDrawing, setGeometry, shaping, startShaping, stopShaping, corner, removeVertex } = useMeasures();
  const [errors, setErrors] = useState([]);
  const [geoMessage, setGeoMessage] = useState(null);
  const geoRef = useRef(null);
  const filesRef = useRef(null);
  const set = (key) => (v) => setDraft({ [key]: v });
  const dated = draft.status === 'completed' || draft.status === 'monitored';

  const { main } = useMap();
  const editable = !!editableCorners(draft.geometry);

  // GeoJSON, a zipped Shapefile, or a Shapefile's parts picked together.
  const onGeoFiles = async (e) => {
    const files = [...(e.target.files ?? [])];
    e.target.value = '';
    if (!files.length) return;
    try {
      const { geometry, name } = await readFootprint(files);
      setGeometry(geometry);
      setGeoMessage({ ok: true, text: f.loaded(name) });
      // Fly to the uploaded footprint (the same framing as opening a measure).
      main?.fitBounds(measureBounds({ geometry }), { padding: 160, maxZoom: 17, duration: 800 });
    } catch (err) {
      setGeoMessage({ ok: false, text: f[err.message] ?? f.badFile });
    }
  };

  const onAttach = (e) => {
    const picked = [...(e.target.files ?? [])].map((x) => ({ name: x.name, size: x.size }));
    e.target.value = '';
    setDraft({ files: [...draft.files, ...picked] });
  };

  const submit = () => {
    const missing = [
      !draft.name.trim() && f.needName,
      !draft.geometry && f.needGeometry,
      dated && !draft.completed && f.needDate,
    ].filter(Boolean);
    setErrors(missing);
    if (!missing.length) save();
  };

  return (
    <>
      <PanelHeader
        title={f.title}
        actions={
          <button type="button" onClick={closeForm} aria-label={f.back} title={f.back} className="grid size-7 place-items-center text-muted hover:bg-hover hover:text-text">
            <LuArrowLeft size={14} />
          </button>
        }
      />
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-4 py-3">
        <Field label={f.name}>
          <TextField value={draft.name} onChange={set('name')} label={f.name} placeholder={f.namePlaceholder} />
        </Field>
        <Field label={f.type}>
          <Select
            value={draft.type}
            onChange={set('type')}
            label={f.type}
            options={MEASURE_TYPES.map((x) => ({ value: x.id, label: m.types[x.id], icon: <x.Icon size={13} className="shrink-0" style={{ color: x.color }} /> }))}
          />
        </Field>
        <Field label={f.status}>
          <Select value={draft.status} onChange={set('status')} label={f.status} options={MEASURE_STATUSES.map((x) => ({ value: x.id, label: m.statuses[x.id] }))} />
        </Field>

        {/* Geometry: drawn on the map, or uploaded. */}
        <div className="flex flex-col gap-2 border border-border p-2.5">
          <div className="flex items-center gap-2">
            <span className="label-caps uppercase">{f.geometry}</span>
          </div>
          <Segmented
            value={draft.source}
            onChange={(v) => {
              if (drawing) finishDrawing();
              stopShaping();
              setDraft({ source: v });
            }}
            label={f.geometry}
            options={[
              { value: 'draw', label: f.draw, icon: <LuPenTool size={12} aria-hidden /> },
              { value: 'upload', label: f.upload, icon: <LuFileUp size={12} aria-hidden /> },
            ]}
          />
          {draft.source === 'draw' &&
            (drawing ? (
              <>
                <p className="text-xs text-text">{f.drawHint}</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="mr-auto text-xs tabular-nums text-muted">{f.corners(draft.vertices.length)}</span>
                  <button type="button" onClick={undoVertex} disabled={!draft.vertices.length} className={btn}>
                    <LuUndo2 size={12} aria-hidden />
                    <span>{f.undoCorner}</span>
                  </button>
                  <button type="button" onClick={finishDrawing} disabled={draft.vertices.length < 3} className={btn}>
                    <span>{f.finish}</span>
                  </button>
                </div>
              </>
            ) : (
              !draft.geometry && (
                <button type="button" onClick={startDrawing} className={`${btn} self-start`}>
                  <LuPenTool size={12} aria-hidden />
                  <span>{f.startDrawing}</span>
                </button>
              )
            ))}
          {draft.source === 'upload' && (
            <>
              <button type="button" onClick={() => geoRef.current?.click()} className={`${btn} self-start`}>
                <LuFileUp size={12} aria-hidden />
                <span>{f.chooseFile}</span>
              </button>
              <input ref={geoRef} type="file" multiple accept=".geojson,.json,.zip,.shp,.shx,.dbf,.prj,.cpg,.gpkg" className="hidden" onChange={onGeoFiles} />
              <p className="text-2xs text-muted">{f.uploadHint}</p>
              {geoMessage && (
                <p className={`flex items-start gap-1.5 text-xs ${geoMessage.ok ? 'text-success' : 'text-warning'}`}>
                  {!geoMessage.ok && <LuCircleAlert size={13} className="mt-px shrink-0" aria-hidden />}
                  <span>{geoMessage.text}</span>
                </p>
              )}
            </>
          )}
          {draft.geometry && !drawing && (
            <>
              <div className="flex flex-wrap items-center gap-1.5 border-t border-border-soft pt-2">
                <span className="mr-auto min-w-0 truncate text-xs text-text">{f.polygonReady(fmtInt(draft.area))}</span>
                <button
                  type="button"
                  onClick={shaping ? stopShaping : startShaping}
                  disabled={!editable}
                  aria-pressed={shaping}
                  title={editable ? undefined : f.notEditable}
                  className={`${btn} ${shaping ? 'border-accent-line bg-accent-soft' : ''}`}
                >
                  {shaping ? <LuCheck size={12} aria-hidden /> : <LuPencil size={12} aria-hidden />}
                  <span>{shaping ? f.doneEditing : f.editShape}</span>
                </button>
                {draft.source === 'draw' && (
                  <button type="button" onClick={startDrawing} className={btn}>
                    <LuPenTool size={12} aria-hidden />
                    <span>{f.redraw}</span>
                  </button>
                )}
                <button type="button" onClick={() => setGeometry(null)} aria-label={f.clearGeometry} title={f.clearGeometry} className="grid size-7 place-items-center text-muted hover:text-accent">
                  <LuTrash2 size={13} />
                </button>
              </div>
              {shaping && (
                <div className="flex items-start gap-2">
                  <p className="min-w-0 flex-1 text-2xs leading-relaxed text-muted">{f.editHint}</p>
                  <button type="button" onClick={() => removeVertex(corner)} disabled={corner == null || draft.vertices.length <= 3} title={f.deleteCornerHint} className={`${btn} shrink-0`}>
                    <LuTrash2 size={12} aria-hidden />
                    <span>{f.deleteCorner}</span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <Field label={dated ? f.completed : f.target}>
          <DatePicker value={draft.completed} onChange={(v) => setDraft({ completed: v })} label={dated ? f.completed : f.target} />
        </Field>
        <Field label={f.area}>
          <NumberField value={draft.area} min={0} label={f.area} className="w-28" onChange={set('area')} />
          <span className="text-xs text-muted">m²</span>
        </Field>
        <Field label={f.cost}>
          <NumberField value={draft.cost} min={0} step={1000} label={f.cost} className="w-28" onChange={set('cost')} />
          <span className="text-xs text-muted">EUR</span>
        </Field>
        <Field label={f.funding}>
          <Select value={draft.funding} onChange={set('funding')} label={f.funding} options={[{ value: '', label: f.choose }, ...FUNDING_PROGRAMMES.map((p) => ({ value: p, label: p }))]} />
        </Field>
        <Field label={f.office}>
          <Select value={draft.office} onChange={set('office')} label={f.office} options={[{ value: '', label: f.choose }, ...RESPONSIBLE_OFFICES.map((o) => ({ value: o, label: o }))]} />
        </Field>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="w-[104px] shrink-0 text-xs text-muted">{f.files}</span>
            <button type="button" onClick={() => filesRef.current?.click()} className={btn}>
              <LuPaperclip size={12} aria-hidden />
              <span>{f.attach}</span>
            </button>
            <input ref={filesRef} type="file" multiple accept="image/*,.pdf,.doc,.docx,.xlsx" className="hidden" onChange={onAttach} />
          </div>
          {draft.files.length > 0 && (
            <ul className="flex flex-col border border-border">
              {draft.files.map((x, i) => (
                <li key={`${x.name}-${i}`} className="flex h-7 items-center gap-2 border-b border-border-soft px-2 last:border-b-0">
                  <span className="min-w-0 flex-1 truncate text-xs text-text">{x.name}</span>
                  <span className="text-2xs tabular-nums text-muted">{Math.max(1, Math.round(x.size / 1024))} KB</span>
                  <button type="button" onClick={() => setDraft({ files: draft.files.filter((_, j) => j !== i) })} aria-label={f.removeFile} title={f.removeFile} className="text-muted hover:text-accent">
                    <LuX size={12} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="text-2xs text-muted">{f.filesHint}</p>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">{f.notes}</span>
          <textarea
            rows={3}
            value={draft.notes}
            onChange={(e) => setDraft({ notes: e.target.value })}
            className="resize-y border border-border bg-field px-2 py-1.5 text-xs text-text outline-none placeholder:text-faint focus:border-accent-line"
            placeholder={f.notesPlaceholder}
          />
        </label>

        {errors.length > 0 && (
          <ul className="flex flex-col gap-1 border border-border bg-[var(--danger-soft)] px-2.5 py-2" role="alert">
            {errors.map((e) => (
              <li key={e} className="flex items-center gap-1.5 text-xs text-danger">
                <LuCircleAlert size={12} className="shrink-0" aria-hidden />
                <span>{e}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-4 py-2.5">
        <button type="button" onClick={closeForm} className={btn}>
          <span>{f.cancel}</span>
        </button>
        <button type="button" onClick={submit} className="flex h-7 items-center gap-1.5 bg-accent px-3 text-xs font-semibold text-on-accent hover:brightness-110">
          <LuSave size={12} aria-hidden />
          <span>{f.save}</span>
        </button>
      </div>
    </>
  );
}
