# Landing page `/`: Assessment B (detector and browser evidence) and audit

Build: Busk Map design/honeycomb f83f1a1, offline at http://localhost:3213. Source: the scratchpad/hc9 export. Every command ran from that export. I ran no live-server, and I did not start or stop the app server. I read no QA report and no Assessment A output.
Evidence files are in `scratchpad/imp/landing-B/`: the scripts `run.mjs`, `focus.mjs`, `focus2.mjs` and `perf.mjs`, plus `results.json`, `detect.json`, `detect-noconfig.json`, the overlay screenshots `overlay-1440.png` and `overlay-390.png`, the full-page screenshots `full-{390,1440}-{light,dark}.png`, and the focus crops `focus-*.png`.

---

## Assessment B

### 1. CLI scan (`impeccable detect --json`)

Targets scanned:
- `src/app/page.tsx`
- `src/components/landing/` (the whole folder)
- honeycomb components: `example-act-card`, `logo`, `percent-cell`, `hex-cell`, `cell-image`, `research-funnel`, `score-ring`
- `src/components/setlist/setlist-panel.tsx` and `src/components/ui/button.tsx`
- layout chrome: `app-header`, `mobile-nav`, `site-footer`

| Run | Exit | Findings |
|---|---|---|
| `detect --json <targets>` | **0** | **0** (`[]`) |
| `detect --json --no-config <targets>` | **0** | **0** |
| text mode | 0 | nothing printed |

- The scan found nothing. The export contains no DESIGN.md, ignore file or `impeccable-disable` comment, and `--no-config` gives the same result, so nothing was suppressed.
- Scanning all of `src/components` also returns 0.
- Static JSX scanning cannot resolve Tailwind classes into computed styles. The browser pass below is where the rules fire.
- One run failed for a harness reason: zsh did not split a `$T` string into separate arguments, so the CLI exited 1 with "cannot access". I re-ran with an array; those are the results above.

### 2. Browser overlay (`detect.js` injected)

Steps, done at both 1440 and 390 in a new Playwright context each time:
1. Navigated with `waitUntil: load`. `networkidle` never settles here: it times out because `Warmup` POSTs to `/api/warm`.
2. Set `document.title` to `[Human] Busk Map`. The mutation preflight passed.
3. Scrolled to the top.
4. Ran `page.addScriptTag({ path: detect.js })`. Injection succeeded and `window.impeccableDetect` is a function.
5. Waited 3 s and read console messages containing "impeccable".

Result: no step failed, and there were no page errors.

Console output:
- 1440: `[impeccable] 11 anti-patterns found` (16 findings on 11 elements or page level)
- 390: `[impeccable] 10 anti-patterns found` (14 findings)

The overlay is visible in `overlay-1440.png`.

| Rule | Where (selector / source) | Verdict |
|---|---|---|
| side-tab ×4 | `header` border-bottom 4px (app-header); hero `section` border-bottom 6px (page.tsx:76); CTA `section` border-top 6px (page.tsx:323) | **False positive.** These are full-bleed band rules between sections, not accents on a card. |
| side-tab ×1 | "Learn these" box, `border-t-4 border-t-primary` (setlist-panel.tsx:126) | **True, by design.** The component doc asks for "an orange top rule". P3. |
| nested-cards ×4 | "Learn these" inside the setlist card; a `div.flex.h-full` in What you get; BrainSketch inside the brain teaser (page.tsx:46); brand swatch panel inside the brand teaser (page.tsx:294) | **Partly true.** The bordered illustration panels sit inside bordered teaser sections. P3. |
| kicker-above-heading ×2 | "Powered by Qloo" above "The brain of Busk Map" (page.tsx:231); "The brand" above "Honeycomb" (page.tsx:272) | **True pattern.** Eyebrow plus giant heading, twice in a row. P3 / judgement call for Assessment A. |
| oversized-h1 (1440 only) | `#hero`: 119px, 42 chars, 46vh | **Borderline false positive.** It is three short poster lines, and the primary CTA stays above the fold at 1440×900. |
| text-occlusion (1440 only) | span "✦ oversized hero headlin…" covered by the h1 | **False positive.** The span is the detector's own overlay label. |
| cream-palette (page) | body `rgb(242,238,230)` | **Intentional.** This is the brand's "Paper" token. |
| bounce-easing (page) | `.hc-pin` uses `cubic-bezier(0.2,1.4,0.4,1)` (globals.css:392, hero-taste-map.tsx:91) | **True.** The pins overshoot as they drop. It is off under reduced motion. P3. |
| dark-glow (page) | zero-offset glow `#ffba00` | **False positive.** `#ffba00` appears nowhere in `src`. It matches the overlay's own oklch(84% .19 80) outline. |
| repeating-gradient stripes (advisory) | Map-legend zone swatch (map-legend.tsx:58) | **Advisory, intentional.** It is the no-busking hatch. |

The detector's visual-contrast pass returned 0 analyses.

---

## Audit (audit.md)

### Evidence gathered

- **axe-core 4.13** (@axe-core/playwright, tags wcag2a/aa, 21a/aa, 22aa and best-practice):
  - 390 day, 390 night, 1440 day and 1440 night all report **0 violations**.
  - Incomplete items: `color-contrast` ×73 (bm-grain background images, the hero image node, and short SVG text) and `aria-prohibited-attr` ×3 (`span[aria-label="Length 4:56"]`, setlist-panel.tsx:111).
- **Contrast**, measured from computed colours. Every pair passes AA:

  | Text pair | Ratio |
  |---|---|
  | Signal text on paper | 5.22 |
  | Signal on card | 5.75 |
  | "With Busk Map" 11px on accent | 4.91 (day) / 5.74 (night), the lowest |
  | Muted on paper | 5.54 |
  | Muted on card | 6.09 |
  | Qloo purple on night | 5.92 |
  | Signal on night | 7.40 |
  | Poster CTA | 6.49 |

- **Headings**: one h1, then h2 ×8 in order. Under What you get the levels run h3 ×3 and then one h4 under the setlist. Nothing is skipped.
- **Landmarks**: header, nav[Main], main, footer and nav[Site] are present, and every section is labelled with aria-labelledby. There is a skip link.
- **Keyboard**: tab order follows the visual order at both widths: skip link, home, nav, Plan a busk, Qloo, the 3 act cards, the week links, the pitch rows, the map/legend, Copy, Learn it, the teasers, the CTA, and the footer. There are no traps.
  - Focus is visible on the poster CTAs (3px orange outline, offset 10px), the cards, the header nav and every control in night mode.
  - Focus **is not visible in day mode** on links inside `data-theme="dark"` islands (see P1).
- **Touch targets below 44 px at 390** (excluding the skip link):
  - inline "Week:" and "Plan your busk" links: 18px tall
  - map-legend toggles "Taste match", "Top pitch" and "Other pitch": 32px (`min-h-8`)
  - Qloo links: 96×33 (hero), 72×25 (brain teaser) and 44×15 (footer)
  - "Learn it": 40px
  - footer text links: 32–37px wide but 48px tall
- **Horizontal scroll**: at 390, 768 and 1440 the scrollWidth equals the clientWidth. There is no overflow, because the hero SVG paths are clipped by `overflow-hidden`.
- **Reduced motion**:
  - `no-preference`: 129 running animations (104 `hc-glow`, 24 `hc-breathe`, 1 `hc-roll` ticker) and 35 elements with transitions.
  - `reduce`: **0 animations and 0 transitions**. The glow is held at 0.5 opacity and the map draws statically. This is an intentional alternative rather than a global 0.01ms kill.
- **Performance** (local production server):
  - 34 requests: JS 316 KB transferred, CSS 147 KB
  - LCP about 0.1 s, CLS 0, 1,887 DOM nodes
  - The MapLibre map is lazy and loads nothing until it is opened. `CellImage` uses `loading="lazy"`.
- **Hard-coded colours** (page.tsx and the components it renders): none in page.tsx, which uses tokens and `var()` only. The single hex is `#8C8CC8` in `logo.tsx:39`, the Qloo bar; it equals `--qloo`.
- **Dark mode**: day and night both render correctly. The dark islands (`data-theme="dark"`) swap their tokens correctly, except `--focus-ring`.
- **Not tested**: map drag and pinch under synthesized touch (the map was not opened), and text scaling to 200%.

### Audit Health Score

| # | Dimension | Score | Key Finding |
|---|---|---|---|
| 1 | Accessibility | 3 | In day mode the focus ring is invisible on links inside dark islands (`--focus-ring` is resolved at `:root`) |
| 2 | Performance | 3 | Lean: 316 KB JS, CLS 0, lazy map. 104 infinite SVG-opacity animations in the hero |
| 3 | Responsive Design | 3 | No overflow at 390/768/1440. Legend toggles (32px) and Qloo links (25–33px) are below 44px |
| 4 | Theming | 3 | Tokens throughout and day/night both verified. One scoping bug in the focus-ring token |
| 5 | Implementation Integrity | 3 | 0 static findings. Overlay true positives are minor; there is a placeholder demo slot and ad hoc button restyles |
| **Total** | | **15/20** | **Good** |

### Implementation Integrity Verdict: **Pass**

The page expresses a coherent, product-specific system:
- the hex lattice, hex cells and BrainSketch are drawn from the same honeycomb vocabulary as the product;
- the copy is about pitches, permits and setlists;
- the colours come only from tokens.

The static detector reports 0. Of the overlay's 14–16 findings:
- 7 are false positives or intentional brand choices (band rules, the overlay's own label and glow, the Paper token, the hatch);
- the true positives are minor and stylistic: nested teaser panels, a repeated kicker-above-heading, and the pin overshoot.

The real integrity gaps are:
- a visible "[Demo video · 60–90 s]" placeholder;
- two `variant="poster"` buttons re-skinned with long className overrides instead of a variant.

### Executive Summary

- Audit Health Score: **15/20 (Good)**
- Issues: **P0 0 · P1 1 · P2 3 · P3 5**
- Top issues:
  1. **P1:** the focus ring is invisible in day mode on the hero Qloo link, the brain-teaser Qloo link and every footer link.
  2. **P2:** the auto-scrolling ticker has no pause control (WCAG 2.2.2).
  3. **P2:** touch targets under 44px at 390 (legend toggles, Qloo links, inline week links).
  4. **P2:** a placeholder demo-video slot ships on the landing page.
- Next steps: fix the focus-ring token scoping (one CSS change); then harden the ticker and the touch targets; then polish.

### Detailed Findings

**[P1] Focus ring invisible on dark islands in day mode**
- **Location:**
  - `src/app/globals.css:200` defines `--focus-ring: 0 0 0 2px var(--ring)` on `:root`, and the fallback rule that uses it is at `globals.css:353`.
  - Affected: `page.tsx:107` (hero QlooLink), `page.tsx:232` (brain QlooLink), and `site-footer.tsx:60–88` (9 links).
- **Category:** Accessibility / Theming
- **Impact:**
  - `var(--ring)` is resolved where `--focus-ring` is declared, on `:root`. Dark islands therefore inherit the day ring `#141c21` and do not get their own `#ff6a2b`.
  - The measured result is a 2px `rgb(20,28,33)` ring on an `rgb(15,20,22)` ground, about 1.1:1. The ring is invisible; see `focus-light-hero-qloo.png` and `focus-light-footer-privacy.png`.
  - Night mode is fine (`focus-dark-hero-qloo.png`).
- **WCAG:** 2.4.7 Focus Visible (AA); 1.4.11 Non-text Contrast (AA)
- **Recommendation:** declare `--focus-ring` again inside `.dark, [data-theme="dark"]` and in the dark media block, or use `box-shadow: 0 0 0 2px var(--ring)` directly in the rule at line 353.
- **Suggested command:** `/impeccable harden`

**[P2] Ticker scrolls forever with no pause**
- **Location:** `page.tsx:112–125`, `.hc-ticker` (globals.css:378)
- **Category:** Accessibility
- **Impact:**
  - Visible text moves continuously, 40 s per loop, next to the hero.
  - It stops only under prefers-reduced-motion. There is no pause on hover or focus and no control.
  - `aria-hidden` keeps it from screen readers, but not from distraction for sighted users.
- **WCAG:** 2.2.2 Pause, Stop, Hide (A)
- **Recommendation:** pause it on hover and focus-within and add a pause toggle, or make it static after one loop.
- **Suggested command:** `/impeccable harden`

**[P2] Touch targets under 44px at 390**
- **Location:**
  - `map-legend.tsx:16` (`min-h-8`, 32px)
  - `logo.tsx:48–57` QlooWordmark: 96×33, 72×25, 44×15 in the footer
  - `page.tsx:161` and `page.tsx:170`, inline links 18px tall
  - `learn-it-menu.tsx:13` (`min-h-10`, 40px)
- **Category:** Responsive
- **Impact:** mis-taps on phones. The 15px-tall footer Qloo mark is the worst. The week links wrap into two rows about 20px apart at 390.
- **WCAG:** 2.5.8 Target Size Minimum (AA) is met by most of these; the footer Qloo mark is marginal. They fail the 44px house standard (`--size-tap: 48px`).
- **Recommendation:**
  - Give QlooWordmark `min-h-tap` plus padding.
  - Use `min-h-tap` on the legend buttons.
  - Present the week links as a stacked list or chips at small widths.
- **Suggested command:** `/impeccable adapt`

**[P2] Placeholder demo video ships on the landing page**
- **Location:** `page.tsx:128–136`
- **Category:** Implementation Integrity
- **Impact:** a large 16:9 dark block reading "[Demo video · 60–90 s]" sits directly under the hero. It reads as unfinished and pushes the act cards down by a full screen at 390.
- **Recommendation:** hide the slot until the video exists, or replace it with a still from the hero map.
- **Suggested command:** `/impeccable distill`

**[P3] Teaser buttons re-skinned ad hoc**
- **Location:** `page.tsx:253` and `page.tsx:288`
- **Category:** Implementation Integrity
- **Impact:** `variant="poster"` is overridden with about 12 utilities: font, case, tracking, background, hover `color-mix` and shadows. This is a hidden second button style outside `button.tsx`, so it will drift.
- **Recommendation:** add a `poster-secondary` variant (or similar) to `button.tsx`.
- **Suggested command:** `/impeccable polish`

**[P3] Seven distinct h2 sizes**
- **Location:** `page.tsx`. The H2 constant is `clamp(44,5vw,72)`, and the other h2s use `clamp(40,4.4vw,60)`, `clamp(44,6vw,80)` (×2) and `clamp(52,7vw,104)`. There are also 13 arbitrary `text-[…]` values in the file.
- **Category:** Implementation Integrity
- **Impact:** the type scale lives in page code, not in tokens.
- **Recommendation:** move the scale into display tokens.
- **Suggested command:** `/impeccable typeset`

**[P3] 104 infinite SVG opacity animations in the hero**
- **Location:** `hero-glow.tsx:44–50` and globals.css:375–376, plus 24 `hc-breathe` in hero-taste-map
- **Category:** Performance
- **Impact:** opacity on SVG child paths is not composited, so the SVG repaints continuously. It runs even off-screen. I measured no jank on desktop, but this costs battery on phones.
- **Recommendation:** pause it when the hero is out of view (IntersectionObserver toggling a class), or animate fewer cells.
- **Suggested command:** `/impeccable optimize`

**[P3] Detector true positives**
- **Location:** nested teaser panels (`page.tsx:46` and `page.tsx:294`), the repeated kicker above a giant heading (`page.tsx:231` and `page.tsx:272`), and the overshoot easing on `.hc-pin`
- **Category:** Implementation Integrity
- **Impact:** stylistic. These are worth a design call, not a fix.
- **Suggested command:** `/impeccable quieter`

**[P3] `aria-label` on a generic span**
- **Location:** `setlist-panel.tsx:111` (`aria-label="Length 4:56"`)
- **Category:** Accessibility
- **Impact:** a label on a generic element is prohibited, so screen readers ignore it and read just "4:56".
- **WCAG:** 4.1.2 (best practice)
- **Recommendation:** use visually hidden text "Length" instead.
- **Suggested command:** `/impeccable harden`

### Patterns & Systemic Issues

- **Theme tokens that reference other tokens are resolved at `:root`.** `--focus-ring` is one; check any other composite token (for example `--shadow-*`, which is already re-declared per theme) when adding dark islands.
- **Wordmark and inline links are sized by their content, not by the tap token.** QlooWordmark is used three times on this page, at 25–33px or less.
- **Page code carries styling the system should own:** arbitrary type sizes, button re-skins and shadow overrides.

### Positive Findings

- axe reports 0 violations at 390 and 1440, in both day and night.
- Every measured text pair passes AA, most at 5.5–8.4:1.
- The semantic skeleton is strong:
  - one h1 with an sr-only "Busk Map:" prefix;
  - labelled sections and a skip link;
  - decorative SVGs and sketches are `aria-hidden`;
  - the hero map is `role="img"` with a real description.
- Reduced motion is handled properly, element by element: 129 animations drop to 0, and the glow is held at half strength rather than killed.
- No horizontal overflow at any width. The h1 sizes itself to its column (`19cqw`) so "What to play." stays on one line.
- The page is lean and fast: map lazy, images lazy, CLS 0.
- The poster CTAs have a strong 3px offset focus outline.
- Colour comes only from tokens, and day/night switching works, including inside the dark islands.

## Recommended Actions

1. **[P1] `/impeccable harden`**: re-declare `--focus-ring` per theme so focus shows on the dark islands in day mode (hero and teaser Qloo links, footer). Also add pause on hover/focus to the ticker (P2) and swap the span's aria-label for hidden text (P3).
2. **[P2] `/impeccable adapt`**: bring QlooWordmark, the map-legend toggles and the inline week links to the 44/48px tap size at 390.
3. **[P2] `/impeccable distill`**: remove or replace the "[Demo video]" placeholder.
4. **[P3] `/impeccable optimize`**: pause the hero glow and breathe animations when off-screen.
5. **[P3] `/impeccable typeset`**: move the h2 scale into tokens.
6. **[P3] `/impeccable polish`**: add a secondary poster button variant, review the nested teaser panels and repeated kickers, then a final pass.

You can ask me to run these one at a time, all at once, or in any order you prefer.

Re-run `/impeccable audit` after fixes to see your score improve.
