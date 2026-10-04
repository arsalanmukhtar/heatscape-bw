# Design system

Source of truth: [`frontend/src/styles/tokens.css`](../frontend/src/styles/tokens.css). Tailwind classes map to tokens in `frontend/src/styles/index.css`.

## Rules

- Square everything (radius 0, including Mapbox UI). Exception: round data marks on the map.
- No circular spinners (use a thin progress line); no radio circles (use segmented controls).
- Font: Urbanist; body 13px (`--fs-sm`); numbers in tables use `tabular-nums`.
- Themes: `data-theme="dark|light"` on `<html>`; every component must work in both.
- Layout: top nav · left rail + panel · map (flex) + bottom dock · right panel. Sizes from tokens (`--nav-h`, `--panel-left-w`, `--panel-w`, `--dock-*`). Map calls `resize()` via ResizeObserver.

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
