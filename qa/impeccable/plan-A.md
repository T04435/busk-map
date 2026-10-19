# Assessment A · Plan page (/p/<id>, Operate)

Seen: folk-duo → /p/qiYncwWE3 at 390/768/1440, day and night; the Full details sheet; Qloo down (acoustic&faults=qloo, lands on `?run=0`). Shots: imp/plan-A/.

## Design specificity: authored
Only Busk Map has these: hex rank badges, score dials, the hex taste map, the hex funnel and the "Your slot 12–15" weather band. The risk is overuse: with hexes on everything, they stop signalling. At 1440 the map is a solid sheet of saturated orange, and the black top pins get lost in it, more so at night.

## Nielsen heuristics

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Status | 3 | Clear replay badge and status line. On Qloo down the funnel spins "choosing pitches" beside "STOPPED". |
| 2 | Real world | 2 | "AGENT VS ENGINE" eyebrow (banned by the code's own B-049 rule), "taste cells". The sheet says "Taste match 0.84"; the comparison says "84 out of 100". |
| 3 | Control | 2 | Esc closes the sheet and clears `?pitch`. Slot, permit and act can't be changed from the plan. |
| 4 | Consistency | 2 | Two "Try again" on Qloo down. The sheet repeats the pitch name twice. Three styles of test-data notice. |
| 5 | Error prevention | 3 | Legality line, "NOT A LEGAL PITCH", 250 m spacing note. |
| 6 | Recognition | 2 | Rows show name, time and score only. The why sits in the sheet or the "vs a plain AI" panel. |
| 7 | Flexibility | 2 | Deep link and Copy link. 18 (390) or 20 (1440) tabs to the first "Full details". |
| 8 | Minimalism | 2 | Pitch 1 sits at y≈850 (1440) and y≈1156 (390). Blank scroll below the footer: ~1,850 px (390), ~1,165 px (1440). |
| 9 | Error recovery | 3 | Plain Qloo-down copy, and the act, day and permit are kept. |
| 10 | Help | 2 | "Data used" and "est." are there. Nothing says what "60" means. |
| **Total** | | **23/40** | **Acceptable** |

## Cognitive load: high (4 failures)
- Single focus: the funnel, the agent card, the map and the list compete above the answer.
- Chunking: 8 funnel chips.
- Minimal choices: 28 map pins plus Browse (25), zoom and the legend.
- Working memory: comparing pitches means opening one sheet after another.

Decision points over 4: the map; the 1440 header (Copy link plus 4 badges); the list (3 rows × select, Full details, badges, plus "Plan my week").

## Emotional journey
The peak is "YOUR BUSK", a ranked list on a map that feels made for you. The valley is at 390: the first screen is header, tags and the test banner, so the answer feels delayed. The end is weak: the page closes on a source list, then an empty scroll on phone with only the tab bar, not "go play here". Qloo down reassures ("your act, day and permit are kept"), but the spinning hex undercuts it.

## Strengths
1. The pitch rows: big hex rank, condensed name and score dial scan instantly at every width; rank 1's orange offset shadow marks the pick.
2. The weather strip's boxed slot band ties the data to the busker's own hours.
3. Honesty: the legality line, "est.", the replay label, and plain-AI picks flagged "NOT A LEGAL PITCH".

## Priority issues
- **[P1] Blank scroll void below the footer.** On phone (both themes, and at 1440) the page "ends" on an empty screen, which looks broken. Fix: the closed "Every check, from earlier" fold (honeycomb/fold.tsx) still adds to scrollHeight. Most likely its positioned descendants escape the `min-h-0 overflow-hidden` wrapper: make that wrapper `relative`, or don't render the list while it is closed. /impeccable harden
- **[P1] The reasons are not on the pitch rows.** "Why here?" is answered in the comparison panel and the sheet, not the list. Fix: give each PitchRow a 2-fact line (e.g. "~930/h · taste 84"). /impeccable clarify
- **[P2] Research before the answer.** At 1440 the 8-chip funnel and the Agent vs Engine card sit above "Your busk"; at 390 header, tags and banners fill screen one. Fix: move both below the busk at every width, and compress the tags to one line. /impeccable layout
- **[P2] Engineering vocabulary.** "AGENT VS ENGINE", "the agent finishes" (PendingPlan), "taste cells", "test model". Fix: say "Claude" and "Busk Map's scores" (B-049), and use one 0–100 scale. /impeccable clarify
- **[P2] The Qloo-down page contradicts itself.** Two retry buttons, and a spinner under "STOPPED". Fix: keep one retry in the panel; show the funnel as stopped. /impeccable polish

## Persona red flags
- **Casey (390):** the first pitch is 1.3 screens down; the fixed tab bar covers the map; the page ends in a void; in the sheet the name repeated twice fills half the screen.
- **Alex:** 18–20 tabs to "Full details"; no row shortcuts; can't tweak the slot here; one sheet per pitch to compare.
- **Sam:** 28 pins and "Browse" come before the list in tab order; at night the black top pins sit on bright orange over a light basemap.

## Minor observations
- "3 of Busk Map's 3 picks are one the plain AI didn't name" is ungrammatical, and "ONLY BUSK MAP" has no space above it.
- The inline score hex breaks the sheet's line height.
- Rank 3's empty badge strip leaves a dead band.
- The basemap stays light in night mode.

## Questions to consider
- What if the row *was* the details, and the sheet held only the charts?
- Is the funnel proof that belongs after the answer?
- Would the map read better with taste cells muted and only the 3 picks loud?
