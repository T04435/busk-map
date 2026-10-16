# /brain · Assessment B (detector + browser evidence) and audit

Build: Busk Map design/honeycomb f83f1a1, http://localhost:3213/brain. Source: scratchpad/hc9 (export). Isolated sub-agent; no QA reports or Assessment A output read.
Evidence folder: scratchpad/imp/brain-B/ (detect.json, results.json, run.cjs, focus.cjs, glow.cjs, screenshots page-*/traced-*/overlay-*/focus-c1-*.png).

## 1. CLI scan

Command (run from hc9):
`impeccable detect --json src/app/brain/page.tsx src/components/brain/brain-map.tsx src/components/honeycomb/note-card.tsx src/components/honeycomb/stat-strip.tsx src/components/honeycomb/logo.tsx src/components/ui/button.tsx`
and `impeccable detect --json src/app/brain src/components/brain`.

- Exit code **0** both runs, output `[]`. **0 findings, 0 rules**, no file:line. stderr empty.

## 2. Browser overlay

Fresh Playwright (Chromium 1.64) context per width, 1440x900 and 390x900, default (light) OS scheme.

| Step | 1440 | 390 |
|---|---|---|
| navigate | ok | ok |
| mutation preflight (`document.title` set, read back "impeccable preflight · The brain of Busk Map") | ok | ok |
| `page.addScriptTag({ path: detect.js })` | ok | ok |
| wait 3 s, `__impeccableCoreError` | empty | empty |
| window API exposed | impeccableDetect/DetectAsync/Scan/ScanAsync/... | same |

Console (`[impeccable]`), identical at both widths: **"2 anti-patterns found"**
- `side-tab` — `header.flex.h-16` "border-bottom: 4px"
- `cream-palette` — body "cream/beige page background rgb(242, 238, 230)"

Second call `window.impeccableDetectAsync()` (after the overlay was drawn) returned additionally:
- `dark-glow` body "Zero-offset box-shadow glow (#ffba00)"
- `low-contrast` 1.0:1 "via analytic-gradient+alpha" on h1, intro `p`, `#wiring` h2, the three column h3s (1440: 6 elements; 390: 4)
- `text-occlusion` on spans reading "low contrast text" covered by h1/h2

Verdicts:
- **side-tab: false positive.** It is the full-width 4 px orange rule under the site header (app chrome, all routes), not a one-sided card accent.
- **cream-palette: false positive for this route.** `--background` light is #f2eee6 on `body`, but /brain pins `data-theme="dark"` on main/header/footer, so no cream pixel is visible (see page-1440-light.png). Site-wide token choice, not a /brain issue.
- **dark-glow #ffba00: false positive / self-contamination.** A full computed-style sweep of every element and pseudo-element on the un-instrumented page found no box-shadow with rgb(255,186,0); no source match for ffba00. It is the overlay's own amber.
- **low-contrast 1.0:1: false positive.** main's background-image is a hex-lattice SVG plus a `color-mix(var(--foreground) 9%)` dot grid; the analyser read the dot colour as the text's background. Measured: intro text #f2ede4 on #0f1416 = 15.9:1; headings same.
- **text-occlusion: false positive** — the "low contrast text" spans are the overlay's own labels sitting over the headings it flagged.
- Net: **0 verified overlay findings** for /brain.

## 3. Audit

### Evidence summary
- **axe** (@axe-core/playwright 4.13, tags wcag2a/aa, 21a/aa, 22aa, best-practice) at 390 and 1440, light and dark OS scheme, idle and traced (c3 picked): **0 violations in all 8 runs.** `color-contrast` incomplete on 24 (390) / 96 (1440) nodes because of the background-image; checked by hand below.
- **Contrast** (computed colours): intro 15.91; stat numeral qloo #8c8cc8 on card 5.27; call sub-line 11 px qloo 5.27; legend/column note/secondary label #a7b0b5 on #0f1416 8.41; idle panel body 6.97; back link #ff6a2b 6.49; dim node #9aa4aa on #141b20 6.85; dim hex numeral #9aa4aa on #2e3a41 4.6; selected sub-line #b8b8e6 on #26323a 6.9; panel title primary on popover 5.38. All pass AA. Card border #2e3a41 vs page #0f1416 = 1.59 (non-text boundary of node buttons).
- **Focus ring: fails in light OS scheme.** Node buttons and the back link get the global fallback `box-shadow: var(--focus-ring)`. `--focus-ring: 0 0 0 2px var(--ring)` is declared on `:root` (globals.css:200), so `var(--ring)` resolves there to the light #141c21 and is inherited as a finished string into the pinned-dark main. Measured on main: `--ring: #ff6a2b` but `--focus-ring: 0 0 0 2px #141c21`. Ring vs card 1.04:1, vs page 1.08:1 — invisible (focus-c1-light.png). In dark OS scheme it is #ff6a2b, 5.78:1 (focus-c1-dark.png). Selected/path pieces have their own `outline` and stay visible.
- **Tab order** (1440): skip link, logo, Busks, Week, Brain, Qloo wordmark, c1…c11, Spotify, Ticketmaster, 18 data points, 9 busk parts, Back link. Follows the column order, no traps, every stop in view.
- **Keyboard behaviour**: Enter on c5 sets aria-pressed=true, live region announces "Tracing. Artists nearby, explained feeds 2 data points and 3 parts of your busk. Other pieces are dimmed."; Escape clears, announces, keeps focus on c5; Clear trace returns focus to the traced piece. Trace detail folds while a piece has :focus-visible (intentional).
- **Headings**: H1 (sr-only "Powered by Qloo:" + "The brain of Busk Map") > H2 The wiring > H3 Qloo calls > H4 With two other sources > H3 Data points > H3 Your busk > H2 Notes (sr-only) > H3 ×3. No skips. Landmarks: header, nav[Main] (desktop + mobile, same label, one hidden per breakpoint), main, footer, nav[Site].
- **Touch targets at 390** (<44 either axis): hero Qloo wordmark link 120x41; footer "with Qloo" link 44x15; footer Terms/Brain/Brand 32–37x48 (skip link 1x1 is sr-only, excluded). All node buttons ≥48 tall, full width. All ≥24 px except the 15 px-tall footer link (WCAG 2.5.8 spacing exception likely applies).
- **Horizontal scroll**: none at 390, 768, 1440 (scrollWidth = clientWidth).
- **Traced state at 390**: dimmed pieces hidden (7 buttons left), picked piece scrolled clear of the panel (node 318–373, panel 632–836, nav 836–900), scroll-padding-bottom 284 px. The sticky panel (max 45vh) covers the lit busk parts below it until scrolled.
- **Reduced motion**: node and wire transitions → 0s, no running animations, scrollIntoView uses `behavior: "instant"`. State change (border, colour) still shows. Good.
- **Hard-coded colours** in route source: brain-map.tsx:176 `bg-[#26323a]`; :178 `bg-[#141b20] text-[#9aa4aa]`; :188 `text-[#9aa4aa]`; :199 `text-[#9aa4aa]`, `text-[#b8b8e6]`; page.tsx:16 lattice stroke `#f2ede4`. Everything else uses tokens (qloo, primary, card, popover, border, input, muted-foreground, bluestone).
- **Dark mode**: page is pinned dark by design; identical rendering in both OS schemes except the focus-ring defect.
- **Performance**: no images, no client fetch; one client component. useWires reads rects in a ResizeObserver callback then sets state once (no read/write interleave); 106 SVG paths re-class on pick; transitions are colour/opacity only.

### Audit Health Score

| # | Dimension | Score | Key Finding |
|---|---|---|---|
| 1 | Accessibility | 3 | Focus ring invisible (1.04:1) on every /brain control when the OS is in light mode |
| 2 | Performance | 4 | -- |
| 3 | Responsive Design | 3 | Hero Qloo wordmark 41 px tall, footer links 15–37 px; trace panel covers up to 45vh at 390 |
| 4 | Theming | 2 | `--focus-ring` frozen at :root value inside pinned-dark subtree; 6 hard-coded hexes for trace states |
| 5 | Implementation Integrity | 3 | Detector clean; overlay findings all false positives; drift limited to state colours and the ring token |
| **Total** | | **15/20** | **Good** |

### Implementation Integrity Verdict
**Pass.** The route expresses a product-specific system: hex numerals and hex column marks, Qloo-purple vs Busk-orange path language, real endpoint names on every call, a live-region-announced trace, scroll-padding that keeps the picked piece above the sticky panel. CLI detector: 0 findings. Browser overlay: 2 console findings + 4 extra rule types from a re-scan, all verified false positives (chrome rule, invisible body token, overlay self-contamination, background-image contrast mis-read). Verified drift: trace-state colours hard-coded outside the token set, and a token composed at :root that does not follow a scoped theme.

### Executive Summary
- Audit Health Score: **15/20 (Good)**
- Issues: P0 0 · P1 1 · P2 2 · P3 4
- Top issues: (1) invisible focus ring in light OS scheme; (2) `--focus-ring` composition is a systemic token bug that will hit any other pinned-dark band (landing dark bands, footer); (3) hard-coded trace-state colours; (4) small Qloo/footer targets at 390.
- Next: fix the ring token (harden), move state colours to tokens (colorize/polish), then adapt targets.

### Findings by severity

**[P1] Focus ring invisible on /brain in light OS scheme**
- Location: src/app/globals.css:200 (`--focus-ring: 0 0 0 2px var(--ring)` on `:root`) with :353–356 fallback rule; affects every node button in src/components/brain/brain-map.tsx:158 and the back link src/app/brain/page.tsx:74
- Category: Accessibility / Theming
- Impact: a keyboard user on a light-mode OS cannot see which of 40 pieces has focus; 1.04:1 against the card, 1.08:1 against the page.
- WCAG: 2.4.7 Focus Visible (AA), 1.4.11 Non-text Contrast (AA), 2.4.13 Focus Appearance (AAA)
- Recommendation: redeclare `--focus-ring` in the `.dark, [data-theme="dark"]` block (and the prefers-color-scheme dark block), or use `box-shadow: 0 0 0 2px var(--ring)` directly in the :353 rule so `--ring` resolves on the element.
- Suggested command: /impeccable harden

**[P2] Trace-state colours hard-coded outside the token set**
- Location: brain-map.tsx:176, 178, 188, 199 (#26323a, #141b20, #9aa4aa ×3, #b8b8e6); page.tsx:16 (#f2ede4 lattice)
- Category: Theming
- Impact: selected/dim states will not follow any palette change; #9aa4aa sits between --muted-foreground and --border with no name. All currently pass contrast.
- Recommendation: add `--trace-selected-bg`, `--trace-dim-bg`, `--trace-dim-fg`, `--trace-selected-sub` (or reuse --muted/--secondary) in the dark block; lattice stroke from `--foreground`.
- Suggested command: /impeccable colorize

**[P2] Sticky trace panel covers the lit busk parts at 390**
- Location: brain-map.tsx:346 (`max-h-[45vh]`, sticky bottom)
- Category: Responsive
- Impact: after a pick, the panel (204 px) plus nav (64 px) hide the lower lit pieces; user must scroll to see what lit up. Picked piece itself is kept visible.
- Recommendation: lower the cap at <768 (e.g. 35vh) or start the panel folded on mobile with an expand control.
- Suggested command: /impeccable adapt

**[P3] Small touch targets at 390** — hero Qloo wordmark link 120x41 (src/components/honeycomb/logo.tsx:54 via page.tsx:30); footer "with Qloo" 44x15, footer Terms/Brain/Brand 32–37 px wide (site-footer). Below 44 px guidance, above 24 px except the 15 px link. Responsive. WCAG 2.5.8 (AA) borderline, 2.5.5 (AAA). /impeccable adapt

**[P3] Node button boundary 1.59:1** — border #2e3a41 and card #182025 vs page #0f1416. Text labels carry the affordance so not a strict 1.4.11 fail, but the 40 buttons read as faint boxes; dim state is barely distinct from idle. Accessibility. /impeccable polish

**[P3] "Powered by Qloo" read twice** — visible span with the Qloo link (page.tsx:28–31) then the h1's sr-only "Powered by Qloo:" (page.tsx:33). Redundant for screen readers. Accessibility. /impeccable clarify

**[P3] 11 px mono sub-lines** — brain-map.tsx:199 and the h4 at :257, 11 px; pass contrast (5.27–8.41) but small for the endpoint text that is the page's evidence. Accessibility/legibility. /impeccable typeset

### Patterns & systemic issues
- Tokens composed from other tokens on `:root` (`--focus-ring`; also `--shadow-sm/md/lg` with literal #141c21, globals.css:197–199) do not follow `[data-theme="dark"]` scoping. Any pinned-dark band in a light OS (here /brain; also landing dark bands, dark footer) inherits light-theme focus and shadow values.
- State variants (trace selected/dim) are styled with arbitrary hex values instead of named tokens.
- axe can't evaluate contrast over the textured `bm-grain` + lattice ground (96 incomplete nodes at 1440), so this route needs manual contrast checks on every change.

### Positive findings
- 0 axe violations across 8 runs (two widths, two schemes, idle and traced).
- Strong keyboard model: real `<button aria-pressed>`, Escape to clear, focus restored to the traced piece, polite live region with a full sentence summary.
- scroll-padding tied to the panel height (B-015) and rAF scrollIntoView keep the picked piece above the sticky panel; verified at 390.
- Reduced motion handled per element (motion-reduce:transition-none), no global kill; state still reads.
- Clean heading outline with sr-only H2 for the notes grid; hex marks and arrows are aria-hidden with sr-only "From/To" text.
- No horizontal overflow at 390/768/1440; stacked layout hides dimmed pieces on mobile instead of shrinking them.
- Planned work labelled "Next · not built yet" as a heading.

## Recommended Actions
1. **[P1] `/impeccable harden`**: redeclare `--focus-ring` (and the shadow tokens) under the dark scopes so the ring is #ff6a2b inside the pinned-dark /brain in a light OS.
2. **[P2] `/impeccable colorize`**: replace the six trace-state hexes in brain-map.tsx with named tokens.
3. **[P2] `/impeccable adapt`**: shorter or folded trace panel under 768 px; enlarge the hero Qloo link and footer links to 44 px.
4. **[P3] `/impeccable typeset`**: raise 11 px mono sub-lines to 12 px.
5. **[P3] `/impeccable clarify`**: drop the duplicated sr-only "Powered by Qloo:" from the h1.
6. `/impeccable polish`: final pass (node boundary contrast, dim vs idle distinction).

> You can ask me to run these one at a time, all at once, or in any order you prefer.
>
> Re-run `/impeccable audit` after fixes to see your score improve.

## Steps that failed or were skipped
- None failed. `impeccable live-server` not started (per brief; detect.js injected from file). First Playwright require of `node_modules/playwright` failed (not hoisted in the pnpm export); used `@playwright/test` instead. Touch gestures not synthesized: the page has no drag/slider surfaces, only taps (verified by click at 390 emulated viewport, Chromium, no touch emulation).
