# Heatscape BW

Geospatial analytics platform for urban heat and land sealing in Baden-Württemberg: map workspace, geoprocessing, agentic copilot.

## Quick start

```powershell
Copy-Item .env.example .env      # set POSTGRES_PASSWORD; optional VITE_MAPBOX_TOKEN; dev sign-in users are preset
docker compose up -d --build
```

| What | URL |
|---|---|
| App | http://localhost:8180 |
| Heat Portal (public, citizen view; workspace account menu) | http://localhost:8180/portal |
| Admin & operations console (Admin role; workspace account menu) | http://localhost:8180/admin |
| Sign in · account settings | http://localhost:8180/signin · /account |
| API docs (Swagger) | http://localhost:8180/api/docs |
| Health (middleware) | http://localhost:8180/healthz |
| Health (backend / database) | http://localhost:8180/api/health · /api/health/db |
| Database (DBeaver/psql, localhost only) | `jdbc:postgresql://localhost:15432/heatscape` · user `heatscape` · password from `.env` |

## Services

| Folder | Service | Stack | Port |
|---|---|---|---|
| `gateway/` | Reverse proxy, only public entry | nginx | 8180 → 80 |
| `frontend/` | Web app | React 19, Vite, Tailwind v4 (JSX), Mapbox GL | internal 80 |
| `middleware/` | BFF, `/api` proxy, sign-in sessions (`/api/auth/*`) | Node 22, Fastify | internal 3000 |
| `backend/` | Domain API | Python 3.12, FastAPI, asyncpg | internal 8000 |
| `backend/` (service `worker`) | Open-data imports on a schedule (`app/ingest`): DWD, OSM, Zensus | same image, `python -m app.ingest.schedule` | none (outbound internet) |
| `translate/` | Machine translation of report text EN ↔ DE (first start downloads the models, a few minutes) | LibreTranslate 1.6 (Argos, open source) | internal 5000 |
| `database/` | Spatial database | PostgreSQL 17 (bookworm), PostGIS 3, h3-pg | 127.0.0.1:15432 → 5432 |

## Frontend dev (HMR)

| Mode | Command | URL |
|---|---|---|
| Docker (dev server + HMR behind gateway) | `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build frontend gateway` | http://localhost:8180 |
| Back to static build | `docker compose up -d --build frontend` | http://localhost:8180 |
| Host only | `cd frontend; npm install; npm run dev` (reads root `.env`) | http://localhost:5180 |

- Docker dev mode: after `npm install` (new or changed dependencies) add `-V` (`--renew-anon-volumes`) to the dev command, or the container keeps its old `node_modules` volume.

## Live data (Phases 1–2)

No registration needed: DWD, Overture Maps, OpenStreetMap, BKG, Destatis and USGS Landsat (via Microsoft Planetary Computer) data are open and keyless.

| Dataset | Source | Refresh (worker) | Shown in |
|---|---|---|---|
| Heat and weather warnings, warn cells Mannheim | DWD GeoServer WFS | 10 min | Portal "Today" card, `/api/weather/warnings` |
| MOSMIX point forecast, station 10729 Mannheim | DWD Open Data | 1 h | Portal forecast highs / tonight's low, `/api/weather/forecast` |
| Climate stations within 30 km: daily values + latest 10-min temperature | DWD CDC | 6 h / 20 min | Layer "Weather Stations (DWD)" |
| Hospitals | Overture Maps places (GeoParquet on S3, read with DuckDB) | 7 days (Overture releases monthly) | Layer "Hospitals", Inspector at-risk facilities |
| Drinking-water supply | OpenStreetMap (Overpass, with mirror fallback) | 7 days | Layer "Water Supply", Inspector at-risk facilities |
| Population and mean age, 100 m grid | Destatis Zensus 2022 | once (on demand) | Layer "Population (Zensus 100 m)" |
| Admin units of Germany, all 16 Länder (one table `admin_units`, column `level`): states, Regierungsbezirke, Stadt-/Landkreise, Verwaltungsgemeinschaften, Gemeinden (with population, area) | BKG VG250-EW | once, first on start-up | Layer group "Administrative Units" |
| City districts and quarters in the region | Overture Maps divisions (macrohood, neighborhood; from OSM) | 30 days | Layers "City Districts", "City Quarters" |
| Land surface temperature, summer (Jun–Aug) composites since 2013, ≈ 100 m: median, p05, p95, clear scenes | USGS Landsat 8/9 C2 L2 (ST_B10) via Planetary Computer STAC | 7 days (current summer recomputed; first run imports every summer, ≈ 10–30 min) | Layers "Land Surface Temp (raster)", "Surface Temp" (≈ 300 m grid), "Heat Hazard Class (raster)" (quintiles), Inspector pixel identify |
| 2 m air temperature, summer mean daily maximum, ≈ 1 km cells and isotherms, clipped to Mannheim | modelled: IDW of the DWD stations above (computed by the API) | with the stations | Layers "Air Temp Model", "Air Temp Isotherms" |

- Schedule lives in the database (`ingest_jobs`, runs in `ingest_runs`): restarts keep it; admin units run first; a failed import retries after 15 min; Run now / Pause in `/admin` → Data Pipelines.
- Water Supply = drinking water only: storm-water, overflow and sewage basins are left out (by tags and by name).

First time (existing database volume — `database/init/` only runs on an empty volume):

```powershell
docker compose up -d --build database
Get-Content -Raw database/init/30_live_data.sql | docker compose exec -T database sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
docker compose up -d --build backend worker middleware gateway frontend
docker compose logs -f worker      # first pass imports everything, admin units first, Zensus last (≈ 1–3 min); Ctrl+C to stop following
```

| Task | Command |
|---|---|
| Import status (source, licence, version, last fetch, rows) | `curl.exe -s http://localhost:8180/api/datasets` |
| Pipelines and run log (what `/admin` → Data Pipelines shows) | `curl.exe -s http://localhost:8180/api/pipelines` · `curl.exe -s "http://localhost:8180/api/pipelines/runs?limit=20"` |
| Run imports now | `docker compose exec worker python -m app.ingest dwd-warnings dwd-forecast dwd-latest dwd-stations overture-places osm-water zensus-grid bkg-vg250 overture-divisions landsat-lst` (or `all`) |
| Overture water check (base-theme classes and water-like names in the region) | `docker compose exec worker python -m app.ingest.overture` |
| Admin units from a manual download (BKG server drops the transfer) | download the [VG250-EW Ebenen GeoPackage zip](https://daten.gdz.bkg.bund.de/produkte/vg/vg250-ew_ebenen_1231/aktuell/vg250-ew_12-31.utm32s.gpkg.ebenen.zip), then `docker compose cp <file>.zip worker:/tmp/vg250.zip`; `docker compose exec -e VG250_FILE=/tmp/vg250.zip worker python -m app.ingest bkg-vg250`; `docker compose exec -u root worker rm -f /tmp/vg250.zip` |
| One layer as GeoJSON | `curl.exe -s http://localhost:8180/api/layers/dwd-stations` (also `hospitals`, `water`, `zensus`, `admin-land`, `admin-rbz`, `admin-krs`, `admin-vwg`, `admin-gem`, `admin-osm9`, `admin-osm10`) |
| Admin units as the map loads them (vector tiles) | `/api/layers/admin-gem/attributes` (properties, inner point, bbox, tile `version`) · `/api/layers/admin-gem/tiles/{z}/{x}/{y}.mvt?v=<version>` · `/api/layers/admin-gem/features/<id>` (one unit, whole geometry); any `admin-*` layer |
| Heat layers | `curl.exe -s http://localhost:8180/api/heat/years` · `/api/heat/lst` · `/api/heat/hazard` · `/api/heat/surface-temp` · `/api/heat/air-temp` · `/api/heat/air-temp/isotherms` (`?year=` for an older summer) |
| Portal warning card data | `curl.exe -s http://localhost:8180/api/portal/warning` |
| Worker logs | `docker compose logs --tail 100 worker` |

## Layout

```
.claude/     Claude rules, agents, skills
docs/        architecture, decisions, design system, product scope
frontend/    public/, src/{components,state,data,lib,styles,assets}
middleware/  src/
backend/     app/{routers,schemas,ingest}
database/    init/ (SQL run on first start)
gateway/     nginx.conf
```

## Status

| Item | State |
|---|---|
| GIS workspace screen (layers, map, attribute table, inspector incl. raster pixel identify, feature popups on every vector layer) | Done; live layers: Hospitals, Water Supply, Weather Stations (DWD), Population (Zensus), Administrative Units (BKG + Overture), Surface Temp, Air Temp Model, LST and Heat Hazard rasters (Landsat, DWD); Urban Blocks, Sealing, measures MOCK |
| Live data Phase 1: worker imports (DWD warnings, MOSMIX, stations; OSM facilities; Zensus grid; admin units of Germany) + `/api/datasets`, `/api/layers/*`, `/api/weather/*`, `/api/portal/warning` | Done (README → Live data) |
| Live data Phase 2: Landsat LST summer composites (worker `landsat-lst`, `lst_composites`), `/api/heat/*` (LST and hazard rasters, surface-temp grid, air temperature from DWD stations) | Done (README → Live data) |
| Notifications (bell: jobs finished/failed, measure changes; unread badge, opens the job or measure) | Done, from MOCK job runner and local measures |
| Data attribution (map credit tiles, report footer, portal sources and licences, admin catalog/pipelines) | Done; credits name the real providers of the datasets the MOCK layers stand for |
| Copilot panel (plan, tool steps, result, composer) | UI done, MOCK conversation; copilot API planned |
| Geoprocessing panel → tool form (right panel: inputs, parameters, extent, output path, Run), Jobs History dock tab + logs, map scale bar | UI done, MOCK tools and simulated jobs; process/job API planned |
| Scenarios workspace (editor, ranking with rank stability, priority map + swipe compare, charts tab) | UI done, ranking computed in browser from MOCK blocks; scenarios/ranking API planned |
| Layers panel (per-layer legend, table, zoom, toggles, layer order overlay with drag restacking) + Symbology panel: Style (incl. rule-based), Label, Query (builder + SQL subset), 3D (extrusion per layer, DEM terrain) tabs; saved per layer | UI done, MOCK vector and raster layers; queries run in the browser until the API exists |
| Measures register (list + filters, add form with draw (snap-close, corner editing) or GeoJSON/Shapefile upload, footprints + buffers on map, Effect panel with status change + timestamped status history + delete (soft: archived as Deprecated, confirmed in a modal), before/after + DiD chart, dock Summary + CSV/PDF reporting export) | UI done, MOCK register and effects; measures API planned (`docs/decisions.md` Open) |
| Report Builder (Reports view: outline with drag reorder, A4 preview with zoom, section properties, map capture, EN/DE page text, templates, rich text, per-language texts with machine translation via `POST /api/translate`; Export PDF via print, DOCX, share link) | UI done, MOCK indicators; saved in the browser; translation live (LibreTranslate); reports API planned (`docs/decisions.md` Open) |
| Public Heat Portal `/portal` (EN/DE, mobile bottom sheet, address search, DWD warning card, area result with quantile dot plot, cool places with walking time, value-suppressing heat layer, 10-min walk isochrone) | UI done; DWD warning card live (`/api/portal/warning`), isochrone live (Mapbox); places and confidence MOCK |
| Admin console `/admin` (Overview KPIs + pipeline timeline + alerts, Data Pipelines with run/pause/logs + run history (live: worker jobs, `/api/pipelines`), STAC catalog, Regions onboarding, Users & Roles + permission matrix, Copilot usage/cost/eval, System Health, Audit Log, log dock) | UI done; Data Pipelines, pipeline KPIs, timeline and failure alerts live; System Health live; the rest MOCK; ops API planned (`docs/decisions.md` Open) |
| Sign-in (`/signin`, split screen, EN/DE, inline validation, show password, remember me, error banner) + middleware sessions + gateway Admin-role guard on `/admin` | Done with MOCK users from `.env` (`ADMIN_*`, `PLANNER_*`); Keycloak planned (`docs/decisions.md` Open) |
| Forgot / update password, email verification, municipality SSO button, Account settings (`/account`: profile, language & theme, active sessions, API tokens) | UI done; sessions live, the rest MOCK until Keycloak |
| Responsive scale (root font size per screen class, rem everywhere, compact portrait-tablet view; portal ≥ 16 px; report pages fixed A4) | Done |
| Backend health + database extensions check | Done |
| Vector tiles for the admin units (`ST_AsMVT`, decision 63) | Done; other layers stay GeoJSON |
| Keycloak, Celery workers, raster tiles, copilot API | Planned (`docs/architecture.md`) |

## Docs

[Architecture](docs/architecture.md) · [Decisions](docs/decisions.md) · [Design system](docs/design-system.md) · [Product scope](docs/product-scope.md)
