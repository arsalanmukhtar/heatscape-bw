import { LuDroplet, LuHospital, LuPanelRightClose } from 'react-icons/lu';
import { REGION, SEASON, atRiskFacilities, blockById } from '../data/mock';
import { t } from '../i18n';
import { useLayout } from '../state/layout';
import { useWorkspace } from '../state/workspace';
import { PanelHeader } from './SidePanel';
import { TempChart } from './TempChart';

const tempClass = (v) => (v >= 38 ? 'text-level-severe' : v >= 36 ? 'text-level-high' : v >= 34 ? 'text-level-moderate' : 'text-text');
const vulnColor = (v) => (v >= 70 ? 'var(--level-severe)' : v >= 45 ? 'var(--level-moderate)' : 'var(--level-normal)');

export function InspectorPanel() {
  const block = blockById(useWorkspace((s) => s.selectedId));
  const toggleRight = useLayout((s) => s.toggleRight);
  const facilities = atRiskFacilities(block);
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
            <LuPanelRightClose size={15} />
          </button>
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5">
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
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm text-text">{t.inspector.chartTitle}</span>
            <span className="text-2xs text-muted">{SEASON.chartMonth}</span>
          </div>
          <TempChart
            labels={t.inspector.weeks}
            domain={[20, 40]}
            ticks={[20, 30, 40]}
            unit="°C"
            series={[
              { name: t.inspector.chartBlock(block.id), values: block.weekly.block, color: 'var(--series-2)' },
              { name: t.inspector.chartCity, values: block.weekly.city, color: 'var(--text-muted)', dashed: true },
            ]}
          />
        </section>

        <section className="mt-6">
          <p className="label-caps mb-2">{t.inspector.atRisk}</p>
          <ul className="flex flex-col gap-2">
            {facilities.map((f) => (
              <li key={f.name} className="flex h-10 items-center gap-3 border border-border bg-field px-3">
                {f.kind === 'hospital' ? (
                  <LuHospital size={15} className="shrink-0 text-level-high" aria-label="Hospital" />
                ) : (
                  <LuDroplet size={15} className="shrink-0 text-accent-2" aria-label="Water supply" />
                )}
                <span className="flex-1 truncate text-sm text-text">{f.name}</span>
                <span className="text-xs tabular-nums text-level-high">+{f.km.toFixed(1)}km</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
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
