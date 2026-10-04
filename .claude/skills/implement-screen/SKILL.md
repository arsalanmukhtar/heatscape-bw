---
name: implement-screen
description: Build a UI screen or panel from a screenshot or generated template the user provides.
---

1. Map the image onto the shell (nav, rails, panels, map, dock). Reuse existing components; add only what is new. Snapshots are references, not overrides: integrate only the new part and keep established app choices (top nav, map controls, rail style, region, earlier user tweaks) over the snapshot.
2. List conflicts with `docs/design-system.md` (rounded corners, raw colours, accent on map, rainbow ramps, sample-data mistakes) and resolve them in favour of the design system. Report each deviation in one line.
3. Implement per `agents/frontend.md`: strings in `i18n.js`, data in `data/mock.js` (MOCK) until an endpoint exists, tokens only.
4. If the screen needs data the backend lacks, propose the endpoint (do not build it unasked).
5. Update the README status table.
6. Finish with `test-handoff` (both themes, panel/dock collapse, narrow width).
