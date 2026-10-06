import { useState } from 'react';
import { LuCheck, LuCopy, LuPlus, LuTrash2 } from 'react-icons/lu';
import { API_TOKENS } from '../../data/mock';
import { useSearch } from '../../lib/search';
import { useSort } from '../../lib/useSort';
import { useAuth } from '../../state/auth';
import { Card, Chip, tdCls, thCls, trCls } from '../admin/AdminParts';
import { Segmented, Select } from '../controls';
import { SearchBar, SearchEmpty } from '../SearchBar';
import { SortTh } from '../SortTh';
import { fmtWhen } from './AccountSessions';
import { AuthField, Banner, useAuthText } from './AuthParts';

const EXPIRIES = ['30', '90', '365'];
const sortValue = (x, key) => x[key] ?? '';

// A random secret; only its prefix stays in the list (MOCK: nothing reaches a server).
const newSecret = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return `hs_${btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
};

/** API tokens: create (shown once, copy), list (sortable, searchable), revoke. MOCK. */
export function AccountTokens() {
  const a = useAuthText();
  const tk = a.account.tokens;
  const lang = useAuth((x) => x.lang);
  const [tokens, setTokens] = useState(API_TOKENS);
  const [name, setName] = useState('');
  const [scope, setScope] = useState('read');
  const [expiry, setExpiry] = useState('90');
  const [tried, setTried] = useState(false);
  const [created, setCreated] = useState(null); // { name, secret }
  const [copied, setCopied] = useState(false);
  const [query, setQuery] = useState('');

  const searchValues = (x) => [x.name, x.prefix, tk.scopes[x.scope]];
  const found = useSearch(tokens, searchValues, query);
  const { rows, sort, sortBy } = useSort(found, sortValue);

  const create = (e) => {
    e.preventDefault();
    setTried(true);
    if (!name.trim()) return;
    const secret = newSecret();
    const now = new Date();
    setTokens((list) => [
      { id: `tok-${now.getTime()}`, name: name.trim(), prefix: secret.slice(0, 7), scope, createdAt: now.toISOString(), lastUsed: null, expiresAt: new Date(now.getTime() + Number(expiry) * 864e5).toISOString() },
      ...list,
    ]);
    setCreated({ name: name.trim(), secret });
    setCopied(false);
    setName('');
    setTried(false);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(created.secret);
      setCopied(true);
    } catch {
      /* clipboard blocked: the token stays visible to copy by hand */
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Banner tone="warning">{tk.mockNote}</Banner>

      <Card title={tk.create}>
        <form noValidate onSubmit={create} className="grid items-start gap-4 p-4 sm:grid-cols-[1fr_auto_10rem_auto]">
          <AuthField label={tk.name} error={tried && !name.trim() ? tk.nameRequired : null}>
            {({ id, invalid, describedBy, className }) => (
              <input id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder={tk.namePlaceholder} aria-invalid={invalid || undefined} aria-describedby={describedBy} className={className} />
            )}
          </AuthField>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-text">{tk.scope}</span>
            <div className="flex h-8 w-56 items-center">
              <Segmented value={scope} onChange={setScope} label={tk.scope} options={['read', 'write'].map((v) => ({ value: v, label: tk.scopes[v] }))} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-text">{tk.expiry}</span>
            <Select value={expiry} onChange={setExpiry} label={tk.expiry} options={EXPIRIES.map((v) => ({ value: v, label: tk.expiries[v] }))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <span aria-hidden className="text-xs">&nbsp;</span>
            <button type="submit" className="flex h-8 items-center gap-1.5 bg-accent px-3 text-xs font-semibold text-on-accent hover:brightness-110">
              <LuPlus size={13} className="shrink-0" aria-hidden />
              <span>{tk.submit}</span>
            </button>
          </div>
        </form>
        {created && (
          <div className="flex flex-col gap-2 border-t border-border p-4">
            <Banner tone="success">{tk.once}</Banner>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate border border-border bg-field px-2.5 py-1.5 font-mono text-xs text-text" aria-label={created.name}>
                {created.secret}
              </code>
              <button type="button" onClick={copy} className="flex h-8 items-center gap-1.5 border border-border px-2.5 text-xs text-text hover:bg-hover">
                {copied ? <LuCheck size={12} className="shrink-0 text-success" aria-hidden /> : <LuCopy size={12} className="shrink-0" aria-hidden />}
                <span>{copied ? tk.copied : tk.copy}</span>
              </button>
              <button type="button" onClick={() => setCreated(null)} className="flex h-8 items-center border border-border px-2.5 text-xs text-text hover:bg-hover">
                <span>{tk.dismiss}</span>
              </button>
            </div>
          </div>
        )}
      </Card>

      <Card title={`${a.account.sections.tokens} · ${rows.length}`} expandId="account-tokens" actions={<SearchBar value={query} onChange={setQuery} className="w-44" />}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[45rem] border-collapse text-xs">
            <thead className="bg-surface-strong">
              <tr className="border-b border-border">
                {Object.keys(tk.columns).map((k) => (
                  <SortTh key={k} label={tk.columns[k]} sortKey={k} sort={sort} onSort={sortBy} className={thCls} />
                ))}
                <th className={thCls}>
                  <span className="sr-only">{tk.revoke}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((x) => (
                <tr key={x.id} className={`${trCls} hover:bg-hover`}>
                  <td className={`${tdCls} text-text`}>
                    <div className="flex items-center gap-2">
                      <span>{x.name}</span>
                      <span className="font-mono text-muted">{x.prefix}…</span>
                    </div>
                  </td>
                  <td className={tdCls}>
                    <Chip color={x.scope === 'write' ? 'var(--warning)' : 'var(--info)'}>{tk.scopes[x.scope]}</Chip>
                  </td>
                  <td className={`${tdCls} whitespace-nowrap tabular-nums text-text`}>{fmtWhen(x.createdAt, lang)}</td>
                  <td className={`${tdCls} whitespace-nowrap tabular-nums text-text`}>{x.lastUsed ? fmtWhen(x.lastUsed, lang) : tk.never}</td>
                  <td className={`${tdCls} whitespace-nowrap tabular-nums text-text`}>{fmtWhen(x.expiresAt, lang)}</td>
                  <td className={`${tdCls} text-right`}>
                    <button
                      type="button"
                      onClick={() => setTokens((list) => list.filter((y) => y.id !== x.id))}
                      aria-label={tk.revokeLabel(x.name)}
                      className="flex h-7 items-center gap-1.5 border border-border px-2.5 text-xs text-text hover:border-[var(--danger)] hover:text-[var(--danger)]"
                    >
                      <LuTrash2 size={12} className="shrink-0" aria-hidden />
                      <span>{tk.revoke}</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <SearchEmpty>{query ? undefined : tk.empty}</SearchEmpty>}
        </div>
      </Card>
    </div>
  );
}
