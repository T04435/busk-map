# QA baseline: 16 Oct 2026

**Verdict: PASS with defects.** The gates are green and no automated path spends money. 7 defects: 1 High (already fixed and verified), 2 Medium, 4 Low. Nothing blocks a judge path.

**Build under test:** `dev/core`, moving during the audit. Gates ran on 36ee2ba plus DEV's uncommitted work. The walk ran on the build from about 13:32, between 7650e20 and e3b85fb. QA specs ran on e3b85fb/0511718. Local Node is v25.2.1, against `engines: 24.x` (Vercel uses 24).

## 1. Gates

| Gate | Result |
|---|---|
| `pnpm check` (typecheck, lint, vitest + coverage, fixtures, build) | Pass. 345 unit tests in 41 files; coverage 96.4% statements, 87.5% branches |
| Unit tests with a network guard (QA preload wraps `fetch` and sockets in all 44 workers) | 349 passed; **0 network calls** |
| Offline e2e, DEV's suite (`CI=1 PORT=3111`) | **92 passed**, desktop + mobile. Server log: only `adapter fault injected` and mock "no results" warnings; no gateway, Neon or live host |
| QA e2e, `tests/e2e/qa/baseline.spec.ts` (`CI=1 PORT=3112`) | 20 passed (including B-003 failing as expected) |

## 2. Money and leak audit

| Check | Result |
|---|---|
| M-1 provider calls | All server fetches go through `runAdapter`/`fetchJson` (`src/server/adapters/core.ts`), which serves synthetic data when `offline`. QA spec: a plan's `dataStatus` has no `live` source |
| M-2 model calls | The planner, plain-AI compare and week explainer pick the mock model when offline (`agent.ts`, `compare.ts`, `week.ts`); the server log shows `model: "mock"` |
| M-3 database | Plans, runs and comparisons use memory when offline; `/api/baseline-stats` reports `store: memory` |
| M-4 Playwright reuse | **B-001 (High)**: `reuseExistingServer` could reuse a live server. DEV fixed it in e3b85fb while QA was auditing. **Verified:** a run against the user's live dev server on 3200 aborted in global setup before any spec |
| M-5 warm-up target | `src/instrumentation.ts` posts to `PORT`; Next sets `PORT` on listen. Test: an offline server on 3113 without `PORT`, with a catcher on :3000. The catcher got 0 requests and 3113 warmed itself. No leak |
| M-6 production switches | `testSwitchesOf` ignores the switches when `VERCEL_ENV=production`; no local env file sets `VERCEL_ENV` (names checked, values never read) |
| Local DB target | `.env.production.local` and `.env.development.local` point at the same Neon host, which differs from `.env.local`'s (compared by hash, never printed). So a local `next start` uses the dev branch, not production |

## 3. Walk (offline server on 3110; desktop 1440×900 and phone 375×812)

| Path | Desktop | Phone | Notes |
|---|---|---|---|
| J-1 Landing → acoustic example | ✓ | ✓ | `/p/<id>` at once. 8 agent steps with notes, inputs and returned data. Agent vs engine line. Map, 3 pitches, score breakdown with weights, crowd panel, setlist, Learn these, plain-AI comparison, sources. No console errors |
| J-2 Own act → plan | ✓ | ✓ | With a catalogue artist (Paul Kelly) plus a typed song: plan on `/p/<id>`, "Qloo couldn't match Buena Vista Social Club" named. With an artist from offline search: **B-003** |
| J-3 Short link reopened | ✓ | ✓ | "Agent steps (replayed, 8)", "cached, no new model call" |
| J-4 Passed slot | ✓ | n/a | "This slot has passed" with a "Plan again" link; no agent run |
| J-5 Not found | ✓ | ✓ | `/nope-qa` gives 404 "No pitch here"; `/p/zzzzzzzzz` gives "Plan not found" |
| J-6 Week (folk duo) | ✓ | ✓ | 5 sessions; Lincoln Square ×2 and Piazza Italia ×2, so the cap holds. Selects blank before hydration (**B-006**) |
| J-7 Tip log | ✓ | n/a | Example sessions labelled "Example data … Not real data"; explains the bonus of up to +5 |
| Phone layout | n/a | ✓ | No horizontal scroll on the plan, week or landing (`scrollWidth` = 375) |

Environment note, not an app defect: twice during the walk, DEV's `next build` rewrote the shared `.next` under a running `next start`, and pages returned 500 ("client reference manifest … does not exist") until a restart. Any server on this checkout breaks when the other thread builds. QA restarts after DEV builds; worth knowing before the user tries a local `next start`.

## 4. Decided rules

| Rule | Result |
|---|---|
| R-1 agent-independence | ✓ `score_pitches` was the 5th call, after 4 looks (QA spec checks ≥ 3); the "Agent vs engine" line is shown |
| R-2 hotspots always scored | ✓ Federation Square and Federation Wharf are in the scored pool. **B-002**: the 250 m spacing keeps a 65-point usual spot out of a top 3 that includes a 60, and the page never says why |
| R-3 week cap ≤ 2 per pitch | ✓ all 3 examples, desktop and phone (QA spec) |
| R-4 data-driven candidates | ✓ "How this plan was found" funnel: 680 cells, then 125 spaces, 30 ruled out, 51 scored; hidden-gem badges |
| R-5 agent v2 steps | ✓ each step shows notes, tool + inputs, "Data returned" |
| R-6 Neon | ✓ in code; offline uses memory (live persistence not exercised: see §7) |
| R-7 no accounts | ✓ no sign-in control on `/`, a plan, the week or the tips (QA spec) |
| R-8/R-11 production and repo | Not touched by QA |
| R-9 design sync | Not landed yet; raw step view is the agreed state for now |
| Retention | DEV reverted the 7-day strip in 0511718 ("plans keep their full step data"); the README no longer claims 7 days. Private server-side storage is within Qloo's terms. FYI for HQ |

## 5. Accessibility and performance

- **axe-core 4.14** (WCAG 2.0/2.1/2.2 A+AA) on `/`, two example plans, the week, tips and both not-found pages, desktop and Pixel 7: **0 violations everywhere except `/`**, which has 1 critical (**B-004**).
- **Keyboard:** Tab through `/` (57 stops) and the example plans (88 stops). Logical order; pitch pins and list are reachable; every stop has a visible ring except the two search inputs (**B-005**).
- **Lighthouse mobile:** not run. It isn't installed, and QA doesn't add packages. Needs DEV to add it (with `@axe-core/playwright`) or approval to run it. Target is ≥ 90 for performance and a11y.

## 6. Honesty and Qloo terms

- Estimates are labelled ("estimate" on foot traffic). "Busk Map never confirms a pitch is legal" appears on the landing and every pitch. Example tip data is labelled. Mock and synthetic data is labelled per source in "Data sources", except the explanations chip (**B-007**).
- Every source is credited on the plan: Qloo, City of Melbourne (CC BY), OSM (ODbL), Ticketmaster, Last.fm, Open-Meteo, Spotify, OpenFreeMap.
- Tool names and JSON are visible in the agent steps. That is the agreed raw view until the design sync puts it behind "Show raw data".
- **No Qloo data in the repo:** `check:fixtures` passes. No UUID appears in any tracked file. Git history (all branches) has no cache, response or env files apart from `.env.example`. The mock catalogue's ids are `4D4F434B…` ("MOCK").
- **Key server-only:** `server-only` is imported by `env.ts` and the Qloo client. Scanning the 45 client files in `.next/static` found 0 occurrences of the values of QLOO_API_KEY, TICKETMASTER_API_KEY, LASTFM_API_KEY, SPOTIFY_CLIENT_SECRET, VERCEL_OIDC_TOKEN and PGPASSWORD (matched in memory, counts only). No Qloo API host appears in the client bundle.
- **Hackathon host:** `QLOO_API_BASE_URL` defaults to `https://hackathon.api.qloo.com`, and no local env file overrides it. The Vercel value needs checking at deploy.

## 7. Live checks: 0 of 5 used

No live runs. QA tried to start a live `next start` on 3110 (dev-branch DB, one example at most), and the permission classifier blocked it. QA didn't work around the block. The live paths (real Qloo shapes, "Live" labels, Neon persistence, replay across instances, cold timing) need either the user's approval for a QA live server or a check on the user's own server.

## 8. Submission checklist (state.json)

| Item | Status | Evidence |
|---|---|---|
| Live, externally hosted demo, free until 16 Nov | **Needs deploy** | Not checked: QA doesn't touch production. Local build: no login anywhere (R-7) |
| Public repo, licence in About | **Partly** | GitHub reports PUBLIC and MIT detected. But `origin/main` was last pushed 14 Oct, and `dev/core` is 61 commits ahead of `origin/dev/core` (67 ahead of `origin/main`), so the public repo doesn't hold the current build. Needs push |
| Text description (agent, why Qloo, what's new) | **Not started** | No draft found in the repo or the hackathon folder. The README has the basics |
| Screenshots | **Not started** | 89 PNGs in `hackathon/…/screens/` are DEV walk captures, many showing synthetic or test-data labels. Submission screenshots must come from the live build |
| Qloo key server-side; no Qloo data in repo | **✓ locally**; confirm on deploy | §6 |
| Hackathon host only | **✓ locally**; confirm the Vercel env | §6 |
| Eligible residence | ✓ (user) | state.json |
| Submit by 30 Oct 23:45 ET | Pending | — |

## 9. Defects

See `qa/bugs.md`. High 1 (B-001, fixed and verified); Medium 2 (B-002, B-004); Low 4 (B-003, B-005, B-006, B-007).
