# Assessment A: error and edge pages (Operate), f83f1a1 @ :3213

Routes: 404 `/this-is-not-a-pitch`, plan-not-found `/p/ZZZZZZZZZ`, route error `faults=render`, run limit `faults=fresh-limit`. Checked at 390/768/1440, day and night, with Try again clicked and keyboard tabbing; shots are in `scratchpad/imp/errors-A/`.

## Design specificity verdict
**Mostly authored, but uneven.** The 404 is clearly this product: a giant orange Big Shoulders "404", a lifted honeycomb pin cell in a hard-shadow card, "No pitch here", and a second door ("Try an example plan"). The route error reuses that card with a red hex. The other two states drift. Plan-not-found is a bare stack with a dashed hex and a 44px h1, against 24px in the cards. The run limit is a generic inline alert that any SaaS could ship.

## Nielsen heuristics (all applicable)
| # | Heuristic | Score | Evidence |
|---|---|---|---|
| 1 | System status | 2 | Try again (768) re-renders the same card, same Reference 190861489, with no pending state; focus drops to body |
| 2 | Real world | 3 | "No pitch here", "can't find this busk" fit the domain; the reference number is unexplained |
| 3 | User control | 3 | Every state has a way home; the limit state offers nothing else |
| 4 | Consistency | 2 | 3 layouts for 4 states; "Go to Busk Map home" / "Go home" / "Back to Busk Map home" |
| 5 | Error prevention | 2 | No warning that you're near the 5-per-hour limit |
| 6 | Recognition | 3 | The limit page keeps the slot eyebrow and the act name |
| 7 | Flexibility | 2 | "About 45 minutes" instead of a clock time; no auto-retry; no recent plan to open |
| 8 | Aesthetic | 3 | On-brand, but the hatched QLOO TEST DATA bar outshouts the limit alert |
| 9 | Error recovery | 2 | 404 good; route error names nothing; limit has no next step |
| 10 | Help | 1 | No help or contact path; the reference code has nowhere to go |
| | **Total** | **23/40 (58%), Acceptable** | |

## Cognitive load
**1 checklist failure (low).** The failure is visual hierarchy on the limit page: the h1 "SOUL AND FUNK SAX PLAYER" and the full-width test-data bar both outrank the small "PLAN LIMIT REACHED" alert, capped at 760px at 1440. No decision point offers more than 4 options.

## Emotional journey
The 404 ends warmly with two doors. The route error is the low point: "Something went wrong" appears twice, retry silently fails, and you're holding a number you can't use. The limit page reassures ("No new plan was started.") but its last element is a bare text link, so planning tonight's slot ends at a dead end.

## Strengths
- The 404 at every width: the stacked full-width CTAs at 390 and the strong double focus ring.
- Specific limit copy ("5 plans this hour… about 45 minutes") on a role=alert.
- All four states hold up at night (the lift turns orange, the red hex keeps contrast), with no horizontal scroll at 390.

## Priority issues
1. **[P1] Retry is silent.** The route error's Try again gives no pending state, comes back with the identical card, and moves focus to `<body>`. **Fix:** a pending button, different copy on the second failure, and focus on the h1. `/harden`
2. **[P1] The limit page's hierarchy is inverted and it has only one way out.** The real message is the third-loudest item, and at 1440 the 760px alert sits misaligned under the full-width bar. **Fix:** lead with the limit, give a clock time, and offer actions that don't count against it (recent plans, an example). `/layout`, then `/clarify`
3. **[P2] Four states use three systems.** Card+numeral, bare stack, card, and inline alert, with three home-link wordings. **Fix:** put every full-page state in StatusCard and use one CTA label. `/polish`
4. **[P2] Plan-not-found shows a doubled pin and is a soft 404.** `lift` applies a drop-shadow through the dashed cell's transparent fill, so an orange ghost pin sits offset behind the icon (zoomed in `z-hex.png`, day and night). The page also returns HTTP 200 with the tab title "Plan · Busk Map". **Fix:** don't lift dashed cells, give the page its own title, and return a 404 status. `/polish`
5. **[P3] Route-error copy is vague.** It doesn't say that the plan failed to load or that your inputs are kept, and there's no report link for the reference code. `/clarify`

## Persona red flags
- **Jordan (first-timer from a broken shared link):** /p/ZZZZZZZZZ says "start a new busk" but offers only a home link. The 404's "Try an example plan" is missing exactly where it's needed most.
- **Casey (mobile, between sets):** at 390 the limit page needs mental arithmetic ("about 45 minutes"), and its only action is a small text link just above the footer.
- **Sam (keyboard / screen reader):** focus is lost after retry, and a second failure announces nothing new.

## Minor observations
- On the 404 no nav item is active; on plan-not-found BUSKS is active.
- At 1440 by day, the 404 numeral (brownish signal-text) and the primary button read as two different oranges.
- The limit's status line repeats the alert's clock icon.

## Questions
- Should a refused run show the last plan made for this slot instead of a dead end?
- Who is "Reference: 190861489" for, and why can't the page send it?
- Why does the warmest copy sit on the page users reach least, while the shared-link page they actually hit is the plainest?
