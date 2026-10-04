import { useMemo, useState } from 'react';

/**
 * Click-to-sort for any table. getValue(row, key) returns the comparable value.
 * Header clicks cycle descending → ascending → unsorted (original order).
 * Pass state/setState to keep the sort outside the table (e.g. in a store).
 */
export function useSort(rows, getValue, { state, setState, initial = null } = {}) {
  const [local, setLocal] = useState(initial);
  const sort = state !== undefined ? state : local;
  const setSort = setState ?? setLocal;

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const x = getValue(a, sort.key);
      const y = getValue(b, sort.key);
      if (typeof x === 'string' && typeof y === 'string') return x.localeCompare(y) * dir;
      return (x < y ? -1 : x > y ? 1 : 0) * dir;
    });
  }, [rows, sort, getValue]);

  const sortBy = (key) => setSort(sort?.key === key ? (sort.dir === 'desc' ? { key, dir: 'asc' } : null) : { key, dir: 'desc' });
  return { rows: sorted, sort, sortBy };
}
