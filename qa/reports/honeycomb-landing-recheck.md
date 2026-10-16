# Landing `/` recheck: 29 parts, board vs build (index)

**Visual report:** [honeycomb-landing-recheck.html](honeycomb-landing-recheck.html). For each part it puts BRAND's board crop and QA's deck render at that width on the left and the build on the right, at 390, 768 and 1440. Each part carries QA's verdict next to DEV's claim. Images are in `qa/screens/honeycomb/recheck/`.

**Build:** `design/honeycomb` at 91b220e (DEV's fixes d169cb4..91b220e), a clean export, offline on QA's own port. **Date:** 16 Oct 2026.

**Checklist:** BRAND's `design-handoff/inventory/landing/` (29 parts). QA hasn't ticked ☐ QA in that README, because QA must not edit the hackathon folder; the QA column below is the tick to copy across.

## Counts (29 parts)

| Present | Different | Missing | Broken | Held |
|---|---|---|---|---|
| 20 | 6 | 1 | 0 | 2 |

DEV claimed 21 built, 6 deviations and 2 held. QA differs in three places:
- **L20** (marked built) differs from its crop.
- **L13** and **L17** differ beyond what DEV declared.
- **L11** (the video) is an accepted deviation, so QA counts it as Missing.

## Per part

| Part | QA | DEV | Note |
|---|---|---|---|
| L01 Header | ☑ Present | built | |
| L02 Hero band | ☑ Present | built | |
| L03 Glowing cells | ☑ Present | built | B-021 glow fixed |
| L04 Hero headline | ☑ Different | deviation | B-025 fixed; HQ intro line declared |
| L05 Hero taste map | ☑ Held | held | Zone, event and river held. Also a full grid and plain pins, not the board's blob and target pins |
| L06 Fill-in and pin drop | ☑ Present | built | |
| L07 Map caption | ☑ Different | deviation | Extra sentence, declared |
| L08 Hero CTA | ☑ Present | built | B-018 fixed (focus ring visible) |
| L09 In partnership | ☑ Present | built | |
| L10 Ticker | ☑ Present | built | |
| L11 Demo video | ☑ Missing | deviation | Accepted deviation 1 |
| L12 Try an act heading | ☑ Present | built | |
| L13 Act cards | ☑ Different | deviation | **B-032** |
| L14 Guesswork heading | ☑ Present | built | |
| L15 Problem cards | ☑ Present | built | |
| L16 What you get back | ☑ Present | built | |
| L17 Research funnel | ☑ Different | deviation | **B-033** |
| L18 Your busk | ☑ Different | deviation | Declared in full |
| L19 And what to play there | ☑ Present | built | |
| L20 Setlist panel | ☑ Different | built | **B-034** |
| L21 Beyond buskers | ☑ Present | built | |
| L22 Brain teaser | ☑ Present | built | B-024 fixed. dev/core R4 makes it 12 kinds |
| L23 Brand teaser | ☑ Held | held | B-019 |
| L24 Closing CTA | ☑ Present | built | |
| L25 Footer | ☑ Present | built | B-023 fixed |
| L26 Bottom nav | ☑ Present | built | |
| L27 Phone layout | ☑ Present | built | No horizontal scroll at any width |
| L28 Reduced motion | ☑ Present | built | No running animations; glow at 0.5 |
| L29 Night theme | ☑ Present | built | |

## New defects (all Low, lost at DEV self-check)

| ID | Part | What differs from the crop and wasn't declared |
|---|---|---|
| B-032 | L13 | The initials hex is filled orange and reads "SA" (board: an outline hex, "SX"). The action is a plain dark row with an arrow (board: an orange underlined link). The Plays lists differ from the board |
| B-033 | L17 | Labels sit under the hexes, stages are joined by dashes instead of ▸ chevrons, and the row is boxed in a card |
| B-034 | L20 | Learn these is a tan panel (board: a bordered box with an orange top rule and a mono title). The set-length line is sans, rows are numbered 1–4 instead of 01–04, the heading names the pitch, and there's no Copy button |

**Known, not new:** after 8 pm the sax example shows "This slot has passed". This is the evening-slot bug fixed on dev/core in e220abd, and DEV is porting it.

## Process fixes
1. DEV: a part counts as built only when it matches its crop at 3 widths; any visible difference is a declared deviation.
2. DEV: when a real component stands in for a drawn one, restyle it or list each difference.
3. BRAND: draw the act-card copy from `src/lib/examples.ts`.
4. QA can't tick the README in the hackathon folder; MANAGER or BRAND copies the QA column across.
5. All: port shared dev/core fixes to design/honeycomb in the same round.
