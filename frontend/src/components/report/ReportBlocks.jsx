import { LuFlame, LuImage } from 'react-icons/lu';
import { scaleBar } from '../../lib/geo';
import { layerById } from '../../lib/layers';
import { legendFor } from '../../lib/legend';
import { fmtSignedValue, fmtValue } from '../../lib/reportContent';
import { htmlBlocks } from '../../lib/richText';
import { ConfidencePips } from '../ConfidencePips';
import { LegendSwatch } from '../LayerLegend';
import { ReportChart } from './ReportChart';

/*
  Page geometry (CSS px at 96 dpi; A4 = 210 × 297 mm = 794 × 1123 px). Every section is cut
  into blocks that the paginator (ReportDocument) packs onto pages; a heading block keeps
  with the block after it, and the title page fills a page of its own.
*/
export const PAGE_W = 794;
export const PAGE_H = 1123;
export const PAD_X = 64;
export const BODY_TOP = 92;
export const BODY_BOTTOM = 84;
export const CONTENT_W = PAGE_W - 2 * PAD_X;
export const CONTENT_H = PAGE_H - BODY_TOP - BODY_BOTTOM;
const MAP_MAX_H = 500;
const LEGEND_LAYERS = 4;
const LEGEND_ITEMS = 6;

// Cells centre their content vertically (like spreadsheet cells); headers never wrap.
const th = 'whitespace-nowrap border-b border-border-strong px-2 py-1.5 text-left align-middle text-[10px] font-semibold uppercase tracking-[var(--tracking-caps)] text-muted';
const td = 'border-b border-border-soft px-2 py-1.5 align-middle';

function Heading({ children }) {
  return <h2 className="border-b border-border pb-[6px] text-[17px] font-semibold text-text">{children}</h2>;
}

/** The title page (fills its page). */
export function TitlePage({ c, section, author }) {
  return (
    <div className="flex h-full flex-col px-[64px] pb-[40px] pt-[64px]">
      <div className="flex items-center gap-[10px]">
        <span className="grid size-[36px] place-items-center bg-accent text-on-accent" aria-hidden>
          <LuFlame size={19} strokeWidth={2.25} />
        </span>
        <span className="text-[15px] font-bold tracking-[0.04em] text-text">{c.P.brand}</span>
      </div>
      <div className="mt-auto">
        <span className="block h-[4px] w-[64px] bg-accent" aria-hidden />
        <h1 className="mt-[24px] text-[34px] font-bold leading-[1.15] text-text">{c.title}</h1>
        <p className="mt-[12px] text-[16px] text-muted">{c.subtitle(section)}</p>
      </div>
      <dl className="mt-auto grid grid-cols-[auto_1fr] gap-x-[24px] gap-y-[6px] border-t border-border pt-[16px] text-[12px]">
        <dt className="text-muted">{c.P.preparedBy}</dt>
        <dd className="text-text">
          {author} · {c.organisation(section)}
        </dd>
        <dt className="text-muted">{c.P.date}</dt>
        <dd className="text-text">{c.date}</dd>
        <dt className="text-muted">{c.P.dataVersion}</dt>
        <dd className="text-text">{c.dataVersion}</dd>
      </dl>
    </div>
  );
}

/** Scale bar and north arrow for the printed map image (scale at the printed width). */
function MapFurniture({ snap, shownW, c }) {
  const zoom = snap.zoom + Math.log2(shownW / snap.cssWidth);
  const bar = scaleBar(snap.center[1], zoom, 110);
  return (
    <>
      <div className="absolute bottom-[8px] left-[8px] flex flex-col gap-[2px] bg-surface/85 px-[6px] py-[4px]">
        <span className="text-[10px] tabular-nums text-text">{bar.label}</span>
        <span className="block h-[6px] border-x-2 border-b-2 border-text" style={{ width: bar.px }} aria-hidden />
      </div>
      <div className="absolute right-[8px] top-[8px] flex flex-col items-center gap-[2px] bg-surface/85 px-[6px] py-[4px]" aria-label="North">
        <svg width="14" height="18" viewBox="0 0 14 18" style={{ transform: `rotate(${-snap.bearing}deg)` }} aria-hidden>
          <path d="M7 0L13 17L7 13L1 17Z" style={{ fill: 'var(--text)' }} />
        </svg>
        <span className="text-[10px] font-semibold text-text">{c.P.north}</span>
      </div>
    </>
  );
}

function MapLegend({ snap, styles, c }) {
  const defs = (snap.layers ?? []).map(layerById).filter((d) => d && styles[d.id]?.showLegend !== false).slice(0, LEGEND_LAYERS);
  if (!defs.length) return null;
  return (
    <div className="mt-[10px]">
      <p className="mb-[6px] text-[10px] font-semibold uppercase tracking-[var(--tracking-caps)] text-muted">{c.P.legend}</p>
      <div className="grid grid-cols-2 gap-x-[24px] gap-y-[10px]">
        {defs.map((def) => {
          const lg = legendFor(def, styles[def.id]);
          return (
            <div key={def.id} className="min-w-[0px]">
              <p className="mb-[4px] truncate text-[11px] font-semibold text-text">{def.label}</p>
              {lg.ramp ? (
                <div>
                  <span className="block h-[8px] outline outline-1 outline-border-strong" style={{ background: `linear-gradient(90deg, ${lg.ramp.colors.join(', ')})` }} aria-hidden />
                  <div className="mt-[2px] flex justify-between text-[10px] tabular-nums text-muted">
                    <span>{lg.ramp.min}</span>
                    <span>{lg.ramp.max}</span>
                  </div>
                </div>
              ) : (
                <ul className="flex flex-col gap-[2px]">
                  {lg.items.slice(0, LEGEND_ITEMS).map((it) => (
                    <li key={it.label} className="flex items-center gap-[6px] text-[10px] text-text">
                      <LegendSwatch swatch={it.swatch} box={12} paper />
                      <span className="truncate">{it.label}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MapImage({ section, c }) {
  const snap = section.snapshot;
  if (!snap) {
    return (
      <div className="flex h-[300px] flex-col items-center justify-center gap-[8px] border border-dashed border-border-strong bg-surface-raised text-muted">
        <LuImage size={22} aria-hidden />
        <span className="text-[12px]">{c.P.mapPlaceholder}</span>
      </div>
    );
  }
  const h = Math.min(MAP_MAX_H, (CONTENT_W * snap.height) / snap.width);
  // object-fit: cover scales by the larger factor; the scale bar follows the shown scale.
  const shownW = Math.max(CONTENT_W, (h * snap.width) / snap.height);
  return (
    <figure>
      <div className="relative overflow-hidden border border-border-strong" style={{ height: h }}>
        <img src={snap.image} alt="" className="size-full object-cover" />
        <MapFurniture snap={snap} shownW={shownW} c={c} />
      </div>
      <figcaption className="mt-[4px] text-right text-[9px] text-muted">© Mapbox © OpenStreetMap</figcaption>
    </figure>
  );
}

function ValueTable({ head, rows, lang, P }) {
  return (
    <table className="w-full border-collapse text-[11.5px] tabular-nums">
      <thead>
        <tr>
          <th className={th}>{head.indicator}</th>
          <th className={`${th} text-right`}>{head.value}</th>
          <th className={`${th} text-right`}>{head.interval}</th>
          <th className={`${th} text-right`}>{head.confidence}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const f = (v) => (r.signed ? fmtSignedValue(v, r.digits, lang) : fmtValue(v, r.digits, lang));
          const unit = r.unit ? ` ${r.unit}` : '';
          return (
            <tr key={r.label}>
              <td className={`${td} text-text`}>{r.label}</td>
              <td className={`${td} whitespace-nowrap text-right font-semibold text-text`}>
                {f(r.med)}
                {unit}
              </td>
              <td className={`${td} whitespace-nowrap text-right text-muted`}>
                {f(r.lo)} – {f(r.hi)}
                {unit}
              </td>
              <td className={`${td} text-right`}>
                <ConfidencePips level={r.confidence} label={P.confidence[r.confidence]} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function SimpleTable({ head, rows }) {
  const keys = Object.keys(head);
  return (
    <table className="w-full border-collapse text-[11px]">
      <thead>
        <tr>
          {keys.map((k) => (
            <th key={k} className={th}>
              {head[k]}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {keys.map((k) => (
              <td key={k} className={`${td} text-text`}>
                {r[k]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Measures register on paper: type colour swatch and tinted status chip, as in the app. */
function MeasuresTable({ head, rows }) {
  return (
    <table className="w-full border-collapse text-[11px]">
      <thead>
        <tr>
          {Object.keys(head).map((k) => (
            <th key={k} className={`${th} ${k === 'area' || k === 'effect' ? 'text-right' : ''}`}>
              {head[k]}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((m, i) => (
          <tr key={i}>
            <td className={`${td} text-text`}>{m.name}</td>
            <td className={td}>
              <span className="flex items-center gap-[6px] text-text">
                <span className="size-[10px] shrink-0" style={{ background: m.typeColor }} aria-hidden />
                <span>{m.type}</span>
              </span>
            </td>
            <td className={td}>
              <span className="level-chip" style={{ '--chip': m.statusColor }}>
                {m.status}
              </span>
            </td>
            <td className={`${td} text-text`}>{m.district}</td>
            <td className={`${td} text-right tabular-nums text-text`}>{m.area}</td>
            <td className={`${td} text-right tabular-nums text-text`}>{m.effect}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const Note = ({ children }) => <p className="text-justify text-[11px] italic leading-relaxed text-muted hyphens-auto">{children}</p>;

/**
 * Blocks for every section, in order: { key, sectionId, el, keepWithNext?, fullPage? }.
 * c: reportContent(); styles: symbology styles (map legend); author: report author.
 */
export function buildBlocks(sections, c, { styles, author }) {
  const blocks = [];
  const add = (section, part, el, extra) => blocks.push({ key: `${section.id}:${part}`, sectionId: section.id, el, ...extra });
  const heading = (s) => add(s, 'h', <Heading>{c.heading(s)}</Heading>, { keepWithNext: true });

  for (const s of sections) {
    switch (s.type) {
      case 'title':
        add(s, 'page', <TitlePage c={c} section={s} author={author} />, { fullPage: true });
        break;
      case 'summary':
      case 'appendix': {
        heading(s);
        // One block per paragraph or list, so long texts flow across pages.
        htmlBlocks(c.text(s)).forEach((html, i) => add(s, `p${i}`, <div className="report-rich" dangerouslySetInnerHTML={{ __html: html }} />));
        if (s.type === 'appendix' && s.includeMeasures && c.measureRows.length) add(s, 'measures', <MeasuresTable head={c.P.measuresHead} rows={c.measureRows} />);
        break;
      }
      case 'map':
        heading(s);
        add(s, 'img', <MapImage section={s} c={c} />);
        if (s.legend && s.snapshot) add(s, 'legend', <MapLegend snap={s.snapshot} styles={styles} c={c} />);
        if (s.uncertainty) add(s, 'unc', <Note>{c.P.mapUncertainty}</Note>);
        break;
      case 'indicators':
        heading(s);
        add(s, 'table', <ValueTable head={c.indicatorHead} rows={c.indicatorRows} lang={c.lang} P={c.P} />);
        if (s.chart && c.chart.rows.length)
          add(
            s,
            'chart',
            <figure>
              <figcaption className="mb-[8px] text-[11px] font-semibold text-text">{c.chart.title}</figcaption>
              <ReportChart rows={c.chart.rows} width={CONTENT_W} lang={c.lang} color={c.chart.rows[0]?.med < 0 ? 'var(--series-1)' : 'var(--heat-5)'} />
            </figure>,
          );
        if (s.uncertainty) add(s, 'unc', <Note>{c.P.indicatorUncertainty}</Note>);
        break;
      case 'method':
        heading(s);
        add(
          s,
          'box',
          <div className="flex flex-col gap-[8px] border border-border-strong bg-surface-raised px-[16px] py-[12px] text-[12px] leading-relaxed text-text">
            {c.P.method.map((p) => (
              <p key={p} className="text-justify hyphens-auto">
                {p}
              </p>
            ))}
          </div>,
        );
        break;
      case 'sources':
        heading(s);
        add(s, 'table', <SimpleTable head={c.P.sourcesHead} rows={c.sources} />);
        break;
      default:
        break;
    }
  }
  return blocks;
}
