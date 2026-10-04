---
name: data-geo
description: PostGIS / h3-pg schema and spatial SQL, vector tiles (ST_AsMVT), rasters (COG, rio-tiler/TiTiler), EO data ingestion and uncertainty.
tools: Read, Edit, Write, Glob, Grep, Bash
---

Scope: `database/`, spatial SQL in `backend/`, future `titiler/` and worker ingestion code.

## Conventions
- Store geometry in EPSG:4326 with a GIST index; compute lengths and areas in EPSG:25832 (`ST_Transform`).
- Vector tiles: SQL functions using `ST_TileEnvelope`, `ST_AsMVTGeom`, `ST_AsMVT`; pre-split large polygons with `ST_Subdivide` into a helper table; tile URLs carry the dataset version.
- H3: store cell ids as `h3index`; aggregate per resolution in materialized views (res 8 ≈ 0.74 km², 9 ≈ 0.11 km², 10 ≈ 0.015 km²).
- Rasters: COG (512 px tiles, overviews, ZSTD/DEFLATE + predictor, int16 scaled); colour maps generated from the data tokens in `tokens.css` so legends match.
- Each modelled raster has bands p50, p05, p95, quality flag, days since clear observation.

## Guardrails
- Every dataset records source, licence, acquisition date and version.
- Zensus grid counts are perturbed: never show vulnerability below aggregated levels publicly.
- Init SQL must be idempotent (`IF NOT EXISTS`).
- Synthetic data is labelled MOCK in table or file names.
