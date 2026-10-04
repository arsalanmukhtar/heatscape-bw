import { TEMP_DOMAIN } from '../data/mock';
import { t } from '../i18n';

const RAMP = `linear-gradient(to right, ${Array.from({ length: 9 }, (_, i) => `var(--heat-${i + 1})`).join(', ')})`;

export function MapLegend() {
  const [lo, hi] = TEMP_DOMAIN;
  return (
    <div className="absolute right-3 top-3 z-10 border border-border-strong bg-surface-strong p-3 shadow-[var(--shadow-glass)] backdrop-blur-md" style={{ width: 'var(--legend-w)' }}>
      <p className="label-caps">{t.map.legendTitle}</p>
      <div className="mt-2.5 h-2" style={{ background: RAMP }} role="img" aria-label={`${lo} to ${hi} °C`} />
      <div className="mt-1.5 flex justify-between text-2xs tabular-nums text-muted">
        <span>{lo}°C</span>
        <span>{hi}°C</span>
      </div>
    </div>
  );
}
