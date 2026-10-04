import { t } from '../i18n';
import { SearchField } from './SearchField';

/** Compact text filter for dock lists; Esc clears it. */
export function FilterInput({ value, onChange, label = t.filter.placeholder }) {
  return (
    <SearchField
      value={value}
      onChange={onChange}
      placeholder={label}
      onClear={() => onChange('')}
      clearLabel={t.filter.clear}
      className="mr-1 h-7 w-56 border-border bg-field"
      inputProps={{ onKeyDown: (e) => e.key === 'Escape' && onChange('') }}
    />
  );
}

/** Case-insensitive match of a query against every value of a row. */
export const matchesFilter = (query, values) => {
  const q = query.trim().toLowerCase();
  return !q || values.some((v) => String(v).toLowerCase().includes(q));
};
