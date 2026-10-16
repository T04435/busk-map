# QA-02 · Repertoire R3 to R5 audit: spec vs build (index)

**QA-02** · branch `dev/core` · commits tested 23a8d72 (R3) and e220abd (R4, R5). Rows are #01–#34 in the HTML; cite a finding as “QA-02 #05”.

**Visual report:** [repertoire-r3-r5-audit.html](repertoire-r3-r5-audit.html). It puts the spec text on the left and the build on the right at 390, 768 and 1440, with a red box around each gap. Images are in `qa/screens/r3/` (R3) and `qa/screens/r45/` (R4, R5). It replaces the R3-only report from f9ba2d6.

**Builds:**
- **R3:** dev/core at 23a8d72.
- **R4 and R5:** dev/core at e220abd. The R5 screens come from a server frozen at Friday 16 Oct, 21:30, Melbourne time.

All builds were clean exports, offline with the mock model. **Date:** 16 Oct 2026.

**Inventory sources** (read before the builds were opened). The published canvas has no Learn* boards, so the design side is text:
1. BRAND's `learn-run-sketch.md` v3
2. `docs/playlist-architecture.md` §4 (renames, Brain) and §7 (learn contract), and `playlist-spec.md`
3. MANAGER's R5 brief and the decisions

## Counts (34 items)

| Round | Present | Different | Missing | Broken |
|---|---|---|---|---|
| R3 (23) | 16 | 4 | 2 | 1 |
| R4 (3) | 3 | 0 | 0 | 0 |
| R5 (8) | 6 | 2 | 0 | 0 |
| **All** | **25** | **6** | **2** | **1** |

## Defects (all R3, logged in f9ba2d6; nothing new in R4 or R5)

| Row | ID | Sev | Item | Lost at |
|---|---|---|---|---|
| #05–#07 | B-027 | Medium | The learn feed shows tool names, raw UUIDs and JSON by default. It runs oldest first, stays above the list, and shows totals as a 10-count grid instead of the funnel | handoff→DEV (sketch v3 not published as boards) |
| #12 | B-028 | Low | Qloo down: no "Your songs are safe." and no "didn't count" line | handoff→DEV |
| #11 | B-029 | Low | Nothing new: the copy contradicts the run's counts | DEV self-check |
| #17 | B-030 | Low | Older runs don't fold | handoff→DEV |
| #18 | B-031 | Low | No filter chips | handoff→DEV |

## R4 and R5 notes
- **The R5 evening bug is fixed.**
  - At Friday 21:30, the sax example opens Friday 23 Oct and the form defaults to Saturday 17 Oct.
  - An explicit past `?date=` still shows "This slot has passed" with "Plan again".
- **Clock runs:** the new `tests/e2e/qa/clock.spec.ts`, plus the full QA suite at three pinned instants, all on e220abd:

  | Pinned instant | Result |
  |---|---|
  | Wednesday 12:00 | 210 of 210 |
  | Friday 21:30 | 210 of 210 |
  | Saturday 00:15 | 210 of 210 |

  - On 23a8d72, 12 tests failed on the real clock after 8 pm. These were not product defects; e220abd fixes them.
- **Different: step pruning.** The SQL and unit tests match the spec (last 5 runs, 30 days). The pruned-replay copy leaves out the retention rule that sketch §6 drafted. Retention is still an open card, so I haven't logged it as a defect.
- **Different: DEV's Postgres smoke "40 of 40".** `scripts/smoke-learn-db.mjs` has **39** `check()` calls; the 40th match is the summary log line. No run log is committed. QA can't run it, since it needs the Neon dev branch and QA works offline only. Pruning and the 400 cap are covered by unit tests (`tests/unit/learn/store.test.ts:205` and `:238`, `tests/unit/playlist/store.test.ts`).
- **R4 copy:** the user-facing strings come from `playlist-copy.ts`. A grep finds no "Setlist" or "Learn these" left in the UI.
- **R4 Brain:** 5 facts, 45 pieces and "Suggested set" with Last.fm all match `qloo-map.ts`.

## Process fixes (also at the foot of the HTML)
1. BRAND: publish the Learn* boards before DEV builds a round.
2. DEV: when only a sketch exists, self-check every sketch row and list the unbuilt ones as deviations.
3. QA: run every round at three pinned clocks; no spec reads the wall clock.
4. MANAGER: hold sign-off on B-027, B-030 and B-031, or accept them as deviations.
5. DEV: commit the output of checks QA can't run offline, and copy sketch-only rules into the contract.
