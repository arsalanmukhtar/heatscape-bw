import { useRef } from 'react';
import { LuCircleAlert, LuCircleCheck } from 'react-icons/lu';
import { t } from '../../i18n';
import { check } from '../../lib/sqlExpr';
import { Select } from '../controls';

const q = t.symbology.query;
const SQL_OPS = ['=', '<>', '<', '>', '<=', '>=', 'AND', 'OR', 'NOT', 'IN ()', 'BETWEEN', 'ILIKE', 'IS NULL', '||'];
const LABEL_OPS = ['||', "' '", "'\\n'", 'round( , 1)', 'upper()', 'coalesce( , )'];

/*
  Expression editor: monospace text area, "insert field" menu, operator chips that insert
  at the cursor, and a live check that names the problem and its column.
  kind: sql (WHERE clause) | label (text expression).
*/
export function SqlField({ value, onChange, fields, kind = 'sql', rows = 3, label, placeholder, compact = false }) {
  const ref = useRef(null);
  const result = check(value, fields.map((f) => f.key));

  const insert = (text) => {
    const el = ref.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const pad = (s) => (/\w$/.test(value.slice(0, start)) ? ' ' : '') + s + (/^\w/.test(value.slice(end)) ? ' ' : '');
    const next = value.slice(0, start) + pad(text) + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el?.focus();
      const pos = start + pad(text).length;
      el?.setSelectionRange(pos, pos);
    });
  };

  return (
    <div className="flex flex-col gap-1.5">
      <textarea
        ref={ref}
        rows={rows}
        value={value}
        spellCheck={false}
        aria-label={label}
        aria-invalid={!!result.error}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`resize-y border bg-field px-2 py-1.5 font-mono text-xs leading-relaxed text-text outline-none placeholder:text-faint ${result.error ? 'border-[var(--danger)]' : 'border-border focus:border-accent-line'}`}
      />
      {!compact && (
        <div className="flex flex-wrap items-center gap-1">
          <Select
            value=""
            onChange={(v) => v && insert(/^[A-Za-z_]\w*$/.test(v) ? v : `"${v}"`)}
            options={[{ value: '', label: q.insertField }, ...fields.map((f) => ({ value: f.key, label: `${f.label} · ${f.key}` }))]}
            label={q.insertField}
            className="w-36"
          />
          {(kind === 'sql' ? SQL_OPS : LABEL_OPS).map((op) => (
            <button
              key={op}
              type="button"
              onClick={() => insert(op)}
              className="h-7 border border-border px-1.5 font-mono text-2xs text-muted hover:border-border-strong hover:text-accent"
            >
              {op}
            </button>
          ))}
        </div>
      )}
      {value.trim() && (
        <p className={`flex items-start gap-1.5 text-2xs ${result.error ? 'text-danger' : 'text-success'}`} role={result.error ? 'alert' : 'status'}>
          {result.error ? <LuCircleAlert size={12} className="mt-px shrink-0" aria-hidden /> : <LuCircleCheck size={12} className="mt-px shrink-0" aria-hidden />}
          <span>{result.error ? q.error(result.error, result.pos) : q.valid}</span>
        </p>
      )}
    </div>
  );
}
