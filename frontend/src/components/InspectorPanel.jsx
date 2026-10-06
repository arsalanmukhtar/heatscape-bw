import { LuDroplet, LuHospital, LuScanSearch, LuX } from 'react-icons/lu';
import { useMap } from 'react-map-gl/mapbox';
import { VscCollapseAll } from 'react-icons/vsc';
import { REGION, SEASON, atRiskFacilities, blockById } from '../data/mock';
import { t } from '../i18n';
import { LAYERS, rasterCell } from '../lib/layers';
import { useLayout } from '../state/layout';
import { useWorkspace } from '../state/workspace';
import { PanelHeader } from './SidePanel';
import { ExpandButton, ExpandSlot } from './Expandable';
import { TempChart } from './TempChart';

const tempClass = (v) => (v >= 38 ? 'text-level-severe' : v >= 36 ? 'text-level-high' : v >= 34 ? 'text-level-moderate' : 'text-text');
const vulnColor = (v) => (v >= 70 ? 'var(--level-severe)' : v >= 45 ? 'var(--level-moderate)' : 'var(--level-normal)');

export function InspectorPanel() {
  const block = blockById(useWorkspace((s) => s.selectedId));
  const toggleRight = useLayout((s) => s.toggleRight);
  const facilities = atRiskFacilities(block);
  const { main } = useMap();
  const vColor = vulnColor(block.vulnerability);

  return (
    <>
      <PanelHeader
        title={t.inspector.title}
        actions={
          <button
            type="button"
            onClick={toggleRight}
            aria-label={t.inspector.collapse}
            title={t.inspector.collapse}
            className="grid size-7 place-items-center text-muted hover:bg-hover hover:text-text"
          >
            <VscCollapseAll size={15} />
          </button>
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5">
        <PixelSection />
        <section className="pt-5">
          <p className="label-caps">{t.inspector.selectedBlock}</p>
          <h3 className="mt-1 flex items-baseline gap-2">
            <span className="text-lg font-semibold text-text">{block.district}</span>
            <span className="text-xs text-muted">{block.id}</span>
          </h3>
          <p className="mt-0.5 text-xs text-muted">
            {REGION.name} · {REGION.state}
          </p>
        </section>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <Stat label={t.inspector.temperature}>
            <span className={tempClass(block.lstDay)}>{block.lstDay.toFixed(1)}</span>
            <span className={`ml-0.5 text-xs ${tempClass(block.lstDay)}`}>°C</span>
          </Stat>
          <Stat label={t.inspector.sealing}>
            <span>{block.sealing}</span>
            <span className="ml-0.5 text-xs">%</span>
          </Stat>
        </div>

        <section className="mt-5 border border-border px-3 py-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-text">{t.inspector.vulnerability}</span>
            <span className="text-sm font-medium" style={{ color: vColor }}>
              {t.inspector.vulnerabilityLevel(block.vulnerability)}
            </span>
          </div>
          <div
            className="mt-3 h-1.5 bg-border"
            role="meter"
            aria-label={t.inspector.vulnerability}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={block.vulnerability}
          >
            <div className="h-full" style={{ width: `${block.vulnerability}%`, background: vColor }} />
          </div>
          <div className="mt-2 flex justify-between text-2xs tabular-nums text-muted">
            <span>0</span>
            <span>{block.vulnerability} / 100</span>
            <span>100</span>
          </div>
        </section>

        <section className="mt-5 border border-border px-3 py-3">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-sm text-text">{t.inspector.chartTitle}</span>
            <span className="ml-auto text-2xs text-muted">{SEASON.chartMonth}</span>
            <ExpandButton id="inspector-temp" className="-mr-1.5" />
          </div>
          <ExpandSlot id="inspector-temp" title={`${t.inspector.chartTitle} · ${block.id}`}>
            {(large) => (
              <TempChart
                large={large}
                labels={t.inspector.weeks}
                domain={[20, 40]}
                ticks={[20, 30, 40]}
                unit="°C"
                series={[
                  { name: t.inspector.chartBlock(block.id), values: block.weekly.block, color: 'var(--series-2)' },
                  { name: t.inspector.chartCity, values: block.weekly.city, color: 'var(--text-muted)', dashed: true },
                ]}
              />
            )}
          </ExpandSlot>
        </section>

        <section className="mt-6">
          <p className="label-caps mb-2">{t.inspector.atRisk}</p>
          <ul className="flex flex-col gap-2">
            {facilities.map((f) => (
              <li key={f.name} className="flex h-10 items-center gap-3 border border-border bg-field pl-3 pr-1.5">
                {f.kind === 'hospital' ? (
                  <LuHospital size={15} className="shrink-0 text-level-high" aria-label="Hospital" />
                ) : (
                  <LuDroplet size={15} className="shrink-0 text-accent-2" aria-label="Water supply" />
                )}
                <span className="flex-1 truncate text-sm text-text">{f.name}</span>
                <span className="text-xs tabular-nums text-level-high">+{f.km.toFixed(1)}km</span>
                <button
                  type="button"
                  onClick={() => main?.flyTo({ center: f.position, zoom: Math.max(main.getZoom(), 15), duration: 800 })}
                  aria-label={t.inspector.zoomTo(f.name)}
                  title={t.inspector.zoomTo(f.name)}
                  className="grid size-7 shrink-0 place-items-center text-muted transition-colors duration-150 hover:text-accent"
                >
                  <LuScanSearch size={13} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}

/** Values of every visible raster at the pixel identified on the map (select tool click). */
function PixelSection() {
  const { pixel, setPixel, layers } = useWorkspace();
  if (!pixel) return null;
  const rows = LAYERS.filter((d) => d.raster && layers[d.id])
    .map((def) => ({ def, cell: rasterCell(def, pixel.lon, pixel.lat) }))
    .filter((r) => r.cell);
  if (!rows.length) return null;
  const { cell } = rows[0];
  const value = (def, v) => {
    if (v == null) return t.inspector.noData;
    const label = def.raster.classes?.find((c) => c.value === v)?.label;
    return label ? `${label} (${v})` : `${v.toFixed(1)}${def.raster.unit ? ` ${def.raster.unit}` : ''}`;
  };
  return (
    <section className="border-b border-border pb-5 pt-5">
      <div className="flex items-center gap-2">
        <p className="label-caps">{t.inspector.pixel}</p>
        <button type="button" onClick={() => setPixel(null)} aria-label={t.inspector.clearPixel} title={t.inspector.clearPixel} className="-mr-1.5 ml-auto grid size-7 place-items-center text-muted hover:bg-hover hover:text-text">
          <LuX size={13} />
        </button>
      </div>
      <p className="text-xs tabular-nums text-text">{`${pixel.lat.toFixed(5)}° N, ${pixel.lon.toFixed(5)}° E`}</p>
      <p className="mt-0.5 text-2xs tabular-nums text-muted">{t.inspector.cell(cell.row + 1, cell.col + 1, cell.size)}</p>
      <ul className="mt-3 flex flex-col gap-2">
        {rows.map(({ def, cell: c }) => (
          <li key={def.id} className="flex h-10 items-center gap-3 border border-border bg-field px-3">
            <span className="flex-1 truncate text-sm text-text">{def.label}</span>
            <span className={`whitespace-nowrap text-sm font-medium tabular-nums ${c.value == null ? 'text-muted' : 'text-text'}`}>{value(def, c.value)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Stat({ label, children }) {
  return (
    <div className="border border-border px-3 py-3">
      <p className="text-2xs text-muted">{label}</p>
      <p className="mt-2 text-xl font-semibold tabular-nums text-text">{children}</p>
    </div>
  );
}
