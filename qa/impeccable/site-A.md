# Assessment A: site chrome, mode Operate

Build f83f1a1 (:3213): 7 routes + 404 at 390/768/1440, day/night; keyboard, tap and page-height checks. Screenshots: scratchpad/imp/site-A/.

## Design-specificity verdict
**The header and phone nav look made for Busk Map; the footer looks generic.** The bluestone bar has a 4px orange rule. The active tab is a solid orange box with mono caps, and on phones the active icon sits in an orange tile with a 2px rule. That is the Honeycomb poster style, and it would not fit another product unchanged. The footer is the usual three-part layout with two brand touches added: the GitHub hex and the pixel critter. On paper pages it is a hairline above 13px muted text (/privacy at 1440), so it looks weak next to the header.

## Nielsen heuristics
| # | Heuristic | Score | Note |
|---|---|---|---|
| 1 | Status | 3 | Active tab is marked visually and with `aria-current`. Tapping a tab lights it and shows a loading skeleton within 150ms. Nothing is lit on /brand, /privacy or /terms. |
| 2 | Real-world match | 3 | The label "Brain" is opaque. |
| 3 | Control | 3 | A skip link exists and the logo goes home. The phone nav has no Home item. |
| 4 | Consistency | 2 | The nav colour changes by route, there is a blank tail on /plan, and the footer layout breaks at 768. |
| 5 | Error prevention | n/a | The chrome has no inputs. |
| 6 | Recognition | 4 | Every nav item has an icon and a text label at all widths. |
| 7 | Efficiency | 2 | The desktop header does not stick (the /plan page is 6371px at 1440). No shortcuts. |
| 8 | Minimalism | 3 | The landing shows the lockup three times. The footer has 8 targets. |
| 9 | Recovery | 3 | The 404 page keeps the full chrome. |
| 10 | Help | 2 | Nothing in the chrome links to help. |
| **Total** | | **25/36** | **69%: Acceptable** |

## Cognitive load
- **Two checklist failures: moderate load.**
  - **Grouping:** "Privacy · Terms · Brain · Brand" puts legal and product links in one row at equal weight.
  - **Minimal choices:** the phone footer has 8 targets (home, 4 links, GitHub, T04435, critter) sitting right above the 3-item nav.
- No other decision point has more than 4 options.

## Emotional journey
The landing ends strongly (dark CTA band into dark footer), though at 390 day a paper bottom nav sits under the dark hero throughout. The low point is the end of a plan: at 390/768 the footer is followed by ~900–1170px of empty paper.

## What's working
1. **Active-state language.** The orange box and tile are bold, on-brand and paired with `aria-current`. The tile's rule drops at night through `--fill-rule`.
2. **Accessible base.** The skip link is the first Tab stop. The focus ring shows on bluestone (768 night). Phone tabs are 130×62 with permanent labels.
3. **Instant feedback.** Tapping a tab lights it and shows a skeleton within 150ms.

## Priority issues
**[P1] Blank scroll after the footer on /plan (390, 768).**
- **What happens:** page 5942px vs footer end 4774px (768); 8359 vs 6692 (390). Absolute `sr-only`/score spans in collapsed folds escape the `min-h-0 overflow-hidden` clip, which is not their containing block.
- **Why it matters:** the core screen ends on a blank screen.
- **Fix:** make the clip div `relative`, use `contain: paint`, or set `hidden`/`inert` on collapsed content.
- **Command:** /impeccable harden

**[P2] The nav theme changes by route.**
- **What happens:** `MobileNav` goes dark only on /brain, so the dark landing gets a paper nav; the footer is dark on / and /brain only.
- **Fix:** derive the nav theme from the page's background, the same way the footer does, and include /.
- **Command:** /impeccable polish

**[P2] No "you are here" on /brand, /privacy, /terms or the landing.**
- **What happens:** neither nav highlights anything, and the footer links have no current state.
- **Fix:** add `aria-current` and a current style to the footer's `SITE_LINKS`.
- **Command:** /impeccable clarify

**[P2] The footer is overloaded and ungrouped.**
- **What happens:** 8 targets, legal and product links mixed, and the critter is an unlabelled icon link.
- **Fix:** group into "Brain · Brand" and "Privacy · Terms", fold GitHub and the author into one credit line, and give the critter a visible label.
- **Command:** /impeccable distill

**[P3] The footer grid breaks at 768.**
- **What happens:** `md:grid-cols-[1fr_auto_1fr]` squeezes the left column, so "with Qloo" wraps under the logo (/busks and /plan).
- **Fix:** use 3 columns from about 1024px up.
- **Command:** /impeccable adapt

## Persona red flags
- **Casey (mobile):** the dead scroll at the end of a plan, the paper nav under the dark hero, and a dense footer right above the nav.
- **Jordan (first-timer):** the main nav says "Brain" without saying what it is. There is no Home tab, and nothing is lit on the landing.
- **Sam (screen reader):** two navs both labelled "Main" (CSS hides one per width); the critter link's purpose is invisible to sighted users.

## Minor observations
- The phone nav is fixed but the desktop header is not, so the two layouts behave differently.
- Night: bluestone header blends into the page; only the orange rule separates them.

## Questions
- Would "How it works" serve users better than "Brain"?
- Should the desktop header stick and carry the plan's act name and a Copy link action?
- Does the footer need a second logo at all?
