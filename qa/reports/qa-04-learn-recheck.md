# QA-04 · Learn run recheck (B-027 to B-029)

**QA-04 · branch dev/core · commit tested df3c80c (fixes f15688f..43343f6) · offline, mock model · functional only (test plan §0) · 16 Oct 2026.** Cite a row as “QA-04 #05”. Same table as [qa-04-learn-recheck.html](qa-04-learn-recheck.html).

**14 of 14 pass.** B-027, B-028 and B-029 are fixed; B-030 and B-031 are absent as planned (back in R6). No new defects.

| Row | Defect | Check | Result | Evidence |
|---|---|---|---|---|
| #01 | B-027 | Default view after a run has no tool names, /v2/, urn:, JSON, ids or step numbers | Pass | Probe at 390/768/1440; learn-feed.spec |
| #02 | B-027 | Finished steps fold closed under “How we found these songs”; Enter opens it | Pass | aria-expanded false → true |
| #03 | B-027 | Open steps are newest first (Ranked … first, Matched … last) and still plain words | Pass | Probe titles |
| #04 | B-027 | Funnel agrees with the cards: artists matched = matching card; new songs = the end line | Pass | 4 = 4, 6 = 6 |
| #05 | B-027 | “Show raw data” is absent while a run is going; afterwards Space turns it on and the tool names appear | Pass | learn-feed.spec |
| #06 | B-028 | Qloo down reads “Your songs are safe. This run didn't count towards your limit.” | Pass | faults=qloo |
| #07 | B-028 | no_match reads the same | Pass | Unmatched artists |
| #08 | B-028 | Neither limit counts these runs; the next run is allowed | Pass | Allowance stays full; qa/unit/learn-uncounted-runs.test.ts (offline runs are exempt from limits, so counting is unit-tested) |
| #09 | B-029 | Nothing new with 0 songs checked reads “Couldn't find songs to check this time.”, never “suggested before” | Pass | Run 7, checked 0; the checked > 0 branch is in DEV's unit test |
| #10 | B-030 | Older runs don't fold: absent from the tree (deferred to R6, 524456e) | Pass | 0 per-run toggles |
| #11 | B-031 | Filter chips: absent from the tree (deferred to R6) | Pass | 0 chip controls |
| #12 | — | Accessibility: axe clean with the fold open and raw on | Pass | WCAG 2.2 AA tags, 3 widths |
| #13 | — | Breakage: no sideways scroll at 390, 768 or 1440 | Pass |  |
| #14 | — | QA suite at Wed 12:00, Fri 21:30 and Sat 00:15 (BUSKMAP_FAKE_NOW) | Pass | 225/225 each |

New QA files: `tests/e2e/qa/learn-feed.spec.ts`, `qa/unit/learn-uncounted-runs.test.ts`. DEV's Postgres smoke log is committed (`docs/smoke/learn-db-373ea1c.log`, 39 of 39).
