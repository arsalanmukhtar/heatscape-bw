---
name: implement-screen
description: Build a UI screen or panel from a screenshot or generated template the user provides.
---

1. Map the image onto the shell (nav, rails, panels, map, dock). Reuse existing components; add only what is new. Snapshots are references, not overrides: build only the new parts (panels, docks, tabs, views) and plug them into the shell. Never change the existing layout or established choices (top nav, rail, map controls, region, earlier user tweaks) because a snapshot differs.
2. Check `docs/decisions.md` "UI overrides": anything listed there stays as listed even if the snapshot shows it otherwise. When the user removes or changes an element, add a line there in the same edit.
3. List conflicts with `docs/design-system.md` (rounded corners, raw colours, accent on map, rainbow ramps, sample-data mistakes) and resolve them in favour of the design system. Report each deviation in one line.
4. Implement per `agents/frontend.md`: strings in `i18n.js`, data in `data/mock.js` (MOCK) until an endpoint exists, tokens only.
5. If the screen needs data the backend lacks, propose the endpoint (do not build it unasked).
6. Update the README status table.
7. Finish with `test-handoff` (both themes, panel/dock collapse, narrow width).
