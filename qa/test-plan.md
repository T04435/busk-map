# Busk Map QA test plan

Owner: QA[busk-map]. Started 16 Oct 2026. Branch `dev/core` (local only).
Deadline: submissions close 30 Oct 2026, 23:45 ET (31 Oct 03:45 UTC). The live URL must work, free and without login, until 16 Nov 2026, 23:45 ET.

QA verifies independently of DEV's tests. QA reports facts; the user decides scope. Sources of truth:
`hackathon/hackathons/qloo-2026/` → `spec.md`, `dev-brief-mvp.md`, `dev-brief-agent-v2.md`, `architecture.md`, `research/rules-and-api.md`, and `state.json` (decisions with `status: "decided"`, and `checklist`).

## 0. Review scope: dev work vs UI work (user rule, 16 Oct 2026)

| Work | Branches | What QA checks | What QA does not do |
|---|---|---|---|
| **Dev work**: feature work in plain shadcn (Repertoire, plan inputs) | `dev/core` | Function; the API and its contract; data; the spec's behaviour and copy; accessibility (axe, keyboard, focus); the 3 widths for **breakage only** (no sideways scroll, nothing clipped or unusable); the pinned clocks (§1) | Deck-vs-build comparison; layout, styling or placement findings; impeccable critique. Reports stay short and functional (text, no side-by-side HTML) |
| **UI work**: `design/honeycomb`, and brand syncs into core (e.g. R6) | `design/honeycomb`, sync rounds | Full visual review against the deck and the parts inventory (`design-handoff/inventory/…`); impeccable critique and audit; side-by-side visual HTML reports at 390/768/1440 with status chips | — |

Every report names the exact commit tested at the top, from QA's own export on QA's own port (never a shared server whose folder may lag).

## 1. How QA runs

| Gate | Command | Notes |
|---|---|---|
| Static + unit + build | `pnpm check` | typecheck, lint, vitest with coverage, fixture provenance, build |
| Offline e2e (DEV's suite) | `CI=1 PORT=<free port> pnpm exec playwright test --reporter=list` | `CI=1` turns `reuseExistingServer` off, so the run fails instead of reusing a server it didn't start. DEV's global setup also aborts unless `GET /api/health` reports `offline: true` (B-001). |
| QA e2e at 390/768/1440 | `CI=1 PORT=<free port> pnpm exec playwright test --config qa/playwright.config.ts` (add `QA_SHOTS=<scratch dir>` to keep every screenshot) | Every QA spec runs at all three widths (projects `w390`, `w768`, `w1440`). `layout.spec.ts` renders each screen, fails on horizontal scroll, content cut off at the right edge, or console errors, and saves a full-page screenshot that QA looks at. |
| QA e2e at pinned clocks (every round) | the QA e2e command three times, with `BUSKMAP_FAKE_NOW` set to DEV's default `2026-10-14T12:00:00+11:00`, a late evening `2026-10-16T21:30:00+11:00` (after the Friday 5–8 pm example ends) and just after midnight `2026-10-17T00:15:00+11:00` | The server clock is frozen only with `BUSKMAP_ALLOW_FAULTS` (DEV's webServer sets both). `clock.spec.ts` works its expected dates out from the spec (next slot that hasn't ended, Melbourne time), not from `src/lib/slot.ts`. No spec may read the wall clock for a server date: use `tests/e2e/clock.ts`. |
| QA e2e (DEV config) | `CI=1 PORT=<free port> pnpm exec playwright test tests/e2e/qa/` | The QA money specs assert offline mode, memory stores and no `live` data source. |
| Clean-export build (every round) | `git archive HEAD \| tar -x -C <scratch>/export-<sha>`, then in it `pnpm install --offline --frozen-lockfile && pnpm typecheck && pnpm build` | Proves the committed tree builds without untracked or local files (no env files are in the export). Delete the export afterwards |
| QA unit (pure logic) | `pnpm exec vitest run --config qa/vitest.config.mts` | Standalone config; only `qa/unit/**` |
| Manual walk | `NEXT_DIST_DIR=.next-qa pnpm build`, then `NEXT_DIST_DIR=.next-qa BUSKMAP_OFFLINE=1 BUSKMAP_ALLOW_FAULTS=1 PORT=3110 pnpm start --port 3110` (own build dir, so DEV's builds can't break it) | Desktop 1440×900 and phone (Pixel 7 / 375×812). Stop the server when done. |
| Live check (manual) | the user's or a QA live server, **max 5 cold agent runs per round** | Each run logged in the round report with time and estimated cost (~$0.10–0.15). Prefer cached examples and replays (free). |

Build cache: if a build fails mid-way (e.g. a Google Fonts fetch for next/font), delete that build's dist folder (.next-qa-e2e etc.) before retrying. Turbopack keeps the failed state and every later build fails with “Can't resolve '@vercel/turbopack-next/internal/font/google/font'” until the folder is gone (seen 17 Oct at 8207373).

Commits: the git index is shared with DEV, so commit only QA paths, always with a pathspec: `git commit -m "qa: …" -- qa/ tests/e2e/qa/`. Never a bare `git commit`, `-a`, or `git add -A`/`.`. Before each commit, `git diff --cached --stat` must show only QA paths.

Never: copy env files, print secrets, point anything at production, enter credentials, push, deploy, or leave a server running.

## 2. Money and leak checks (every round)

| ID | Check | How |
|---|---|---|
| M-1 | Every server-side provider call goes through `runAdapter`, which serves synthetic data when offline | code read of `src/server/adapters/core.ts` and every `fetch(` / `neon(` call site |
| M-2 | Model calls use the mock model offline (planner, plain-AI compare, week explainer) | code read `agent.ts`, `compare.ts`, `week.ts`; runtime: plan payload `model` is `mock` |
| M-3 | Offline mode never opens Neon (plans, runs, comparisons all memory) | code read of the three stores; `/api/baseline-stats` reports `store: memory` |
| M-4 | Playwright cannot reuse a live server | global setup aborts unless `/api/health` is offline (B-001); rerun against any live server on the e2e port |
| M-5 | No automated path triggers another server | `src/instrumentation.ts` warm-up posts to the server's own port (Next sets `PORT` on listen); checked with a catcher on :3000 |
| M-6 | Test switches are ignored in production | `testSwitchesOf` unit test; `VERCEL_ENV` not set to `production` in any local env file (names only, never values) |
| M-7 | Unit tests make no network calls | vitest run with fetch guarded; grep for un-mocked `fetch` in `tests/unit` |

## 3. The 3 MVP features end to end

### F1 Where to play (pitch ranking on the taste map)
- Plan shows a map coloured by taste match, 3 ranked pitch pins and a keyboard-reachable list.
- Each pitch: score, score breakdown with weights shown, nearby busy places open in the slot, footfall level used and its source, hidden-gem badge where earned.
- Only legal pitches are recommended; cautions shown; Busk Map never claims a pitch is legal (links to the council scheme).
- Live venue detail (live music, good for, keywords) appears in pitch reasons; event artists feed taste.
- Different acts get different top pitches.
- Plain-AI comparison sits beside the plan, labelled, in three buckets, and never changes a score.

### F2 Why this crowd
- Crowd panel: Qloo local artists with explainability, demographics (age lean), "your fans vs the usual crowd".
- Every "why" line is traceable to a tool result in the agent steps.

### F3 What to play
- Setlist contains only songs the performer picked, ordered by Qloo affinity plus age lean (release-year era).
- 3 "learn these" from Qloo `audience_growth`/trending, set length, "Learn it" links only on "Learn these".
- Last.fm down: setlist still ordered, without play counts.

### Agent (Agent v2)
- Steps stream live: notes before each call, tool name + chosen inputs, the returned data (collapsible).
- Varied investigation paths across acts (live check only).
- Guardrails: final pitches are in the engine-scored set; ~12 steps; 90 s timeout → engine plan with a note.
- Replay of a stored run shows the same steps at once, with no new run.

## 4. Decided rules (state.json, `status: "decided"`)

| ID | Decision | What QA checks |
|---|---|---|
| R-1 | `agent-independence` = show-both | `score_pitches` unlocks only after 3 looks; an "Agent vs engine" line shows where/why the agent changed the ranking |
| R-2 | `hotspot-policy` = always-candidates | Well-known spots are always scored; the score decides (a usual spot may be #1); gems keep their badge |
| R-3 | `hotspot-policy` week cap | Week plan has at most 2 sessions per pitch |
| R-4 | `pitch-model` = data-driven | Candidates come from Qloo taste cells, filtered by legality and foot traffic; "hidden gem" angle |
| R-5 | `agent-v2` = go | Real tool inputs; each step shows its returned data |
| R-6 | `database` = neon | Runs, baselines, comparisons and plans persist in Neon (dev branch locally); memory when offline; no-op without `DATABASE_URL` |
| R-7 | `accounts-round` = after-mvp | No sign-in anywhere; nothing gated behind login |
| R-8 | `prod-migration` = with-deploy | Production DB untouched until deploy; QA never points at production |
| R-9 | `design-review` = C | After the design sync lands: screens vs BRAND's system and the /plan canvas; raw step view only behind "Show raw data" |
| R-10 | `spec-approve` | 3 examples preloaded, no login, plain-LLM toggle, labelled example tip log |
| R-11 | `github-repo` | Public repo, MIT licence detected in About (needs push; not verifiable locally) |
| R-12 | `architecture-approve` | Zod at boundaries, adapters fall back, BotID + rate limit on plan endpoint, Lighthouse mobile ≥ 90 perf and a11y |
| R-13 | Retention | Raw step data stripped after 7 days; plans and links persist; research totals survive the strip |

## 5. Judge paths (desktop and phone)

| ID | Path | Expected |
|---|---|---|
| J-1 | Landing → example act → busk page | Opens fast (cached), 3 pitches, map, setlist, agent research steps visible, no login |
| J-2 | Own act → busk | Type artists/songs (or Spotify link), pick a slot → `/p/<id>`; agent runs; unmatched artists named |
| J-3 | Short link `/p/<id>` reopened | Same plan at once, replayed, no new run; Copy link works (and falls back) |
| J-4 | A passed slot | Note that the slot has passed, a pre-filled form link, no new run |
| J-5 | Not found | Unknown URL → 404 card with a link home; unknown/malformed `/p/<id>` → its own not-found state |
| J-6 | Week planner | Top sessions, grid, .ics export, unavailable slot re-plans, cap 2 per pitch |
| J-7 | Tip log | Example sessions labelled; logging adapts the plan (≤ +5); `/tips` history |
| J-8 | Outages | Qloo down → clear error, no recommendations; other sources down → plans with less data, labelled |

## 6. Comparison with plain AI
- Plain-AI answer is a separate tool-less model call, labelled as such, shown beside the plan.
- Buckets show where plain AI agrees/differs; scores unchanged.
- `/api/baseline-stats` reports agent-vs-engine divergence and plain-AI uniqueness (live store only).

## 7. Screen widths (user rule)
- Every screen at **390, 768 and 1440 px**, actually rendered and looked at. A screen that breaks at any of the three fails the round. On dev work this is a breakage check only (§0).
- No horizontal scroll, tap targets ≥ 24 px, map usable or list alternative reachable, no overlapping sticky UI.

## 8. Accessibility (WCAG 2.2 AA)
- axe scan of landing, plan, week, tips, not-found (needs `@axe-core/playwright`; ask DEV to add the dev dependency, QA doesn't touch `package.json`).
- Keyboard: every control reachable and operable, visible focus, pitch selection from the list, dialogs trap and return focus.
- Labels: form fields, map region, icon buttons; live regions for streaming steps don't flood screen readers.
- Contrast AA in light (and dark if offered).

## 9. Performance
- Lighthouse mobile on landing and an example plan: target ≥ 90 performance and accessibility (architecture gate). Locally against `next start`; repeat on the deploy.
- Example plan opens from cache in < 2 s; cold live agent time logged.

## 10. Honesty and data handling
- Estimates labelled as estimates (footfall, busy, score).
- Data sources credited on screen (Qloo, OSM/ODbL, City of Melbourne CC BY, Ticketmaster, Last.fm, Open-Meteo, OpenFreeMap).
- Synthetic/offline/mock data says so wherever it appears.
- No tool names or JSON in the busker UI outside the raw-data toggle (applies once the design sync lands; until then the raw view is the agreed state).
- Example tip sessions clearly marked.

## 11. Qloo terms
- No Qloo response data in the repo or its history (`check:fixtures` plus QA's own UUID / `entity_id` scan of tracked files and history).
- The Qloo key is server-only: `server-only` import on the env module; the key value never appears in `.next/static` (checked by count, never printed).
- Only `hackathon.api.qloo.com`: default `QLOO_API_BASE_URL`, no override in local env names; production env needs deploy.

## 12. Submission checklist (state.json `checklist`)
Each item checked locally where possible; the rest marked "needs deploy" or "needs the user". See the round reports.

## 13. Defects
Logged in `qa/bugs.md`: id, severity (High / Medium / Low), steps, expected, actual, status. Defects go to DEV directly; HQ gets one verdict per round with counts by severity.
