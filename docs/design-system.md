# Design system

Source of truth: [`frontend/src/styles/tokens.css`](../frontend/src/styles/tokens.css). Tailwind classes map to tokens in `frontend/src/styles/index.css`.

## Rules

- Square everything (radius 0, including Mapbox UI). Exception: round data marks on the map.
- No circular spinners (use a thin progress line); no radio circles (use segmented controls).
- Font: Urbanist; body 13px (`--fs-sm`); numbers in tables use `tabular-nums`.
- Themes: `data-theme="dark|light"` on `<html>`; every component must work in both.
- Scrollbars: global only (`index.css`), no end arrows, `--scrollbar-w` wide, faint `--scrollbar-thumb`; no per-component scrollbar styles.
- Vertical alignment: text beside an icon or inside a control is wrapped in its own `<span>` inside an `items-center` row; `index.css` trims it to cap height, or to x-height when it sits directly beside an icon and is not uppercase, so icon, text, placeholder and chip content line up. Never leave a bare text node next to an icon. Native input text cannot be trimmed, so search and filter boxes use `SearchField`: the input text is transparent and both value and placeholder are drawn by a trimmed overlay span that follows the input scroll; never a bare `<input>` next to an icon.
- Dropdowns, menus and scrollable lists: no top or bottom padding on the list container (rows run edge to edge); rows are single-line, `text-xs`, 28px (`h-7`) for text rows; thumbnail rows use a 25px thumbnail (`size-6.25`) with 2px vertical padding and take their height from it; no secondary description; the selected row is shown by `bg-accent-soft`, not an extra mark.
- Panel notes (caveats, disclaimers, method notes): never a strip inside the panel; pass the text as `info` to `PanelHeader`, which shows an ⓘ button left of the header actions with the note on hover or keyboard focus. Current: Ranking → scenario-effects disclaimer.
- Map nav-control panels: always `ControlPopover`, opened by `MapControls` (one at a time; outside click, Esc, its control button or folding the column closes it; choosing an item inside never closes it). They open from the top of the control column, left of the controls, and may use the full map height. Motion: unroll downward from the top edge with a slight drift in from the right, rows staggered via `popoverRowStyle`; quicker roll-up on close.
- Dock list tabs (tables, job lists) get the shared `FilterInput` in the dock bar: any-column, case-insensitive; counts and exports follow the filtered rows.
- Tables: every table is sortable — `useSort` (`lib/useSort.js`) + `SortTh` headers, click cycles descending → ascending → original; keep the sort state outside the table (store) when it can move into the expanded view.
- Expand: every compact table or chart (dock tabs, panel tables, panel charts) has an `ExpandButton` in its header and its body in an `ExpandSlot` with the same id; expanded, it covers the map container edge to edge (no inset, no restore button in the overlay; the element's own button, the placeholder Restore or Esc restores, one at a time) and its original place keeps its exact height with one bold uppercase text control, IN FOCUS, that crossfades to an orange RESTORE on hover or focus and restores on click (no icon, no separate button). Dock tabs: the focused tab stays in focus view while other tabs are browsed in the dock; expanding another tab swaps them. The dock draws the focused tab from one stable `overlayOnly` slot and the active tab from a `placeholderOnly` slot, so tab switches never remount (flicker) the overlay. Charts draw at a larger internal size when `large` so text keeps its size.
- Tables: classification labels (risk, level) use the `level-chip` utility (tinted bg + coloured text); numbers stay plain coloured text. Every chip has one width (`--level-chip-w`; icon-only chips `--chip-compact-w`) with its content centred; a chip with an icon or pips centres icon and text together as one group.
- Focus ring: keyboard only (`data-input` on `<html>`); a mouse click never leaves an outline.
- Layout: top nav · left rail + panel · map (flex) + bottom dock · right panel. Sizes from tokens (`--nav-h`, `--panel-w` (both sides), `--dock-*`). Map calls `resize()` via ResizeObserver.

## Colour roles

| Role | Tokens | Use |
|---|---|---|
| Chrome | `--bg`, `--surface*`, `--border*`, `--text*`, `--nav-*` | UI surfaces and text |
| Accent | `--accent*`, `--glow*` | Active state, primary action, focus — not on map data or charts |
| Levels | `--level-*` | Heat-stress classes: NORMAL, MODERATE, HIGH, SEVERE, NO DATA, INDICATIVE |
| Status | `--success`, `--warning`, `--danger`, `--info` (+ `-soft`) | Jobs, forms, alerts — always with icon + text |
| Data ramps | `--heat-1…9`, `--cool-*`, `--green-*`, `--seal-*`, `--vuln-*` | Map layers, legends (theme-independent) |
| Diverging | `--dt-*`, `--ds-*`, `--div-mid` | Temperature change, sealing change |
| Bivariate | `--biv-11…33` | Heat × vulnerability |
| Uncertainty | `--unc-*` | Hatch (low confidence), dots (gap-filled), no data |
| Series | `--series-1…8` | Chart series in fixed order; max 3 in scatter plots |

- Confidence is shown as a neutral 3-pip chip (■■■ / ■■□ / ■□□), never with level colours.
- `--text-faint` only for placeholders/disabled (fails 4.5:1).
