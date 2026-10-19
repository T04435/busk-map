# /busks · Assessment B (detector + browser evidence) and audit

Build: design/honeycomb f83f1a1, offline at http://localhost:3213/busks. Commands ran from the export (scratchpad/hc9). Raw evidence is in scratchpad/imp/busks-B/: cli.json, overlay.json, audit.json, focus.json, the overlay-*.png, busks-*.png and focus-*.png captures, and the scripts overlay.cjs, audit.cjs and focus.cjs. I did not read any QA report or Assessment A output.

## 1. CLI scan

`impeccable detect --json` over src/app/busks/page.tsx, landing/{performer-form, artist-picker, song-search, repertoire-picker, warmup}.tsx, src/components/forms/ (whole dir) and honeycomb/{example-act-card, banner, page-header, form-message}.tsx

- **Exit code 0. Output `[]`.** No findings: 0 rules and 0 file:line hits.
- Note: the source scan sees no computed styles, so the one finding that appears in the browser scan (the kicker) did not show up here.

## 2. Browser overlay (detect.js)

Each width ran in a new Playwright Chromium context and page, at 1440×900 and at 390×900.

| Step | 1440 | 390 |
|---|---|---|
| navigate (`waitUntil: networkidle`) | **timed out at 30 s.** The page had loaded: `Warmup` fires `POST /api/warm` (keepalive), so the network never goes idle | same |
| mutation preflight (document.title set to `[Human] Plan your busk · Busk Map`) | ok | ok |
| `page.addScriptTag({ path: detect.js })`, wait 3 s | ok, ran in the page | ok |
| console `[impeccable]` | `3 anti-patterns found` (group) | same |
| `window.impeccableDetectAsync()` | 4 findings across 3 elements | same 4 |

| Rule | Element | Detail | Verdict |
|---|---|---|---|
| `kicker-above-heading` | `span.font-mono.text-xs` (PageHeader meta, honeycomb/page-header.tsx:45; text from busks/page.tsx:25) | "Your act, your hours" above h1 "Plan your busk" | **True positive** under the rule. It is the shared PageHeader pattern, so it repeats on every app page |
| `side-tab` | `header.flex.h-16` (honeycomb/app-header.tsx:17) | `border-b-4 border-primary` | **False positive in intent.** It is a full-width rule under the site header, not a one-sided accent on a card. It is global chrome, not part of this route |
| `cream-palette` | body | `rgb(242,238,230)` = `--background: #f2eee6` (globals.css:24) | **True by rule.** It comes from a token and is a deliberate theme value, so this is a design call, not a code defect. Dark mode replaces it with #0f1416 |
| `dark-glow` | body | zero-offset box-shadow `#ffba00` | **False positive (self-detection).** #ffba00 matches the detector's own `BRAND_COLOR oklch(84% 0.19 80.46)` used for its overlay `GLOW` (detect.js:2859, :2893). It does not appear anywhere in src. A computed-style sweep of the page found no zero-offset coloured shadow at rest |

No live-server was started; detect.js was injected from the saved file. Nothing was left to stop.

## 3. Audit

### Audit Health Score

| # | Dimension | Score | Key Finding |
|---|---|---|---|
| 1 | Accessibility | 3 | axe: 0 violations in all 4 runs. On submit, the artists error is not tied to its combobox (no aria-invalid or describedby) and focus does not move |
| 2 | Performance | 3 | Lean form with no images. The /api/warm keepalive request keeps the network busy for more than 30 s |
| 3 | Responsive Design | 3 | No horizontal scroll at 390, 768 or 1440. Route controls are at least 44 px. Footer "Qloo" link hit area is 44×15 |
| 4 | Theming | 3 | Route sources use tokens throughout; dark mode is verified. App header hard-codes 5 hex values |
| 5 | Implementation Integrity | 3 | CLI clean. 4 overlay findings: 1 true (kicker), 1 token judgment call (cream), 2 false positives |
| **Total** | | **15/20** | **Good** |

### Implementation Integrity Verdict: **Pass**

The route is built from the honeycomb system: ChoiceGroup/ChoiceCard, which mark the picked card by both shape and fill; TimeSlotPicker; DatePicker; and the shadcn Command comboboxes. Colours, the hard poster shadows, focus rings and the 44 px control height (`--size-control`) all come from tokens. The CLI scan is clean. Of the 4 browser findings, one is a true pattern hit: the kicker, which comes from the shared PageHeader. The cream background is a token decision. The side-tab and glow hits are false positives.

### Executive Summary

- Score: **15/20 (Good)**. Issues: P0 0 · P1 0 · P2 3 · P3 5.
- Top issues:
  1. The artists and songs errors are not programmatically tied to their inputs.
  2. Submitting does not move focus to the error.
  3. There is no visible pending state after "Plan my busk".
  4. A kicker eyebrow sits above the h1.
  5. The app header hard-codes hex colours.
- Next: run `/impeccable harden` on the error flow, then `/impeccable polish`.

### Evidence

- **axe** (@axe-core/playwright with tags wcag2a/aa, 21a/aa, 22aa and best-practice) at 390 and 1440, in day and night: **0 violations** in every run, 47 passes each. Each run has 1 incomplete item: color-contrast on the three example cards' hex initials (AS/SA/FD) over an image or gradient hex fill.
- **Contrast** (computed). Light:
  - muted text (#56606a) on bg: 5.54:1; on card: 6.09:1
  - placeholder: 6.09:1
  - primary button: #141c21 on #ff5a1f = 5.53:1
  - badge: 11.69:1
  - h1: 14.9:1

  Dark:
  - muted text: 8.41 (on bg) and 7.48 (on card)
  - primary button: #0f1416 on #ff6a2b = 6.49:1

  All pass AA, including the 11–12 px mono labels.
- **Keyboard**: tab order follows reading order:
  1. skip link
  2. logo
  3. 3 example cards
  4. Act name
  5. artist combobox
  6. song combobox
  7. Spotify link
  8. city radio
  9. time-of-day group (one stop, roving)
  10. Date
  11. From
  12. To
  13. permit group (one stop)
  14. Plan my busk
  15. Plan my week
  16. footer

  Every stop showed a 2 px ring: #141c21 in light, #ff6a2b in dark. Choice cards add a 3 px focus-within outline. Captures are in busks-B/focus-*.png. No traps.
- **Headings**: H1 "Plan your busk" → H2 "Or try a made-up act". The form has no heading; it is named by `aria-label` and its sections use legends. Landmarks are present: header, nav, main, form, footer.
- **Targets at 390**: Act name, the input groups, Date, From and To are 44 px high. Quick slots are 56; choice cards 110; primary button 52. The radios measure 22×25, but the whole card label is the hit area (false positive). Off-route footer links: Terms/Brain/Brand are 32–37 px wide × 48 high, and Qloo is 44×15.
- **Overflow**: scrollWidth equals clientWidth at 390, 768 and 1440.
- **Reduced motion**: with `reducedMotion: reduce`, transitions are 0 s and no animations run. Normally there is a 150 ms colour transition and nothing animates at rest. Only transitions are removed, so every state change still happens instantly. The global rule (globals.css:367) covers transitions only, so it is acceptable here.
- **Dark mode**: tokens switch fully (busks-1440-dark.png). The header stays bluestone in both themes.
- **Gestures**: the route has no custom drag or slider surfaces. Evidence comes from emulated viewports in Chromium only; touch was not synthesized.

### Findings by severity

**[P2] Artist and song errors not associated with their inputs**
- Location: performer-form.tsx:152–157 (ArtistPicker gets no `invalid` or `describedBy`); artist-picker.tsx:128–142 (CommandInput has no aria-invalid or aria-describedby); repertoire-picker.tsx:196 (the describedby sits on the fieldset, not on the song combobox).
- Category: Accessibility.
- Impact: After submitting an empty form, the browser showed `[aria-invalid=true]` count = 0. A screen-reader user who moves back to the artist field hears no error. The bottom Alert (role=alert) does announce it once.
- WCAG: 3.3.1, 1.3.1.
- Recommendation: Pass `invalid` and `describedBy` to ArtistPicker and RepertoirePicker and put them on the CommandInputs. TimeSlotPicker already does this.
- Suggested command: `/impeccable harden`.

**[P2] Focus stays on the submit button after a validation error**
- Location: performer-form.tsx:123–126 (`setError` with no focus).
- Category: Accessibility.
- Impact: At 390 the inline error sits about 1,800 px above the button. The user sees only the bottom Alert and has to scroll and find the field.
- WCAG: 3.3.1 (advisory), 2.4.3.
- Recommendation: Focus the first invalid field, or the Alert, on error.
- Suggested command: `/impeccable harden`.

**[P2] No pending feedback after "Plan my busk"**
- Location: performer-form.tsx:90–95 and :193–200.
- Category: Accessibility / Implementation.
- Impact: `submitting` only disables the primary button, with no text, spinner or live status, while POST /api/plans runs. The second "Plan my week" button stays live during that time.
- WCAG: 4.1.3.
- Recommendation: Give the button a busy label and `aria-busy`, and disable both submits.
- Suggested command: `/impeccable harden`.

**[P3] Kicker above the h1**
- Location: honeycomb/page-header.tsx:45, used from busks/page.tsx:25.
- Category: Implementation Integrity (detector `kicker-above-heading`).
- Impact: A generic eyebrow line that repeats on every page.
- Recommendation: Fold "your act, your hours" into the subtitle or drop it.
- Suggested command: `/impeccable distill`.

**[P3] Hard-coded hex in app header**
- Location: honeycomb/app-header.tsx:17, :18, :30, :31 (#f2ede4, #a7b0b5, #232d33).
- Category: Theming.
- Impact: These bypass the tokens, so a palette change will drift. The values duplicate existing tokens.
- Recommendation: Map them to header tokens.
- Suggested command: `/impeccable colorize`.

**[P3] Double stacked labels "When and where" / "City"**
- Location: performer-form.tsx:170–171 with forms/choice-cards.tsx:37.
- Category: Implementation.
- Impact: Two bold labels on consecutive lines (seen in busks-390-error.png and busks-1440-dark.png), and the City group has a single non-choice card.
- Recommendation: Drop one label, or show the city as static text until there is a second city.
- Suggested command: `/impeccable distill`.

**[P3] Section order versus headings**
- Location: busks/page.tsx:50–61.
- Category: Accessibility / IA.
- Impact: The only H2, "Or try a made-up act", comes before the primary form, which has no heading. The heading outline reads as if the examples were the main task.
- Recommendation: Give the form a heading, or reword or move the examples heading.
- Suggested command: `/impeccable layout`.

**[P3] Small footer hit areas (global, off-route)**
- Location: the footer component.
- Category: Responsive.
- Impact: Qloo is 44×15 and Terms/Brain/Brand are under 44 px wide. They pass WCAG 2.5.8 (24 px) only through the spacing exception.
- Recommendation: Pad to `h-tap`.
- Suggested command: `/impeccable adapt`.

### Patterns & systemic issues

- Errors are wired to their fields one by one. TimeSlotPicker and Act name get `aria-invalid` and `describedby`; the combobox fields (artists, songs) do not. Whenever a new field type is added, its error wiring has to be added separately.
- Global chrome (header, footer) carries the off-system values: the hex colours and the small links. The route's own sources are clean.

### Positive findings

- axe is clean in day and night at both widths, and every measured text pair is at least 5.5:1.
- There is one focus language: a 2 px ring that changes with the theme, plus a 3 px card outline. It was verified visible on every stop.
- The 44 px control height comes from a token (`--size-control`). Choice cards mark selection by shape and fill, not colour alone. Radix roving focus keeps groups to one tab stop.
- The page works without horizontal scroll at all three widths. Reduced motion is handled per animation, and the loader spinner gets `motion-reduce:animate-none`.
- FormMessage and Alert avoid double announcement through `alert={false}`.

## Recommended Actions

1. **[P2] `/impeccable harden`**: wire errors to the artist and song comboboxes, focus the first invalid field on submit, and add a busy state that disables both submit buttons.
2. **[P3] `/impeccable distill`**: remove the PageHeader kicker and the redundant "When and where"/"City" double label.
3. **[P3] `/impeccable layout`**: give the form its own heading and reconsider whether the examples should come first.
4. **[P3] `/impeccable colorize`**: tokenise the app-header hex values.
5. **[P3] `/impeccable adapt`**: increase footer link hit areas.
6. **`/impeccable polish`**: final pass.

You can ask me to run these one at a time, all at once, or in any order you prefer.

Re-run `/impeccable audit` after fixes to see your score improve.
