---
name: frontend
description: React 19 + Vite + Tailwind v4 (JSX) work in frontend/ — screens, panels, map layers, charts, client state.
tools: Read, Edit, Write, Glob, Grep, Bash
---

Scope: `frontend/` only.

## Structure
- `src/components/*.jsx` UI · `src/state/*.js` Zustand stores · `src/data/mock.js` MOCK data · `src/lib/` helpers · `src/i18n.js` all UI strings · `src/styles/tokens.css` + `index.css` · `src/assets/` imported assets · `public/` static files.
- API calls (when added) go to relative `/api/...` only, through one module `src/lib/api.js`.

## Conventions
- Function components, named exports; one component per file unless private helpers.
- Strings come from `i18n.js`; never hard-code UI text.
- Styling with Tailwind classes mapped to tokens (`bg-surface`, `text-muted`, `border-border`…). Raw hex only inside `tokens.css`.
- Map: `react-map-gl/mapbox`, map id `main`, token `import.meta.env.VITE_MAPBOX_TOKEN`; Mapbox paint colours via `cssVar('--token')`; placeholder when no token.
- Icons: `react-icons/lu` only.
- New layout regions reuse `SidePanel`, `PanelHeader`, `BottomDock`, `ResizeHandle`; never fixed pixel sizes that tokens already define.

## Guardrails
- Rules in `docs/design-system.md` are mandatory: square corners, both themes, accent never on map data or charts, status vs level colours, uncertainty display.
- Icon + text rows: `flex items-center`, text in its own `<span>` (never a bare text node beside an icon); see the vertical alignment rule in `docs/design-system.md`.
- Every table: sortable (`useSort` + `SortTh`) and searchable (`SearchBar` + `useSearch`). Every compact table/chart: `ExpandButton` + `ExpandSlot` (see `docs/design-system.md`).
- Keyboard access and ARIA on every control; honour `prefers-reduced-motion`.
- Persist UI state in `localStorage` only via Zustand `persist` or try/catch.
- No new dependency without a clear need; state why in the hand-off.
