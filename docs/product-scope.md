# Product scope

HEATSCAPE-BW: urban heat and land-sealing intelligence for Baden-Württemberg (proposal: physics-informed AI + multisensor EO, 36 months).

## Users and jobs

| User | Job |
|---|---|
| City planning / climate office | Prioritise de-sealing and greening; check development plans |
| Health office | Heat action plan: vulnerable residents, cool places |
| Regional association | Protect cold-air source areas and corridors |
| State (LUBW, ministries) | Comparable indicators across BW |
| Public | Heat in my area, nearest cool place |
| Market (consultancies, real estate, insurers) | Site-level heat risk, climate opinions |

## Core features

1. GIS workspace: layers, inspector, attribute table, swipe compare, timeline.
2. Geoprocessing: zonal stats, raster calculator, exceedance probability, isochrones, H3 aggregation, downscaling (baseline → PhD model).
3. Copilot: plan → approve → execute; spatial and non-spatial SQL, process calls; results with intervals and provenance.
4. Indicators: heat exposure, vulnerability, green-space access, sealing change, cold-air proxy.
5. Scenarios: weighted ranking with rank stability; indicative cooling estimates.
6. Measures register: record measures, measure effect before/after vs control.
7. Reports (PDF) and OGC services for partner GIS.
8. Public heat portal.

## Uncertainty

Stored: p05/p50/p95, quality flag, days since clear observation, validation error per class. Shown as: exceedance probability, value-suppressing palette, hatching, lower/median/upper toggle, interval bands, rank stability, calibrated wording (likely = 66–100 %, very likely = 90–100 %).

## Data sources

Landsat 8/9 ST, Sentinel-2/3, ECOSTRESS, DWD/LUBW stations, Zensus 2022 (100 m), LGL orthophotos/LoD2/DGM, Copernicus HRL, OSM, partner Klimaatlas.

## Out of scope

Forecasting (except DWD warnings), hourly gridded maps, real-time gridded data.
