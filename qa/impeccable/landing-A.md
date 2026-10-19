# Assessment A · Landing `/` (Persuade) · f83f1a1

Inspected live at 390, 768 and 1440 wide, day and night. Clicked the hero CTA (→ `/busks` form) and the Folk duo card (→ new run at `/p/…`), tabbed 8 focus stops.

## Design specificity verdict
**Authored for this product.** The hero is a hex taste map with numbered pitches 1–3, a poster headline and an orange slab button. "Busking is guesswork" sets the guess ("Wonderwall, again.") against the fix. "What you get back" uses the real product components, not generic feature tiles. The bottom third drifts: Beyond buskers, Brain and Brand are three look-alike bordered panels with offset shadows, written for judges rather than buskers.

## Nielsen heuristics
| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of status | 3 | The example cards start a run right away. The taste map can show an empty "Show the map" stub. |
| 2 | Match real world | 3 | Busker voice is strong ("ranger moves you on"). The funnel uses system jargon: "taste cells mapped", "sensor counts", "rules checks". |
| 3 | User control | 3 | The own-act and Week paths are offered. Each example click silently makes a new plan URL. |
| 4 | Consistency | 3 | The main action has three labels: "Plan a busk", "Plan your busk" and "Watch Busk Map plan this act". |
| 5 | Error prevention | 3 | The Copy and "Learn it" buttons in the static setlist preview look live. |
| 6 | Recognition | 3 | Cards show "Sounds like" and "Plays". |
| 7 | Flexibility | n/a | Persuade surface |
| 8 | Aesthetic / minimalist | 2 | A "[Demo video · 60–90 s]" placeholder, a 10-node funnel and three teaser bands. |
| 9 | Error recovery | n/a | No input on this page that can fail. |
| 10 | Help & docs | n/a | Persuade surface |
| **Total** | | **20/28** | **71%: Good** (low end) |

## Cognitive load
Three checklist failures (moderate):
- **Chunking:** the funnel is a 10-node chain. At 390 it wraps into 5 ragged lines.
- **Single focus:** "IN PARTNERSHIP WITH Qloo" is set in 44px purple display type right under the hero CTA (1440), so it competes with the button.
- **Progressive disclosure:** the landing page shows the full setlist with Learn these, set length and per-song scores.

**Decision points with more than 4 options:** "Try an act" has 7 links (3 cards, 3 Week links, Plan your busk).

## Emotional journey
- **Peak:** the hero. The glowing map makes the promise concrete in about 2 s, in both themes.
- **Valleys:** the demo-video placeholder right after the ticker, then "Not built yet", Brain and Brand just before the ask.
- **End:** "Your crowd is out there." is strong, but it comes after the detours.
- **Night mode:** at 1440 dark, the hero, video, Beyond, Brain and closing bands all share the page background, flattening the poster rhythm.

## Strengths
1. **The hero's type and map.** "What to play." stays on one line at every width, and the CTA clears the fold at 390 (y≈690–760).
2. **The "Guessing / With Busk Map" cards.** Concrete, local, funny.
3. **Real components with labelled example data.** Honest expectations.

## Priority issues
- **[P1] A demo-video placeholder ships as the second block.**
  - Why: peak attention spent on missing content; reads unfinished (all widths, both themes).
  - Fix: remove it until the video exists, or use a short loop of the funnel filling in.
  - Command: `/impeccable distill`
- **[P1] The hero never says where or for whom.**
  - Why: no city named; Melbourne shows only via example street names.
  - Fix: one line under the H1 (city plus what you get); shrink the partnership line to a mono label.
  - Command: `/impeccable clarify`
- **[P2] The bottom third serves judges.**
  - Why: Beyond buskers, Brain and Brand sit between the product proof and the close.
  - Fix: move them below the final CTA, or merge them into one "Under the hood" strip.
  - Command: `/impeccable distill`
- **[P2] The 10-node funnel is hard to read, worst at 390.**
  - Fix: 3 grouped stats here (looked at / checked / picked); full chain on the result page.
  - Command: `/impeccable layout`
- **[P3] Night mode loses the band rhythm.**
  - Fix: give the dark bands a raised surface or an orange top rule.
  - Command: `/impeccable colorize`

## Persona red flags
- **Jordan (first-timer):**
  - The hero names no city.
  - "Sensor counts" and "rules checks" are opaque.
  - The two CTA verbs ("Plan a busk" and "Watch Busk Map plan this act") leave the difference unclear.
- **Riley (stress tester):**
  - The bracketed video placeholder and the "not built yet" badge suggest a prototype.
  - The Copy and "Learn it" buttons on the example data invite pointless clicks.
- **Casey (mobile, 390):**
  - The map takes the top ~310px, so the headline starts at y≈440.
  - The page is 9,431px tall, and the closing CTA sits about 8 screens down.

## Minor observations
- **Card focus:** keyboard focus on the example cards is only a thicker border, weak next to the CTA's solid outline (1440 day).
- **Ticker:** "Qloo" appears in 4 of the 6 items, so it reads like sponsor copy.

## Provocative questions
- Is this page for the busker or the judge?
- If the hero already shows the taste map, does the page need a video at all?
- What would be lost if the page ended right after "And what to play there"?
