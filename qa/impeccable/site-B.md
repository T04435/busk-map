# Site chrome: Assessment B (detector + browser evidence) and audit

Target: the site chrome (AppHeader, MobileNav, SiteFooter, plus the skip link in the root layout) on `/`, `/busks`, `/brain`, `/brand`, `/privacy`, `/terms`.
Build: design/honeycomb f83f1a1 at http://localhost:3213 (already running; not started or stopped here). Source: `scratchpad/hc9/src`.
Sources: `src/components/honeycomb/{app-header.tsx, mobile-nav.tsx, site-footer.tsx, nav-items.ts, logo.tsx}`, `src/app/layout.tsx`. `hex-cell.tsx` was also scanned because the footer renders it.
Evidence folder: `scratchpad/imp/site-B/`. It holds the scripts `overlay.mjs`, `audit.mjs`, `focus.mjs` and `skip.mjs`, the raw outputs `detect.json`, `overlay.json` and `audit.json`, and the `shot-*.png`, `focus-*.png` and `skip-*.png` screenshots.
Isolation: no QA report and no Assessment A output was read.

---

## 1. CLI scan

```
impeccable detect --json src/components/honeycomb/{app-header,mobile-nav,site-footer,logo,hex-cell}.tsx \
  src/components/honeycomb/nav-items.ts src/app/layout.tsx
```

- **Exit code 0. Output `[]`, so 0 findings and 0 rules.** stderr was empty. Running it again without `--json` also exited 0 with no output.
- The deterministic scan of the chrome markup is clean.

## 2. Browser overlay

Flow, run separately at 1440×900 and 390×900 for each of the 6 pages:
1. Open a new Playwright context and page, `goto` (`load` plus 1.5 s).
2. Mutation preflight: set `document.title`, then read it back. It passed on all 12 runs.
3. `page.addScriptTag({ path: detect.js })`, wait 3 s, then collect console messages and call `window.impeccableDetectAsync({serialize:false})` to get each element and its findings.

**Steps that failed:** on the first attempt, `/` and `/busks` at both widths, and `/` at 390, timed out after 60 s waiting for `networkidle`. The map tiles and polling keep the network busy. Switching to `load` plus a settle delay fixed it. All 12 final runs succeeded: navigate ok, title ok, inject ok. live-server was not started, as instructed. The script was injected from the saved file.

Console summary lines (`[impeccable] N anti-patterns found`):

| page | 1440 | 390 |
|---|---|---|
| / | 11 | 10 |
| /busks | 3 | 3 |
| /brain | 2 (+ visual-contrast hits in detectAsync) | 2 |
| /brand | 34 | 44 |
| /privacy | 4 | 3 |
| /terms | 4 | 3 |

**Findings on chrome elements.** Only one chrome element is flagged, and it is flagged on every page at both widths:
- `side-tab`, "border-bottom: 4px", on `header[data-slot=app-header]`. **False positive.** This is the full-width 4 px orange rule under the bluestone bar (app-header.tsx:17, `border-b-4 border-primary`). It is a deliberate brand rule across the whole header, not a coloured side stripe on a card.

**Page-wide findings that land on `<body>`, which the root layout and globals own:**
- `cream-palette`, "cream/beige page background rgb(242,238,230)", on every page. This is the `--background` token #f2eee6. It is a deliberate Honeycomb "paper" ground, not an accident. Treat it as design intent and leave the decision to Assessment A.
- `dark-glow`, "Zero-offset box-shadow glow (#ffba00)", on every page. **False positive.** No element has that shadow before injection (body box-shadow is `none`, and the computed-style scan found 0 elements with it). Nothing in `src` contains that colour. #ffba00 is close to the overlay's own highlight colour `oklch(84% 0.19 80.46)`, so the detector is most likely seeing its own overlay.

**Out of scope here (page bodies, listed for the parent):**
- `/`: side-tab ×3 (hero/section rules), nested-cards ×4, kicker-above-heading ×2, oversized-h1, text-occlusion, bounce-easing, repeating-stripes-gradient.
- `/brain`: low-contrast ×4–6 on the h1 and lede ("1.0:1 via analytic-gradient+alpha"), probably a gradient or alpha false reading that the page assessment should confirm; text-occlusion.
- `/brand`: nested-cards 11–30, tiny-text ×8, numbered-section-labels ×8, line-length ×8, all-caps-body ×2, and others.
- `/busks`, `/privacy`, `/terms`: kicker-above-heading ×1 each.

The overlay was injected into a headless Playwright page, which no human was watching. There is no persistent user-visible overlay.

---

## 3. Audit (audit.md)

### What was measured

- **axe** (@axe-core/playwright 4.13, tags wcag2a/aa, 21a/aa, 22aa, best-practice), scoped to the header, the bottom nav, the footer and the skip link. 6 pages × {390, 1440} × {light, dark} = 24 runs. **0 violations in all 24 runs.** "Incomplete" results: 10 nodes of color-contrast in the landing footer, because axe cannot resolve contrast over the `bm-grain` background image. I checked those nodes by hand (see below) and they pass.
- **Contrast of key pairs**, computed from the rendered colours:

| pair | day | night |
|---|---|---|
| Header logo/active ring #f2ede4 on bluestone #141c21 | 14.79 | 14.79 |
| Header inactive item #a7b0b5 on #141c21 | 7.82 | 7.82 |
| Header active item #141c21 on #ff5a1f | 5.53 | (same bar) |
| Bottom nav inactive (muted-fg on card) | 6.09 (#56606a/#fbf9f5) | 7.48 (#a7b0b5/#182025) |
| Bottom nav active (fg on card) | 16.4 | 14.16 |
| Footer secondary text "with", "Built by" (muted-fg) | 5.54 on paper | 8.41 on #0f1416 |
| Footer links (fg) | 14.9 | 15.91 |
| Landing footer (dark band) text / links | 8.41 / 15.91 | 8.41 / 15.91 |
| **Built-by critter #d97757 (sole content of the Claude Code link)** | **2.68 on #f2eee6** (computed) | 5.9 |

- **Keyboard**, Tab order at 1440: skip link, header logo, Busks, Week, Brain, main, footer. At 390: skip link, header logo, main, footer, and then the bottom nav **last**. Tab presses needed to reach the bottom nav at 390: 12 on /privacy, 27 on /busks, 38 on /. The skip link activates and the next Tab lands inside `#main` on `/` and `/busks`. Every chrome link shows a 2 px ring on `:focus-visible`:
  - Header links: cream `#f2ede4` ring. Screenshot `focus-header-active-brain.png` shows it clearly around the orange active item.
  - Footer and bottom nav links: `--focus-ring`, which is ink #141c21 by day and orange #ff6a2b by night.
  - A forced-colors fallback is present (`outline: 2px solid CanvasText`).
- **Headings:** the chrome contributes no headings, which is correct. Each page has exactly one h1, coming from page content. **Landmarks:** banner header, `nav[Main]`, `main#main`, contentinfo footer, `nav[Site]`. Only one `nav[Main]` is rendered at a time; the other is `display:none`.
- **Touch targets at 390:**
  - Header logo: 179×48.
  - Bottom nav items: 130×62.
  - GitHub and critter links: 48×48.
  - Footer text links: 48 tall but 32–44 wide (Brain 32, Brand 35, Terms 37, Privacy 44).
  - **Qloo wordmark link: 44×15.**
- **Horizontal scroll:** none at 390, 720, 721, 768 or 1440 on any of the 6 pages (scrollWidth equals clientWidth), and no chrome element overflows. The breakpoint switch is exact: at 720 the bottom nav shows and the header nav is hidden; at 721 it is the other way round.
- **Bottom nav and content:** body padding-bottom is 64 px under 721. The last footer link ends at y=812 and the nav starts at y=836, so no content is covered.
- **Reduced motion:** with `reduce`, all chrome transitions compute to 0 s (the global rule at globals.css:368–370). Without it, the colour transitions are 150 ms (header) and 200 ms (nav tile). Only colour and background change, so the state change survives the kill. There are no animations in the chrome.
- **Dark mode:** emulated `prefers-color-scheme: dark` swaps every chrome token. `/brain` forces `data-theme="dark"` on the bottom nav and the footer even by day, which is intentional and matches the night page. The landing footer is always the dark grain band. The header is bluestone in both themes.
- **Hard-coded colours in chrome source:** app-header.tsx has 6 (lines 17, 18, 30, 31 ×3: #f2ede4, #a7b0b5, #232d33), logo.tsx:39 has #8C8CC8, and site-footer.tsx:27 has #d97757. mobile-nav.tsx and layout.tsx have none.

### Audit Health Score

| # | Dimension | Score | Key finding |
|---|---|---|---|
| 1 | Accessibility | 3 | axe: 0 violations ×24. Built-by critter is 2.68:1 by day (1.4.11). At 390 the bottom nav comes last in tab order. |
| 2 | Performance | 3 | Small SVG lockups (2 KB), self-hosted next/font. Footer Logo loads both lockup files (one hidden), and the Suspense fallback ships a second copy of each chrome part in the HTML stream. |
| 3 | Responsive Design | 3 | No h-scroll at any of 5 widths, exact 720/721 switch, 48 px targets. Qloo link is 15 px tall. Footer text links are 32–44 px wide. |
| 4 | Theming | 3 | Full token set and dark mode verified. 6 hard-coded hex values in the header duplicate night tokens. #8C8CC8 duplicates `--qloo-brand`. |
| 5 | Implementation Integrity | 3 | CLI clean. The overlay's only chrome hit is a false positive. Minor drift: hex literals, and the `--bottom-nav` breakpoint at 768 does not match the nav switch at 721. |
| **Total** | | **15/20** | **Good** |

### Implementation Integrity Verdict: **PASS**

The chrome is a coherent, product-specific system:
- A bluestone bar with the 4 px orange rule in both themes.
- An orange boxed active state with `aria-current`.
- A hex-cell GitHub mark, the pixel built-by critter, and the Qloo credit as a single link with one accessible name.
- One shared `NAV_ITEMS` and `activeNavId` source for the header and the bottom nav, and one `Logo` component.

Evidence for the verdict: the deterministic detector found 0 issues in the 7 source files. In the browser, the only chrome finding (`side-tab` on the header rule) was checked and is a false positive. The drift that remains is small: literal hex values in the header, and one breakpoint constant that does not match the nav switch.

### Executive Summary

- Audit Health Score: **15/20 (Good)**.
- Issues: P0 0 · P1 0 · P2 3 · P3 5.
- Top issues:
  1. The built-by critter is the only visible content of the "Built with Claude Code" link, and it is 2.68:1 against paper by day.
  2. On phones the Main navigation is the last thing in DOM and tab order, after the whole page and the footer.
  3. The Qloo wordmark link in the footer is 15 px tall.
  4. The header hard-codes night colours instead of using tokens.
- Next steps: `/impeccable harden` for P2-1 to P2-3, then `/impeccable polish` for the token and breakpoint drift.

### Findings by severity

**[P2] Built-by critter fails non-text contrast by day**
- Location: site-footer.tsx:22–33 (`BuiltByMark`, fill #d97757), rendered in the link at line 88.
- Category: Accessibility / Theming.
- Impact: the critter is the link's only visible content, so it is how a sighted user identifies the control. Against #f2eee6 it computes to about 2.68:1. Night (#0f1416) is about 5.9:1.
- WCAG: 1.4.11 Non-text Contrast (3:1).
- Recommendation: by day, darken the fill or give the mark a 1–2 px ink (`--rule`) outline. Alternatively, sit it on a darker chip. Keep #d97757 by night.
- Suggested command: `/impeccable harden`.

**[P2] Phone navigation comes last in reading and focus order**
- Location: layout.tsx:51–53 (`<MobileNav/>` rendered after `<SiteFooter/>`). mobile-nav.tsx:16–20 (fixed bottom).
- Category: Accessibility.
- Impact: under 721 px a keyboard or switch user needs 12 to 38 Tabs to reach Busks/Week/Brain. Screen-reader users meet the `nav[Main]` landmark after the footer. The visual position (always on screen) and the sequential position do not match.
- WCAG: 2.4.3 Focus Order (meaningful-order risk). The skip link already exists, which mitigates it.
- Recommendation: render MobileNav right after the header in the DOM. It is `position: fixed`, so the visual layout does not change. Alternatively, add a "Skip to navigation" link.
- Suggested command: `/impeccable harden`.

**[P2] Qloo wordmark link is a 44×15 target**
- Location: logo.tsx:48–60 (`QlooWordmark`), used at site-footer.tsx:64 with `width={44}`.
- Category: Responsive / Accessibility.
- Impact: at 390 it is the smallest tap target in the chrome, about a third of the 44 px guideline and of the project's own `--size-tap` of 48. It passes WCAG 2.5.8 only through the spacing exception.
- WCAG: 2.5.8 Target Size (minimum) is met through spacing. The 44 px guideline (2.5.5 AAA) fails.
- Recommendation: give the anchor `min-h-tap` (and `min-w-tap`) with the SVG centred, the same way the GitHub and critter links already do.
- Suggested command: `/impeccable harden`.

**[P3] Header hard-codes night colours**
- Location: app-header.tsx:17, 18, 30, 31 (#f2ede4 ×4, #a7b0b5, #232d33).
- Category: Theming.
- Impact: these are exactly the night `--foreground`, `--muted-foreground` and `--secondary`. A token change will not reach the header.
- Recommendation: put `data-theme="dark"` on the header (as MobileNav does on /brain) and use `text-foreground`, `text-muted-foreground`, `hover:bg-secondary` and `ring-foreground`. Keep `bg-bluestone` and `border-primary`. Caveat: the active item uses `bg-primary`, which would then become night orange #ff6a2b; check that this is acceptable.
- Suggested command: `/impeccable polish`.

**[P3] Qloo purple duplicated as a literal**
- Location: logo.tsx:39 `fill="#8C8CC8"`, while the `--qloo-brand` token exists at globals.css:52.
- Category: Theming.
- Recommendation: `fill="var(--qloo-brand)"`.
- Suggested command: `/impeccable polish`.

**[P3] `--bottom-nav` breakpoint does not match the nav switch**
- Location: globals.css:305–307 (`--bottom-nav` reset at 768 px; the comment says "under 768px") against mobile-nav.tsx:20 and layout.tsx:36, which switch at 721 px.
- Category: Implementation Integrity / Responsive.
- Impact: from 721 to 767 px there is no bottom nav, but `scroll-padding-bottom` is still 64 px, and any sticky bar that reads `--bottom-nav` floats 64 px too high.
- Recommendation: move the media query to `min-width: 721px` and fix the comment.
- Suggested command: `/impeccable polish`.

**[P3] Footer text links are narrower than 44 px**
- Location: site-footer.tsx:42 (`LINK`) and lines 67–76.
- Category: Responsive.
- Impact: Brain is 32 px, Brand 35, Terms 37. The targets are 48 px tall and separated by a dot and an 8 px gap, so they pass 2.5.8.
- Recommendation: add `min-w-tap justify-center`, or `px-1`.
- Suggested command: `/impeccable adapt`.

**[P3] Bottom nav labels are 11 px**
- Location: mobile-nav.tsx:30 (`text-[11px]`).
- Category: Accessibility / Responsive.
- Impact: the caps labels are small. They are bold, mono and 6.09–7.48:1, and each sits with an icon, so the effect is minor.
- Recommendation: 12 px, the same as the desktop header items.
- Suggested command: `/impeccable typeset`.

**Not raised (checked and fine):**
- Header focus ring: the first capture looked transparent only because the string was truncated. A re-check shows `rgb(242,237,228) 0 0 0 2px` and the screenshot confirms it.
- The Suspense fallbacks stream a paper footer and an unlit nav before the resolved copy in the same response. On `/` this could flash the paper footer before the dark one on a very slow connection. Not observed and not measured, so not raised.
- Detector `side-tab` and `dark-glow` are false positives, as described in section 2.

### Patterns and systemic issues

- **Literal colours where tokens exist.** All 8 hex literals in the chrome either duplicate an existing token (night fg, muted, secondary, qloo-brand) or are an untokenised brand mark. The tokens exist; the header just does not reach for them.
- **Small secondary targets.** The primary controls are generous (48–62 px), but the footer's inline links (Qloo, the text links) fall back to text-sized boxes.
- **Breakpoint constants in two places.** 721 lives in the components and 768 in globals.

### Positive findings

- 0 axe violations across 24 chrome-scoped runs (2 widths × 2 themes × 6 pages). The detector CLI is clean.
- Text contrast is AA or better everywhere: 5.5–16.4:1 in both themes, including the landing's dark grain band.
- A skip link that works. A consistent 2 px focus ring with a theme-aware colour (ink by day, orange by night, cream on the bluestone bar). A forced-colors fallback.
- `aria-current="page"` is rendered on the server (2 occurrences in the `/busks` and `/brain` HTML). The landing and legal pages correctly light no item.
- One nav model (`NAV_ITEMS`, `activeNavId`) drives both navigations. Only one `nav[Main]` is ever displayed.
- The breakpoint swap is exact at 720/721. There is no horizontal overflow at any width, the fixed nav never covers the footer, and the safe-area insets are handled.
- Reduced motion keeps the state changes and drops only the fades. The chrome has no animation.
- External links say "(opens in a new tab)" in their names and carry `rel="noopener noreferrer"`. Decorative SVGs are `aria-hidden` and `focusable="false"`.

### Recommended actions

1. **[P2] `/impeccable harden`**: give the built-by critter 3:1 by day, move MobileNav next to the header in the DOM, and make the Qloo link a 48 px target.
2. **[P3] `/impeccable polish`**: tokenise the header's hex values (try `data-theme="dark"` on the header), use `var(--qloo-brand)`, and align `--bottom-nav` to 721 px.
3. **[P3] `/impeccable adapt`**: widen the footer text links to `min-w-tap`.
4. **[P3] `/impeccable typeset`**: set the bottom nav labels to 12 px.
5. `/impeccable polish` as the final pass.
