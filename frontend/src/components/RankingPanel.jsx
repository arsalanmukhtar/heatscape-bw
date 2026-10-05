import { useEffect, useRef } from 'react';
import { LuFileText, LuSave, LuShare2, LuTriangleAlert } from 'react-icons/lu';
import { VscCollapseAll } from 'react-icons/vsc';
import { t } from '../i18n';
import { useSearch } from '../lib/search';
import { useSort } from '../lib/useSort';
import { useLayout } from '../state/layout';
import { useActiveRanking, useScenarios } from '../state/scenarios';
import { useWorkspace } from '../state/workspace';
import { ConfidencePips } from './ConfidencePips';
import { ExpandButton, ExpandSlot } from './Expandable';
import { SortTh } from './SortTh';
import { SearchBar, SearchEmpty } from './SearchBar';
import { PanelHeader } from './SidePanel';

const RANGE_MAX = 40; // the rank-range bar shows ranks 1–40
const fmtCool = (c) => `−${c.med.toFixed(1)} °C (−${c.lo.toFixed(1)} to −${c.hi.toFixed(1)})`;
const outlineBtn =
  'flex h-8 items-center gap-1.5 border border-border-strong px-3 text-xs text-text hover:bg-hover disabled:opacity-50 disabled:hover:bg-transparent';
// Footer actions share each row evenly and wrap as whole buttons.
const actionBtn = `${outlineBtn} flex-1 justify-center whitespace-nowrap`;

export function RankingPanel() {
  const toggleRight = useLayout((s) => s.toggleRight);
  const { scenarios, activeId, stale } = useScenarios();
  const ranking = useActiveRanking();
  const scenario = scenarios.find((s) => s.id === activeId);

  return (
    <>
      <PanelHeader
        title={t.ranking.title}
        info={t.ranking.disclaimer}
        meta={
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="block truncate border border-border px-1.5 py-0.5 text-2xs text-muted">{scenario?.name}</span>
            {ranking && stale[activeId] && (
              <span className="level-chip shrink-0" style={{ '--chip': 'var(--warning)' }}>
                {t.ranking.outdated}
              </span>
            )}
          </span>
        }
        actions={
          <button type="button" onClick={toggleRight} aria-label={t.ranking.collapse} title={t.ranking.collapse} className="grid size-7 place-items-center text-muted hover:bg-hover hover:text-text">
            <VscCollapseAll size={15} />
          </button>
        }
      />
      {ranking ? <Ranking ranking={ranking} stale={stale[activeId]} /> : <Empty />}
    </>
  );
}

function Empty() {
  const openSection = useLayout((s) => s.openSection);
  const leftOpen = useLayout((s) => s.leftOpen && s.leftSection === 'scenarios');
  return (
    <div className="px-4 py-5">
      <p className="text-sm text-muted">{t.ranking.empty}</p>
      {!leftOpen && (
        <button type="button" onClick={() => openSection('scenarios')} className={`${outlineBtn} mt-3`}>
          <span>{t.ranking.openScenarios}</span>
        </button>
      )}
    </div>
  );
}

function Ranking({ ranking, stale }) {
  const selectedId = useWorkspace((s) => s.selectedId);
  const row = ranking.rows.find((r) => r.id === selectedId);

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto pb-4">
        {stale && (
          <p className="mx-4 mt-3 flex items-center gap-2 border border-border bg-[var(--warning-soft)] px-3 py-2 text-xs text-text">
            <LuTriangleAlert size={13} className="shrink-0 text-warning" aria-hidden />
            <span>{t.ranking.outdatedHint}</span>
          </p>
        )}

        <div className="mx-3 mt-3 flex items-center justify-between">
          <span className="label-caps px-1">{t.ranking.candidates(ranking.rows.length)}</span>
          <ExpandButton id="ranking-table" />
        </div>
        <ExpandSlot id="ranking-table" title={t.ranking.title}>
          {(large) => <RankingTable rows={ranking.rows} large={large} />}
        </ExpandSlot>

        <section className="px-4 pt-5">
          <p className="label-caps">{t.ranking.detail}</p>
          {row ? <Detail row={row} /> : <p className="mt-2 text-xs text-muted">{t.ranking.notCandidate}</p>}
        </section>
      </div>

      <Actions />
    </>
  );
}

const CONF_ORDER = { High: 3, Medium: 2, Low: 1 };
const rankSearch = (r) => [r.rank, r.id, r.district, r.score.toFixed(1), t.ranking.confidence[r.confidence]];
const rankValue = (r, key) =>
  key === 'block' ? r.id : key === 'stability' ? r.rankHi - r.rankLo : key === 'confidence' ? CONF_ORDER[r.confidence] : r[key];

/* Compact (panel): fixed column widths that add up to the panel width, range as bar only and
   confidence as pips. Large (expanded view): natural widths, range numbers and words shown. */
function RankingTable({ rows: all, large }) {
  const { selectedId, select } = useWorkspace();
  const { rankSort, setRankSort, rankQuery, setRankQuery } = useScenarios();
  const found = useSearch(all, rankSearch, rankQuery);
  const { rows, sort, sortBy } = useSort(found, rankValue, { state: rankSort, setState: setRankSort });
  const listRef = useRef(null);
  const c = t.ranking.columns;

  // Keep the selected row visible when the selection comes from the map.
  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [selectedId]);

  return (
    <div className={large ? 'flex min-h-0 flex-1 flex-col' : 'mx-3 mt-1.5'}>
      <SearchBar value={rankQuery} onChange={setRankQuery} placeholder={t.ranking.filter} className={large ? 'w-64' : 'w-full'} />
      <div
        ref={listRef}
        className={`flex flex-col border border-border ${large ? 'mt-2 min-h-0 flex-1 overflow-auto' : 'mt-1.5 max-h-72 overflow-y-auto overflow-x-hidden'}`}
      >
      <table className={`w-full border-collapse text-xs ${large ? '' : 'table-fixed'}`}>
        {!large && (
          <colgroup>
            <col className="w-6" />
            <col />
            <col className="w-11" />
            <col className="w-[52px]" />
            <col className="w-11" />
            <col className="w-11" />
          </colgroup>
        )}
        <thead className="sticky top-0 z-[1] bg-surface-strong">
          <tr className="h-8 border-b border-border">
            <SortTh label={c.rank} sortKey="rank" sort={sort} onSort={sortBy} className="pl-1.5" />
            <SortTh label={c.block} sortKey="block" sort={sort} onSort={sortBy} className="px-1.5" />
            <SortTh label={c.score} sortKey="score" sort={sort} onSort={sortBy} align="right" className="px-1.5" />
            <SortTh label={c.stability} sortKey="stability" sort={sort} onSort={sortBy} className="px-1.5" />
            <SortTh label={c.pTop} sortKey="pTop" sort={sort} onSort={sortBy} align="right" title={t.ranking.pTopTitle} className="px-1.5" />
            <SortTh label={c.confidence} sortKey="confidence" sort={sort} onSort={sortBy} align="right" className="pr-1.5" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const on = r.id === selectedId;
            return (
              <tr
                key={r.id}
                onClick={() => select(r.id)}
                aria-selected={on}
                className={`h-10 cursor-pointer border-b border-border-soft tabular-nums ${on ? 'bg-accent-soft' : 'hover:bg-hover'}`}
              >
                <td className="pl-1.5 font-semibold text-text">{r.rank}</td>
                <td className="px-1.5">
                  <span className="block truncate text-text">{r.id}</span>
                  <span className="block truncate text-2xs text-muted">{r.district}</span>
                </td>
                <td className="px-1.5 text-right text-text">{r.score.toFixed(1)}</td>
                <td className="px-1.5">
                  <RankRange rank={r.rank} lo={r.rankLo} hi={r.rankHi} level={r.confidence} showText={large} />
                </td>
                <td className="px-1.5 text-right text-text">{r.pTop.toFixed(2)}</td>
                <td className="pr-1.5">
                  <span className="flex justify-end">
                    <ConfidencePips level={r.confidence} label={t.ranking.confidence[r.confidence]} compact={!large} />
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.length === 0 && <SearchEmpty />}
      </div>
    </div>
  );
}

/* Rank range on a fixed 1–RANGE_MAX scale: segment = 5th–95th percentile, square = rank.
   Bar only in the panel (narrow column); showText adds the numbers in the expanded view. */
/* The range bar takes the confidence colour of its width class (the same classes that set
   confidence: narrow = High, wide = Low), so stable and volatile ranks read at a glance. */
const RANGE_COLOR = { High: 'var(--conf-high)', Medium: 'var(--conf-medium)', Low: 'var(--conf-low)' };

function RankRange({ rank, lo, hi, level, showText = false }) {
  const pos = (v) => `${((Math.min(v, RANGE_MAX) - 1) / (RANGE_MAX - 1)) * 100}%`;
  const label = t.ranking.rangeLabel(rank, lo, hi);
  return (
    <span className="flex min-w-0 items-center gap-2" title={label}>
      <span className={`relative block h-2 shrink-0 ${showText ? 'w-32' : 'w-10'}`} role="img" aria-label={label}>
        <span className="absolute inset-x-0 top-1/2 h-px bg-border-strong" />
        <span
          className="absolute top-1/2 h-1 -translate-y-1/2"
          style={{ left: pos(lo), right: `calc(100% - ${pos(hi)})`, background: RANGE_COLOR[level] ?? 'var(--text-muted)' }}
        />
        <span className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 bg-text" style={{ left: pos(rank) }} />
      </span>
      {showText && (
        <span className="text-2xs text-muted">
          {lo}–{hi}
        </span>
      )}
    </span>
  );
}

function Detail({ row }) {
  const { notes, activeId, setNote } = useScenarios();
  const note = notes[`${activeId}:${row.id}`] ?? '';

  return (
    <>
      <h3 className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="min-w-0 truncate text-lg font-semibold text-text">{row.district}</span>
        <span className="text-xs text-muted">
          {row.id} · {t.ranking.rangeLabel(row.rank, row.rankLo, row.rankHi)}
        </span>
      </h3>
      <div className="mt-2">
        <ConfidencePips level={row.confidence} label={t.ranking.confidence[row.confidence]} />
      </div>

      <div className="mt-4 border border-border px-3 py-3">
        <div className="mb-2 flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-sm text-text">{t.ranking.lstChart}</span>
          <span className="level-chip uppercase" style={{ '--chip': 'var(--level-screening)' }}>
            {t.ranking.indicative}
          </span>
          <ExpandButton id="ranking-lst" className="-mr-1.5" />
        </div>
        <ExpandSlot id="ranking-lst" title={`${t.ranking.lstChart} · ${row.id}`}>
          {(large) => <Dumbbell now={row.lstNow} scenario={row.lstScenario} large={large} />}
        </ExpandSlot>
      </div>

      <div className="mt-3 border border-border px-3 py-3">
        <p className="text-2xs text-muted">{t.ranking.cooling}</p>
        <p className="mt-1.5 flex flex-wrap items-center gap-2">
          <span className="text-xl font-semibold tabular-nums text-text">{fmtCool(row.cooling)}</span>
          <span className="text-2xs text-muted">{t.ranking.indicative.toLowerCase()}</span>
        </p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <Stat label={t.ranking.residents} value={row.residents.toLocaleString('en-US')} />
        <Stat label={t.ranking.sealedRemove} value={`${row.sealedRemoveM2.toLocaleString('en-US')} m²`} />
      </div>

      <label className="mt-4 block">
        <span className="label-caps mb-2 block">{t.ranking.notes}</span>
        <textarea
          rows={3}
          value={note}
          onChange={(e) => setNote(row.id, e.target.value)}
          placeholder={t.ranking.notesPlaceholder}
          className="block w-full resize-none border border-border bg-field px-3 py-2 text-sm text-text outline-none placeholder:text-faint focus:border-accent-line"
        />
      </label>
    </>
  );
}

function Stat({ label, value }) {
  return (
    <div className="border border-border px-3 py-3">
      <p className="text-2xs text-muted">{label}</p>
      <p className="mt-1.5 text-lg font-semibold tabular-nums text-text">{value}</p>
    </div>
  );
}

/* Before/after dumbbell: interval line + square median for now and scenario, joined by a
   dashed connector. Data colours from tokens (heat for now, cool for scenario). */
function Dumbbell({ now, scenario, large = false }) {
  // Drawn at about the card width (352px panel) or the overlay width (large), so labels
  // render near their nominal size instead of scaling with the container.
  const W = large ? 900 : 300;
  const H = large ? 220 : 92;
  const PAD = { l: 50, r: 10, t: 10, b: 22 };
  const lo = Math.floor(Math.min(scenario.lo, now.lo) - 0.5);
  const hi = Math.ceil(Math.max(scenario.hi, now.hi) + 0.5);
  const x = (v) => PAD.l + ((v - lo) / (hi - lo)) * (W - PAD.l - PAD.r);
  const ticks = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i).filter((v, i, a) => a.length <= 7 || (v - lo) % 2 === 0);
  const rows = [
    { key: 'now', label: t.ranking.now, d: now, y: PAD.t + (H - PAD.t - PAD.b) * 0.3, color: 'var(--heat-7)' },
    { key: 'scenario', label: t.ranking.scenario, d: scenario, y: PAD.t + (H - PAD.t - PAD.b) * 0.75, color: 'var(--cool-6)' },
  ];
  const fmt = (d) => `${d.med.toFixed(1)} °C (${d.lo.toFixed(1)}–${d.hi.toFixed(1)})`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={`block w-full ${large ? 'm-auto max-w-[1100px]' : ''}`} role="img" aria-label={`${t.ranking.now} ${fmt(now)}; ${t.ranking.scenario} ${fmt(scenario)}`}>
      {ticks.map((v) => (
        <g key={v}>
          <line x1={x(v)} x2={x(v)} y1={PAD.t} y2={H - PAD.b} stroke="var(--chart-grid)" />
          <text x={x(v)} y={H - 7} textAnchor="middle" fontSize="9" fill="var(--text-muted)">
            {v}°
          </text>
        </g>
      ))}
      <line x1={PAD.l} x2={W - PAD.r} y1={H - PAD.b} y2={H - PAD.b} stroke="var(--chart-axis)" />
      <line x1={x(now.med)} x2={x(scenario.med)} y1={rows[0].y} y2={rows[1].y} stroke="var(--text-muted)" strokeWidth={1.25} strokeDasharray="3 2.5" />
      {rows.map((r) => (
        <g key={r.key}>
          <title>{`${r.label}: ${fmt(r.d)}`}</title>
          <text x={0} y={r.y} dy="0.32em" fontSize="10" fill="var(--text-muted)">
            {r.label}
          </text>
          <line x1={x(r.d.lo)} x2={x(r.d.hi)} y1={r.y} y2={r.y} stroke={r.color} strokeWidth={2} />
          <line x1={x(r.d.lo)} x2={x(r.d.lo)} y1={r.y - 4} y2={r.y + 4} stroke={r.color} strokeWidth={2} />
          <line x1={x(r.d.hi)} x2={x(r.d.hi)} y1={r.y - 4} y2={r.y + 4} stroke={r.color} strokeWidth={2} />
          <rect x={x(r.d.med) - 5} y={r.y - 5} width={10} height={10} fill={r.color} stroke="var(--surface-strong)" strokeWidth={2} />
          <text x={x(r.d.med)} y={r.y - 9} textAnchor="middle" fontSize="9" fontWeight="600" fill="var(--text)">
            {r.d.med.toFixed(1)}
          </text>
        </g>
      ))}
    </svg>
  );
}

function Actions() {
  const { saved, scenarios, activeId, save, share } = useScenarios();
  const isSaved = saved[activeId];
  const isShared = scenarios.find((s) => s.id === activeId)?.status === 'Shared';

  return (
    <div className="flex shrink-0 flex-wrap gap-2 border-t border-border px-4 py-3">
      <button
        type="button"
        onClick={save}
        disabled={isSaved}
        className="flex h-8 flex-1 items-center justify-center gap-1.5 whitespace-nowrap bg-accent px-3 text-xs font-medium text-on-accent hover:brightness-110 disabled:opacity-60 disabled:hover:brightness-100"
      >
        <LuSave size={13} aria-hidden />
        <span>{isSaved ? t.ranking.saved : t.ranking.save}</span>
      </button>
      <button type="button" onClick={share} disabled={isShared} className={actionBtn}>
        <LuShare2 size={13} aria-hidden />
        <span>{isShared ? t.ranking.shared : t.ranking.share}</span>
      </button>
      <button type="button" disabled title={t.ranking.comingNext} className={actionBtn}>
        <LuFileText size={13} aria-hidden />
        <span>{t.ranking.report}</span>
      </button>
    </div>
  );
}
