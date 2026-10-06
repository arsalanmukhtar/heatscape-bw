-- Phase 1 live data (open data, refreshed by the worker: backend/app/ingest).
-- Idempotent: runs on first start with an empty volume, and can be re-applied to an
-- existing database (README → Live data).

-- Every imported dataset: source, licence, version and when it was fetched.
CREATE TABLE IF NOT EXISTS datasets (
  id          text PRIMARY KEY,
  title       text NOT NULL,
  source      text NOT NULL,
  url         text NOT NULL,
  licence     text NOT NULL,
  attribution text NOT NULL,      -- provider key in frontend/src/lib/attribution.js
  version     text,               -- provider's issue time or file date
  fetched_at  timestamptz,
  rows        integer,
  status      text NOT NULL DEFAULT 'never',  -- ok | failed | never
  message     text
);

-- DWD weather warnings (CAP) for the region's warn cells; replaced on every fetch.
CREATE TABLE IF NOT EXISTS dwd_warnings (
  identifier  text PRIMARY KEY,
  warncell_id bigint NOT NULL,
  area        text,
  event       text NOT NULL,
  ec_ii       integer,            -- event code: 247 strong heat, 248 extreme heat
  severity    text,
  headline    text,
  description text,
  instruction text,
  onset       timestamptz,
  expires     timestamptz,
  sent        timestamptz
);

-- DWD MOSMIX_L point forecast (hourly steps), temperatures in °C.
CREATE TABLE IF NOT EXISTS dwd_forecast (
  station_id  text NOT NULL,
  step        timestamptz NOT NULL,
  t2m         real,               -- 2 m air temperature
  tmax12      real,               -- max of the past 12 h (at 06/18 UTC steps)
  tmin12      real,               -- min of the past 12 h
  PRIMARY KEY (station_id, step)
);

-- DWD climate stations around the region (CDC).
CREATE TABLE IF NOT EXISTS dwd_stations (
  id          text PRIMARY KEY,   -- 5-digit station id
  name        text NOT NULL,
  state       text,
  elevation_m real,
  data_from   date,
  data_to     date,
  geom        geometry(Point, 4326) NOT NULL
);
CREATE INDEX IF NOT EXISTS dwd_stations_geom ON dwd_stations USING gist (geom);

-- Daily climate values (KL, recent ≈ last 500 days), °C and mm.
CREATE TABLE IF NOT EXISTS dwd_daily (
  station_id  text NOT NULL REFERENCES dwd_stations (id) ON DELETE CASCADE,
  day         date NOT NULL,
  tmean       real,
  tmax        real,
  tmin        real,
  precip      real,
  PRIMARY KEY (station_id, day)
);

-- Latest 10-minute air temperature per station.
CREATE TABLE IF NOT EXISTS dwd_latest (
  station_id  text PRIMARY KEY REFERENCES dwd_stations (id) ON DELETE CASCADE,
  observed_at timestamptz NOT NULL,
  t2m         real,
  humidity    real
);

-- OpenStreetMap facilities (hospitals, drinking-water supply); replaced per kind.
CREATE TABLE IF NOT EXISTS osm_facilities (
  osm_id      text PRIMARY KEY,   -- n123 | w123 | r123
  kind        text NOT NULL,      -- hospital | water
  subtype     text,               -- e.g. water_works, pumping_station
  name        text,
  operator    text,
  beds        integer,
  emergency   text,
  geom        geometry(Point, 4326) NOT NULL
);
CREATE INDEX IF NOT EXISTS osm_facilities_geom ON osm_facilities USING gist (geom);
CREATE INDEX IF NOT EXISTS osm_facilities_kind ON osm_facilities (kind);

-- Zensus 2022 100 m grid cells in the region (population, mean age). Counts are perturbed
-- by Destatis (secrecy); never show vulnerability below aggregated levels publicly.
CREATE TABLE IF NOT EXISTS zensus_grid (
  grid_id     text PRIMARY KEY,   -- CRS3035RES100mN…E…
  population  integer,
  mean_age    real,
  geom        geometry(Polygon, 4326) NOT NULL
);
CREATE INDEX IF NOT EXISTS zensus_grid_geom ON zensus_grid USING gist (geom);

-- Administrative units: BKG VG250-EW for Baden-Württemberg (land, rbz, krs, vwg, gem) and
-- OSM city districts / quarters in the region (osm9, osm10). Replaced per source.
CREATE TABLE IF NOT EXISTS admin_units (
  id          text PRIMARY KEY,   -- <level>:<ARS> (BKG) | <level>:r<relation id> (OSM)
  level       text NOT NULL,      -- land | rbz | krs | vwg | gem | osm9 | osm10
  ars         text,               -- Amtlicher Regionalschlüssel
  ags         text,               -- Amtlicher Gemeindeschlüssel
  name        text NOT NULL,
  type        text,               -- BKG BEZ (Stadt, Gemeinde, Landkreis …) or Stadtbezirk / Stadtteil
  population  integer,            -- BKG EWZ (31 Dec of the edition year); OSM population tag
  area_km2    real,
  nuts        text,
  district    text,               -- containing Kreis (gem, vwg) or municipality (OSM levels)
  region      text,               -- containing Regierungsbezirk
  geom        geometry(MultiPolygon, 4326) NOT NULL
);
CREATE INDEX IF NOT EXISTS admin_units_geom ON admin_units USING gist (geom);
CREATE INDEX IF NOT EXISTS admin_units_level ON admin_units (level);
