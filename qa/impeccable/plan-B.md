# Plan page: Assessment B (detector + browser evidence) and audit

Target: plan page, `http://localhost:3213/plan?example=folk-duo` (client redirect to `/p/<id>`, waited on region "Pitches", exact name). Build: design/honeycomb f83f1a1, offline, port 3213 (not started or stopped by me). Source: export at `scratchpad/hc9/src`. All commands ran from the export dir. Evidence files: `scratchpad/imp/plan-B/` (`detect-cli.json`, `results.json`, `probe2.json`, screenshots `*-light.png`, `*-dark.png`, `*-overlay.png`, `pitches-390-*.png`, `sheet-390.png`, `focus-390.png`, `popover-390.png`; scripts `run.mjs`, `probe2..5.mjs`).

Isolation: no QA report, `qa/tools/*-parts.py` or Assessment A output was read.

---

## 1. CLI scan

Command: `impeccable detect --json "src/app/p/[id]" src/app/plan src/components/plan src/components/map src/components/pitch-card`

- **Exit code 0. 0 findings** (`[]`). The same result came back with `--no-config` and in text mode. There is no DESIGN.md, no `.impeccable` config (only `.impeccable/live`) and no `impeccable-disable` comments in scope, so nothing was suppressed.
- Note: the static scan cannot see classes that render through shared `src/components/honeycomb/*` components (PitchRow, EvidenceLine, PageHeader). The browser findings below come from those.

## 2. Browser overlay

New Playwright Chromium page per run, at 1440x900 and 390x844 in light mode. I navigated, waited for "Pitches", set `document.title` (preflight OK: title became `Plan · Busk Map [impeccable-preflight]`), then ran `page.addScriptTag({ path: imp/detect.js })` (injected OK) and waited 3 s. `window.__impeccableCoreError` was empty, and there were no warn or error lines. The overlay rendered visibly (`1440-light-overlay.png`).

Console: `[impeccable] 19 anti-patterns found` (1440) / `16 anti-patterns found` (390). `window.impeccableDetectAsync()`: 1440 = 20 elements / 23 findings; 390 = 16 elements / 19 findings.

| Rule | 1440 | 390 | Where | Verdict |
|---|---|---|---|---|
| all-caps-body | 8 | 8 | Pitch names in PitchRow `b.font-display uppercase` (honeycomb/pitch-row.tsx:38), map marker tooltip labels, SVG text, header meta `span.font-mono uppercase` (37 chars) | **True, low impact.** 46–48-char pitch names in condensed uppercase wrap to 3 lines at 390. It is a brand choice, but the long names hurt it. |
| skipped-heading | 1 | 1 | h2 "How we found your pitches" → h4 "Artists this crowd likes" (plan/tool-results.tsx:152,167) | **True.** axe agrees (`heading-order`, 1440). |
| undersized-ui-text | 3 | 0 | 10px "EVIDENCE" chip (honeycomb/evidence-line.tsx:8) | **True.** Below the 11px floor. Contrast is fine at 6.1:1. |
| line-length | 1 | 0 | `#research > p.text-sm`, about 182 chars per line (plan-view.tsx:577 section) | **True at desktop.** |
| kicker-above-heading | 2 | 2 | "Agent vs engine" above h2; "Weather" above h2 (weather-strip.tsx) | Pattern hit. It is house style: mono kickers run across the system. This is a judgment call, not a defect. |
| nested-cards | 1 | 2 | Agent stream card's inner bordered blocks (`section.flex.min-w-0 > div.border-2`) | Partly true. A bordered box inside a bordered box in the research feed. |
| clipped-overflow-container | 2 | 2 | Map wrapper `overflow-hidden` (plan-map.tsx:324) and `.maplibregl-map` | **False positive.** The clip is deliberate for a map. The summary popover sits inside and is sized `min(19rem, 100%-4rem)`, so it never needs to escape. |
| side-tab | 1 | 1 | `header.h-16` border-bottom 4px | **False positive.** A full-width header rule, not a one-sided card accent. |
| repeating-stripes-gradient | 1 | 1 | Hatch fills | **False positive.** The hatch carries meaning (no-busking zones / legend key), not decoration. |
| cream-palette | 1 | 1 | page bg rgb(242,238,230) | Brand ground (honeycomb), intentional. Not a defect. |
| dark-glow | 1 | 1 | "Zero-offset glow #ffba00" | **Could not reproduce.** No element carried a zero-offset blurred shadow or rgb(255,186,0) at rest. It is most likely the 2px focus/ring shadow `--focus-ring: 0 0 0 2px` (no blur), so a false positive. |
| text-occlusion | 1 | 0 | `span "undersized functional te…"` | **False positive.** The detector's own overlay label covering text. |

Failed or skipped steps: none in the final run. The first run failed because `getByRole('region', { name: 'Pitches' })` matched 3 regions (map, Pitches, "How we found your pitches"); I fixed it with `exact: true`. I did not start live-server, as the brief said; the injection used the saved `detect.js`.

## 3. Audit evidence (verified)

- **axe** (@axe-core/playwright from the export, wcag2a/aa, 21a/aa, 22aa, best-practice):
  - 390 light: 0 violations. 390 dark: 0.
  - 1440 light: 1 (`heading-order`, moderate, `.space-y-2:nth-child(1) > h4`). 1440 dark: the same 1.
  - `color-contrast` incomplete: 33 at 390 and 72 at 1440, for shortTextContent, imgNode (hex SVG backgrounds), nonBmp and bgOverlap.
- **Contrast** (own probe, composited backgrounds, worst pairs):
  - Light: signal-text "pitches" 5.22:1, muted badge "Usual pitch" 5.27, muted mono time 5.32, "Your slot" on orange 5.53, header meta 5.54, "Not a legal pitch" 5.92, "Evidence" 6.09.
  - Dark: muted text 6.4–8.4, pink badge 6.06, orange 7.4.
  - All pass AA. The probe flagged "60" in dark at 1.21, but that is a false positive: the text sits on an SVG orange hex, not the card. The screenshot `dark-score-60.png` shows dark-on-orange, about 6.5:1.
- **Keyboard:**
  - Tab order at 390: home → Copy link → "See the research ↓" → map canvas (aria-label "Map") → pitch markers 1–3 (named "Pitch 1: … score 60") → zoom +/− → attribution → Browse other pitches (25) → 4 legend keys → pitch rows with "Full details for …" → Plan my week → raw switch → Every check (8) → source links. The order is logical.
  - Every stop has a visible 2px ring (box-shadow `--focus-ring`). Primary buttons use an outline with 2px offset. There is a `forced-colors` outline fallback (globals.css:357).
  - The "Full details" sheet opens as `role=dialog` with focus inside. Escape closes it and returns focus to the trigger.
  - The map summary popover moves focus to "Next pitch", and Escape / close returns focus to Browse (plan-map.tsx:305–315).
- **Headings:**
  - 1440: H1 Folk duo → H2 Agent vs engine → H2 Your busk → H3 (sr-only) Top pitches → H2 Weather → H2 vs plain AI → H3 ×2 → H2 How we found → **H4 ×2 (skip)** → H3 Data used.
  - At 390 the research heading moves under H2 "The research" correctly. The h4 skip remains.
- **Landmarks:** header/nav/main/footer, plus named sections. The map has two regions (a wrapper div `role=region` and MapLibre's canvas `role=region "Map"`), which is redundant.
- **Touch targets at 390** (under 44px; hidden skip link excluded):
  - Map legend keys 100/73/79/79 × **32px** (map-legend.tsx:16 `min-h-8`).
  - Map summary popover Prev/Next/Close **40×40** (`icon-sm` = `size-10`, ui/button.tsx:41).
  - "≈144 people an hour est." tooltip trigger 187×24 (estimate-label.tsx:41, inline).
  - Data-source links 20–40px tall (data-sources.tsx:63, inline text links).
  - Raw switch 46×26 visually, but its `after:-inset-3` pseudo-element extends the hit area past 44, and it has a `<label>`, so this is not a finding.
  - Pitch row buttons and "Full details" are 48px (`min-h-tap`). The MapLibre controls are forced to 44px (globals.css:396).
- **Horizontal scroll:** none at 390, 768 or 1440 (scrollWidth equals clientWidth, light and dark, no offenders).
- **Touch gesture** (CDP synthesized touch, Chromium, 390, `isMobile`):
  - A one-finger horizontal drag pans the map (marker moved 120px).
  - A one-finger vertical drag on the map does **not** scroll the page (scrollY 244 → 244). The canvas has `touch-action: none` and no `cooperativeGestures` (plan-map.tsx:137).
  - The map is 326×320 inside an 844px viewport, so a swipe that starts on it gets stuck.
  - Not tested on a physical device.
- **Reduced motion:**
  - With no preference, these run during load: the `bm-shimmer` skeleton (2.4s infinite), `hc-fold` 400ms, and the `motion-safe:animate-in` agent cards.
  - With `reduce`, no animations run at all. Each is gated per class (globals.css:342,384), plus a global `transition-duration: 0ms !important` (globals.css:368). State changes stay instant and visible, so feedback is not lost.
  - Not gated in app code: MapLibre `easeTo` 400/600ms (plan-map.tsx:292,304). The library may honour the preference itself; this is unverified.
- **Tokens:** no hard-coded colours in scope, apart from hex **fallbacks** in `themeColor("--token", "#…")`, needed because MapLibre can't parse oklch (plan-map.tsx:26–68,208,230–231). There are no raw Tailwind palette classes.
- **Dark mode:** it renders fully. Tokens swap, contrast passes (above), and focus rings swap to the light ring.
- **Performance:**
  - MapLibre is loaded through `next/dynamic` with `ssr:false`, behind an IntersectionObserver plus a skeleton (lazy-plan-map.tsx:13,37).
  - There are no raster images in scope.
  - "Plan my week" has `prefetch={false}`, with a reason given (plan-view.tsx:488).
  - Console: no page errors or React errors.
  - Not measured: bundle size, LCP, INP.

## Audit Health Score

| # | Dimension | Score | Key Finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | 3 | h2 → h4 skip in the research feed (axe heading-order + detector); everything else passes axe, contrast ≥ 5.2:1, focus is managed in both dialogs |
| 2 | Performance | 3 | Map lazy-loaded and SSR-off; nothing heavy found, but no metrics measured |
| 3 | Responsive Design | 3 | No overflow at 390/768/1440; the map captures one-finger vertical swipes at 390; legend keys 32px, popover buttons 40px |
| 4 | Theming | 4 | Full token use, hex only as MapLibre fallbacks; dark mode verified |
| 5 | Implementation Integrity | 3 | CLI clean (0); overlay hits are mostly brand choices or false positives; real ones: skipped heading, 10px chip, long all-caps names |
| **Total** | | **16/20** | **Good** |

## Implementation Integrity Verdict

**Pass.** The page expresses a coherent, product-specific system:
- Honeycomb hex cells carry the scores and ranks.
- Hatch means "no busking".
- One focus-ring rule with a forced-colors fallback.
- Tokens resolved even for MapLibre.
- Copy and structure belong to this product: pitch, slot, permit, crowd taste.

The deterministic CLI scan is clean. Of the 12 browser rule types, 5 are false positives or intentional brand (side-tab, clipped-overflow, stripes, cream, text-occlusion; dark-glow could not be reproduced). Four are real but small: skipped-heading, undersized 10px "Evidence", all-caps long pitch names, 182-char line at 1440. Kicker-above-heading and nested-cards are house style worth questioning, not defects. The integrity issue the detector can't see: offline fixture names such as "Footpath near Synthetic sensor: Queen Vic Market" reach user-visible pitch names (fixtures in src/server/adapters/footfall/fixtures/synthetic.ts). That is acceptable in an offline build, but it should never ship.

## Executive Summary

- Audit Health Score: **16/20 (Good)**
- Issues: P0 0 · P1 0 · P2 3 · P3 6
- Top issues:
  1. The map swallows one-finger vertical page scroll at phone width.
  2. Heading level skip (h2 → h4) in "How we found your pitches".
  3. Map legend keys are 32px tall at 390.
  4. 10px "Evidence" chip.
  5. 3-line all-caps pitch names.
- Next: `/impeccable adapt` (map gestures, targets), `/impeccable harden` (heading outline), `/impeccable typeset` (chip size, caps, measure), then `/impeccable polish`.

## Findings by Severity

**[P2] Map traps vertical scroll on phones**
- Location: src/components/map/plan-map.tsx:137 (MapLibreMap options); canvas `touch-action: none`.
- Category: Responsive.
- Impact: at 390 the map is 320px tall, and a thumb swipe that starts on it pans the map instead of scrolling the page. The user can feel stuck between the pitch list and the map.
- Standard: touch gesture heuristics.
- Recommendation: enable `cooperativeGestures` (two-finger pan) below `md`, or disable one-finger `dragPan` on touch with a hint.
- Evidence: synthesized CDP touch in Chromium; not tested on a device.
- Suggested command: /impeccable adapt

**[P2] Heading level skipped in the research feed**
- Location: src/components/plan/tool-results.tsx:152, :167 (h4 under h2 from agent-steps.tsx:276).
- Category: Accessibility.
- Impact: screen-reader heading navigation shows a broken outline. axe `heading-order` reports it at 1440, and the detector at both widths.
- Standard: WCAG 1.3.1 (best practice).
- Recommendation: render these as h3, or pass the heading level down from the context.
- Suggested command: /impeccable harden

**[P2] Map legend keys below the 44px target**
- Location: src/components/map/map-legend.tsx:16 (`min-h-8`).
- Category: Responsive.
- Impact: four tooltip keys are 32px tall on a touch screen, and they sit right next to each other.
- Standard: passes WCAG 2.5.8 (24px); fails the 44px project/impeccable floor (2.5.5 AAA).
- Recommendation: `min-h-tap`, or a hit-area pseudo-element like the switch uses.
- Suggested command: /impeccable adapt

**[P3] Map summary popover buttons are 40×40**
- Location: src/components/map/plan-map.tsx:363–371 (`size="icon-sm"`, ui/button.tsx:41).
- Category: Responsive.
- Recommendation: `size="icon"`, or a 44px hit area.
- Suggested command: /impeccable adapt

**[P3] 10px "Evidence" chip**
- Location: src/components/honeycomb/evidence-line.tsx:8.
- Category: Implementation Integrity / typography.
- Impact: functional label below the 11px floor; it is hard to read at arm's length outdoors.
- Recommendation: 11px minimum.
- Suggested command: /impeccable typeset

**[P3] Long pitch names set in all caps**
- Location: src/components/honeycomb/pitch-row.tsx:38 (`uppercase`, 22px display).
- Category: Implementation Integrity.
- Impact: 46–48-character names run to 3 uppercase lines at 390 (`pitches-390-light.png`), which slows scanning.
- Recommendation: keep caps for short names; switch to sentence case above about 24 characters, or clamp the line count.
- Suggested command: /impeccable typeset

**[P3] 182-character line in the research section at 1440**
- Location: `#research > p.text-sm` (plan-view.tsx:577 section).
- Category: Implementation Integrity.
- Recommendation: `max-w-[70ch]`.
- Suggested command: /impeccable typeset

**[P3] Redundant double map region**
- Location: plan-map.tsx:325 (`role="region"` wrapper) plus MapLibre's canvas `role=region aria-label="Map"`.
- Category: Accessibility.
- Impact: two landmarks for one map; noisy landmark navigation.
- Recommendation: drop the wrapper role, or relabel the canvas.
- Suggested command: /impeccable harden

**[P3] Fixture names visible in pitch names**
- Location: footfall fixtures (src/server/adapters/footfall/fixtures/synthetic.ts) surfacing through PitchRow.
- Category: Implementation Integrity.
- Impact: "Synthetic sensor" reads as broken data in demos.
- Recommendation: give the offline fixtures realistic place names.
- Suggested command: /impeccable clarify

Unverified, not scored: whether MapLibre `easeTo` (plan-map.tsx:292,304) honours reduced motion.

## Patterns & Systemic Issues

- Small touch targets come from secondary controls (`min-h-8` legend keys, `icon-sm` buttons), not from primary ones, which consistently use `min-h-tap`. The fix is to apply the tap token to secondary controls as well.
- Heading levels are hard-coded per component (`h4` in pitch-card.tsx:20, tool-results.tsx, foot-traffic-chart.tsx:42, pitch-details.tsx:28/73). Wherever these components nest under a different parent, the outline can skip a level.
- Uppercase is applied by class to content of any length (pitch names, the header meta line), not only to short labels.

## Positive Findings

- Zero axe violations at 390 in day and night. Every measured text pair is at least 5.2:1 by day and 6:1 by night.
- Focus is handled thoroughly: one ring token, an offset outline on orange fills, a forced-colors fallback, and focus moved into and back out of both the details sheet and the map summary. Escape works in both.
- Map pins are focusable named buttons ("Pitch 1: …, score 60"). Scores have `role=img` "Score 60 out of 100".
- Reduced motion is respected class by class, and nothing animates under `reduce`.
- No horizontal overflow at any width. MapLibre controls are raised to 44px.
- Colours are tokens throughout, resolved at runtime even for MapLibre.
- The map is lazy-loaded with SSR off and a skeleton placeholder. Prefetch of /week is disabled on purpose, with a comment explaining the cost.

## Recommended Actions

1. **[P2] `/impeccable adapt`**: cooperative gestures on the map below md; legend keys and popover buttons to the 44px tap token.
2. **[P2] `/impeccable harden`**: fix the h2 → h4 skip in tool-results; remove the duplicate map region.
3. **[P3] `/impeccable typeset`**: Evidence chip to at least 11px, sentence case for long pitch names, cap the research paragraph measure.
4. **[P3] `/impeccable clarify`**: realistic names in the offline footfall fixtures.
5. `/impeccable polish`

> You can ask me to run these one at a time, all at once, or in any order you prefer.
>
> Re-run `/impeccable audit` after fixes to see your score improve.
