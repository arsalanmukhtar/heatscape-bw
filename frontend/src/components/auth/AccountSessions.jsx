import { useCallback, useEffect, useRef, useState } from 'react';
import { LuLogOut } from 'react-icons/lu';
import { endSession, listSessions } from '../../lib/api';
import { useSearch } from '../../lib/search';
import { useSort } from '../../lib/useSort';
import { useAuth } from '../../state/auth';
import { Card, Chip, tdCls, thCls, trCls } from '../admin/AdminParts';
import { SearchBar, SearchEmpty } from '../SearchBar';
import { SortTh } from '../SortTh';
import { Banner, useAuthText } from './AuthParts';

/** "Chrome · Windows" from a user agent (enough to recognise a device, not a fingerprint). */
export function deviceOf(ua = '') {
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : ua ? 'Browser' : '–';
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return os ? `${browser} · ${os}` : browser;
}

export const fmtWhen = (iso, lang) =>
  iso ? new Date(iso).toLocaleString(lang === 'de' ? 'de-DE' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '–';

const sortValue = (x, key) => (key === 'device' ? deviceOf(x.userAgent) : x[key]);

/** Live list of the user's sessions (middleware); sign out one, or all others. */
export function AccountSessions({ onSignedOut }) {
  const a = useAuthText();
  const s = a.account.sessions;
  const lang = useAuth((x) => x.lang);
  const [list, setList] = useState(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');
  const signedOut = useRef(onSignedOut);
  signedOut.current = onSignedOut;

  const load = useCallback(async () => {
    try {
      setList(await listSessions());
      setFailed(false);
    } catch (e) {
      if (e.status === 401) return signedOut.current();
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const searchValues = (x) => [deviceOf(x.userAgent), x.ip, fmtWhen(x.createdAt, lang), fmtWhen(x.lastSeen, lang)];
  const found = useSearch(list ?? [], searchValues, query);
  const { rows, sort, sortBy } = useSort(found, sortValue);
  const others = (list ?? []).filter((x) => !x.current).length;

  const end = async (x) => {
    if (x.current) return onSignedOut();
    await endSession(x.id).catch(() => {});
    load();
  };

  const endOthers = async () => {
    await endSession('others').catch(() => {});
    load();
  };

  if (failed) return <Banner tone="error">{s.failed}</Banner>;

  return (
    <div className="flex flex-col gap-3">
      <Card
        title={`${a.account.sections.sessions} · ${rows.length}`}
        expandId="account-sessions"
        actions={
          <>
            <button type="button" onClick={endOthers} disabled={!others} className="flex h-7 items-center gap-1.5 border border-border px-2.5 text-xs text-text hover:bg-hover disabled:opacity-50 disabled:hover:bg-transparent">
              <LuLogOut size={12} className="shrink-0" aria-hidden />
              <span>{s.endOthers}</span>
            </button>
            <SearchBar value={query} onChange={setQuery} className="w-44" />
          </>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[47.5rem] border-collapse text-xs">
            <thead className="bg-surface-strong">
              <tr className="border-b border-border">
                {Object.keys(s.columns).map((k) => (
                  <SortTh key={k} label={s.columns[k]} sortKey={k} sort={sort} onSort={sortBy} className={thCls} />
                ))}
                <th className={thCls}>
                  <span className="sr-only">{s.end}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((x) => {
                const device = deviceOf(x.userAgent);
                return (
                  <tr key={x.id} className={`${trCls} hover:bg-hover`}>
                    <td className={`${tdCls} text-text`}>
                      <div className="flex items-center gap-2">
                        <span className="whitespace-nowrap">{device}</span>
                        {x.current && <Chip color="var(--success)">{s.current}</Chip>}
                        {x.remember && <Chip color="var(--text-muted)">{s.remembered}</Chip>}
                      </div>
                    </td>
                    <td className={`${tdCls} font-mono tabular-nums text-text`}>{x.ip}</td>
                    <td className={`${tdCls} whitespace-nowrap tabular-nums text-text`}>{fmtWhen(x.createdAt, lang)}</td>
                    <td className={`${tdCls} whitespace-nowrap tabular-nums text-text`}>{fmtWhen(x.lastSeen, lang)}</td>
                    <td className={`${tdCls} whitespace-nowrap tabular-nums text-text`}>{fmtWhen(x.expiresAt, lang)}</td>
                    <td className={`${tdCls} text-right`}>
                      <button type="button" onClick={() => end(x)} aria-label={s.endLabel(device)} className="flex h-7 items-center gap-1.5 border border-border px-2.5 text-xs text-text hover:bg-hover">
                        <LuLogOut size={12} className="shrink-0" aria-hidden />
                        <span>{s.end}</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {list && rows.length === 0 && <SearchEmpty>{query ? undefined : s.empty}</SearchEmpty>}
        </div>
      </Card>
      <p className="text-xs text-muted">{s.note}</p>
    </div>
  );
}
