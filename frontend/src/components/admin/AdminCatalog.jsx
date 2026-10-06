import { useState } from 'react';
import { STAC_COLLECTIONS } from '../../data/mock';
import { t } from '../../i18n';
import { BW_BOUNDS } from '../../lib/geo';
import { useSearch } from '../../lib/search';
import { rem } from '../../lib/useRootScale';
import { useSort } from '../../lib/useSort';
import { SearchBar, SearchEmpty } from '../SearchBar';
import { SortTh } from '../SortTh';
import { Card, fmtDate, fmtInt, PageHead, tdCls, thCls, trCls } from './AdminParts';

const a = t.admin;
const c = a.catalog.columns;
const searchValues = (x) => [x.id, x.title, x.licence, x.version];
const sortValue = (x, key) => (key === 'temporal' ? x.temporal[0] : key === 'spatial' ? (x.bbox[2] - x.bbox[0]) * (x.bbox[3] - x.bbox[1]) : x[key]);

/** Footprint placeholder: the collection's bbox drawn inside the Baden-Württemberg frame. */
function Footprint({ bbox }) {
  const [[w0, s0], [e0, n0]] = BW_BOUNDS;
  // Frame: BW, widened to the bbox when the collection reaches beyond it.
  const [w, s, e, n] = [Math.min(w0, bbox[0]), Math.min(s0, bbox[1]), Math.max(e0, bbox[2]), Math.max(n0, bbox[3])];
  const W = 64;
  const H = 40;
  const x = (lon) => 2 + ((lon - w) / (e - w)) * (W - 4);
  const y = (lat) => 2 + ((n - lat) / (n - s)) * (H - 4);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: rem(W), height: rem(H) }} role="img" aria-label={a.catalog.footprint} className="block">
      <rect x={x(w0)} y={y(n0)} width={x(e0) - x(w0)} height={y(s0) - y(n0)} style={{ fill: 'var(--surface-raised)', stroke: 'var(--border-strong)' }} />
      <rect x={x(bbox[0])} y={y(bbox[3])} width={Math.max(2, x(bbox[2]) - x(bbox[0]))} height={Math.max(2, y(bbox[1]) - y(bbox[3]))} strokeWidth={1.5} style={{ fill: 'color-mix(in srgb, var(--accent-2) 22%, transparent)', stroke: 'var(--accent-2)' }} />
    </svg>
  );
}

/** Data catalog (STAC collections). */
export function AdminCatalog() {
  const [query, setQuery] = useState('');
  const found = useSearch(STAC_COLLECTIONS, searchValues, query);
  const { rows, sort, sortBy } = useSort(found, sortValue);
  return (
    <>
      <PageHead title={a.sections.catalog} hint={a.hints.catalog} />
      <div className="px-6 pb-6">
        <Card title={a.catalog.total(rows.length)} expandId="admin-catalog" actions={<SearchBar value={query} onChange={setQuery} placeholder={a.filter} className="w-48" />}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[56.25rem] border-collapse text-xs">
              <thead className="bg-surface-strong">
                <tr className="border-b border-border">
                  <SortTh label={c.title} sortKey="title" sort={sort} onSort={sortBy} className={thCls} />
                  <SortTh label={c.items} sortKey="items" sort={sort} onSort={sortBy} align="right" className={thCls} />
                  <SortTh label={c.temporal} sortKey="temporal" sort={sort} onSort={sortBy} className={thCls} />
                  <SortTh label={c.spatial} sortKey="spatial" sort={sort} onSort={sortBy} className={thCls} />
                  <SortTh label={c.licence} sortKey="licence" sort={sort} onSort={sortBy} className={thCls} />
                  <SortTh label={c.version} sortKey="version" sort={sort} onSort={sortBy} className={thCls} />
                </tr>
              </thead>
              <tbody>
                {rows.map((x) => (
                  <tr key={x.id} className={`${trCls} hover:bg-hover`}>
                    <td className={tdCls}>
                      <span className="block text-text">{x.title}</span>
                      <span className="block font-mono text-2xs text-muted">{x.id}</span>
                    </td>
                    <td className={`${tdCls} text-right tabular-nums text-text`}>{fmtInt(x.items)}</td>
                    <td className={`${tdCls} whitespace-nowrap text-text`}>
                      {fmtDate(x.temporal[0])} – {fmtDate(x.temporal[1])}
                    </td>
                    <td className={`${tdCls} py-1.5`}>
                      <span className="flex items-center gap-2">
                        <Footprint bbox={x.bbox} />
                        <span className="font-mono text-2xs text-muted">{x.bbox.map((v) => v.toFixed(2)).join(', ')}</span>
                      </span>
                    </td>
                    <td className={`${tdCls} text-text`}>{x.licence}</td>
                    <td className={`${tdCls} text-text`}>{x.version}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && <SearchEmpty />}
          </div>
        </Card>
      </div>
    </>
  );
}
