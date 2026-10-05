import { FaEarthAmericas } from 'react-icons/fa6';
import { t } from '../i18n';
import { BASEMAPS } from '../lib/mapStyle';
import { useBasemap } from '../state/basemap';
import { popoverRowStyle } from './ControlPopover';

/** Map control button that toggles the basemap panel (the panel is placed by MapControls). */
export function BasemapButton({ open, disabled, onToggle }) {
  return (
    <div className="flex flex-col border border-border-strong bg-surface-strong shadow-[var(--shadow-glass)] backdrop-blur-md">
      <button
        type="button"
        aria-label={t.map.basemap}
        title={t.map.basemap}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={onToggle}
        className={`grid size-7 place-items-center transition-colors disabled:opacity-50 ${open ? 'bg-accent-soft text-accent' : 'text-text hover:bg-hover'}`}
      >
        <FaEarthAmericas size={13} />
      </button>
    </div>
  );
}

/** Basemap list: thumbnail square + name per row; picking applies it and keeps the panel open to compare. */
export function BasemapList({ shown }) {
  const { basemap, setBasemap } = useBasemap();
  return (
    <ul role="listbox" aria-label={t.map.basemap} className="min-h-0 w-48 overflow-y-auto">
      {BASEMAPS.map((b, i) => {
        const on = b.id === basemap;
        return (
          <li key={b.id} role="option" aria-selected={on} style={popoverRowStyle(shown, i)}>
            <button
              type="button"
              onClick={() => setBasemap(b.id)}
              className={`flex w-full items-center gap-2 px-1.5 py-0.5 text-left text-xs ${on ? 'bg-accent-soft font-semibold text-text' : 'text-text hover:bg-hover'}`}
            >
              {b.thumb ? (
                <img src={b.thumb} alt="" className="size-8 shrink-0 border border-border object-cover" />
              ) : (
                <span className="size-8 shrink-0 border border-border bg-field" aria-hidden />
              )}
              <span className="min-w-0 flex-1 truncate">{t.map.basemaps[b.id]}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
