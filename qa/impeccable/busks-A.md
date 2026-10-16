# Assessment A · /busks (busk form) · Operate · f83f1a1

Evidence: scratchpad/imp/busks-A/ (390/768/1440, light + dark, fold/full, after empty submit; flow at 390: artist pick, submit).

## Design specificity verdict
**Mostly authored, with a generic middle.** Honeycomb shows up where it counts: Big Shoulders uppercase title, hex monogram badges on example acts, hex radio marks on permit and city cards, a signal-orange offset shadow on the selected card, and mono time ranges in the Time of day tiles (1440 light/dark). The middle of the form (Act name, Artists, Songs, Spotify link) is stock shadcn: label, then a 2px-ruled input, repeated four times with nothing that says "busking." The single-option Melbourne card with a yellow LIVE DATA chip is branded but has no job.

## Nielsen heuristics (Operate: all 10 apply)
| # | Heuristic | Score | Finding |
|---|---|---|---|
| 1 | System status | 3 | "0 of 10" artist counter, picks header with song count and length, Spotify-link loading text; the submit gives no feedback beyond the disabled button. |
| 2 | Real-world match | 3 | Busker vocabulary (pitch, permit, circle act, "sounds like"). "Live data" on the city and "Plan my week from this date" need context. |
| 3 | User control | 3 | Remove/edit per song, quick slots override cleanly. No way to clear all picks. |
| 4 | Consistency | 3 | Card-radio pattern is shared by City and Permit. Time of day uses a third selected style (solid fill; cream in dark) next to the shadowed cards. |
| 5 | Error prevention | 2 | Date picker has `min`, but From/To both offer 24 hours with only an "Up to 6 hours" hint. A blank Act name is silently submitted as "MY ACT" (seen on the result page at 390). |
| 6 | Recognition | 3 | Examples, typeahead with "Add as typed," and quick slots. The inline error sits ~1,100px above the summary at 390, so the user has to remember which field it means. |
| 7 | Flexibility | 3 | Comma-to-add artists, Enter to load a Spotify link, example acts as a shortcut, week planning from the same form. |
| 8 | Minimalist | 2 | A one-option city picker, three example cards before the form, and two helper lines under Songs. |
| 9 | Error recovery | 2 | Plain text ("Add at least one artist you sound like.") shown both inline and as a summary. But only the first issue is shown, focus stays on the submit button, and the summary does not link to the field. |
| 10 | Help | 3 | Hints sit next to each field (comma tip, Spotify link format, permit note, offline-mode notes). |
| | **Total** | **27/40 (68%)** | **Acceptable** (close to Good) |

## Cognitive load
Checklist failures: **3 (moderate)**.
- **Single focus:** fails. "Or try a made-up act" (three cards) comes before the form. At 390 the form starts around y≈1,000, below three stacked cards.
- **Visual hierarchy:** fails. The form has no heading, and the "Or…" heading has nothing before it to be the alternative to.
- **Working memory:** fails. On error, the message is at the bottom while the field it names is far up the page.

Decision points with more than 4 options: the From and To selects have 24 options each (they are bounded, so this is acceptable). The bottom bar shows 2 primary-weight submit buttons. Time of day (4) and Permit (3) are within limits.

## Emotional journey
The start is confident (big title, playful example acts). The low point is the empty submit: nothing visibly happens at the button except a pink box, and at 390 the field in error is off-screen. The finish is strong: one artist gets you a full "YOUR BUSK" plan with data provenance. That makes the empty-state error the most memorable friction.

## Strengths
1. Typeahead is honest and forgiving: a Spotify match card with releases and listeners, "Not on Spotify? Add 'Paul Kelly' as typed," and a clear offline-mode notice (390 light).
2. The Time of day tiles turn a 2×24 select problem into one tap and keep the exact selects as the source of truth.
3. Permit cards explain the consequence ("Adds the premium-only pitches") right where you choose. Dark mode keeps contrast and the orange shadow (1440 dark).

## Priority issues
- **[P1] Empty submit strands the user away from the problem.** *Why:* focus stays on "Plan my busk" and the page does not scroll. At 390 the only field in error ("Artists you sound like") is ~1,100px up. Screen-reader users hear nothing tied to the field. *Fix:* on error, focus the first invalid field (or a summary with anchor links), list every issue, and announce the summary with role=alert. *Command:* /impeccable harden
- **[P1] The form is not the first thing on its own page.** *Why:* "Or try a made-up act" comes before the thing it is the "or" to. On phones, three cards push the form below the fold, so first-timers may treat the example cards as the product. *Fix:* put the form first with a heading ("Your act"), and move the examples below it or into a single "No act yet? Try an example" row. *Command:* /impeccable layout
- **[P2] Blank act name is silently replaced with "My act."** *Why:* the result page reads "MY ACT," which feels like a bug and appears in shared links. *Fix:* mark the field "(optional)" like the Spotify field and show the fallback name as its placeholder, or require it. *Command:* /impeccable clarify
- **[P2] Weak focus indicator.** *Why:* the focused input (Songs, 390 light) only darkens its 2px rule, which is barely different from rest. Keyboard users lose their place in a long form. *Fix:* add a 2px signal-orange outline with an offset on all inputs and cards. *Command:* /impeccable polish
- **[P3] A one-option City picker.** *Why:* it takes about 70px and adds a "Live data" chip with no decision behind it. *Fix:* replace it with a one-line "Melbourne · live data" statement until a second city exists. *Command:* /impeccable distill

## Persona red flags
- **Jordan (first-timer):** sees examples first, so may not know whether "Watch Busk Map plan this act" is the main path. "Plan my week from this date" vs "Plan my busk" has no explanation. After the empty submit, the pink box says "Artists you sound like," but that field is off-screen at 390.
- **Sam (keyboard/screen reader):** must Tab through skip link, logo and three example cards before reaching Act name. Focus is not moved on error. Focus rings on inputs are low-contrast. Radix select IDs (`radix-_R_…`) show up as focus targets with no label in the tab trace.
- **Casey (mobile):** the primary action is at the very bottom of a ~3,000px form. The fixed bottom nav covers the bottom 60px, so error text near the buttons can sit under it.

## Minor observations
- "When and where" legend and "City" label stack with no spacing between them (all widths).
- Evening's selected state is a solid dark fill in light mode and cream in dark mode, which is a different selection language from the shadowed cards.
- "Search for songs above." sits under the search box and reads like a leftover.
- The error summary repeats the inline text exactly. Use it for the full list instead.

## Questions to consider
- What if the only required input, "who do you sound like," were the hero field, with everything else defaulted and collapsible?
- Does a busker need the picker for 24 starting hours, or just the four tiles plus "custom"?
- Should the examples be a teaser after the form rather than the gateway before it?
