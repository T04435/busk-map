# QA round 3: B-009 to B-011 and examples as inputs, 16 Oct 2026

**Verdict: PASS.** B-009, B-010 and B-011 are fixed and verified. 2 new Low (B-012, a flaky test; B-013, the retry time's zone). No High or Medium is open. The examples-as-inputs change works as built, but it carries judge-facing risks the user should weigh (§3). QA reports them; it doesn't decide scope.

**Build:** `dev/core` at 7126c07 (e42ab30 … 7126c07 on top of QA's dd7cd55), local only. QA build dir `.next-qa`.

## 1. Gates

| Gate | Result |
|---|---|
| `NEXT_DIST_DIR=.next-qa pnpm check` | Pass. 432 unit tests in 50 files; coverage 96.6% statements, 87.9% branches; fixtures OK (250 files) |
| Offline e2e, full suite, desktop + mobile (`CI=1 PORT=3111`) | **147 passed, 1 flaky** (DEV's example-card test failed once on mobile and passed on retry: **B-012**) |
| QA a11y spec | Landing ready signal changed (DEV's heads-up): `aria-expanded="false"` is now in the server HTML too, so the spec waits for the client-side `/api/warm` POST, which proves hydration, before axe runs. 0 violations on all 7 pages, both sizes |

## 2. Fix verification

| Bug | Fix | How QA verified | Result |
|---|---|---|---|
| B-009 guard by hostname | e42ab30 | `PLAYWRIGHT_BASE_URL` = `http://192.168.1.101:3200`, `http://0.0.0.0:3200` and `http://127.0.0.2:3200`, against the user's live dev server, health spec only. Every run aborted in global setup ("e2e aborted: the server at … is not in offline mode") before any spec ran | ✓ |
| B-010 offline Claude text | 222cf92 | Offline: the rendered acoustic plan (after the stream and hydration) has 0 "Claude" mentions. The server HTML of `/plan` and `/week` for all 3 examples has 0 | ✓ |
| B-011 SSR aria-expanded | 868c371 | `curl /`: both comboboxes have `aria-expanded="false"` and no `aria-controls` | ✓ |

## 3. Examples as inputs (e83a94c): facts for HQ and the user

What changed: each example click now makes a new `/p/<id>` and a fresh agent run, with no cached example plan. Reopened links replay with "Replay of an earlier run (no new model call)". There's a new limit of 5 fresh runs per IP per hour, per instance, with replays exempt and offline exempt. A WAF rule of 15/hour on `/api/plan` is documented in `docs/deploy.md`.

Offline, it behaves as described. DEV's e2e confirms two clicks give two links and two fresh runs, and the replay badge shows.

Risks QA sees (not defects; the user decides):
- **The spec no longer matches.** `spec.md` ("The judge's first 30 seconds") says the three examples are "already loaded", and `architecture.md` says "Example performers are fully preloaded, so judges see results instantly". `dev-brief-mvp.md` says "Cache the 3 examples so they stay fast". Now a judge's first click on an example waits for a cold agent run: about 20–60 s by DEV's earlier timings, not measured live by QA.
- **Cost.** Every example click in production is a paid agent run (~$0.10–0.15 by the QA brief's estimate), plus a plain-AI baseline and live Qloo calls. At $50 a month for AI Gateway, that's roughly 330–500 fresh runs across judging (2–16 Nov), shared with everyone else who visits.
- **Shared IPs.** The limit is per IP. Judges behind one office or VPN address share 5 fresh runs an hour (per instance). One judge who opens the 3 examples and plans 2 acts hits the limit on the next try. The throttled page has no e2e coverage, because offline is exempt (see B-013).
- **Retry time.** The 429 message gives the retry time in Melbourne time with no zone label (**B-013**).

## 4. Other changes
- 0e50a0a: `researchTotals` now has `qlooCalls` and `qlooCacheHits`. Covered by DEV's unit tests; QA's specs don't assert totals.
- 7126c07: baseline-stats has `agentDiffersRate`, `n` and `dateRange`. Offline, the store is memory; not checked live.

## 5. Not done
- **Live checks:** 0 of 5. They still need the user's approval (the classifier blocked a QA live server). That's especially relevant now: cold example timing and the 429 page can only be measured live.
- **Lighthouse:** needs approval for `npx lighthouse`.

## Counts
Open: High 0, Medium 0, Low 2 (B-012, B-013). Fixed and verified to date: 11 (B-001 to B-011).
