import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlignTable,
  WidthType,
} from 'docx';
import { toHex } from './color';
import { resolveLight } from './css';
import { fmtSignedValue, fmtValue } from './reportContent';
import { htmlRuns } from './richText';

/*
  DOCX export of a report, built with the docx library from the same content model as the
  preview (lib/reportContent.js). Imported on demand (the library is large).
*/
const FONT = 'Urbanist';

/** The preview chart as PNG bytes: computed colours inlined so the SVG renders standalone. */
async function chartPng() {
  const svg = document.querySelector('.report-page [data-report-chart]');
  if (!svg) return null;
  const copy = svg.cloneNode(true);
  const src = svg.querySelectorAll('*');
  copy.querySelectorAll('*').forEach((el, i) => {
    const cs = getComputedStyle(src[i]);
    el.setAttribute('fill', cs.fill);
    el.setAttribute('stroke', cs.stroke);
    el.removeAttribute('style');
    el.setAttribute('font-family', 'Urbanist, Arial, sans-serif');
  });
  const w = Number(svg.getAttribute('width'));
  const h = Number(svg.getAttribute('height'));
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(copy))}`;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = w * 2;
  canvas.height = h * 2;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
  return { data: new Uint8Array(await blob.arrayBuffer()), width: w, height: h };
}

/** Light-theme token colours as DOCX hex (pages are light in every theme). */
function lightColors() {
  const [text, muted, accent, fill] = resolveLight(['var(--text)', 'var(--text-muted)', 'var(--accent)', 'var(--surface-raised)']).map((v) => toHex(v).slice(1).toUpperCase());
  return { text, muted, accent, fill };
}
let C; // set by buildDocx

const dataUrlBytes = (url) => Uint8Array.from(atob(url.split(',')[1]), (c) => c.charCodeAt(0));
const run = (text, opts = {}) => new TextRun({ text, font: FONT, size: 21, ...opts });
// Running text is justified; tables, headings and captions are not.
const para = (text, opts = {}) => new Paragraph({ alignment: AlignmentType.JUSTIFIED, children: [run(text, opts.run)], spacing: { after: 120 }, ...opts.para });
const heading = (text) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [run(text, { size: 30, bold: true, color: C.text })], spacing: { before: 240, after: 120 } });
const cell = (text, opts = {}) =>
  new TableCell({ verticalAlign: VerticalAlignTable.CENTER,
    children: [new Paragraph({ alignment: opts.align, children: [run(text, { size: 18, bold: opts.bold, color: opts.color })] })],
    shading: opts.fill ? { type: ShadingType.CLEAR, fill: opts.fill, color: 'auto' } : undefined,
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
  });
const table = (head, rows) =>
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { insideVertical: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
    rows: [new TableRow({ tableHeader: true, children: head.map((h) => cell(h, { bold: true, color: C.muted, fill: C.fill })) }), ...rows.map((r) => new TableRow({ children: r.map((v) => cell(String(v))) }))],
  });
/** Rich text runs (lib/richText.js) as DOCX runs: bold, italic, underline, colour, highlight. */
const richRuns = (runs) =>
  runs.map((x) =>
    x.br
      ? new TextRun({ break: 1 })
      : run(x.text, {
          bold: x.bold,
          italics: x.italic,
          underline: x.underline ? {} : undefined,
          color: x.color?.slice(1).toUpperCase(),
          shading: x.highlight ? { type: ShadingType.CLEAR, fill: x.highlight.slice(1).toUpperCase(), color: 'auto' } : undefined,
        }),
  );
/** Measures register: a type-coloured square before the type, the status in its colour. */
function measuresTable(head, rows) {
  const colors = resolveLight(rows.flatMap((m) => [m.typeColor, m.statusColor])).map((v) => toHex(v).slice(1).toUpperCase());
  const colored = (text, color, mark) =>
    new TableCell({ verticalAlign: VerticalAlignTable.CENTER,
      children: [new Paragraph({ children: [...(mark ? [run('■ ', { size: 18, color })] : []), run(text, { size: 18, color: mark ? undefined : color })] })],
      margins: { top: 60, bottom: 60, left: 80, right: 80 },
    });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { insideVertical: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
    rows: [
      new TableRow({ tableHeader: true, children: Object.values(head).map((h) => cell(h, { bold: true, color: C.muted, fill: C.fill })) }),
      ...rows.map(
        (m, i) =>
          new TableRow({
            children: [cell(m.name), colored(m.type, colors[2 * i], true), colored(m.status, colors[2 * i + 1], false), cell(m.district), cell(m.area, { align: AlignmentType.RIGHT }), cell(m.effect, { align: AlignmentType.RIGHT })],
          }),
      ),
    ],
  });
}

/** Section HTML as justified paragraphs and lists (numbered lists carry their number). */
const textBlocks = (html) =>
  htmlRuns(html).flatMap((b) =>
    b.kind === 'p'
      ? [new Paragraph({ alignment: AlignmentType.JUSTIFIED, children: richRuns(b.items[0]), spacing: { after: 120 } })]
      : b.items.map((item, i) =>
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            ...(b.kind === 'ul' ? { bullet: { level: 0 } } : { indent: { left: 360, hanging: 360 } }),
            children: b.kind === 'ol' ? [run(`${i + 1}.\t`), ...richRuns(item)] : richRuns(item),
            spacing: { after: 60 },
          }),
        ),
  );

/** The report as a DOCX blob (same content as the preview). */
export async function buildDocx(report, c) {
  C = lightColors();
  const P = c.P;
  const body = [];
  for (const s of report.sections) {
    switch (s.type) {
      case 'title':
        body.push(
          para(P.brand, { run: { bold: true, size: 22, color: C.accent } }),
          new Paragraph({ children: [run(c.title, { size: 52, bold: true })], spacing: { before: 2400, after: 200 } }),
          para(c.subtitle(s), { run: { size: 28, color: C.muted } }),
          new Paragraph({ children: [run(`${P.preparedBy}: ${report.author} · ${c.organisation(s)}`, { size: 20 })], spacing: { before: 1600, after: 60 } }),
          para(`${P.date}: ${c.date} · ${P.dataVersion}: ${c.dataVersion}`, { run: { size: 20 } }),
          new Paragraph({ children: [new PageBreak()] }),
        );
        break;
      case 'summary':
      case 'appendix':
        body.push(heading(c.heading(s)), ...textBlocks(c.text(s)));
        if (s.type === 'appendix' && s.includeMeasures && c.measureRows.length) body.push(measuresTable(P.measuresHead, c.measureRows));
        break;
      case 'map':
        body.push(heading(c.heading(s)));
        if (s.snapshot) {
          const w = 600;
          body.push(new Paragraph({ children: [new ImageRun({ type: 'jpg', data: dataUrlBytes(s.snapshot.image), transformation: { width: w, height: Math.round((w * s.snapshot.height) / s.snapshot.width) } })] }));
          body.push(para('© Mapbox © OpenStreetMap', { run: { size: 16, color: C.muted }, para: { alignment: AlignmentType.RIGHT } }));
        } else body.push(para(P.mapPlaceholder, { run: { italics: true, color: C.muted } }));
        if (s.uncertainty) body.push(para(P.mapUncertainty, { run: { italics: true, size: 18, color: C.muted } }));
        break;
      case 'indicators': {
        body.push(heading(c.heading(s)));
        const h = c.indicatorHead;
        const f = (r, v) => `${r.signed ? fmtSignedValue(v, r.digits, c.lang) : fmtValue(v, r.digits, c.lang)}${r.unit ? ` ${r.unit}` : ''}`;
        body.push(table([h.indicator, h.value, h.interval, h.confidence], c.indicatorRows.map((r) => [r.label, f(r, r.med), `${f(r, r.lo)} – ${f(r, r.hi)}`, P.confidence[r.confidence]])));
        if (s.chart) {
          const png = await chartPng();
          if (png) {
            const w = 600;
            body.push(para(c.chart.title, { run: { bold: true, size: 19 }, para: { alignment: AlignmentType.LEFT, spacing: { before: 240, after: 80 } } }));
            body.push(new Paragraph({ children: [new ImageRun({ type: 'png', data: png.data, transformation: { width: w, height: Math.round((w * png.height) / png.width) } })] }));
          }
        }
        if (s.uncertainty) body.push(para(P.indicatorUncertainty, { run: { italics: true, size: 18, color: C.muted } }));
        break;
      }
      case 'method':
        body.push(heading(c.heading(s)), new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [new TableRow({ children: [new TableCell({ verticalAlign: VerticalAlignTable.CENTER, shading: { type: ShadingType.CLEAR, fill: C.fill, color: 'auto' }, margins: { top: 120, bottom: 120, left: 160, right: 160 }, children: P.method.map((p) => para(p)) })] })] }));
        break;
      case 'sources': {
        const h = P.sourcesHead;
        body.push(heading(c.heading(s)), table(Object.values(h), c.sources.map((x) => Object.keys(h).map((k) => x[k]))));
        break;
      }
      default:
        break;
    }
  }

  const doc = new Document({
    creator: report.author,
    title: c.title,
    styles: { default: { document: { run: { font: FONT } } } },
    sections: [
      {
        properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1300, bottom: 1300, left: 1134, right: 1134 } } },
        headers: { default: new Header({ children: [new Paragraph({ children: [run(`${P.brand}  ·  ${c.title}`, { size: 16, color: C.muted })] })] }) },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                children: [run(`${P.dataVersion} ${c.dataVersion} · ${P.generated} ${c.date} · `, { size: 16, color: C.muted }), new TextRun({ children: [PageNumber.CURRENT, ' / ', PageNumber.TOTAL_PAGES], font: FONT, size: 16, color: C.muted })],
              }),
              new Paragraph({ children: [run(c.credits, { size: 14, color: C.muted })] }),
            ],
          }),
        },
        children: body,
      },
    ],
  });
  return Packer.toBlob(doc);
}
