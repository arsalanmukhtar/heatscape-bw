# Decisions

Append-only. One line each: decision — reason.

1. Product, not demo: built for municipalities, public and market use — the proposal needs a real planning case.
2. Mapbox GL JS is the map engine — explicit exception to the open-source rule.
3. JavaScript/JSX only, no TypeScript — team choice.
4. Docker Compose, one folder per service, gateway is the only published port — portable to on-prem municipal servers.
5. BFF pattern: browser talks only to middleware via `/api` — tokens stay server-side, one place for auth and streaming.
6. All backend routes under `/api`, Swagger at `/api/docs` — paths identical through gateway and middleware.
7. `frontend/src/styles/tokens.css` is the single source for colours, type and geometry — no raw colours in components.
8. No rounded corners anywhere; Urbanist font; dark (default) and light themes — design direction.
9. Data colours are theme-independent; the rust accent never colours map data or charts — heat data uses warm hues.
10. Uncertainty is stored and shown with every modelled value — core claim of the proposal.
11. Claude does not run tests, builds or servers; it hands over a test list — the user tests.
12. First screen region is Mannheim (approved screen); Stuttgart remains the primary study region in the proposal.
13. Frontend dev in Docker uses `docker-compose.dev.yml` (Vite dev server, bind mount, polling) — HMR without rebuilds; default compose stays the static nginx build.
14. Scenario priority classes use the vulnerability ramp (`--vuln-2/4/5/7/9`); unstable ranks get the low-confidence hatch — priority is not temperature, so no heat hues.
15. Confidence is shown everywhere with `ConfidencePips`: pip count (■■■ / ■■□ / ■□□) + word, coloured from its own scale `--conf-high/medium/low` (green / amber / rose, validated for CVD in both themes) — user asked for colour; never heat-level or job-status colours, so it cannot read as a temperature or a failure.
16. Swipe compare uses a second non-interactive Mapbox map clipped beside the handle and synced to the main camera — Mapbox has no per-layer clipping.

## UI overrides

User removed or changed these. Snapshots never bring them back; only an explicit request does.

- Map coordinates readout: removed.
- Map scale: bare bracket bar + distance, bottom left, no box or background, 2 px strokes, ≤ 60 px.
- Map legend: removed from the map (to live per layer in the Layers panel).
- Mapbox wordmark and default attribution: replaced by the collapsible ⓘ attribution, bottom right.
- Map projection: Web Mercator always (`MAP_PROJECTION`), never the Mapbox globe, on every basemap. No style fog either (`MAP_FOG = null`): the styles' globe fog culls tiles on a flat map when zoomed out.
- Map controls: compact 28 px buttons, top right, in order: collapse chevron, zoom ±, world / Baden-Württemberg extent, tools, basemap, compare; the chevron folds the column with a staggered slide (state persisted); no fullscreen or prev/next view buttons.
- Basemap: chosen in the basemap map control (list: thumbnail square + name), saved in localStorage (`hs-basemap`); Default Dark; no "Auto (theme)" entry (removed by request), a saved 'auto' falls back to Dark. Not in the Settings panel. Order: Dark, Light, then the rest. Thumbnails: full screenshots in `frontend/public/basemaps/`, 96 px square crops (Channel coast, land + sea) in `public/basemaps/thumbs/`, shown at 32 px; set in `BASEMAPS` (`lib/mapStyle.js`).
- Map snapshot: camera control saves the map container as PNG to a folder and name picked in a save dialog (Chromium; other browsers download with the default name) (`html-to-image`, `lib/mapSnapshot.js`): basemap, layers, markers, scale and the attribution (forced expanded); nav controls, geocoder, swipe handle and focus overlay are excluded via `data-snapshot="exclude"`. Map canvases use `preserveDrawingBuffer` for this.
- Geocoder: compact, top left; 5 results visible, then scroll. Picking fits the result extent (bbox, else a zoom by result type) and drops a yellow pin (short pin in a wide ground ring, soft ground shadow) once the map has arrived; clearing the search removes it.
- Rail active state: soft accent background, no edge bar, icon in full text colour.
- Top nav: as built (brand, region menu, view tabs, season, theme, notifications, account); no active-jobs meter or user name block.
- Status and classification labels: square marks or tinted chips, never circles. Every chip one width (`--level-chip-w` 96 px; icon-only `--chip-compact-w` 36 px), content centred, icon + text centred together.
- Left sections and the right panel: opening a section opens its wired right view (`SECTION_VIEW` in `state/layout.js`: layers → inspector, scenarios → ranking); a section without one collapses the right panel. New sections declare their view there.
- Panel widths: every left panel section and every right panel view share one width, 352 px (22rem) (`--panel-w`, one saved drag width `panelW` for both sides); no per-section or per-view widths.

## Open

- Map selection outline: accent (as in approved screen) or `--accent-2`.
- Mock district "Waldfriedhof" is not a Mannheim district (Waldhof is).
- Mapbox wordmark hidden on request; Mapbox terms require it on public deployments — restore before going public.
- Map legend: where in the Layers panel to attach it (`MapLegend.jsx` kept for that).
