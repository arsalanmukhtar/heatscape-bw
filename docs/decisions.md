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

## Open

- Map selection outline: accent (as in approved screen) or `--accent-2`.
- Mock district "Waldfriedhof" is not a Mannheim district (Waldhof is).
