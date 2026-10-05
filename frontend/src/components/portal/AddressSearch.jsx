import { useEffect, useId, useRef, useState } from 'react';
import { LuLocateFixed, LuMapPin, LuSearch, LuX } from 'react-icons/lu';
import { REGION } from '../../data/mock';
import { portalText } from '../../i18n';
import { geocode } from '../../lib/geocode';
import { usePortal } from '../../state/portal';

/*
  Address search for citizens: large (44 px) field with suggestions (arrow keys, Enter,
  Esc), clear button and "Use my location". Nothing typed or found is stored.
*/
export function AddressSearch() {
  const { lang, location, setLocation } = usePortal();
  const p = portalText[lang].search;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [status, setStatus] = useState(null); // locating | failed | none
  const listId = useId();
  const boxRef = useRef(null);

  // Show the chosen place's name in the field.
  useEffect(() => {
    if (location) setQuery(location.name);
  }, [location]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3 || q === location?.name) return setResults([]);
    const ctrl = new AbortController();
    const id = setTimeout(async () => {
      try {
        const found = await geocode(q, { proximity: REGION.center, signal: ctrl.signal, limit: 6 });
        setResults(found);
        setActive(0);
        setStatus(found.length ? null : 'none');
      } catch (e) {
        if (e.name !== 'AbortError') setResults([]);
      }
    }, 250);
    return () => {
      clearTimeout(id);
      ctrl.abort();
    };
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (r) => {
    setLocation({ name: r.name, place: r.place, center: r.center });
    setOpen(false);
    setResults([]);
  };

  const locate = () => {
    if (!navigator.geolocation) return setStatus('failed');
    setStatus('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setStatus(null);
        setLocation({ name: p.myLocation, place: '', center: [pos.coords.longitude, pos.coords.latitude] });
      },
      () => setStatus('failed'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const onKey = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.max(0, Math.min(results.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1))));
    } else if (e.key === 'Enter' && results[active]) {
      e.preventDefault();
      pick(results[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const showList = open && results.length > 0;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={`${listId}-input`} className="text-sm font-semibold text-text">
        {p.label}
      </label>
      <div className="flex gap-2">
        <div
          ref={boxRef}
          className="relative flex h-11 min-w-0 flex-1 items-center gap-2 border border-border-strong bg-field px-3 focus-within:border-accent-line"
          onBlur={(e) => !boxRef.current.contains(e.relatedTarget) && setOpen(false)}
        >
          <LuSearch size={16} className="shrink-0 text-muted" aria-hidden />
          <input
            id={`${listId}-input`}
            type="text"
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={showList ? `${listId}-${active}` : undefined}
            autoComplete="off"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKey}
            className="h-full min-w-0 flex-1 bg-transparent text-base text-text outline-none placeholder:text-faint"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setResults([]);
                setLocation(null);
              }}
              aria-label={p.clear}
              title={p.clear}
              className="-mr-2 grid size-11 shrink-0 place-items-center text-muted hover:text-text"
            >
              <LuX size={16} />
            </button>
          )}
          {showList && (
            <ul id={listId} role="listbox" aria-label={p.results(results.length)} className="absolute inset-x-[-1px] top-full z-30 mt-1 border border-border-strong bg-surface-strong shadow-[var(--shadow-glass)]">
              {results.map((r, i) => (
                <li
                  key={r.id}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(r)}
                  className={`flex min-h-11 cursor-pointer items-center gap-2.5 px-3 py-1.5 ${i === active ? 'bg-hover' : ''}`}
                >
                  <LuMapPin size={15} className="shrink-0 text-muted" aria-hidden />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm text-text">{r.name}</span>
                    {r.place && <span className="truncate text-xs text-muted">{r.place}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          type="button"
          onClick={locate}
          aria-label={p.locate}
          title={p.locate}
          className="grid size-11 shrink-0 place-items-center border border-border-strong text-text hover:border-accent-line hover:text-accent"
        >
          <LuLocateFixed size={17} className={status === 'locating' ? 'animate-pulse' : undefined} />
        </button>
      </div>
      <p className="text-xs text-muted" role="status">
        {status === 'locating' ? p.locating : status === 'failed' ? p.locateFailed : status === 'none' ? p.noResults : p.hint}
      </p>
    </div>
  );
}
