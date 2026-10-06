import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { LuFlame } from 'react-icons/lu';
import { reportContent } from '../../lib/reportContent';
import { useAllMeasures } from '../../state/measures';
import { useReports } from '../../state/reports';
import { useSymbology } from '../../state/symbology';
import { BODY_BOTTOM, BODY_TOP, buildBlocks, CONTENT_H, CONTENT_W, PAD_X, PAGE_H, PAGE_W } from './ReportBlocks';

const GAP = 14; // space after each block (inside the measured box)

/** Pack measured blocks into pages: a heading keeps with the next block; full pages stand alone. */
function paginate(blocks, heights) {
  const pages = [];
  let cur = [];
  let used = 0;
  const flush = () => {
    if (cur.length) pages.push({ blocks: cur });
    cur = [];
    used = 0;
  };
  blocks.forEach((b, i) => {
    if (b.fullPage) {
      flush();
      pages.push({ full: b });
      return;
    }
    const h = heights[b.key] ?? 0;
    const next = blocks[i + 1];
    const need = h + (b.keepWithNext && next && !next.fullPage ? (heights[next.key] ?? 0) : 0);
    if (used + need > CONTENT_H && cur.length) flush();
    cur.push(b);
    used += h;
  });
  flush();
  return pages;
}

/**
 * The report as pages. Blocks are rendered once off-screen at the content width to
 * measure them (the measurer element must be mounted), then packed into A4 pages.
 */
export function useReportPages() {
  const report = useReports();
  const measures = useAllMeasures();
  const styles = useSymbology((s) => s.styles);
  const content = useMemo(() => reportContent(report, measures), [report, measures]);
  const blocks = useMemo(() => buildBlocks(report.sections, content, { styles, author: report.author }), [report.sections, report.author, content, styles]);
  const [heights, setHeights] = useState({});
  const [fontsReady, setFontsReady] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    document.fonts?.ready.then(() => setFontsReady(true));
  }, []);

  // Re-measure after every change; only a real difference re-renders (no loop).
  useLayoutEffect(() => {
    const next = {};
    for (const el of ref.current?.children ?? []) next[el.dataset.key] = el.offsetHeight;
    const same = Object.keys(next).length === Object.keys(heights).length && Object.keys(next).every((k) => next[k] === heights[k]);
    if (!same) setHeights(next);
  });

  const pages = useMemo(() => paginate(blocks, heights), [blocks, heights]);
  const measurer = (
    <div data-theme="light" aria-hidden className="pointer-events-none invisible fixed left-[0px] top-[0px] -z-10 text-[13px] leading-relaxed text-text" style={{ width: CONTENT_W }} key={fontsReady ? 'f' : 'n'}>
      <div ref={ref}>
        {blocks
          .filter((b) => !b.fullPage)
          .map((b) => (
            <div key={b.key} data-key={b.key} style={{ paddingBottom: GAP }}>
              {b.el}
            </div>
          ))}
      </div>
    </div>
  );
  return { pages, content, measurer };
}

/*
  Section marker in the left margin (preview only): accent bar beside every block of the
  selected section, a faint bar beside the hovered one. Bars sit outside the content box,
  so marking never covers or reflows the page.
*/
function Marker({ on, hover, left = -18 }) {
  if (!on && !hover) return null;
  return <span className="pointer-events-none absolute bottom-[14px] top-[0px] w-[3px]" style={{ left, background: on ? 'var(--accent)' : 'var(--border-strong)' }} aria-hidden />;
}

/** One A4 page. Pages are always light (white) in both themes. */
function Page({ page, n, total, content: c, selectedId, onSelect, hovered, onHover }) {
  const preview = !!onSelect;
  const bind = (id) =>
    preview
      ? {
          onClick: (e) => {
            e.stopPropagation();
            onSelect(id);
          },
          onMouseEnter: () => onHover(id),
          onMouseLeave: () => onHover(null),
          className: 'relative cursor-pointer',
          'data-section': id,
        }
      : { className: 'relative' };

  return (
    <section
      data-theme="light"
      lang={c.lang}
      className={`report-page relative shrink-0 overflow-hidden bg-[var(--report-page)] text-[13px] leading-relaxed text-text ${preview ? 'report-sheet' : ''}`}
      style={{ width: PAGE_W, height: PAGE_H }}
    >
      {page.full ? (
        <div {...bind(page.full.sectionId)} style={{ position: 'absolute', inset: 0, bottom: BODY_BOTTOM }}>
          {preview && <Marker on={page.full.sectionId === selectedId} hover={page.full.sectionId === hovered} left={PAD_X - 18} />}
          {page.full.el}
        </div>
      ) : (
        <>
          <header className="absolute inset-x-[0px] top-[0px] flex items-center gap-[8px] border-b border-border" style={{ height: BODY_TOP - 28, marginInline: PAD_X, paddingTop: 22 }}>
            <span className="grid size-[20px] place-items-center bg-accent text-on-accent" aria-hidden>
              <LuFlame size={12} strokeWidth={2.25} />
            </span>
            <span className="text-[11px] font-bold tracking-[0.04em] text-text">{c.P.brand}</span>
            <span className="ml-auto max-w-[60%] truncate text-[11px] text-muted">{c.title}</span>
          </header>
          <div className="absolute" style={{ top: BODY_TOP, left: PAD_X, width: PAGE_W - 2 * PAD_X, height: PAGE_H - BODY_TOP - BODY_BOTTOM }}>
            {page.blocks.map((b) => (
              <div key={b.key} {...bind(b.sectionId)} style={{ paddingBottom: GAP }}>
                {preview && <Marker on={b.sectionId === selectedId} hover={b.sectionId === hovered} />}
                {b.el}
              </div>
            ))}
          </div>
        </>
      )}
      {/* Footer: credit line (lib/attribution.js) wraps within the left half; page number, data version and date
          stand right-aligned in the other half. */}
      <footer className="absolute flex items-start justify-between gap-[32px] border-t border-border pt-[8px] text-[9px] leading-snug text-muted" style={{ left: PAD_X, right: PAD_X, bottom: 18, height: BODY_BOTTOM - 28 }}>
        <p className="w-1/2">{c.credits}</p>
        <div className="flex flex-col items-end gap-[2px] text-right">
          <span className="text-[10px] font-semibold text-text">{c.P.page(n, total)}</span>
          <span>
            {c.P.dataVersion} {c.dataVersion}
          </span>
          <span>
            {c.P.generated} {c.date}
          </span>
        </div>
      </footer>
    </section>
  );
}

/** All pages; onSelect makes blocks clickable (preview only; the print copy passes none). */
export function ReportPages({ pages, content, selectedId, onSelect }) {
  const [hovered, setHovered] = useState(null);
  return pages.map((p, i) => <Page key={i} page={p} n={i + 1} total={pages.length} content={content} selectedId={selectedId} onSelect={onSelect} hovered={hovered} onHover={setHovered} />);
}
