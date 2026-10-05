import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { LuFileDown, LuFileText, LuLink, LuMinus, LuPlus, LuPrinter } from 'react-icons/lu';
import { t } from '../../i18n';
import { reportFileName, shareLink } from '../../lib/reportExport';
import { REPORT_ACTION } from '../../lib/shortcuts';
import { saveFile } from '../../lib/saveFile';
import { useReports, ZOOMS } from '../../state/reports';
import { Select } from '../controls';
import { ReportPages, useReportPages } from './ReportDocument';

const r = t.report;
const btn = 'flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap border border-border px-2.5 text-xs text-text hover:bg-hover disabled:opacity-40 disabled:hover:bg-transparent';
const iconBtn = 'grid size-7 place-items-center text-muted hover:bg-hover hover:text-text disabled:opacity-40 disabled:hover:bg-transparent';

/*
  Report Builder centre: action bar (template, page count, zoom, share and exports) over a
  neutral canvas of A4 pages. Covers the map area while the Reports view is open; the map
  stays mounted (and sized) underneath so "Use current map view" can read it.
*/
export function ReportWorkspace() {
  const report = useReports();
  const { pages, content, measurer } = useReportPages();
  const [pending, setPending] = useState(null); // template awaiting confirmation
  const [note, setNote] = useState(null); // { ok, text } after share / export
  const [busy, setBusy] = useState(false);
  const zi = ZOOMS.indexOf(report.zoom);

  // Export PDF: render the print copy, open the print dialog, drop the copy afterwards.
  useEffect(() => {
    if (!report.printing) return;
    const title = document.title;
    document.title = content.title;
    const done = () => {
      document.title = title;
      report.setPrinting(false);
    };
    window.addEventListener('afterprint', done, { once: true });
    const id = requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('afterprint', done);
    };
  }, [report.printing]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!note) return;
    const id = setTimeout(() => setNote(null), 4000);
    return () => clearTimeout(id);
  }, [note]);

  // Shortcuts (Settings → Reports) reach the open builder as an event.
  useEffect(() => {
    const onAction = (e) => (e.detail === 'docx' ? onDocx() : e.detail === 'share' ? onShare() : undefined);
    window.addEventListener(REPORT_ACTION, onAction);
    return () => window.removeEventListener(REPORT_ACTION, onAction);
  });

  const onShare = async () => {
    const res = await shareLink(report);
    setNote({ ok: res.ok, text: res.ok ? (res.withoutMap ? r.sharedNoMap : r.shared) : r.shareFailed });
  };
  const onDocx = async () => {
    setBusy(true);
    try {
      // The save dialog opens first (user gesture); the DOCX is built after a file is picked.
      await saveFile(reportFileName(content.title, 'docx'), async () => {
        const { buildDocx } = await import('../../lib/reportDocx');
        return buildDocx(report, content);
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-surface">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-4">
        <span className="text-xs text-muted">{r.template}</span>
        <Select
          value={report.template}
          onChange={(v) => v !== report.template && setPending(v)}
          label={r.template}
          className="w-44"
          options={Object.keys(r.templates).map((id) => ({ value: id, label: r.templates[id], icon: <LuFileText size={13} className="shrink-0 text-muted" /> }))}
        />
        <span className="ml-2 level-chip tabular-nums" style={{ '--chip': 'var(--text-muted)' }}>
          {r.pages(pages.length)}
        </span>

        <div className="ml-auto flex items-center gap-1.5">
          {note && (
            <span role="status" className={`mr-1 max-w-72 truncate text-xs ${note.ok ? 'text-success' : 'text-danger'}`} title={note.text}>
              {note.text}
            </span>
          )}
          <div className="mr-2 flex items-center border border-border" role="group" aria-label={r.zoom}>
            <button type="button" onClick={() => report.setZoom(ZOOMS[zi - 1])} disabled={zi <= 0} aria-label={r.zoomOut} title={r.zoomOut} className={iconBtn}>
              <LuMinus size={13} />
            </button>
            <Select value={report.zoom} onChange={report.setZoom} label={r.zoom} className="w-[72px] border-y-0" options={ZOOMS.map((z) => ({ value: z, label: `${z} %` }))} />
            <button type="button" onClick={() => report.setZoom(ZOOMS[zi + 1])} disabled={zi >= ZOOMS.length - 1} aria-label={r.zoomIn} title={r.zoomIn} className={iconBtn}>
              <LuPlus size={13} />
            </button>
          </div>
          <button type="button" onClick={onShare} className={btn}>
            <LuLink size={12} aria-hidden />
            <span>{r.share}</span>
          </button>
          <button type="button" onClick={onDocx} disabled={busy} className={btn}>
            <LuFileDown size={12} aria-hidden />
            <span>{busy ? r.exporting : r.exportDocx}</span>
          </button>
          <button type="button" onClick={() => report.setPrinting(true)} title={r.exportPdfHint} className="flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap bg-accent px-3 text-xs font-semibold text-on-accent hover:brightness-110">
            <LuPrinter size={12} aria-hidden />
            <span>{r.exportPdf}</span>
          </button>
        </div>
      </div>

      {pending && (
        <div role="alertdialog" aria-label={r.template} className="flex shrink-0 items-center gap-3 border-b border-border bg-[color-mix(in_srgb,var(--warning)_12%,transparent)] px-4 py-2">
          <span className="min-w-0 flex-1 text-xs text-text">{r.replaceTemplate(r.templates[pending])}</span>
          <button type="button" onClick={() => setPending(null)} className={btn}>
            <span>{r.cancel}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              report.applyTemplate(pending);
              setPending(null);
            }}
            className="flex h-7 items-center bg-accent px-3 text-xs font-semibold text-on-accent hover:brightness-110"
          >
            <span>{r.replace}</span>
          </button>
        </div>
      )}

      {/* Neutral canvas; pages keep their print size and are scaled with CSS zoom. */}
      <div className="min-h-0 flex-1 overflow-auto bg-bg-deep" onClick={() => report.select(null)}>
        <div className="mx-auto flex w-max flex-col items-center gap-6 p-8" style={{ zoom: report.zoom / 100 }}>
          <ReportPages pages={pages} content={content} selectedId={report.selectedId} onSelect={report.select} />
        </div>
      </div>

      {measurer}
      {report.printing &&
        createPortal(
          <div className="report-print">
            <ReportPages pages={pages} content={content} />
          </div>,
          document.body,
        )}
    </div>
  );
}
