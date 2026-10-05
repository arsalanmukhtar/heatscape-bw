import { useState } from 'react';
import { LuCheck, LuMinus } from 'react-icons/lu';
import { ADMIN_ROLES, ADMIN_USERS, ROLE_PERMISSIONS } from '../../data/mock';
import { t } from '../../i18n';
import { useSearch } from '../../lib/search';
import { useSort } from '../../lib/useSort';
import { SearchBar, SearchEmpty } from '../SearchBar';
import { SortTh } from '../SortTh';
import { Card, Chip, fmtTime, PageHead, relTime, tdCls, thCls, trCls } from './AdminParts';

const a = t.admin;
const u = a.users;
// Roles in categorical series order (identity, not state); the role name is always written.
const ROLE_COLOR = Object.fromEntries(ADMIN_ROLES.map((r, i) => [r, `var(--series-${i + 1})`]));
const ROLE_ORDER = Object.fromEntries(ADMIN_ROLES.map((r, i) => [r, i]));
const searchValues = (x) => [x.name, x.email, u.roles[x.role], x.org, x.regions.join(' ')];
const sortValue = (x, key) => (key === 'role' ? ROLE_ORDER[x.role] : key === 'regions' ? x.regions.length : x[key]);

/** Users & roles: user table and the role-permission matrix. */
export function AdminUsers() {
  const [query, setQuery] = useState('');
  const found = useSearch(ADMIN_USERS, searchValues, query);
  const { rows, sort, sortBy } = useSort(found, sortValue);
  return (
    <>
      <PageHead title={a.sections.users} hint={a.hints.users} />
      <div className="flex flex-col gap-4 px-6 pb-6">
        <Card title={`${a.sections.users} · ${rows.length}`} expandId="admin-users" actions={<SearchBar value={query} onChange={setQuery} placeholder={a.filter} className="w-48" />}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-xs">
              <thead className="bg-surface-strong">
                <tr className="border-b border-border">
                  {Object.keys(u.columns).map((k) => (
                    <SortTh key={k} label={u.columns[k]} sortKey={k} sort={sort} onSort={sortBy} className={thCls} />
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((x) => (
                  <tr key={x.id} className={`${trCls} hover:bg-hover`}>
                    <td className={tdCls}>
                      <span className="block text-text">{x.name}</span>
                      <span className="block text-2xs text-muted">{x.email}</span>
                    </td>
                    <td className={tdCls}>
                      <Chip color={ROLE_COLOR[x.role]}>{u.roles[x.role]}</Chip>
                    </td>
                    <td className={`${tdCls} text-text`}>{x.org}</td>
                    <td className={`${tdCls} text-text`}>{x.regions.join(', ')}</td>
                    <td className={`${tdCls} text-text`} title={fmtTime(x.lastActive)}>
                      {relTime(x.lastActive)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && <SearchEmpty />}
          </div>
        </Card>

        <Card title={u.matrixTitle} expandId="admin-roles">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-xs">
              <thead className="bg-surface-strong">
                <tr className="border-b border-border">
                  <th scope="col" className={`${thCls} text-left text-2xs font-medium uppercase tracking-[var(--tracking-caps)] text-muted`} />
                  {ADMIN_ROLES.map((role) => (
                    <th key={role} scope="col" className={`${thCls} text-center`}>
                      <Chip color={ROLE_COLOR[role]}>{u.roles[role]}</Chip>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROLE_PERMISSIONS.map((p) => (
                  <tr key={p.id} className={trCls}>
                    <th scope="row" className={`${tdCls} text-left font-normal text-text`}>
                      {u.permissions[p.id]}
                    </th>
                    {ADMIN_ROLES.map((role) => {
                      const yes = p.roles.includes(role);
                      return (
                        <td key={role} className={`${tdCls} text-center`}>
                          <span className="inline-grid place-items-center" title={yes ? u.yes : u.no}>
                            {yes ? <LuCheck size={15} className="text-success" aria-hidden /> : <LuMinus size={14} className="text-faint" aria-hidden />}
                            <span className="sr-only">{yes ? u.yes : u.no}</span>
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
