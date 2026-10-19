# /brain · Assessment A (design review) · Operate

Build f83f1a1. Checked at 390, 768 and 1440, in the day and night OS schemes. The page pins dark, so both schemes look the same except for focus. I traced Taste heatmap and Setlist, then tested Tab and Esc. Shots are in `imp/brain-A/`.

## Design specificity verdict
**This page was designed for this product.** The columns run Qloo calls → data points → Your busk. That is the real call graph, with endpoints, the 5b call, dashed Spotify and Ticketmaster sources, hex number badges, and the orange "path you picked" against Qloo violet. One opportunity is missed: the honeycomb appears only as badges and a lattice. The "brain" is three lists of rectangles, and below 1024 the wires disappear.

## Heuristics
| # | Heuristic | Score | Note |
|---|---|---|---|
| 1 | Status | 3 | Clear lit, picked and dim states, plus a "Lights up…" summary and a live region. The sticky panel covers lit pieces. |
| 2 | Real world | 3 | Plain labels, but every call also shows endpoint jargon. |
| 3 | Control | 3 | Clear, Esc and a second click all undo a trace. Below 1024 you must clear before picking another piece. |
| 4 | Consistency | 3 | One node style. The idle panel sits inline, but the traced panel is sticky. |
| 5 | Error prevention | n/a | Read-only explorer with no input. |
| 6 | Recognition | 3 | From/To "how" lines. Below 1024 there are no wires to look at. |
| 7 | Flexibility | 2 | No deep link to a trace and no search across 38 pieces. |
| 8 | Aesthetic | 3 | Strong type. In the idle state at 1440 the data→busk wires form a tangle. |
| 9 | Error recovery | n/a | No error states on this page. |
| 10 | Help | 3 | A good "Try…" panel, but it sits after the grid. |
| **Total** | | **23/32 (72%)** | **Good** |

## Cognitive load
Three checklist failures, so moderate:
- **Chunking:** columns of 14, 15 and 9.
- **Minimal choices:** 38 pieces at equal weight.
- **Progressive disclosure:** all endpoints shown up front.

Decision points with more than 4 options: the wiring as a whole (38), and each of the three columns.

## Emotional journey
- **Peak:** the hero and the stat strip.
- **Valley:** a wall of 38 boxes. At 390 the "Pick any piece" guidance comes about 2,500 px after the intro.
- **Reward:** the first click at 1440, when the orange wires snap across the columns.
- **End:** honest notes ("Next · not built yet").

## Strengths
1. **The trace payoff at 1440.** Setlist lights 4 calls, 5 data points and Spotify, and dims the rest to 10%.
2. **Panel copy.** "Decides:" / "Comes from:" plus per-edge sentences explain the path in plain words.
3. **Accessibility groundwork.** `aria-pressed`, live announcements, Esc, focus returning to the traced piece, and scroll-padding sized to the panel.

## Priority issues
**[P1] Focus is invisible on idle and dim pieces in the day OS scheme.**
- **What I saw:** at 1440 in light mode, the focused "Spotify id match" ring is `rgb(20,28,33)` on a dark card. In dark mode it is orange.
- **Why:** `--focus-ring` resolves at the light `:root`, while the page pins dark. This fails WCAG 2.4.7.
- **Fix:** redeclare `--focus-ring` under `[data-theme=dark]`.
- **Command:** /impeccable harden

**[P1] The trace panel hides the path it describes.**
- **What I saw:** at 1440×900, Taste heatmap lights 5 parts, but Plain-AI comparison and The agent's tools sit under the panel. At 390 the panel is 204 px plus the nav, and Pitch ranking is covered.
- **Fix:** at lg, use a side or top slot outside the grid. On mobile, default to a one-line bar that expands on tap.
- **Command:** /impeccable layout

**[P2] Below 1024 the metaphor collapses.**
- **What I saw:** there are no wires. A trace hides 31 of 38 pieces, so it acts as a filter, and switching to another piece needs Clear first.
- **Fix:** render the lit chain with connector glyphs. Keep the dimmed pieces as collapsed rows you can tap.
- **Command:** /impeccable adapt

**[P2] The entry point comes after the content.**
- **What I saw:** "Try Setlist…" and "Try Taste heatmap" are bold text, not buttons, and they sit below the grid.
- **Fix:** make them buttons that start the trace, placed above "The wiring".
- **Command:** /impeccable onboard

**[P3] Endpoint noise.**
- **What I saw:** "/v2/insights" repeats 8 times. The hero says "11 kinds" over 12 items (5b).
- **Fix:** show endpoints only in the panel, and explain 5b once.
- **Command:** /impeccable distill

## Persona red flags
- **Alex:** no `?trace=` link to share a path, and no type-to-find. Tab walks all 14 calls first. At 390, picking another piece means Clear, re-scroll, then pick.
- **Sam:** the focus ring is invisible in day mode. While tabbing, the panel folds and hides "Decides" exactly when Sam needs it.
- **Casey (390):** the first screen shows no pieces. During a trace, the panel plus the nav take about a third of the viewport.

## Minor observations
- The legend wraps at 390.
- The busk column's `justify-between` leaves uneven gaps at 1440.
- The selected piece's offset shadow crowds the column edge at 390.
- The dim and idle states look nearly identical at 1440.

## Questions
- Should "Why did I get this setlist?" be the default entry point, starting from a busk part?
- Should the brain be an actual honeycomb of cells?
- Does a busker ever need `urn:entity:place`?
- Could a trace read as one sentence?
