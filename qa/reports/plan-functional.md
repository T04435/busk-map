# Plan · functional

**v1 · branch dev/core · commit tested c845cd7 · offline, unit level · functional only (test plan §0) · 17 Oct 2026.** Cite a row as “Plan · functional #02”. Same table as [plan-functional.html](plan-functional.html).

**4 of 4 pass.** B-043's counting logic works; the panel itself is tracked in Plan · review.

| Row | Defect | Check | Result | Evidence |
|---|---|---|---|---|
| #01 | B-043 | Qloo-down runs leave the 5-per-hour fresh-run count unchanged; the next run is allowed | Pass | 5 Qloo-down runs then 5 real runs fit; the 6th is refused (qa/unit/plan-uncounted-runs.test.ts) |
| #02 | B-043 | A normal end, a timeout (engine plan), an internal error, model_unavailable and stopped keep their hit | Pass | refundPlanRun returns false for each; the 6th run after 5 such runs is refused |
| #03 | B-043 | Replays, joins and offline runs record nothing, so nothing is refunded | Pass | freshRunGate with reused or offline never touches the limiter; the route refunds only when counted = !reused && !offline (route.ts, read at c845cd7) |
| #04 | B-043 | Only the Qloo-down catch refunds | Pass | route.ts: refundPlanRun sits only in the QlooUnavailableError branch; the internal branch and the agent's own 90 s timeout (engine plan) don't refund |

QA file: `qa/unit/plan-uncounted-runs.test.ts` (4 tests, pass).
