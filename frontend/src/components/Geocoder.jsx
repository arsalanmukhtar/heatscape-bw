import { useEffect, useId, useRef, useState } from 'react';
import { Marker, useMap } from 'react-map-gl/mapbox';
import { create } from 'zustand';
import { REGION } from '../data/mock';
import { t } from '../i18n';
import { fmtLatLon, parseCoords } from '../lib/coords';
import { geocode } from '../lib/geocode';
import { useWorkspace } from '../state/workspace';
import { SNAPSHOT_EXCLUDE } from '../lib/mapSnapshot';
import { SearchBar } from './SearchBar';

// Zoom for results without a bounding box: close enough to read the place without zooming in.
const TYPE_ZOOM = { address: 17, street: 16, poi: 16, block: 16, neighborhood: 14, locality: 14, postcode: 13, place: 12, district: 10, region: 8, country: 5 };

/** The searched location; set once the map has finished moving there. */
const usePin = create((set) => ({ pin: null, setPin: (pin) => set({ pin }) }));

/* Pin geometry (viewBox 256): a short pin with a hole whose tip rests inside a wide ground
   ring centred on the location (128, 184), over a soft blurred ground shadow. Anchored at
   the bottom and shifted down so the ring centre, not the box edge, sits on the coordinate. */
const PIN_SIZE = 36;
const PIN_PATH =
  'M124,175a8,8,0,0,0,7.94,0c2.45-1.41,60-35,60-94.95A64,64,0,0,0,64,80C64,140,121.58,173.54,124,175ZM128,56a24,24,0,1,1-24,24A24,24,0,0,1,128,56ZM240,184c0,31.18-57.71,48-112,48S16,215.18,16,184c0-14.59,13.22-27.51,37.23-36.37a8,8,0,0,1,5.54,15C42.26,168.74,32,176.92,32,184c0,13.36,36.52,32,96,32s96-18.64,96-32c0-7.08-10.26-15.26-26.77-21.36a8,8,0,0,1,5.54-15C226.78,156.49,240,169.41,240,184Z';

/** Pin for the searched location; rendered inside the map. */
export function SearchPin() {
  const pin = usePin((s) => s.pin);
  if (!pin) return null;
  return <PlacePin key={pin.id} center={pin.center} name={pin.name} />;
}

/** The yellow place pin (search results here, the citizen's place in the Heat Portal). */
export function PlacePin({ center, name }) {
  return (
    <Marker longitude={center[0]} latitude={center[1]} anchor="bottom" offset={[0, Math.round(PIN_SIZE * (1 - 184 / 256))]}>
      <svg width={PIN_SIZE} height={PIN_SIZE} viewBox="0 0 256 256" className="pin-drop block overflow-visible text-[var(--search-pin)]" role="img" aria-label={name}>
        <title>{name}</title>
        <defs>
          <filter id="hs-pin-ground" x="-50%" y="-100%" width="200%" height="300%">
            <feGaussianBlur stdDeviation="10" />
          </filter>
          <filter id="hs-pin-lift" x="-20%" y="-20%" width="140%" height="150%">
            <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#000" floodOpacity="0.3" />
          </filter>
        </defs>
        <ellipse cx="128" cy="192" rx="104" ry="36" fill="#000" opacity="0.22" filter="url(#hs-pin-ground)" />
        <path d={PIN_PATH} fill="currentColor" filter="url(#hs-pin-lift)" />
      </svg>
    </Marker>
  );
}

/** Compact place search; the list shows five rows and scrolls for the rest. */
export function Geocoder({ disabled }) {
  const { main } = useMap();
  const listId = useId();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listRef = useRef(null);
  // Coordinates in the box go first in the list ("Go to …"); the chip sets lat/lon order.
  const { coordOrder, toggleCoordOrder } = useWorkspace();
  const coords = parseCoords(query, coordOrder);
  const options = coords ? [{ id: 'coords', name: fmtLatLon(coords), place: t.map.coordsHint, center: coords, type: 'coords' }, ...results] : results;

  // Debounced lookup; a newer keystroke aborts the pending request.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2 || parseCoords(q)) {
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

  const setPin = usePin((s) => s.setPin);

  // Fit the result's extent (its bbox, or a zoom for its type) and drop the pin once the map has arrived.
  const pick = (r) => {
    setQuery(r.name);
    setOpen(false);
    setPin(null);
    if (!main) return;
    main.once('moveend', () => setPin(r));
    if (r.type === 'coords') main.flyTo({ center: r.center, zoom: Math.max(main.getZoom(), 16), duration: 1000 });
    else if (r.bbox) main.fitBounds([[r.bbox[0], r.bbox[1]], [r.bbox[2], r.bbox[3]]], { padding: 80, maxZoom: 17, duration: 1000 });
    else main.flyTo({ center: r.center, zoom: TYPE_ZOOM[r.type] ?? 15, duration: 1000 });
  };

  const changeQuery = (v) => {
    setQuery(v);
    setOpen(true);
    if (!v) setPin(null);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && options.length) {
      pick(options[Math.max(active, 0)]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const showList = open && query.trim().length >= 2;

  return (
    <div className="absolute left-3 top-3 z-20 w-64" {...SNAPSHOT_EXCLUDE} onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setOpen(false)}>
      <SearchBar
        value={query}
        onChange={changeQuery}
        placeholder={t.map.searchPlaceholder}
        clearLabel={t.map.searchClear}
        size="md"
        variant="floating"
        className="w-full"
        clearOnEscape={false}
        trailing={
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={toggleCoordOrder}
            title={t.map.coordOrderHint}
            aria-label={t.map.coordOrderHint}
            className={`flex h-5 shrink-0 items-center border px-1.5 font-mono text-2xs uppercase ${coords ? 'border-accent-line bg-accent-soft text-accent' : 'border-border text-muted hover:text-text'}`}
          >
            {coordOrder === 'latlon' ? t.map.latLon : t.map.lonLat}
          </button>
        }
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
          {options.length === 0 ? (
            <li className="flex h-10 items-center justify-center px-3 text-xs text-muted">
              <span>{t.map.searchEmpty}</span>
            </li>
          ) : (
            options.map((r, i) => (
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
