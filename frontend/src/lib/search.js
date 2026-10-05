import { useMemo } from 'react';

/** Case-insensitive match of a query against any of a row's values. */
export const matchesSearch = (query, values) => {
  const q = query.trim().toLowerCase();
  return !q || values.some((v) => String(v).toLowerCase().includes(q));
};

/**
 * Rows whose values match the query (SearchBar's value). getValues(row) lists the
 * searchable values; define it outside the component so the memo holds.
 */
export function useSearch(rows, getValues, query) {
  return useMemo(() => (query.trim() ? rows.filter((r) => matchesSearch(query, getValues(r))) : rows), [rows, getValues, query]);
}
