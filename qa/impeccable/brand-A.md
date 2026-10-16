# /brand · Assessment A (design review) · mode Read

Build f83f1a1 at localhost:3213/brand. Viewed at 390, 768 and 1440, day and night. Screenshots are in scratchpad/imp/brand-A/. The page heights are 5,677 px at 390 (folded), 22,866 px at 768 and 16,299 px at 1440. There were no console errors, no 4xx responses and no horizontal page scroll.

## Design specificity verdict
**Authored, not interchangeable.** The page makes its case with the product's own material: a live specimen map with hex heat cells and hatched no-busking zones, PitchRows, the weather strip with "YOUR SLOT 12–15", PlanAlerts and the Qloo StatStrip. It is a working brand book, not a set of swatches. The hero (dark grain, a 144 px "HONEY**COMB**", a 6 px signal rule) and the 2 px-ruled cards carry the street-poster idea all the way through.

**Where it slips:** the page structure (eyebrow number, giant heading, intro, card grid) repeats eight times with no change of pace. Sections 02, 04 and 06 are plain data tables that any design-system site could have.

## Nielsen heuristics
| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of status | 2 | There is no sticky or active-section nav on a 16–23k px page. Once you scroll past the hero, you cannot tell where you are. |
| 2 | Match real world | 3 | The domain words (pitch, busk) are strong. The jargon is aimed at insiders: "design system v66", "Tokens → shadcn", PascalCase component lists. |
| 3 | User control | 2 | There is no back-to-top link and no in-page day/night toggle, even though the copy says "Switch your system to night". |
| 4 | Consistency | 3 | The ruled-card system holds. Principle titles are display caps but Voice titles are bold sans. "Honest numbers" appears twice, once in Principles and once in Voice. |
| 5 | Error prevention | 3 | Downloads name their files. The Handoff section points to `hackathons/qloo-2026/design-handoff/`, which does not exist in the repo and has no link. |
| 6 | Recognition vs recall | 2 | The Colour swatches show no hex values; the reader has to find them in the tokens table about 2,000 px further down. On phone, that table's Day and Night columns are off screen. |
| 7 | Flexibility | 2 | There are anchors, but no search, no copy-token buttons and no fold on tablet. |
| 8 | Aesthetic / minimalist | 3 | Strong, but the page is dense: orphan cards, a broken funnel specimen and a duplicated hero logo. |
| 9 | Error recovery | n/a | The page has no errors, inputs or failure states. |
| 10 | Help & docs | 3 | The page is the documentation, and every section has an intro. The handoff reference is dead. |
| **Total** | | **23/36 (64%)** | **Acceptable** |

## Cognitive load
**4 checklist failures, so the load is high.**
- **Chunking:** some groups are far larger than the four-item guideline: 8 principles, 9 colours, 41 icons, 45 token rows and a 72-component list.
- **Minimal choices:** the hero has 8 anchor links. At 390 these wrap into three rows with about 47 px gaps.
- **Working memory:** colour values have to be looked up in the tokens table (see heuristic 6).
- **Progressive disclosure:** the PhoneFold breakpoint is 719 px, so 768 gets everything open. That makes the tablet page 22,866 px, the longest of the three widths.

**Decision points with more than 4 options:** the hero nav (8), the phone fold stack (14 or more disclosures), and the Plan your busk specimen (choice cards, time toggles and chips together).

## Emotional journey
- **Peak:** the hero, and the Components section at 1440. The live PitchRow with its offset shadow and the night grain read as real craft.
- **Valley 1:** Tokens → shadcn on phone. Opening "Colour tokens (45)" shows a frame inside a frame. The rows are about 100 px tall and the swatches are clipped at the right edge, so the token colours are not visible without sideways scrolling.
- **Valley 2:** Assets. The cards are tall and repetitive, and filenames break mid-word.
- **End:** the Handoff block looks good but points at a folder you cannot reach. The page ends on a promise it does not keep.

## Strengths
1. **Real components as specimens.** Every state shown (PlanAlert limit, Qloo unavailable, data-only, AgentStatusLine ×3) is the app's own component, so the book cannot drift from the product.
2. **Honest-data language made visible.** The DataStatusBadge row (Qloo: Live, Weather: Cached, Foot traffic: Estimated) and the "Next · not built yet" NoteCard turn the "Honest numbers" principle into UI you can see.
3. **The phone fold.** At 390 the 23k px page becomes about 5.7k px of clearly labelled disclosures, with counts in mono.

## Priority issues
1. **[P1] The tokens table is unusable at 390.**
   - *Why:* it has a fixed `min-width: 860` inside a 318 px region inside a disclosure card. The colour columns are hidden and the Use column makes rows about 100 px tall. This is the page's single most reusable reference.
   - *Fix:* below 720 px, render each token as a stacked card showing the name, day and night swatches with hex values, then the use. Drop the nested frame.
   - */impeccable adapt*
2. **[P1] Dead handoff reference.**
   - *Why:* section 08 says "everything a team needs" lives in a path that does not exist in this repo, and nothing links to it. A studio reader acting on this hits a wall.
   - *Fix:* link to the real files (`globals.css`, `public/brand`), or say where the handoff folder is published.
   - */impeccable clarify*
3. **[P2] The ResearchFunnel specimen looks broken.**
   - *Where:* the Research card at 1440 day.
   - *Why:* the connector dashes float as orphan "–" marks after the funnel wraps into a narrow card, so the funnel reads as a rendering bug.
   - *Fix:* give the group `wide`, or hide connectors when the funnel wraps.
   - */impeccable polish*
4. **[P2] No wayfinding on a 16–23k px page.**
   - *Fix:* add a sticky section rail or top bar from 768 up, with the active section marked and a back-to-top link. Also fold, or two-column, the page at tablet width.
   - */impeccable layout*
5. **[P3] Grid orphans and night-swatch naming.**
   - *Grid orphans:* auto-fit grids leave lone cards in 8 principles, 4 voice items, 9 colours and the Social row.
   - *Night swatches:* at 768 night the "Paper" swatch is near-black, and Bluestone, Paper and Ground look almost identical.
   - *Fix:* size the grids to their counts, and show a day/night split on each swatch.
   - */impeccable polish*

## Persona red flags
- **Sam (accessibility):**
  - Each scrollable `role=region` table frame is focusable, which is good, but on phone it sits inside a `<details>` and only scrolls sideways.
  - The swatches are `aria-hidden`, so hex values are announced as text, but the Colour section has no values at all.
  - At 390, the two-letter "GW" hex and the 11 px mono captions are small.
- **Alex (power user, a dev implementing from the deck):**
  - There is no copy button on tokens or filenames.
  - The 72 component names are a dot-separated plain string, with no links to source.
  - Getting the colour hex values takes a long scroll down to the tokens table.
- **Casey (mobile):**
  - The hero takes the whole first screen. The Busk Map lockup repeats directly under the header, which already shows it.
  - Jumping to #tokens lands on a closed fold that needs another tap.
  - The bottom nav covers the last row of every opened fold.

## Minor observations
- Asset filenames break mid-token at 1440 ("favicon.sv / g", "apple-touc / h-icon-18 / 0.png"). The favicon cards could be wider, or the filename could wrap above the Download link.
- The Controls card at 1440 day has about 400 px of empty space below its specimens.
- Screens says each screen "is drawn … in the design deck's Plan Screens canvas", which is a reference the reader cannot open.
- Under night, Disabled renders as brown-orange, which reads as a colour of its own rather than "off".

## Questions to consider
- Who is this page for: a judge, a studio, or the team? The hero copy says a studio, but "v66" and the shadcn mapping say the team.
- Should the book use its own logic and break its sameness, so that each of the eight sections gets one distinct composition, as a poster would?
- If honest numbers are the brand's core, why do the colour specimens hide their numbers?
