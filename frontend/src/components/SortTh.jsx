import { LuArrowDown, LuArrowUp } from 'react-icons/lu';
import { t } from '../i18n';

/** Sortable table header cell (pairs with useSort). align: 'left' | 'right'. */
export function SortTh({ label, sortKey, sort, onSort, align = 'left', className = '', title }) {
  const active = sort?.key === sortKey;
  return (
    <th
      scope="col"
      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
      className={`font-medium ${align === 'right' ? 'text-right' : 'text-left'} ${className}`}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        title={title ?? t.sort.by(label)}
        className={`inline-flex max-w-full items-center gap-1 text-2xs uppercase tracking-[var(--tracking-caps)] ${align === 'right' ? 'flex-row-reverse' : ''} ${
          active ? 'text-text' : 'text-muted hover:text-text'
        }`}
      >
        <span className="truncate">{label}</span>
        {active && (sort.dir === 'desc' ? <LuArrowDown size={10} className="shrink-0" /> : <LuArrowUp size={10} className="shrink-0" />)}
      </button>
    </th>
  );
}
