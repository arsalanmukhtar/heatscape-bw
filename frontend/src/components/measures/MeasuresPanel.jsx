import { LuPlus } from 'react-icons/lu';
import { useMap } from 'react-map-gl/mapbox';
import { MANNHEIM_DISTRICTS } from '../../data/mock';
import { t } from '../../i18n';
import { MEASURE_STATUSES, MEASURE_TYPES, measureStatus, measureType } from '../../lib/measures';
import { useLayout } from '../../state/layout';
import { filterMeasures, SORT_KEYS, useAllMeasures, useMeasures } from '../../state/measures';
import { Select } from '../controls';
import { SearchBar, SearchEmpty } from '../SearchBar';
import { PanelHeader } from '../SidePanel';
import { fmtDate, fmtEffect, measureBounds } from './format';
import { MeasureForm } from './MeasureForm';

const m = t.measures;
const YEARS = ['2026', '2025', '2024', '2023', '2022', '2021', '2020'];

/** Left panel "Measures": the register list, or the add-measure form. */
export function MeasuresPanel() {
  const mode = useMeasures((s) => s.mode);
  return mode === 'form' ? <MeasureForm /> : <MeasureList />;
}

function MeasureList() {
  const all = useAllMeasures();
  const { query, setQuery, filters, setFilter, clearFilters, sort, setSort, openForm } = useMeasures();
  const rows = filterMeasures(all, { query, filters, sort });
  const filtered = query || Object.values(filters).some(Boolean);

  return (
    <>
      <PanelHeader
        title={m.title}
        info={m.info}
        actions={
          <button type="button" onClick={openForm} className="flex h-7 items-center gap-1.5 bg-accent px-2.5 text-xs font-semibold text-on-accent hover:brightness-110">
            <LuPlus size={13} aria-hidden />
            <span>{m.add}</span>
          </button>
        }
      />
      <div className="flex shrink-0 flex-col gap-2 border-b border-border px-3 py-3">
        <SearchBar value={query} onChange={setQuery} placeholder={m.search} size="md" className="w-full" />
        <div className="grid grid-cols-2 gap-1.5">
          <Select value={filters.type} onChange={(v) => setFilter('type', v)} label={m.filterType} options={[{ value: '', label: m.allTypes }, ...MEASURE_TYPES.map((x) => ({ value: x.id, label: m.types[x.id], icon: <x.Icon size={13} className="shrink-0" style={{ color: x.color }} /> }))]} />
          <Select value={filters.status} onChange={(v) => setFilter('status', v)} label={m.filterStatus} options={[{ value: '', label: m.allStatuses }, ...MEASURE_STATUSES.map((x) => ({ value: x.id, label: m.statuses[x.id] }))]} />
          <Select value={filters.district} onChange={(v) => setFilter('district', v)} label={m.filterDistrict} options={[{ value: '', label: m.allDistricts }, ...MANNHEIM_DISTRICTS.map((d) => d.name).sort().map((d) => ({ value: d, label: d }))]} />
          <Select value={filters.year} onChange={(v) => setFilter('year', v)} label={m.filterYear} options={[{ value: '', label: m.allYears }, ...YEARS.map((y) => ({ value: y, label: y }))]} />
        </div>
        <div className="flex h-7 items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-xs text-muted">{m.count(rows.length, all.length)}</span>
          {filtered && (
            <button type="button" onClick={clearFilters} className="h-7 px-1 text-xs text-accent hover:underline">
              {m.clear}
            </button>
          )}
          <Select value={sort} onChange={setSort} label={m.sortBy} className="w-36" options={SORT_KEYS.map((k) => ({ value: k, label: m.sorts[k] }))} />
        </div>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {rows.length === 0 && <SearchEmpty>{m.noMatch}</SearchEmpty>}
        {rows.map((x) => (
          <MeasureRow key={x.id} measure={x} />
        ))}
      </ul>
    </>
  );
}

function MeasureRow({ measure: x }) {
  const { main } = useMap();
  const { selectedId, select } = useMeasures();
  const showRightView = useLayout((s) => s.showRightView);
  const type = measureType(x.type);
  const status = measureStatus(x.status);
  const on = x.id === selectedId;
  const effect = fmtEffect(x);

  const pick = () => {
    select(x.id);
    showRightView('effect');
    main?.fitBounds(measureBounds(x), { padding: 160, maxZoom: 17, duration: 800 });
  };

  return (
    <li>
      <button
        type="button"
        onClick={pick}
        aria-current={on ? 'true' : undefined}
        className={`flex w-full items-center gap-3 border-b border-l-2 border-b-border-soft px-3 py-2.5 text-left ${on ? 'border-l-accent bg-accent-soft' : 'border-l-transparent hover:bg-hover'}`}
      >
        {/* Type mark: icon in the type colour (identity, always next to the type name in the tooltip). */}
        <span className="grid size-8 shrink-0 place-items-center border" style={{ borderColor: type.color, color: type.color }} title={m.types[x.type]}>
          <type.Icon size={15} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-text">{x.name}</span>
          <span className="mt-0.5 block truncate text-2xs text-muted">
            {x.district} · {x.completed ? fmtDate(x.completed) : m.target(x.target)}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span className="level-chip" style={{ '--chip': status.color }}>
            {m.statuses[x.status]}
          </span>
          <span className={`text-xs tabular-nums ${effect.value == null ? 'text-muted' : 'font-semibold text-text'}`}>{effect.text}</span>
        </span>
      </button>
    </li>
  );
}
