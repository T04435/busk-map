# Repertoire R3 audit: Songs you should learn, spec vs build (index)

**Visual report:** [repertoire-r3-audit.html](repertoire-r3-audit.html). It puts the spec text on the left and the build on the right at 390, 768 and 1440, with a red box around each gap. Images are in `qa/screens/r3/`.

**Build:** dev/core at 23a8d72 (R3 2d4d153, 3cf3799, 2271728, ee8a7fd, with R4 on top), a clean export, offline with the mock model on QA's port. **Date:** 16 Oct 2026.

**Inventory sources** (read before the build was opened). The published playlist canvas has no Learn* boards, so the design side is text:
1. BRAND's `learn-run-sketch.md` v3, §1 to §4
2. DEV's contract `docs/playlist-architecture.md` §2 and §7, and `playlist-spec.md`
3. Decisions: Sonnet, 3 runs an hour per Repertoire and 6 per IP with `limit.scope`, never re-suggest, "Not for me" with Undo, Last.fm as backup

## Counts (23 items)

| Present | Different | Missing | Broken |
|---|---|---|---|
| 16 | 4 | 2 | 1 |

## Defects

| ID | Sev | Item | Lost at |
|---|---|---|---|
| B-027 | Medium | The learn feed shows tool names, raw UUIDs and JSON by default. It runs oldest first and stays above the list, and totals show as a 10-count grid instead of the funnel | handoff→DEV (sketch v3 not published as boards) |
| B-028 | Low | Qloo down: no "Your songs are safe." and no "didn't count" line | handoff→DEV |
| B-029 | Low | Nothing new: the copy contradicts the run's counts (0 checked, 0 suggested before), with no left-out count or hint | DEV self-check |
| B-030 | Low | Older runs don't fold | handoff→DEV |
| B-031 | Low | No filter chips | handoff→DEV |

## Other checks
- **API probe:** 37 of 39 passed, and the other 2 were probe errors. It covered the stream order, refusals (404, 409 ×3, 429 with scope, Retry-After and resetAt, 503), the server steps, the artist cap of 2, never re-suggesting across 8 runs, isNew on the latest run only, undo, Origin 403, and that Qloo down isn't counted.
  - already_running can't be reached offline, because runs finish in about 30 ms. The unit tests and the partial unique index cover it.
- **Can't be checked offline:** the live "N runs left this hour" counter, and Last.fm songs (they're unit-tested). `MODELS.planner` is Sonnet.
- **QA suite:** 12 of 195 failed on 23a8d72. All of them hit `/plan?example=sax` after 8 pm on Friday: the example opened today's 5–8 pm slot, which had already passed, so there were no Pitches. This is not a product defect at R3. e220abd (nextSlotDate) fixes it: **195 of 195 pass on e220abd**.
- `brain.spec` is updated for R4: 45 nodes, 5 facts, "Suggested set", and Last.fm in the panel.

## Process fixes (also at the foot of the HTML)
1. BRAND: publish the Learn* boards before DEV builds a round.
2. DEV: when only a sketch exists, self-check every sketch row and list the unbuilt ones as deviations.
3. QA: pin `BUSKMAP_FAKE_NOW` so the specs never depend on the wall clock.
4. MANAGER: hold the R3 sign-off on B-027, B-030 and B-031, or accept them as deviations.
5. All: copy the sketch-only copy rules into the contract.
