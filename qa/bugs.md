# Busk Map bug log (QA)

Severity: **High** blocks a judge path, leaks money or data, or breaks a rule. **Medium**: a judge would notice something wrong or misleading. **Low**: polish, offline-only, or minor a11y.

| ID | Sev | Title | Status |
|---|---|---|---|
| B-001 | High | Playwright could reuse a live server and call paid APIs | Fixed (e3b85fb), verified by QA |
| B-002 | Medium | Plan doesn't say why higher-scored spots aren't in the top 3 (250 m spacing) | Fixed (4161a9f), verified by QA |
| B-003 | Low | Offline own act: picking a searched artist fails with a generic form error | Fixed (cdecbb7), verified by QA |
| B-004 | Medium | Landing search comboboxes: `aria-expanded="true"` and `aria-controls` points at a missing listbox (axe critical) | Fixed (491f506), verified by QA; pre-hydration leftover in B-011 |
| B-005 | Low | Artist and song search inputs show no focus ring | Fixed (2559a05), verified by QA |
| B-006 | Low | Select values are blank in the server HTML until hydration | Fixed (54d3217), verified by QA |
| B-007 | Low | Offline: "Explanations: Claude" chip and credit while the mock model wrote them | Fixed (270c877), verified by QA; other offline Claude text in B-010 |
| B-008 | Low | e2e guard is skipped whenever `PLAYWRIGHT_BASE_URL` is set, even to a localhost live server | Fixed (70eb77e), verified by QA; residual hosts in B-009 |
| B-009 | Low | e2e guard treats this machine's other addresses (0.0.0.0, 127.0.0.2, LAN IP, .local) as a deploy | Open |
| B-010 | Low | Offline: steps, Agent vs engine and pitch cards still say Claude wrote them | Open |
| B-011 | Low | Landing search comboboxes say `aria-expanded="true"` in the server HTML until hydration | Open |

---

### B-001 · High · Playwright could reuse a live server and call paid APIs
- **Found:** baseline, 16 Oct 2026, by reading `playwright.config.ts`.
- **Steps:** with a live server (no `BUSKMAP_OFFLINE`) on the e2e port, for example `PORT=3200 pnpm test:e2e` while the user's `next dev` runs on 3200.
- **Expected:** the run refuses, or starts its own offline server.
- **Actual (before the fix):** `reuseExistingServer: !process.env.CI` reused it, so the specs drove real Claude, Qloo and Ticketmaster calls.
- **Status:** fixed by DEV in e3b85fb (`tests/e2e/global-setup.ts` checks `GET /api/health` for `offline: true`). **Verified by QA:** `PORT=3200 pnpm exec playwright test tests/e2e/health.spec.ts` aborted in global setup with "e2e aborted: the server on port 3200 is not in offline mode", before any spec ran. Against a deploy (`PLAYWRIGHT_BASE_URL`) it only warns, which is deliberate.

### B-002 · Medium · Plan doesn't say why higher-scored spots aren't in the top 3
- **Steps:** open the acoustic example (offline). Scroll to "Busk Map vs a plain AI".
- **Expected:** if a pitch with a higher score is left out of the top 3, the plan says why (`hotspot-policy`: "the score decides").
- **Actual:** the top 3 are Centre Place 77, Flinders Lane east 74, Alfred Place 60. The plain-AI panel says Busk Map scores Federation Square 65 and Flinders Street Station 63 "higher than one of Busk Map's picks: worth a look". The cause is `pickTopPitches(…, minSpacingM = 250)` in `src/server/scoring/pitch-score.ts`: Federation Square is about 190 m from Flinders Lane east. "How pitches are scored" never mentions the spacing rule, so a judge sees a ranking that contradicts its own scores.
- **Suggestion (DEV/user decide):** one line in "How pitches are scored" and on the plain-AI row ("within 250 m of pick no. 2, so not listed separately").

### B-003 · Low · Offline own act: picking a searched artist fails with a generic form error
- **Steps:** offline server, landing → "Or plan for your own act": type an act name, search "Buena Vista" in "Artists you sound like", pick "Buena Vista (synthetic)", add songs, press "Plan my set".
- **Expected:** a plan opens on `/p/<id>`.
- **Actual:** "Check the form and try again." and no request is sent. The synthetic fixture gives the artist the id `syn-artist-1` (`src/server/adapters/repertoire/fixtures/synthetic.ts`), which fails `spotifyIdSchema` (22 base62 characters) in `src/lib/plan-schema.ts`. Live Spotify ids are 22 characters, so this is offline only. The generic message also names no field, so any other schema failure would leave a user stuck too.
- **Regression test:** `tests/e2e/qa/baseline.spec.ts` "B-003" (marked `test.fail` until fixed).

### B-004 · Medium · Landing search comboboxes have broken ARIA (axe critical)
- **Steps:** axe-core 4.14 (WCAG 2.0–2.2 A/AA tags) on `/`, desktop and Pixel 7.
- **Expected:** 0 violations.
- **Actual:** `aria-valid-attr-value` (critical) on both cmdk inputs ("Search Spotify, e.g. Paul Kelly" and "Search songs, e.g. Riptide"): `aria-expanded="true"` while no list is shown, and `aria-controls` points at an id that isn't in the DOM. A screen reader announces an open list that doesn't exist. Every other page scanned had 0 violations.

### B-005 · Low · Artist and song search inputs show no focus ring
- **Steps:** on `/`, Tab to "Search Spotify, e.g. Paul Kelly", then to "Search songs, e.g. Riptide".
- **Expected:** a visible focus indicator like every other control (WCAG 2.4.7).
- **Actual:** only the text caret shows; neither the input nor its wrapper gets an outline or ring. All 57 other focus stops on `/`, and all 88 on the example plans, have one.

### B-006 · Low · Select values are blank in the server HTML until hydration
- **Steps:** `curl` `/` and `/week?example=folk-duo`, or load them on a slow phone.
- **Expected:** "6 pm", "9 pm", "General", "5", "1" in the select triggers on first paint.
- **Actual:** `<span data-slot="select-value"></span>` is empty in the server HTML. The landing From/To/Permit and the week's "Sessions this week"/"Per day" show empty boxes until JavaScript runs (seen for about 3 s in the walk).

### B-007 · Low · Offline: "Explanations: Claude" while the mock model wrote them
- **Steps:** any plan on the offline server.
- **Expected:** the header chip and the "Data sources" credit say the explanations are mock or test output (as the Qloo and Spotify labels do).
- **Actual:** the chip says "Explanations: Claude" and the credit says "Plan explanations written by Claude (Anthropic) via Vercel AI Gateway". The plan text itself does say "Mock planner summary (offline test mode)". Offline only, but this is the case the learning "never leave a test-mode server running" warns about.

### B-008 · Low · e2e guard is skipped whenever `PLAYWRIGHT_BASE_URL` is set
- **Found:** retest of e3b85fb ("try to make it leak"), by reading `tests/e2e/global-setup.ts`. Not run, because running it would spend money.
- **Steps:** `PLAYWRIGHT_BASE_URL=http://localhost:3200 pnpm test:e2e` while the user's live dev server runs on 3200.
- **Expected:** a localhost base URL is checked like the reused-server case (`/api/health` must report `offline: true`), or needs an explicit opt-in.
- **Actual:** global setup only warns and returns. `LOCAL` is false, so the mock and fault specs skip, but the example, own-act and short-link specs run against the live server and can start real agent runs on uncached plans. It takes a deliberate env var, so the severity is Low. Suggest: apply the health check whenever the base URL host is localhost/127.0.0.1, or require `BUSKMAP_E2E_LIVE=1` to run against a non-offline target.
- **Everything else tried held:** `/api/health` is dynamic, not prerendered, so a server started without `BUSKMAP_ALLOW_FAULTS` from a faults-on build reported `faults: false`. A live server can't inherit `offline: true` from an offline build. A server without the route (older build, production) gives 404, and the run aborts. `VERCEL_ENV=production` forces `offline: false`, and the run aborts. Guard verified to abort against live :3200 (see B-001).

### B-009 · Low · e2e guard treats this machine's other addresses as a deploy
- **Found:** retest of 70eb77e. `guardMode()` from `tests/e2e/guard.ts` was evaluated directly for each URL with `external: true`; Playwright was not run against a live server.
- **Steps:** `PLAYWRIGHT_BASE_URL=http://192.168.1.101:3200 pnpm test:e2e` (the "Network:" URL that `next dev` prints), or the same with `0.0.0.0`, `127.0.0.2` or `<machine>.local`.
- **Expected:** the health check runs, because these are all this machine.
- **Actual:** `localhost`, `127.0.0.1` and `[::1]` give `check`, but `0.0.0.0`, `127.0.0.2`, `192.168.1.101` and `t04435-mbp.local` give `warn`. In those cases the non-mock specs run against the live dev server.
- **Suggestion:** call `/api/health` for every target, and when it isn't `offline: true`, require an explicit opt-in (E2E_ALLOW_LIVE=1, or a deploy flag) instead of deciding by hostname.

### B-010 · Low · Offline: steps, "Agent vs engine" and pitch cards still credit Claude
- **Found:** retest of 270c877, as DEV flagged.
- **Steps:** offline server, `/plan?example=acoustic`.
- **Expected:** with the mock model, nothing says Claude wrote the text.
- **Actual:** the chip and credit are fixed, but the page still shows "Claude kept the engine's top 3.", every step's "Claude: …" prefix (for example "Claude: I'll start with the taste map…"), and "Explained by Claude" on each pitch card. This is offline only. It matters because a test-mode server left running reads as a real Claude run.

### B-011 · Low · Search comboboxes say expanded in the server HTML
- **Found:** retest of 491f506 (a leftover DEV already knows about).
- **Steps:** `curl /` and look at the two `role="combobox"` inputs.
- **Expected:** `aria-expanded="false"` from the first paint.
- **Actual:** both inputs have `aria-expanded="true"` until hydration. After hydration, axe finds 0 violations on `/`. Only screen-reader users who arrive before the JavaScript loads are affected.
