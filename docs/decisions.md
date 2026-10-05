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
28. Reports render in the browser from one content model (`lib/reportContent.js`): the A4 preview paginates measured blocks, Export PDF prints that preview (`@page` A4, print-only copy), DOCX is built with `docx` from the same model, the share link carries the settings in the URL hash (no map image) — council-ready output without a render service; server-side rendering can replace it behind the same model.
29. Report pages print light (paper-white `--report-page`, light tokens via `data-theme="light"` on each page) in both app themes; page text has its own language (EN/DE) independent of the UI — a council paper must look the same whoever exports it.
30. Machine translation is self-hosted LibreTranslate (open source, EN/DE only) behind `POST /api/translate` — report text never leaves our servers and no key or per-call cost; quality is below commercial engines, so translations are marked for review. Report text fields keep one version per language (`{ en, de }`); a missing version shows the other language until translated or written.
31. The public Heat Portal is a separate route (`/portal`, lazily loaded bundle) of the same frontend, no sign-in, its own EN/DE switch (default from the browser language) — one codebase and design system; citizens never load the workspace.
32. Portal heat layer shows heat relative to the Mannheim median on a spectral ramp (`--spectral-1…11`, ColorBrewer Spectral: blue, green, yellow = typical, orange, red; ±5.5 °C spans it; an exception to the no-rainbow rule by user request, portal only) with value suppression: 11 classes at high confidence, 5 at medium (40 % towards `--unc-suppress`), 3 at low (70 %); legend as a confidence × cooler/typical/hotter grid — citizens read "hotter or cooler than usual here" (user request), and uncertainty shows without hatching on a phone-sized map.
33. Portal privacy: the searched address is never stored or sent to our backend (geocoding and the walking isochrone go to Mapbox from the browser); only language and layout are remembered.
34. The admin & operations console is a third route (`/admin`, own bundle) on the workspace shell without the map (top bar, rail, navigation panel, page, log dock); System Health checks the built services live through the gateway and lists planned services as planned — operations must never show invented health.
35. Admin access is not enforced yet (no auth service); `/admin` must sit behind the Admin role (Keycloak) before any deployment.
36. Interim sign-in until Keycloak: the middleware checks email + password against MOCK users from `.env` (`middleware/src/users.js`) and keeps the session in memory behind an opaque httpOnly `hs_session` cookie (SameSite=Lax; 12 h, or 30 d with Remember me; 5 failed attempts per 15 min lock that ip + email); the gateway guards `/admin` with `auth_request` to the middleware (signed out → `/signin?next=/admin`, no Admin role → `/signin?…&denied=admin`, fails closed); identity reaches the backend only as `X-User-*` headers set by the middleware — supersedes 35 for local use; the browser never holds a token, and Keycloak OIDC later replaces only the password check behind the same cookie and `/api/auth/me`.
37. Sign-in and account pages are a fourth route bundle (`/signin`, `/signin/forgot`, `/signin/update-password`, `/signin/verify-email`, `/account`) with their own EN/DE switch, built as standalone pages to port to a Keycloak theme (Keycloakify); forgot password, update password, email verification, municipality SSO and API tokens are MOCK until Keycloak and a mail service exist; active sessions are live.

## UI overrides

User removed or changed these. Snapshots never bring them back; only an explicit request does.

- Map coordinates readout: removed.
- Map scale: bare bracket bar + distance, bottom left, no box or background, 2 px strokes, ≤ 60 px.
- Map legend: removed from the map; each layer's legend sits inside its row in the Layers panel, generated from its symbology.
- Mapbox wordmark and default attribution: replaced by the collapsible ⓘ attribution, bottom right.
- Map projection: Web Mercator always (`MAP_PROJECTION`), never the Mapbox globe, on every basemap. No style fog either (`MAP_FOG = null`): the styles' globe fog culls tiles on a flat map when zoomed out.
- Map controls: compact 28 px buttons, top right, in order: collapse chevron, zoom ± with north reset (`TbMapNorth`, turns with the map bearing), world / Baden-Württemberg extent, tools, basemap, compare; the chevron folds the column with a staggered slide (state persisted); no fullscreen or prev/next view buttons.
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
- Heat Portal map controls: the workspace's compact 28 px group (zoom ±, north reset); no Mapbox attribution, no attribution tile and no Mapbox logo (removed by request).
- Settings panel: no theme switch (top nav and the T key only); it lists every keyboard shortcut, grouped (General, Navbar, Left panel, Right panel, Dock, Map, Measures, Reports), searchable, each row runs on click.
- Report outline: each section type once; Add section lists only the missing ones.
- Report pages: the selected section is marked by an accent bar in the left margin (faint bar on hover), not an outline over the content. Footer: licence line wrapped in the left half, page x of y with data version and date right-aligned.
- Measure footprint draft: dotted outline over a light fill until saved (solid once saved); drawing snaps to the first corner to close the shape; finishing opens corner editing (square corner handles, 12 px: click selects (theme orange fill), drag moves, Delete / Backspace, the Delete corner button, right-click or double-click removes; round midpoint handles at 30 % opacity, full on hover: drag or click to add).
- Ruler snapping: a magnet button slides out left of the ruler while the ruler is on and toggles snapping (default on); points snap within 12 px to the ruler's own points and the vertices of app layers (not the basemap), shown by an orange ring.
- Panel widths: every left panel section and every right panel view share one width, 352 px (22rem) (`--panel-w`, one saved drag width `panelW` for both sides); no per-section or per-view widths.

## Open

- Measures API (proposed, not built): `GET/POST /api/measures` (multipart: footprint GeoJSON/GPKG/SHP converted server-side, photos/documents), `PATCH /api/measures/{id}/status` (appends to `measure_status_events`: measure_id, from_status, to_status, changed_at timestamptz, completed_on, changed_by), `GET /api/measures/{id}/effect` (LST/sealing/NDVI before-after, DiD, series), `GET /api/measures/summary`, `GET /api/measures/export?format=csv|pdf`.
- Portal API (proposed, not built): `GET /api/portal/warning?district=` (DWD CAP heat warnings, cached), `GET /api/portal/area?lon=&lat=` (surface LST p05/p50/p95 around a point, city rank, confidence), `GET /api/portal/cool-places?lon=&lat=` (register with opening hours, walking minutes from the routing service).
- Keycloak (planned): realm with roles Public / Planner / Partner / Expert / Admin, OIDC code flow in the middleware, Keycloakify theme from the `/signin` pages, municipality SSO via identity brokering, mail service for reset and verification; API tokens as Keycloak service accounts or personal access tokens (to decide). Imprint and Privacy pages are not written yet (linked on the sign-in pages).
- Ops API (proposed, not built): `GET /api/admin/pipelines` (+ `POST …/{id}/run`, `POST …/{id}/pause`, `GET …/{id}/runs`), `GET /api/admin/stac/collections` (pgstac), `GET /api/admin/regions`, `GET/PATCH /api/admin/users` (Keycloak admin API), `GET /api/admin/copilot/usage`, `GET /api/admin/audit`, `GET /api/admin/logs` (SSE stream) — all Admin role only.
- Reports API (proposed, not built): `GET/POST /api/reports` and `GET/PUT/DELETE /api/reports/{id}` (report settings, sections, map snapshot as object-storage key), `POST /api/reports/{id}/render?format=pdf|docx` (server-side rendering for archived council papers), `POST /api/reports/{id}/share` (signed read-only link replacing the URL-hash link).
- Multiband RGB rasters (band picker, per-band stretch) need the tile server (rio-tiler); not possible in Mapbox GL client-side.
- Symbology: optional QML/SLD style import (not built).
- Map selection outline: accent (as in approved screen) or `--accent-2`.
- Mock district "Waldfriedhof" is not a Mannheim district (Waldhof is).
- Mapbox wordmark hidden on request in the workspace; Mapbox terms require it on public deployments — restore before going public, including on the Heat Portal (`/portal`), where logo and attribution were removed by request.
