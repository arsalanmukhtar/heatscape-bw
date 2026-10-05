import { t } from '../i18n';
import { SearchField } from './SearchField';

const SIZE = { sm: 'h-7', md: 'h-8' };
const VARIANT = {
  field: 'border-border bg-field',
  floating: 'border-border-strong bg-surface-strong shadow-[var(--shadow-glass)] backdrop-blur-md',
};

/*
  The one search bar for every list, table and lookup: icon, trimmed text, clear button,
  Esc clears. Pair it with useSearch (lib/search.js) for any-column, case-insensitive
  row filtering. size: sm (dock bars, table toolbars) | md (panels, map).
  variant: field | floating (over the map). className sets width and margins (default w-56).
  clearOnEscape: false when the caller uses Esc itself (e.g. to close a result list).
*/
/** Empty or no-match message, centred in the remaining space of a table or list. */
export function SearchEmpty({ children = t.filter.noMatch }) {
  return (
    <div className="grid min-h-24 flex-1 place-items-center px-4 text-center text-xs text-muted">
      <span>{children}</span>
    </div>
  );
}

export function SearchBar({
  value,
  onChange,
  placeholder = t.filter.placeholder,
  clearLabel = t.filter.clear,
  size = 'sm',
  variant = 'field',
  className = 'w-56',
  clearOnEscape = true,
  inputProps = {},
}) {
  const onKeyDown = (e) => {
    if (clearOnEscape && e.key === 'Escape') onChange('');
    inputProps.onKeyDown?.(e);
  };
  return (
    <SearchField
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      onClear={() => onChange('')}
      clearLabel={clearLabel}
      iconSize={size === 'md' ? 13 : 12}
      className={`${SIZE[size]} ${VARIANT[variant]} ${className}`}
      inputProps={{ ...inputProps, onKeyDown }}
    />
  );
}
