import { useRef, useState } from 'react';
import { LuSearch, LuX } from 'react-icons/lu';

/*
  Search box: icon + input (+ clear).
  Text inside a native input is placed by the browser from the font's line metrics and
  cannot be trimmed, so it never lines up exactly with the icon. Here the browser draws
  nothing visible: the input's text is transparent (caret, selection, IME and copy/paste
  still work) and both the value and the placeholder are drawn by an overlay span trimmed
  to cap height, centred on the icon like every other label. The overlay follows the
  input's horizontal scroll so the caret stays on the letters when the text overflows.
  inputProps: extra attributes for the input (ARIA, focus and key handlers).
*/
export function SearchField({ value, onChange, placeholder, onClear, clearLabel, iconSize = 12, className = '', inputProps = {} }) {
  const inputRef = useRef(null);
  const [scrollX, setScrollX] = useState(0);
  const sync = () => requestAnimationFrame(() => setScrollX(inputRef.current?.scrollLeft ?? 0));

  return (
    <label className={`flex items-center gap-2 border px-2 focus-within:border-accent-line ${className}`}>
      <LuSearch size={iconSize} className="shrink-0 text-muted" aria-hidden />
      <span className={`relative flex min-w-0 flex-1 items-center self-stretch ${inputProps.disabled ? 'opacity-50' : ''}`}>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            sync();
          }}
          onScroll={sync}
          onSelect={sync}
          onKeyUp={sync}
          aria-label={placeholder}
          className="h-full w-full min-w-0 bg-transparent text-xs text-transparent caret-text outline-none selection:bg-accent-soft"
          {...inputProps}
        />
        {/* Drawn text: clipped exactly at the input's sides, with room above and below for
            descenders that fall outside the trimmed box. */}
        <span className="pointer-events-none absolute inset-x-0 [clip-path:inset(-0.4em_0)]" aria-hidden>
          <span
            className={`text-trim block whitespace-pre text-xs ${value ? 'text-text' : 'text-faint'}`}
            style={
              value
                ? { transform: `translateX(${-scrollX}px)` }
                : // Long placeholders end in an ellipsis; clip (not hidden) keeps descenders.
                  { overflow: 'clip', overflowClipMargin: '0.4em', textOverflow: 'ellipsis' }
            }
          >
            {value || placeholder}
          </span>
        </span>
      </span>
      {value && onClear && (
        <button
          type="button"
          onClick={() => {
            onClear();
            setScrollX(0);
          }}
          aria-label={clearLabel}
          title={clearLabel}
          className="shrink-0 text-muted hover:text-text"
        >
          <LuX size={12} />
        </button>
      )}
    </label>
  );
}
