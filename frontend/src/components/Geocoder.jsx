import { useEffect, useId, useRef, useState } from 'react';
import { useMap } from 'react-map-gl/mapbox';
import { REGION } from '../data/mock';
import { t } from '../i18n';
import { geocode } from '../lib/geocode';
import { SearchField } from './SearchField';

/** Compact place search; the list shows five rows and scrolls for the rest. */
export function Geocoder({ disabled }) {
  const { main } = useMap();
  const listId = useId();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listRef = useRef(null);

  // Debounced lookup; a newer keystroke aborts the pending request.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      const c = main?.getCenter();
      geocode(q, { proximity: c ? [c.lng, c.lat] : REGION.center, signal: ctrl.signal })
        .then((r) => {
          setResults(r);
          setActive(-1);
        })
        .catch((e) => e.name !== 'AbortError' && setResults([]));
    }, 250);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query, main]);

  useEffect(() => {
    listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const pick = (r) => {
    setQuery(r.name);
    setOpen(false);
    if (r.bbox) main?.fitBounds([[r.bbox[0], r.bbox[1]], [r.bbox[2], r.bbox[3]]], { padding: 60, maxZoom: 15, duration: 800 });
    else main?.flyTo({ center: r.center, zoom: 15, duration: 800 });
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results.length) {
      pick(results[Math.max(active, 0)]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const showList = open && query.trim().length >= 2;

  return (
    <div className="absolute left-3 top-3 z-20 w-64" onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setOpen(false)}>
      <SearchField
        value={query}
        onChange={(v) => {
          setQuery(v);
          setOpen(true);
        }}
        placeholder={t.map.searchPlaceholder}
        onClear={() => setQuery('')}
        clearLabel={t.map.searchClear}
        iconSize={13}
        className="h-8 border-border-strong bg-surface-strong shadow-[var(--shadow-glass)] backdrop-blur-md"
        inputProps={{
          role: 'combobox',
          'aria-label': t.map.search,
          'aria-expanded': showList,
          'aria-controls': listId,
          'aria-autocomplete': 'list',
          'aria-activedescendant': active >= 0 ? `${listId}-${active}` : undefined,
          disabled,
          onFocus: () => setOpen(true),
          onKeyDown,
        }}
      />
      {showList && (
        <ul ref={listRef} id={listId} role="listbox" className="max-h-50 overflow-y-auto border border-t-0 border-border-strong bg-surface-strong shadow-[var(--shadow-glass)] backdrop-blur-md">
          {results.length === 0 ? (
            <li className="flex h-10 items-center px-3 text-xs text-muted">{t.map.searchEmpty}</li>
          ) : (
            results.map((r, i) => (
              <li
                key={r.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(r)}
                onMouseEnter={() => setActive(i)}
                className={`flex h-10 cursor-pointer flex-col justify-center border-b border-border-soft px-3 last:border-b-0 ${i === active ? 'bg-hover' : ''}`}
              >
                <span className="truncate text-xs text-text">{r.name}</span>
                <span className="truncate text-2xs text-muted">{r.place}</span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
