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
17. Layer symbology is a JSON style per layer (`lib/styleModel.js`) translated to Mapbox layers in one place (`lib/symbology.js`) and saved in localStorage (`hs-symbology`) until reset — styles must survive refreshes and browser restarts; one translator keeps map, legend and panel in step.
18. Class breaks are computed on the full layer data, never on rendered features — breaks must not change while panning.
19. Marker shapes, icon markers and fill patterns are drawn on a canvas on demand (`styleimagemissing`, parameters in the image id) — no sprite sheet, any colour/size combination, survives basemap and theme switches.
20. MOCK rasters are PNG image sources with the value in the red channel, decoded by `raster-color-mix` and coloured by `raster-color` — client-side ramps and palettes without a tile server; real rasters move to rio-tiler colormap/rescale params later.

21. Measures register: footprints and 100 m analysis buffers are styleable registry layers fed live from the measures store (MOCK register + measures added in the form, saved in localStorage `hs-measures`) — one layer system for styling, legends, tables and draw order.
22. Measure effect = difference-in-differences of the summer (Jun–Aug) median Landsat 8/9 LST, footprint vs a matched control area, before vs after completion, 90 % intervals; estimated only after 2 post-completion summers ("awaiting data" before) — single scenes are too noisy at 30–100 m thermal resolution.
23. Measure types have their own non-warm categorical tokens `--measure-*`, validated (dataviz validator, both themes) in the fixed order De-sealing, Green roof, Shade, Tree planting, Water feature; always shown with the type name — a footprint must never read as a heat value.
24. Queries, rule-based styles and label classes use one SQL subset (`lib/sqlExpr.js`) evaluated in the browser on prepared layer data (`lib/prepared.js`): definition queries drop features, selection queries flag them — Mapbox filters lack LIKE and functions; the same WHERE subset can go to PostGIS later as a parameterised query.
25. Labels draw from their own source (points, line geometry, polygon centroids / visual centres / outlines) and sit above every data layer; fonts limited to Mapbox-served stacks (DIN Pro, Open Sans, Roboto, Arial Unicode MS) — QGIS-like label placement without depending on tile-split polygon labels.

26. Shapefile footprints are read in the browser with `shpjs` (a zip, or .shp + .dbf + .prj (+ .cpg) picked together; the .prj reprojects to WGS 84 via proj4) — no upload service needed for SHP; GeoPackage (SQLite) still waits for it.
27. Measure status changes are an append-only trail of timestamped events (`from`, `to`, `at` ISO date-time, `completed` date), kept in `hs-measures` until the API stores them in `measure_status_events`; the latest event sets status and dates — every change stays traceable.

## UI overrides

User removed or changed these. Snapshots never bring them back; only an explicit request does.

- Map coordinates readout: removed.
- Map scale: bare bracket bar + distance, bottom left, no box or background, 2 px strokes, ≤ 60 px.
- Map legend: removed from the map; each layer's legend sits inside its row in the Layers panel, generated from its symbology.
- Mapbox wordmark and default attribution: replaced by the collapsible ⓘ attribution, bottom right.
- Map projection: Web Mercator always (`MAP_PROJECTION`), never the Mapbox globe, on every basemap. No style fog either (`MAP_FOG = null`): the styles' globe fog culls tiles on a flat map when zoomed out.
- Map controls: compact 28 px buttons, top right, in order: collapse chevron, zoom ±, world / Baden-Württemberg extent, tools, basemap, compare; the chevron folds the column with a staggered slide (state persisted); no fullscreen or prev/next view buttons.
- Basemap: chosen in the basemap map control (list: thumbnail square + name), saved in localStorage (`hs-basemap`); Default Dark; no "Auto (theme)" entry (removed by request), a saved 'auto' falls back to Dark. Not in the Settings panel. Order: Dark, Light, then the rest. Thumbnails: full screenshots in `frontend/public/basemaps/`, 96 px square crops (Channel coast, land + sea) in `public/basemaps/thumbs/`, shown at 32 px; set in `BASEMAPS` (`lib/mapStyle.js`).
- Map snapshot: camera control saves the map container as PNG to a folder and name picked in a save dialog (Chromium; other browsers download with the default name) (`html-to-image`, `lib/mapSnapshot.js`): basemap, layers, markers, scale and the attribution (forced expanded); nav controls, geocoder, swipe handle and focus overlay are excluded via `data-snapshot="exclude"`. Map canvases use `preserveDrawingBuffer` for this.
- Geocoder: compact, top left; 5 results visible, then scroll. Picking fits the result extent (bbox, else a zoom by result type) and drops a yellow pin (short pin in a wide ground ring, soft ground shadow) once the map has arrived; clearing the search removes it.
- Rail active state: soft accent background, no edge bar, icon in full text colour.
- Sample region: Mannheim stays in every new screen; template examples from Stuttgart are translated to Mannheim districts (e.g. Hallschlag → Neckarstadt-West).
- Top nav: as built (brand, region menu, view tabs, season, theme, notifications, account); no active-jobs meter or user name block.
- Status and classification labels: square marks or tinted chips, never circles. Every chip one width (`--level-chip-w` 96 px; icon-only `--chip-compact-w` 36 px; dock tab badges `--dock-chip-w` 76 px), content centred, icon + text centred together.
- Left sections and the right panel: opening a section opens its wired right view (`SECTION_VIEW` in `state/layout.js`: layers → inspector, scenarios → ranking); a section without one collapses the right panel. New sections declare their view there.
- Attribute table: one layer picker, the table button in the Layers panel; no layer dropdown in the dock bar. No Sort button either: sorting is by the column headers.
- Dock tabs: compact (12 px icon, 2xs caps label, `--dock-chip-w` 76 px badges, no wrapping); the tab strip scrolls sideways instead of overlapping the tab actions.
- Measure footprint draft: dotted outline over a light fill until saved (solid once saved); drawing snaps to the first corner to close the shape; finishing opens corner editing (square corner handles, 12 px: click selects (theme orange fill), drag moves, Delete / Backspace, the Delete corner button, right-click or double-click removes; round midpoint handles at 30 % opacity, full on hover: drag or click to add).
- Ruler snapping: a magnet button slides out left of the ruler while the ruler is on and toggles snapping (default on); points snap within 12 px to the ruler's own points and the vertices of app layers (not the basemap), shown by an orange ring.
- Panel widths: every left panel section and every right panel view share one width, 352 px (22rem) (`--panel-w`, one saved drag width `panelW` for both sides); no per-section or per-view widths.

## Open

- Measures API (proposed, not built): `GET/POST /api/measures` (multipart: footprint GeoJSON/GPKG/SHP converted server-side, photos/documents), `PATCH /api/measures/{id}/status` (appends to `measure_status_events`: measure_id, from_status, to_status, changed_at timestamptz, completed_on, changed_by), `GET /api/measures/{id}/effect` (LST/sealing/NDVI before-after, DiD, series), `GET /api/measures/summary`, `GET /api/measures/export?format=csv|pdf`.
- Multiband RGB rasters (band picker, per-band stretch) need the tile server (rio-tiler); not possible in Mapbox GL client-side.
- Symbology: optional QML/SLD style import (not built).
- Map selection outline: accent (as in approved screen) or `--accent-2`.
- Mock district "Waldfriedhof" is not a Mannheim district (Waldhof is).
- Mapbox wordmark hidden on request; Mapbox terms require it on public deployments — restore before going public.
