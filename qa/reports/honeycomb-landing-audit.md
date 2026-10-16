# QA-01 · Landing `/` audit: Honeycomb design vs build (index)

**QA-01** · branch `design/honeycomb` · commit tested 69a6cad. Rows are #01–#21 in the HTML; cite a finding as “QA-01 #04”.

**Visual report:** [honeycomb-landing-audit.html](honeycomb-landing-audit.html). It shows design and build side by side at 390, 768 and 1440, with a red box around each gap. Images are in `qa/screens/honeycomb/landing/`.

**Build:** `design/honeycomb` at 69a6cad, offline, served from QA's own build on port 3213 (same commit as 3210). **Date:** 17 Oct 2026.

**Inventory sources** (read before the build was opened):
1. BRAND's deck, the Main board at 1440/768/390
2. DS v62 READMEs: TasteMap, ExampleActCard, StatStrip, ResearchFunnel, PlanMap, SetlistPanel, QlooWordmark, SiteFooter, AppHeader, MobileNav
3. `restyle-notes.md` ("Landing /" and §4 copy)
4. `decisions.md` lines 104, 105, 109, 121, 131 (v67) and 146
5. HQ's defaults in `honeycomb-round.md`
6. DEV's 14 deviations

## Counts (21 items)

| Present | Different | Missing | Broken |
|---|---|---|---|
| 8 | 7 | 5 | 1 |

## Defects (all on the landing)

| Row | ID | Sev | Item | Lost at |
|---|---|---|---|---|
| #04 | B-018 | Medium | The hero "Plan a busk" CTA shows no focus indicator. Its poster `box-shadow` overrides the focus ring (WCAG 2.4.7). It's the only one of 58 tab stops with this problem | DEV self-check (QA's focus check also missed it: it counted any shadow as a ring) |
| #16 | B-019 | Medium | The "Honeycomb" brand teaser section (→ /brand) is missing | BRAND→handoff |
| #11–#13 | B-020 | Medium | "What you get back" has no research funnel, no taste map with pins, no Learn these and no set length (a 3-row list instead) | BRAND→handoff |
| #03, #06 | B-021 | Low | Hero: no hatched no-busking zone, event diamond or river on the taste map; no glowing honeycomb cells on the ground; caption reworded | BRAND→handoff |
| #09 | B-022 | Low | "Try an act" cards have no "Saturday · 6–9 pm" line and no "Plays …" songs line | BRAND→handoff (the DS ExampleActCard README also lacks them) |
| #18 | B-023 | Low | The footer has a "Brand" link the user removed (decision 121), and it sits on paper, not the deck's dark band | handoff→DEV |
| #14 | B-024 | Low | Brain teaser: an extra 4th number labelled "parts of your plan" (the brand word is "busk") | DEV self-check |
| #02 | B-025 | Low | The H1 orphans "PLAY." at 1440 (5 lines; the deck keeps it at 4) | DEV self-check |
| #19 | B-026 | Low | The "For judges" link from HQ's 8 judge additions (decision 104) was never designed | brief→BRAND |

Also missing, but already accepted: the demo-video slot (DEV deviation 1).

## Why the process missed these
- **BRAND→handoff (5 items).** `restyle-notes` "Landing /" names 6 of the deck's 18 landing parts. The funnel, the plan-map preview, Learn these, the brand teaser, the hero map details and the ticker aren't in it. DEV built from the handoff plus HQ's corrections, so whatever only the deck had depended on DEV looking at it.
- **DEV self-check.** None of these sections are in DEV's 14 deviations. DEV's sweep checked axe, overflow and focus, not "is every designed section here".
- **QA.** QA's layout and axe specs were derived from the build (a landing h1 and the brain-teaser test id), so a missing section couldn't fail them. QA's focus check counted any box-shadow as a ring and missed B-018. Fixed for this audit: focused styles are now compared with unfocused ones.
- **MANAGER.** The 8 judge additions (decision 104) weren't tracked to a deck section or a build check, so the "For judges" link fell through.

## Process fixes (also at the foot of the HTML)
1. BRAND: generate restyle notes from the deck boards, one row per deck section.
2. DEV: self-check section by section against the deck at 3 widths, side by side, and list every unbuilt section as a deviation.
3. QA: build the inventory from the design before opening the build; specs assert each designed section; focus checks compare focused with unfocused styles.
4. MANAGER: trace every brief item to a deck section and a build check.
5. All: copy decisions that change a screen (v67, 121) into the handoff and the checklist the same day.
