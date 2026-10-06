import { useState } from 'react';
import { COPILOT_DAILY, COPILOT_EVAL, COPILOT_FAILED_CALLS, COPILOT_TOP_QUESTIONS } from '../../data/mock';
import { t } from '../../i18n';
import { useSearch } from '../../lib/search';
import { useSort } from '../../lib/useSort';
import { SearchBar, SearchEmpty } from '../SearchBar';
import { SortTh } from '../SortTh';
import { Bars, Sparkline } from './AdminCharts';
import { Card, fmtInt, fmtTime, Kpi, PageHead, tdCls, thCls, trCls } from './AdminParts';

const a = t.admin;
const cp = a.copilot;
const day = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const eur = (v) => `${v.toFixed(2)} €`;
const qValues = (x) => [x.q];
const fValues = (x) => [x.tool, x.error, x.user];

/** Copilot: usage and cost per day (two charts, never one dual-axis chart), evaluation, questions, failures. */
export function AdminCopilot() {
  const [qQuery, setQQuery] = useState('');
  const [fQuery, setFQuery] = useState('');
  const questions = useSort(useSearch(COPILOT_TOP_QUESTIONS, qValues, qQuery), (x, k) => x[k]);
  const failed = useSort(useSearch(COPILOT_FAILED_CALLS, fValues, fQuery), (x, k) => x[k]);
  const queries = COPILOT_DAILY.reduce((s, d) => s + d.queries, 0);
  const cost = COPILOT_DAILY.reduce((s, d) => s + d.cost, 0);

  return (
    <>
      <PageHead title={a.sections.copilot} hint={a.hints.copilot} />
      <div className="flex flex-col gap-4 px-6 pb-6">
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Kpi label={cp.totalQueries} value={fmtInt(queries)} />
          <Kpi label={cp.totalCost} value={eur(cost)} />
          <Kpi label={cp.perQuery} value={eur(cost / queries)} />
          <div className="flex items-end justify-between gap-3 border border-border bg-surface px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-2xs uppercase tracking-[var(--tracking-caps)] text-muted">{cp.passRate}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-text">{(COPILOT_EVAL.passRate * 100).toFixed(1)} %</p>
              <p className="mt-0.5 truncate text-2xs text-muted">{cp.passHint(COPILOT_EVAL.cases)}</p>
            </div>
            <Sparkline values={COPILOT_EVAL.runs} />
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card title={cp.usageTitle} hint={cp.days} expandId="admin-copilot-usage">
            {(large) => (
              <div className="px-4 py-3">
                <Bars large={large} data={COPILOT_DAILY.map((d) => ({ key: d.day, label: day(d.day), value: d.queries }))} format={(v) => fmtInt(Math.round(v))} />
              </div>
            )}
          </Card>
          <Card title={cp.costTitle} hint={cp.days} expandId="admin-copilot-cost">
            {(large) => (
              <div className="px-4 py-3">
                <Bars large={large} color="var(--series-3)" data={COPILOT_DAILY.map((d) => ({ key: d.day, label: day(d.day), value: d.cost }))} format={(v) => v.toFixed(1)} />
              </div>
            )}
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card title={cp.topTitle} expandId="admin-copilot-top" actions={<SearchBar value={qQuery} onChange={setQQuery} placeholder={a.filter} className="w-40" />}>
            <table className="w-full border-collapse text-xs">
              <thead className="bg-surface-strong">
                <tr className="border-b border-border">
                  <SortTh label={cp.columns.q} sortKey="q" sort={questions.sort} onSort={questions.sortBy} className={thCls} />
                  <SortTh label={cp.columns.n} sortKey="n" sort={questions.sort} onSort={questions.sortBy} align="right" className={thCls} />
                </tr>
              </thead>
              <tbody>
                {questions.rows.map((x) => (
                  <tr key={x.q} className={trCls}>
                    <td className={`${tdCls} text-text`}>{x.q}</td>
                    <td className={`${tdCls} text-right tabular-nums text-text`}>{x.n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {questions.rows.length === 0 && <SearchEmpty />}
          </Card>
          <Card title={cp.failedTitle} expandId="admin-copilot-failed" actions={<SearchBar value={fQuery} onChange={setFQuery} placeholder={a.filter} className="w-40" />}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[32.5rem] border-collapse text-xs">
                <thead className="bg-surface-strong">
                  <tr className="border-b border-border">
                    {['time', 'tool', 'error', 'user'].map((k) => (
                      <SortTh key={k} label={cp.columns[k]} sortKey={k} sort={failed.sort} onSort={failed.sortBy} className={thCls} />
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {failed.rows.map((x) => (
                    <tr key={x.id} className={trCls}>
                      <td className={`${tdCls} whitespace-nowrap text-text`}>{fmtTime(x.time)}</td>
                      <td className={`${tdCls} font-mono text-text`}>{x.tool}</td>
                      <td className={`${tdCls} text-danger`}>{x.error}</td>
                      <td className={`${tdCls} text-text`}>{x.user}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {failed.rows.length === 0 && <SearchEmpty />}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
