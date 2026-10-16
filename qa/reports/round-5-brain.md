# QA round 5: /brain, 16 Oct 2026

**Verdict: FAIL (one Medium).** /brain renders, passes axe and the layout checks at 390, 768 and 1440 px, keyboard tracing works, and the facts match the doc. But the sticky trace panel hides focused pieces while tabbing (**B-015, Medium**, WCAG 2.2 AA 2.4.11). There's also 1 Low doc drift (B-014). Open: High 0, Medium 1, Low 1.

**Build:** `dev/core` at f9edb1a (515321a..f9edb1a plus 8afd14d, 5c6fdfd), local only.

## Gates

| Gate | Result |
|---|---|
| `NEXT_DIST_DIR=.next-qa pnpm check` | Pass. 462 unit tests; fixtures OK (261 files) |
| Clean-export build of f9edb1a | install 0, typecheck 0, build 0 |
| Full e2e, DEV config (desktop + mobile) | 237 passed, 33 skipped (DEV's own-viewport layout spec skips in the mobile project), 0 failed |
| QA suite, `qa/playwright.config.ts` at w390, w768, w1440 | 123 passed (B-015's test marked `test.fail`). `/brain` was added to `layout.spec.ts` and `a11y.spec.ts`, and `tests/e2e/qa/brain.spec.ts` is new |

## /brain checks (DEV's "worth checking" list and more)

| Check | Result |
|---|---|
| Facts strip vs `docs/qloo-data-map.md` and `qloo-map.ts` | ✓ 11 kinds of call, 24–33 calls per new busk, 0 on a rerun ("cached for 24 h"), 9 parts; quota note "10,000 requests a month". Doc drift elsewhere: **B-014** |
| Panel claim "Setlist and learn these, where four Qloo calls and Spotify meet" | ✓ the trace comes from Artists nearby (explained), Affinity at a pitch, Trending, Demographics, and Spotify |
| Screen-reader announcement on trace | ✓ the `role=status` live region says "Tracing. Setlist and learn these comes from 4 Qloo calls, 1 other source and 5 data points. Other pieces are dimmed." |
| Announcement on clear | ✓ "Trace cleared. Every piece is shown." |
| Escape returns focus to the traced node | ✓ even when focus was on "Clear trace" |
| The "Clear trace" button returns focus to the node | ✓ |
| Breakpoint at exactly 1023 and 1024 px | ✓ 1023: one column, no wires, dimmed pieces hidden. 1024: three columns, wires (an SVG path per edge), dimmed pieces still shown |
| Landing teaser | ✓ "Open the brain" leads to `/brain` |
| axe (WCAG 2.0–2.2 A/AA, all impacts) | ✓ 0 violations at all three widths |
| Layout | ✓ no page scroll, nothing cut off at the right, no cut-off placeholders, no console errors, at all three widths. Screenshots looked at (768 shown stacked, two columns of pieces) |
| **Focus not obscured (2.4.11)** | **✗ B-015.** With a trace open, Tab scrolls each piece to the bottom edge, under the sticky panel (up to 45vh). Confirmed in screenshots at 390 (c5 hidden) and 1440 (c4 hidden) |

## Defects
- **B-015 Medium:** the sticky trace panel hides the focused node. Suggestion: `scroll-padding-bottom` set to the panel's height while a trace is open, or a non-sticky panel at narrow widths.
- **B-014 Low:** `docs/qloo-data-map.md` §4 still describes the week-prefetch comment as "about 47 Qloo calls"; it now says about N+2.

## Not done
Live checks and Lighthouse still need the user's approval.
