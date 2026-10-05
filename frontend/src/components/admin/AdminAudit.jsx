import { useMemo, useState } from 'react';
import { t } from '../../i18n';
import { useSearch } from '../../lib/search';
import { useSort } from '../../lib/useSort';
import { useAdmin } from '../../state/admin';
import { Select } from '../controls';
import { SearchBar, SearchEmpty } from '../SearchBar';
import { SortTh } from '../SortTh';
import { Card, Chip, fmtTime, PageHead, tdCls, thCls, trCls } from './AdminParts';

const a = t.admin;
const au = a.audit;
const RESULT_COLOR = { ok: 'var(--success)', error: 'var(--danger)', denied: 'var(--warning)' };
const searchValues = (x) => [x.user, x.action, x.target, au.results[x.result]];
const sortValue = (x, key) => x[key];

/** Audit log: every admin and data action, newest first; filter by action, search, sort. */
export function AdminAudit() {
  const audit = useAdmin((s) => s.audit);
  const [query, setQuery] = useState('');
  const [action, setAction] = useState('');
  const actions = useMemo(() => [...new Set(audit.map((x) => x.action))].sort(), [audit]);
  const byAction = useMemo(() => (action ? audit.filter((x) => x.action === action) : audit), [audit, action]);
  const found = useSearch(byAction, searchValues, query);
  const { rows, sort, sortBy } = useSort(found, sortValue);

  return (
    <>
      <PageHead title={a.sections.audit} hint={a.hints.audit} />
      <div className="px-6 pb-6">
        <Card
          title={`${a.sections.audit} · ${rows.length}`}
          expandId="admin-audit"
          actions={
            <>
              <Select value={action} onChange={setAction} label={au.columns.action} className="w-40" options={[{ value: '', label: au.allActions }, ...actions.map((x) => ({ value: x, label: x }))]} />
              <SearchBar value={query} onChange={setQuery} placeholder={a.filter} className="w-48" />
            </>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-xs">
              <thead className="bg-surface-strong">
                <tr className="border-b border-border">
                  {Object.keys(au.columns).map((k) => (
                    <SortTh key={k} label={au.columns[k]} sortKey={k} sort={sort} onSort={sortBy} className={thCls} />
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((x) => (
                  <tr key={x.id} className={`${trCls} hover:bg-hover`}>
                    <td className={`${tdCls} whitespace-nowrap tabular-nums text-text`}>{fmtTime(x.time)}</td>
                    <td className={`${tdCls} text-text`}>{x.user}</td>
                    <td className={`${tdCls} font-mono text-text`}>{x.action}</td>
                    <td className={`${tdCls} text-text`}>{x.target}</td>
                    <td className={tdCls}>
                      <Chip color={RESULT_COLOR[x.result]}>{au.results[x.result]}</Chip>
                    </td>
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
