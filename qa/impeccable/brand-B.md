# /brand · Assessment B (detector + browser evidence) and audit

Build: Busk Map design/honeycomb f83f1a1, served at http://localhost:3213/brand (not started or stopped by me). Source: scratchpad/hc9 (the export). Every command ran from the export dir. Scratch files are in scratchpad/imp/brand-B/: run.cjs, results.json, overlay-findings.txt, detect-cli*.json, plus the screenshots overlay-1440.png, overlay-390.png, p1440-light.png, p1440-dark.png, p390-light.png and focus-*.png / radio-*.png.

I read no QA reports and no Assessment A output.

---

## 1. CLI scan (`impeccable detect --json`)

| Run | Targets | Exit | Findings |
|---|---|---|---|
| A | `src/app/brand` + `src/components/brand` (page.tsx and the 5 brand component files) | **0** | `[]`, 0 findings |
| B | A plus the 33 shared components the page renders (honeycomb/*, ui/{alert,badge,button,input,label,toggle-group}, forms/{choice-cards,permit-picker,time-slot-picker}, map/map-legend, plan/weather-strip, status/status-card) | **0** | `[]`, 0 findings |

The deterministic source scan is clean: no rule names and no file:line results. Stderr was empty. (A first attempt at run B passed the file list as one string because of shell quoting. That is not a detector fault, and the corrected re-run is the one reported.)

## 2. Browser overlay (detect.js injected)

Flow, run separately at 1440×900 and 390×844 in a new Playwright Chromium context each time: navigate (networkidle) → set `document.title` to "[Human] Brand · Busk Map" (the mutation preflight passed) → scroll to top → `page.addScriptTag({ path: imp/detect.js })` → wait 3 s → collect console output, then read `window.impeccableDetectAsync()`.

- **Every step succeeded at both widths.** The script exposes `impeccableDetect`, `impeccableDetectAsync`, `impeccableScan`, `impeccableScanAsync`, `impeccableMeasureHiddenText`, `impeccableCollectVisualContrastCandidates`, `impeccableAnalyzeVisualContrast`, `impeccableGetLastVisualContrastAnalyses`, `impeccableSnapshotCapture` and `impeccableDetectFromSnapshot`. The overlay drew 67 nodes at 1440 and 87 at 390 (see overlay-390.png).
- **Console:** `[impeccable] 34 anti-patterns found` at 1440 and `[impeccable] 44 anti-patterns found` at 390. Only the group header contains the word "impeccable". The per-finding lines are `%c` logs, so I took the detail from `impeccableDetectAsync()`. No other console errors or page errors appeared.
- **Note:** the second scan, run after the auto-scan, also picked up the overlay's own labels and outlines (text-occlusion and dark-glow below). The deduplicated counts are listed per rule.

| Rule | 1440 | 390 | Where | Verdict |
|---|---|---|---|---|
| nested-cards | 11 | 30 (all inside closed folds) | specimen cards inside group cards (Alerts in SPEC cards, StatusCard, PitchRow list, ChoiceCards), and at 390 every PhoneFold `<details>` card | **Mostly a false positive for a component showcase.** A specimen has to sit in a frame. At 390 the Disclosure frame wrapping a CARD grid makes it two ruled boxes deep. Real but minor (P3). |
| line-length | 8 | 0 | hero p (page.tsx:119, ~91 ch), section intros `max-w-3xl` at 18px (page.tsx:45, 93–99 ch), Components intro, Assets intro (368), token-table Use cells, component-name lists (brand-components.tsx:40, ~103 ch) | **True.** `max-w-3xl` at 18px gives about 90+ characters. P3. |
| tiny-text | 8 | 8 | colour-swatch captions `text-[11px]` (page.tsx:214) | **True**, but deliberate mono metadata at 6.09:1 day and 7.48:1 night. P3. |
| numbered-section-labels | 8 | 8 | "01"…"08" (page.tsx:41, 432) | The deck idiom, so intentional. It is a recognisable template tell, though. Judgment, not a defect. |
| side-tab | 2 | 2 | header 4px bottom rule (layout), hero `border-b-[6px] border-primary` (page.tsx:112) | **False positive.** These are full-width print rules, not side accents on cards. |
| all-caps-body | 2 | 2 | hero eyebrow, 40 ch (page.tsx:115); PlanAlert mono line, 32 ch | Short labels, so borderline. P3 at most. |
| hero-eyebrow-chip | 1 | 1 | "Busk Map design deck · design system v66" above the H1 (page.tsx:115) | **True pattern.** Assessment A should judge whether it is earned. |
| kicker-above-heading | 1 | 1 | WeatherStrip "Weather" kicker above its own `<h2>` | Specimen of the shared component. It also exposes the stray h2 (see A11y). |
| undersized-ui-text | 1 | 0 | EvidenceLine "Evidence" chip at 10px (`src/components/honeycomb/evidence-line.tsx:8`) | **True**, below the 11px floor. P3, but in a shared component. |
| cream-palette | 1 | 1 | page ground rgb(242,238,230) | Intentional (warm paper is the brand). Not a defect. |
| repeating-stripes-gradient | 1 | 1 | `globals.css:321–330` hatch fills (no-busking zones, estimate stripes) | Intentional map semantics. False positive as decoration. |
| dark-glow | 1 | 1 | "zero-offset glow #ffba00" | **False positive.** No element on the page has a zero-offset blurred shadow at rest (checked every computed `box-shadow`). #ffba00 is not in the source; it is the overlay's own highlight colour. |
| em-dash-overuse | 1 | 0 | "80 em-dashes" | **False positive.** `document.body.innerText` contains 0 em-dashes and 14 en-dashes (time ranges). |
| text-occlusion | 2 | 0 | spans reading "line length too long" over the H1/H2 | **False positive.** These are the overlay's own labels, picked up by the re-scan. |

The CLI scan is clean, and the browser overlay holds the real signal: line length, 11/10px text, and the eyebrow-plus-numbered-label template look. Roughly 40% of the browser hits are false positives or intentional brand choices.

---

## 3. Audit (audit.md)

### Evidence gathered (Chromium via @playwright/test from the export; @axe-core/playwright with tags wcag2a/aa, 21a/aa, 22aa and best-practice)

- **axe**
  - 390 day and 390 night (folds closed): **0 violations**.
  - 390 with every fold opened: 1 violation, **landmark-unique** (moderate, 2 nodes).
  - 1440 day and 1440 night: the same single violation, **landmark-unique** ×2 (`#words`, `#screens`).
  - Incomplete `color-contrast`: 24 nodes at 390 and 52 at 1440. These are text over grain backgrounds and images, so I checked them manually.
- **Contrast**, computed against the composited background:

  | Text | Day | Night |
  |---|---|---|
  | H1 | 15.91 (hero is forced dark) | 15.91 |
  | "comb" signal-text | 7.4 | 7.4 |
  | Hero nav links | 7.4 | 7.4 |
  | Section number (signal-text on paper) | 5.22 | 7.4 |
  | H2 / intro | 14.9 | 15.91 |
  | Muted 11–12px (th, captions, lists) | 6.09 | 7.48 |
  | Handoff body on dark | 15.91 | 15.91 |

  Every sampled pair passes AA, and most pass AAA.
- **Horizontal scroll:** none at 390, 768 or 1440 (scrollWidth equals clientWidth), and none at 390 with every fold opened. Wide tables scroll inside their own `role=region tabIndex=0` frames.
- **Page height:** 390 with folds closed is 5,677px (the PhoneFold works: 28 `<details>`, all closed); 390 with folds open is 32,162px; 768 is 22,866px; 1440 is 16,299px.
- **Keyboard (1440):**
  - The skip link is the first stop and is visible on focus.
  - Order: header nav → on-page nav (8 links) → Qloo → the words table region → tokens region → buttons → inputs → chips → radio group (one stop, roving) → toggle group → chips → legend buttons → StatusCard link → ExampleActCard → Screens region → route links. The order is logical.
  - Focus is visible everywhere I checked: a 2px ring (box-shadow `0 0 0 2px` foreground) on links, inputs, toggles and legend buttons, and an outer frame on ChoiceCards (radio-tabfocus.png).
  - Arrow keys move the radio choice and select it (verified with a real keydown/keyup).
  - **Keyboard (390):** skip → logo → 8 anchors → 28 fold summaries. Logical.
- **Heading outline (1440):** H1 → 8 H2 → H3/H4. Breaks:
  - (a) **`<h2>` "Dry through your slot"** sits inside the H3 "The busk" group. It comes from WeatherStrip (`src/components/plan/weather-strip.tsx:36`).
  - (b) **`<h3>` "Next · not built yet"** sits under an H4 (NoteCard, `src/components/honeycomb/note-card.tsx:10`).
  - (c) At 390 the outline drops from 50 headings to 22. Every PhoneFold `<h3>` becomes plain `<summary>` text (`src/components/brand/phone-fold.tsx:25-31`).
- **Touch targets below 44px**, measured at 390 with folds open:

  | Target | Size (px) | Location |
  |---|---|---|
  | Map legend buttons ×4 | 73–100 × 32 | MapLegend |
  | Chips | 53–92 × 40 | |
  | Screens-table route links ×15 | 7–58 × 16 | page.tsx:354; "/" is 7×16 |
  | Footer Qloo link | 44 × 15 | layout, outside this route |
  | On-page nav "Words" | 42 × 48 | page.tsx:133, width only |
  | Header Qloo wordmark link | 96 × 33 | |

  The 22×25 radio buttons are a false positive: the whole `<label>` card (min-h-16) is the hit area. axe target-size (24px, with the spacing exception) passed.
- **Reduced motion:** under `reduce`, **0** elements animate or transition. Without it, only 3 Loader SVGs spin (`motion-safe:animate-spin`). The page's own copy says "Under prefers-reduced-motion, everything drops to 0 ms except progress" (page.tsx:281), and `globals.css:366` says "the Loader keeps moving". In practice the Loader **stops** (`loader.tsx`: "It stops under reduced motion but stays visible"). The spec page contradicts the implementation.
- **Dark mode:** follows `prefers-color-scheme`, and the hero and Handoff are pinned dark with `data-theme`. Every pair re-measured at night passes (above), and the night screenshot is clean (p1440-dark.png).
- **Hard-coded colour:**
  - No hex, rgb or oklch values in page.tsx or any brand/* file.
  - Swatches use `var(--token)`.
  - The token table's swatch hexes (`src/lib/brand-data.ts:60+`) are documented values, not styling.
  - Type sizes do drift: **63 arbitrary `-[...]` values** (page.tsx 49, brand-components 8, brand-demos 4, brand-icons 2). These include `text-[26px]`×3, `[22px]`×2, `[30px]`×2, `[13px]`×3, `[11px]`×4, `[19px]` and `[56px]`. Only `text-label` is a utility, so the design system page bypasses its own type scale.
- **Performance (390 load):**
  - DCL 58ms, load 85ms, 36 requests, about 544KB transferred.
  - DOM: 2,712 nodes at 390 and 2,560 at 1440.
  - 21 of 26 images are lazy.
  - CLS is 0 at both 390 and 1440, even though PhoneFold folds after hydration.
  - Asset images use `next/image unoptimized`, which is deliberate: they are download files shown as is.

### Audit Health Score

| # | Dimension | Score | Key Finding |
|---|---|---|---|
| 1 | Accessibility | 3 | Duplicate landmark names (#words, #screens) and a broken heading outline (stray h2 from WeatherStrip; at 390, 28 sub-headings become summaries). Contrast and keyboard are solid. |
| 2 | Performance | 3 | Lean (about 544KB, CLS 0, lazy images). The 32k px DOM at 390 is fully rendered even when folded. |
| 3 | Responsive Design | 3 | No overflow at any width; the phone fold cuts 22.8k → 5.7k px. Several targets under 44px: legend 32, chips 40, table links 16. |
| 4 | Theming | 4 | Colour is token-only in both themes, and every sampled pair is ≥5.2:1 day and ≥7.4:1 night. |
| 5 | Implementation Integrity | 3 | CLI clean. The page drifts from its own type scale (63 arbitrary values) and states a reduced-motion rule the code does not follow. |
| **Total** | | **16/20** | **Good** |

### Implementation Integrity Verdict: **Pass**

/brand renders the app's real components (Button, ChoiceGroup, PitchRow, WeatherStrip, ResearchFunnel, StatusCard) instead of mock-ups. Colour is token-driven, with dark mode verified pair by pair, and the source detector is clean across all 38 files. The verified gaps are isolated:
- arbitrary type sizes where the scale should be used;
- two on-page claims the code does not match: the reduced-motion "except progress" line, and an underlined `<b>` presented as the council-rules link (brand-components.tsx:236);
- shared components leaking the wrong heading levels into the deck.

### Executive Summary

- Audit Health Score: **16/20 (Good)**.
- Issues by severity: **P0 0 · P1 0 · P2 4 · P3 6**.
- Top issues:
  - The heading outline is broken by shared components, and at 390 it loses its sub-headings.
  - Duplicate landmark names (the section and the table region are both called "The words" / "Screens").
  - Touch targets under 44px on the map legend, chips and Screens-table links.
  - The reduced-motion copy contradicts the code.
  - The page bypasses its own type scale.
- Next steps: /impeccable harden (headings, landmarks), /impeccable adapt (targets), /impeccable typeset (scale and line length), then /impeccable polish.

### Findings by Severity

**[P2] Heading outline broken by embedded specimens**
- **Location:** `src/components/plan/weather-strip.tsx:36` (`<h2>` inside the H3 group at brand-components.tsx:178); `src/components/honeycomb/note-card.tsx:10` (`<h3>` under the H4 at brand-components.tsx:255-257).
- **Category:** Accessibility.
- **Impact:** Screen-reader heading navigation shows "Dry through your slot" as a top-level section of the deck, and "Next · not built yet" outranks its parent.
- **WCAG:** 1.3.1 Info and Relationships (best practice for heading order).
- **Recommendation:** Give WeatherStrip and NoteCard a heading-level prop, the way StatusCard has `embedded`, and pass level 4 or 5 on /brand.
- **Suggested command:** /impeccable harden.

**[P2] Phone fold removes 28 sub-headings from the outline**
- **Location:** `src/components/brand/phone-fold.tsx:25-31`.
- **Category:** Accessibility.
- **Impact:** At 390 the outline goes from 50 headings to 22. "Colour", "Type", "Controls" and the rest exist only as summary text, so H-key navigation skips them.
- **WCAG:** 1.3.1, 2.4.6.
- **Recommendation:** Render the `<h3>` inside the `<summary>` (`<summary><h3 className=…>`), or pass a heading element as the Disclosure label.
- **Suggested command:** /impeccable harden.

**[P2] Duplicate landmark names**
- **Location:** page.tsx:39 with :181, and :339 with :341.
- **Category:** Accessibility.
- **Impact:** Two landmarks named "The words" and two named "Screens" make the landmark list ambiguous. This is the only axe violation at 1440, and at 390 when folds are open.
- **WCAG:** axe landmark-unique (best practice), related to 2.4.1.
- **Recommendation:** Rename the table regions, for example "Word list table" and "Screens table".
- **Suggested command:** /impeccable harden.

**[P2] Touch targets under 44px at 390**
- **Location:**
  - MapLegend buttons, 32px high (brand-components.tsx:170 → `src/components/map/map-legend.tsx`)
  - Chips, 40px (brand-demos.tsx:64; `honeycomb/chip.tsx`)
  - Screens-table route links, 16px high; "/" is 7×16 (page.tsx:354)
  - Header Qloo wordmark link, 33px high
- **Category:** Responsive.
- **Impact:** These are hard to hit on a phone held in one hand, the stated use context.
- **WCAG:** Passes 2.5.8 (AA) through spacing; fails 2.5.5 (AAA, 44px).
- **Recommendation:** Apply `min-h-tap` to legend buttons and chips. Give the table links `inline-flex min-h-tap items-center`, as the Download links have.
- **Suggested command:** /impeccable adapt.

**[P3] Reduced-motion copy contradicts the code**
- **Location:** page.tsx:281; `globals.css:366` comment; `honeycomb/loader.tsx`.
- **Category:** Implementation Integrity.
- **Impact:** A studio building from "this deck alone" would ship a moving Loader under reduce. The code (correctly) stops it.
- **Recommendation:** Change the line to "everything drops to 0 ms; the Loader stops but stays visible", and fix the globals comment.
- **Suggested command:** /impeccable clarify.

**[P3] Type scale bypassed on the design-system page**
- **Location:** 63 arbitrary values across page.tsx, brand-components.tsx, brand-demos.tsx and brand-icons.tsx (for example page.tsx:22-23, 62, 115, 119, 214, 371, 393, 399).
- **Category:** Implementation Integrity / Theming.
- **Impact:** H3 sizes vary (30/26/22px) with no named step, so the deck documents a scale it does not use.
- **Recommendation:** Add `@utility` type steps (display-xl/l/m/s, mono-xs) next to `text-label` and use them.
- **Suggested command:** /impeccable typeset.

**[P3] Measure too long**
- **Location:** page.tsx:45 (`max-w-3xl` at 18px), :119 (19px hero p), brand-components.tsx:40.
- **Category:** Implementation Integrity (readability).
- **Impact:** Lines run 91–103 characters (detector line-length ×8).
- **Recommendation:** Use `max-w-[65ch]`.
- **Suggested command:** /impeccable typeset.

**[P3] 10–11px text**
- **Location:** `honeycomb/evidence-line.tsx:8` (10px "Evidence"); page.tsx:62 and :214, brand-icons.tsx:26 (11px).
- **Category:** Accessibility.
- **Impact:** Contrast passes, but small text is hard to read in sunlight.
- **Recommendation:** Raise to at least 12px, and the Evidence chip to 11–12px.
- **Suggested command:** /impeccable typeset.

**[P3] Underlined non-link in the "no legal pitch" specimen**
- **Location:** brand-components.tsx:236.
- **Category:** Implementation Integrity.
- **Impact:** `<b className="underline">` looks like a link but does nothing. It misrepresents the real PlanAlert, which links out.
- **Recommendation:** Render the real `PlanAlert kind="no-legal"`, or a real link.
- **Suggested command:** /impeccable polish.

**[P3] Nested ruled boxes at 390**
- **Location:** PhoneFold Disclosure around the CARD grids (page.tsx:154-176 and others).
- **Category:** Implementation Integrity.
- **Impact:** Ruled boxes sit two deep (detector nested-cards ×30 at 390).
- **Recommendation:** Inside a fold, drop the inner card borders, or let the fold body carry no frame.
- **Suggested command:** /impeccable distill.

### Patterns & Systemic Issues

- **Shared components assume they own the page heading level.** WeatherStrip uses h2 and NoteCard uses h3. StatusCard already solved this with `embedded`; apply the same pattern to the others.
- **Small interactive pieces skip `min-h-tap`.** Legend buttons, chips and inline table links do, while the Download links and nav anchors use it correctly.
- **Arbitrary type sizes instead of named steps.** This repeats across every brand file.

### Positive Findings

- AA contrast holds everywhere sampled, in both themes. Signal-text is a separate readable orange (5.22:1 on paper, 7.4:1 at night), as the brand book promises.
- Real components are live and interactive: the radio group uses roving tabindex and arrow-to-select, and the toggle group and chips work. Focus rings are visible on every control I tested, and there is a skip link.
- Wide tables scroll inside labelled, focusable regions, so there is no page-level overflow at 390, 768 or 1440.
- PhoneFold cuts the phone page from about 32k to 5.7k px with native `<details>`, with zero layout shift.
- Reduced motion is honoured completely (0 animations or transitions).
- The page is lean: about 544KB, lazy images and fast load.
- The CLI anti-pattern scan is clean across the page and all 33 shared components.

### Recommended Actions

1. **[P2] `/impeccable harden`**: heading-level props for WeatherStrip and NoteCard on /brand; `<h3>` inside the PhoneFold summaries; unique names for the "The words" and "Screens" table regions.
2. **[P2] `/impeccable adapt`**: `min-h-tap` on MapLegend buttons, chips, Screens-table route links and the header Qloo link.
3. **[P3] `/impeccable typeset`**: named type steps replacing the 63 arbitrary sizes; 65ch measure; no text under 12px (Evidence chip, swatch captions).
4. **[P3] `/impeccable clarify`**: correct the reduced-motion line (page.tsx:281) and the globals.css:366 comment.
5. **[P3] `/impeccable distill`**: flatten the double ruled frames inside phone folds.
6. **`/impeccable polish`**: a real link in the no-legal-pitch specimen, then a final pass.

You can ask me to run these one at a time, all at once, or in any order you prefer.

Re-run `/impeccable audit` after fixes to see your score improve.
