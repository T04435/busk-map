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
| B-009 | Low | e2e guard treats this machine's other addresses (0.0.0.0, 127.0.0.2, LAN IP, .local) as a deploy | Fixed (e42ab30), verified by QA |
| B-010 | Low | Offline: steps, Agent vs engine and pitch cards still say Claude wrote them | Fixed (222cf92), verified by QA |
| B-011 | Low | Landing search comboboxes say `aria-expanded="true"` in the server HTML until hydration | Fixed (868c371), verified by QA |
| B-012 | Low | Flaky e2e: example-card test reads the plan stream body after navigating | Fixed (1950bd2), verified by QA |
| B-013 | Low | Fresh-run limit message gives the retry time in Melbourne time with no zone | Fixed (4b6237b), verified by QA |
| B-014 | Low | docs/qloo-data-map.md still calls the week-prefetch comment "about 47 Qloo calls" | Fixed (b88e174), verified by QA |
| B-015 | Medium | /brain: the sticky trace panel hides the focused node while tabbing (WCAG 2.2 AA 2.4.11) | Fixed (2b26dc5), verified by QA |
| B-016 | Low | /repertoire: after Remove, keyboard focus falls to <body> | Fixed (1b00ab4), verified by QA |
| B-017 | Low | /week loading state: `aria-label` on a role-less div (axe serious, aria-prohibited-attr) | Fixed (1b5a4e5), verified by QA |
| B-018 | Medium | Honeycomb landing: hero "Plan a busk" CTA has no visible focus indicator (WCAG 2.4.7) | Fixed (d169cb4), verified by QA on 91b220e |
| B-019 | Medium | Honeycomb landing: "Honeycomb" brand teaser section missing | Fixed (9ef8b9a, user call), verified in Landing · review v4 at 7b1521e |
| B-020 | Medium | Honeycomb landing: "What you get back" lacks research funnel, taste map, Learn these, set length | Fixed (91b220e) with declared deviations, verified by QA; differences in B-033, B-034 |
| B-021 | Low | Honeycomb landing: hero map without zone/event/river; no glowing cells; caption reworded | Glow and caption fixed (774a87f), verified; zone/event/river held for the user (L05) |
| B-022 | Low | Honeycomb landing: act cards lack day/hours and "Plays …" lines | Fixed (ac950fd), verified; other card differences in B-032 |
| B-023 | Low | Honeycomb landing: footer Brand link (removed by decision 121); paper not dark band | Fixed (514d36a), verified by QA |
| B-024 | Low | Honeycomb landing: Brain teaser 4th number "parts of your plan" | Fixed (e2e3240), verified by QA |
| B-025 | Low | Honeycomb landing: H1 orphans "PLAY." at 1440 | Fixed (29695f7), verified by QA |
| B-026 | Low | "For judges" link from decision 104 never designed | Open (BRAND/MANAGER) |
| B-027 | Medium | /repertoire learn feed: tool names, raw UUIDs and finish_suggestions JSON in the default view; oldest first; stays above the list; 10-count grid, not the funnel | Fixed (373ea1c, 524456e, 43343f6), verified by QA (functional) on df3c80c |
| B-028 | Low | /repertoire Qloo down: no "Your songs are safe." and nothing says the run did not count | Fixed (9d374f5), verified by QA (functional + qa/unit) on df3c80c |
| B-029 | Low | /repertoire nothing new: copy says everything was suggested before while the run shows songs checked 0, suggested before 0; no left-out count or next-step hint | Fixed (f15688f), verified by QA on df3c80c |
| B-030 | Low | /repertoire Learn list: older runs do not fold | Deferred to R6 (3034133 reverted in 524456e; absent, checked) |
| B-031 | Low | /repertoire Learn list: no filter chips (All · New · To learn · Learned · Not for me) | Deferred to R6 (dc7c09f reverted in 524456e; absent, checked) |
| B-032 | Low | Honeycomb landing L13: act cards: filled orange initials hex reading "SA" (board: outline, "SX"); action is a plain dark row, not the orange underlined link; Plays lists differ from the board | Accepted by the user (kept as built; reverted in 8b6a21e) |
| B-033 | Low | Honeycomb landing L17: research funnel labels under the hexes, dashes instead of ▸ chevrons, boxed in a card | Fixed (2d8dc86, d74ccd2), verified in v4 at 7b1521e |
| B-034 | Low | Honeycomb landing L20: setlist panel marked built but Learn these is a tan panel (board: bordered box, orange top rule, mono title); set-length line sans; rows 1–4 not 01–04; heading names the pitch; no Copy | Fixed (4b9bff1, fe89b0e), verified in v4 at 7b1521e |
| B-035 | High | design/honeycomb 4b9bff1 doesn't build from a clean export: setlist-panel.tsx imports components/setlist/copy-set-button, which was never committed (untracked in DEV's worktree) | Fixed (fe89b0e), verified: 7b1521e builds from a clean export |
| B-036 | Low | Honeycomb /busks B07: after a song is picked the search results stay open under the field until the query is cleared | Open (design/honeycomb) |
| B-037 | Low | Honeycomb /busks B08: picks list has no “Your picks · N songs · total time” header | Open (design/honeycomb) |
| B-038 | Low | Honeycomb /busks B06: the artists hint “N of 10. Type a comma to add a name that isn't on Spotify.” is missing | Open (design/honeycomb) |
| B-039 | Low | Honeycomb /busks B12: no “Up to 6 hours” hint under To | Open (design/honeycomb) |
| B-040 | Low | Honeycomb /busks B09: Spotify artist link has no visible label; “(optional)” lives in the placeholder (WCAG 3.3.2) | Open (design/honeycomb; F26 reshapes it) |
| B-041 | Low | Honeycomb /busks B11/B14: a focused choice card shows a 2 px dark outline flush on its 2 px dark border, barely visible on the selected card | Open (design/honeycomb) |
| B-042 | Low | Honeycomb /busks B07 at 390: the “By your artist” badge and the time squeeze the song title in the results to one letter | Open (design/honeycomb) |
| B-043 | Medium | Honeycomb plan P17: Qloo down shows only an alert; no “No plan without taste data” panel and no Try again (board) | Open (design/honeycomb; Try again vs HQ default 8 is the user's call) |
| B-044 | Medium | Honeycomb plan P19: no legal pitch has no recovery actions (board: Plan with a general permit · Try another day) | Open (design/honeycomb) |
| B-045 | Low | Honeycomb plan P18: no artist matched stacks three alerts and has no “Pick your artists from Spotify” action | Open (design/honeycomb) |
| B-046 | Low | Honeycomb plan P20: a source down shows only a chip; no alert saying what is estimated | Open (design/honeycomb) |
| B-047 | Low | Honeycomb plan P06: weather shows only the slot's hours; no hours either side, slot bracket or updated line | Open (design/honeycomb) |
| B-048 | Low | Honeycomb plan: at 1440 the heading outline skips h1 → h3 (the h2 is hidden when wide) | Open (design/honeycomb) |
| B-049 | Low | Honeycomb plan P15/P18: fallback copy says “agent” and “engine” where the board says Claude and Busk Map's scores | Open (design/honeycomb) |
| B-050 | Medium | Honeycomb plan P24: “Your busk” starts 871 px down at 390 (987 px at 1440): header stack, chips and funnel push the payoff below the fold | Open (design/honeycomb) |
| B-051 | Low | Honeycomb plan P02/P03: the plan page keeps the boxed funnel and full-width Agent vs engine rows, unlike the board | Open (design/honeycomb) |
| B-052 | Low | Honeycomb /brain BR08: the Pick any piece panel lost the board's two “Try …” prompts (Setlist and learn these; Taste heatmap); one run-on sentence instead | Open (design/honeycomb) |

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

### B-012 · Low · Flaky e2e: example-card test reads the plan stream after navigating
- **Found:** fix round 3 (dev/core at 7126c07), full offline e2e with `CI=1` (1 retry).
- **Test:** `tests/e2e/short-links.spec.ts:7` "an example card is inputs only…" (DEV's). It failed once on mobile, then passed on retry: "response.text: Protocol error (Network.getResponseBody): No data found for resource with given identifier".
- **Cause (likely):** the spec reads the `/api/plan` response body after `page.goto("/")` for the second click and after the page has moved on. Chrome drops the body of a streamed response from a page it has left. This is test-only; the app is fine.
- **Suggestion:** read the stream with `request.post` (as the totals test does), or collect the body via `response.body()` before navigating.

### B-013 · Low · Fresh-run limit message gives the retry time in Melbourne time with no zone
- **Found:** code read of `freshRunGate` (`src/server/rate-limit.ts`, e83a94c). Not testable offline, because offline mode is exempt from the limit.
- **Steps:** live, start a 6th fresh plan within an hour from one IP, from outside Melbourne (for example a judge in New York).
- **Expected:** the retry time in the viewer's time zone, or labelled with its zone.
- **Actual:** "…or try again at 3:15 pm." The time is formatted with the plan city's time zone (Australia/Melbourne) and no zone label, so a New York judge reads the wrong hour.
- **Also:** no e2e covers the throttled page, because offline is exempt. Suggest a fault switch (for example `faults=fresh-limit`, honoured only with BUSKMAP_ALLOW_FAULTS) so the 429 UI can be tested offline.

### QA miss (not a bug ID): cut-off placeholder at 390 px
DEV found and fixed it (8afd14d): at 390 px the landing's "Your Spotify artist link (optional)" placeholder was cut off. QA's baseline phone screenshot (375 px) showed "Your Spotify artist link (opt…", but QA didn't file it. QA's layout spec now fails on any placeholder wider than its field (a canvas text measure against the field's content box). The check was proven on a deliberately cut-off field and passes on dev/core 5c6fdfd at 390, 768 and 1440.

### B-014 · Low · Qloo data map doc is stale about the week-prefetch comment
- **Found:** /brain retest (dev/core f9edb1a), checking the facts strip against `docs/qloo-data-map.md`.
- **Actual:** §4 says a comment in `plan-view.tsx` reads "about 47 Qloo calls" and calls it "uncertain, likely stale". 54b1ae3 already changed it to "about N+2 Qloo calls" (`plan-view.tsx:287`).
- **Expected:** the doc describes the current comment, or drops the note.
- The facts strip itself matches the doc and `qloo-map.ts`: 11 kinds, 24–33 calls per new busk, 0 on a rerun, 10,000 a month at 5 a second paced to 3, and 9 parts.

### B-015 · Medium · /brain: the sticky trace panel hides the focused node (WCAG 2.2 AA 2.4.11)
- **Found:** /brain retest (dev/core f9edb1a), `tests/e2e/qa/brain.spec.ts` at 390, 768 and 1440 px, confirmed with screenshots.
- **Steps:** open `/brain`, trace "Setlist and learn these" (click or Enter), then press Tab through the pieces.
- **Expected:** every focused piece stays at least partly visible (2.4.11 Focus Not Obscured (Minimum), AA in WCAG 2.2).
- **Actual:** the browser scrolls each newly focused piece to the bottom edge of the viewport, where the trace panel (`sticky bottom-0`, up to 45vh) sits on top of it. At 390 px, 20 Tab stops landed on fully hidden pieces (c5, c6, Spotify, d_crowd, d_pitchaff, d_trend, f_setlist and others); at 1440, c4 onwards. At 1440 the open panel also covers about half the wiring.
- **Suggestion:** while a trace is open, set `scroll-padding-bottom` on the page (or the scroll container) to the panel's height, so focus scrolling clears it. Or make the panel non-sticky at narrow widths, or scroll the focused piece to the centre on focus.
- **Regression test:** marked `test.fail` in `tests/e2e/qa/brain.spec.ts` until it's fixed.

### B-016 · Low · /repertoire: after Remove, keyboard focus falls to `<body>`
- **Found:** Repertoire R1 retest (dev/core cbda583), `tests/e2e/qa/repertoire.spec.ts` at 390, 768 and 1440.
- **Steps:** on `/repertoire`, add three songs, Tab to "Remove Scar", press Enter.
- **Expected:** focus stays in context: the next song's Remove button, the previous one, or the list heading when it's the last song (WCAG 2.4.3 focus order). The status line already says "Removed Scar.".
- **Actual:** the removed row's button goes away and `document.activeElement` is `<body>`, for any song, not just the last one. Keyboard and screen-reader users have to Tab again from the top of the page. "Move to Songs you can sing" removes its own button the same way, so it likely has the same problem (not separately tested).
- **Regression test:** the 2 specs in `tests/e2e/qa/repertoire.spec.ts` are marked `test.fail` until it's fixed.

### B-017 · Low · /week loading state: `aria-label` on a role-less div
- **Found:** Repertoire R2 retest (dev/core 8e4cd0d), with axe run straight after navigation. It's there since b4035c2 (15 Oct, the first week planner), not from R2; QA's earlier scans always waited for the loaded week.
- **Steps:** open `/week?example=folk-duo` and run axe before "Top sessions" renders (offline it shows for a moment; on a cold live run, for seconds).
- **Expected:** the loading state is announced, and axe passes.
- **Actual:** `src/app/week/page.tsx:35` renders `<div aria-busy="true" aria-label="Loading week">`. axe flags `aria-prohibited-attr` (serious): a `div` with no role can't carry `aria-label`, so screen readers don't announce "Loading week". The same pattern is on two spans in `week-view.tsx` (line 177 "Score N out of 100", line 230 "…: already started"). axe didn't flag those in the loaded state QA scanned, but they're likely ignored by screen readers too.
- **Suggestion:** give the loading wrapper `role="status"` (with the label, or visible sr-only text), and give the spans visible sr-only text instead of `aria-label`. This touches ARIA only, so it doesn't change the frozen Week design.
- Regression spec (added with the fix): `tests/e2e/qa/week-a11y.spec.ts` renders the server HTML without scripts, so the Suspense fallback stays on screen deterministically. It fails on 8e4cd0d and passes on 1b5a4e5.

### B-018 to B-026 · Honeycomb landing (design/honeycomb at 69a6cad)
Details, evidence and the lost-at hop for each are in the visual report on the `design/honeycomb` branch: `qa/reports/honeycomb-landing-audit.html`, indexed by `qa/reports/honeycomb-landing-audit.md`. They're logged here so the ledger stays complete; they apply to the Honeycomb branch, not to dev/core's current look.

### B-027 to B-031 · Repertoire R3, Songs you should learn (dev/core at 23a8d72)
Spec: BRAND's `learn-run-sketch.md` v3 and DEV's contract (`docs/playlist-architecture.md` §7); the published canvas has no Learn* boards yet. Evidence, side by side at 390/768/1440: `qa/reports/repertoire-r3-r5-audit.html`, indexed by `qa/reports/repertoire-r3-r5-audit.md`. All found offline with the mock model.
- **B-027 (Medium):** after a run, every step shows its tool name, Qloo endpoint, raw artist UUIDs and the whole `finish_suggestions` JSON, numbered oldest first, above the songs (at 1440 the new songs start about 1,600 px down). Sketch §2: plain words, raw data only behind "Show raw data", newest first, and once finished the feed moves under the list as "How we found these songs"; totals as the ResearchFunnel with one "left out" count.
- **B-028 (Low):** Qloo down shows "Qloo isn't answering" but not "Your songs are safe." (sketch §1 error, §2 endings), and nothing tells the user the run didn't count (the API doesn't count it).
- **B-029 (Low):** at run 8 (nothing new) the message says everything found was suggested before, while that run's counts read songs checked 0 and suggested before 0. Sketch: "…already in your history (7 left out)", plus a hint to try after a new busk or after learning songs.
- **B-030 (Low):** every run group stays expanded; sketch §3 says the newest run is open and older runs fold.
- **B-031 (Low):** no filter chips; sketch §3 and §6 list All · New · To learn · Learned · Not for me.

### B-032 to B-034 · Honeycomb landing recheck (design/honeycomb at 91b220e)
Checked part by part against BRAND's 29-part inventory (`design-handoff/inventory/landing/`). Evidence at 390/768/1440 is on the `design/honeycomb` branch: `qa/reports/honeycomb-landing-recheck.html`, indexed by `qa/reports/honeycomb-landing-recheck.md`. All three are visual differences from the part's crop that DEV's fix report didn't declare (lost at DEV self-check). The recheck also verified B-018 and B-020 to B-025 (statuses above). After 8 pm the sax example shows "This slot has passed": that's the known evening-slot bug (fixed on dev/core in e220abd, being ported), not a new defect.

**B-027 to B-031 recheck (16 Oct, dev/core df3c80c, functional only per §0 of the test plan).** Offline probe: 46 of 46 checks at 390/768/1440.
- B-027:
  - The default view has no tool names, /v2/, urn:, JSON, ids or step numbers. The steps fold closed under "How we found these songs", newest first, opened with Enter.
  - The funnel's "artists matched" and "new songs" agree with the cards and the end line.
  - "Show raw data" is absent while a run is going, toggles with Space afterwards, and shows the tool names. axe is clean with the fold open and raw on.
- B-028: the Qloo-down and no_match copy match the fix, and the allowance stays full. The next run is allowed.
  - Offline runs are exempt from the limits, so the counting itself is shown by `qa/unit/learn-uncounted-runs.test.ts`. Four uncounted runs leave both limits untouched, three real runs still fit, and timeout and stopped do count.
- B-029: with 0 songs checked (run 7), the copy reads "Couldn't find songs to check this time.". The checked > 0 branch is covered by DEV's unit test.
- B-030 and B-031: no filter chips and no per-run folds in the tree.
- Regression spec: `tests/e2e/qa/learn-feed.spec.ts`. The QA suite passes 225 of 225 at Wednesday 12:00, Friday 21:30 and Saturday 00:15.
- DEV's Postgres smoke log is now committed: `docs/smoke/learn-db-373ea1c.log`, 39 of 39.

### B-035 · High · design/honeycomb HEAD doesn't build (found 16 Oct)
- **How found:** `git archive HEAD` of design/honeycomb (6bc169e, on top of DEV's 4b9bff1), then `next build` fails with "Module not found: Can't resolve '@/components/setlist/copy-set-button'" (src/components/setlist/setlist-panel.tsx:2).
- **Cause:** the file exists only as an untracked file in DEV's worktree. Anything that builds from git (a deploy, CI, another checkout) breaks.
- **Also checked:** bbd1111 (the evening-slot port) builds, and QA's honeycomb suite passes there 153 of 153 at Wednesday 12:00, Friday 21:30 and Saturday 00:15.

### B-036 to B-042 · Busks · review v1 (design/honeycomb at 7b1521e)
Evidence, side by side with the deck at 390/768/1440: `qa/reports/busks.html` on design/honeycomb (rows B06–B14). Parts are provisional until BRAND's busks inventory lands. The user's calls F13, F14, F20, F25, F26 and F27 are tracked in that report, not here.

### B-043 to B-051 · Plan · review v1 (design/honeycomb at 7b1521e)
Evidence, side by side with the deck's 11 Plan boards: `qa/reports/plan.html` on design/honeycomb (rows P01–P26; provisional until BRAND's plan inventory lands). axe is clean on the ready plan and every reachable state; the engine fallback (P15) has no offline switch and is judged from the source.

B-052 evidence: `qa/reports/brain.html` on design/honeycomb, row BR08.
