# Errors and edge pages: Assessment B (detector + browser evidence) and audit

Build: Busk Map design/honeycomb f83f1a1, offline, http://localhost:3213 (production build: minified React, `/api/health` → `{offline:true, faults:true}`). Source: the hc9 export.
Routes: `/this-is-not-a-pitch` (404), `/p/ZZZZZZZZZ` (planNF), `/plan?example=acoustic&faults=render` (render), `/plan?example=sax&faults=fresh-limit` (limit).
Run as an isolated sub-agent. No QA reports and no Assessment A output were read.
Evidence is in `scratchpad/imp/errors-B/`: `detect.json`, `overlay.json`, `evidence.json`, `follow.json`, the scripts `run.cjs`, `overlay2.cjs`, `follow.cjs` and `retry.cjs`, and the screenshots (`<route>-<width>-<light|dark|overlay>.png`, `focus-*.png` and `*-text200.png`).

## 1. CLI scan

Command: `impeccable detect --json` on these files:
- `src/app/not-found.tsx`, `src/app/error.tsx`, `src/app/global-error.tsx` and `src/app/p/[id]/not-found.tsx`
- `src/components/status/` (`error-card.tsx`, `status-card.tsx`) and `src/app/plan/page.tsx`
- `src/components/honeycomb/plan-alert.tsx` and `hex-cell.tsx`
- `src/components/plan/plan-view.tsx`
- `src/components/ui/alert.tsx` and `button.tsx`

Result:
- **Exit 0, `[]`.** That is 0 findings and 0 rules, with nothing on stderr.
- **Canary check.** A throwaway `.tsx` containing `border-l-4`, `bg-clip-text` and a purple gradient returned exit 2 with 3 findings: side-tab, gradient-text and ai-color-palette. So the detector does parse TSX, and the clean result is real.

## 2. Browser overlay

Setup:
- Each route got a new Playwright context and page at 1440 and at 390 (light), 8 runs in all.
- Mutation preflight passed on all 8. `document.title` was set to `[Human] …` and an appended `<script>` executed (`window.__mutok=1`).
- `detect.js` was added with `page.addScriptTag({path})`, followed by a 3 s wait.
- The script exposes `window.impeccableDetect()` and others; its results were read from there. Overlay elements rendered: 3 on most pages, 5 on limit.
- No step failed. live-server was not started, as the brief says.

Console counts:
- 404, planNF and render: `[impeccable] 2 anti-patterns found`
- limit: `3 anti-patterns found`

The results were the same at 1440 and 390.

| Rule | Where | Pages | Verdict |
|---|---|---|---|
| side-tab (`border-bottom: 4px`) | `header.flex.h-16`, `src/components/honeycomb/app-header.tsx:17` (`border-b-4 border-primary`) | all | **False positive.** It is the full-width app bar's orange rule, not a one-sided card accent. |
| cream-palette (`rgb(242,238,230)`) | body; `--background: #f2eee6`, `src/app/globals.css:24` | all | **True by rule.** The value is a brand token and dark mode swaps it to `#0f1416`. Whether it is a reflexive choice is for Assessment A. |
| dark-glow (`#ffba00` zero-offset glow) | body (in the results array only, not in the console count) | all | **False positive.** No element on the page computes a `#ffba00` / `rgb(255,186,0)` box- or text-shadow (checked every node), and the colour is not in `src/`. It matches the detector's own highlight colour (`oklch(84% 0.19 80.46)`), so the overlay is detecting itself. |
| all-caps-body (36 chars uppercase) | `span.font-mono.text-xs`, the eyebrow "Fri 16 Oct · 5–8 pm · General permit" | limit | **False positive in intent.** It is a 12px mono metadata label, not body copy. |
| repeating-stripes-gradient | `.bm-hatch-test` on the "Qloo test data" banner, `globals.css:323` | limit | **Intentional.** It is a documented hazard hatch that marks mock data. Keep it. |

Other console output:
- render shows `Minified React error #441`. This is React's production placeholder for "an error occurred in the Server Components render", which is expected for the simulated fault. It also logs `Busk Map render error {digest, name}`, as designed.
- 404 logs a 404 resource load (the document itself).
- limit logs a 429 from `/api/plan` (the fault, as designed).

## 3. Audit

### Evidence collected

- **axe** (@axe-core/playwright 4.13, WCAG 2.0/2.1/2.2 A+AA plus best-practice):
  - Covered every route at 390 and 1440, day and night: 16 runs.
  - **0 violations and 0 incomplete.**
- **Contrast**, measured from computed styles, with alpha flattened by canvas:
  - 404 body: 6.09 (day) / 7.48 (night)
  - Decorative "404": 5.22 / 7.40
  - Primary button ink on orange: 5.53 / 6.49
  - Error reference (mono, 13px): 6.09 / 7.48
  - planNF body: 5.54 / 8.41
  - Limit alert ink on its tint: about 15:1 by day (alert background resolves to `rgb(247,232,231)`) and about 14:1 at night
  - Limit "Back to Busk Map home": 5.22 / 7.40
  - Lowest pair: 5.22.
- **Keyboard:**
  - Tab order starts at Skip to content (150×52, visible on focus), then the logo, Busks, Week and Brain, then the page actions in reading order, then the footer.
  - The header uses a 2px `#f2ede4` ring on the dark bar. Buttons use a 2px outline in the ring token, offset 2px. Inline links use a 2px ink box-shadow. Focus is visible on every stop (see the `focus-*.png` crops).
  - There is no keyboard trap.
- **Headings and landmarks:**
  - Each page has exactly one `h1`: "No pitch here", "We can't find this busk", "Something went wrong" and "Soul and funk sax player".
  - The "404" numeral is an `aria-hidden` `<p>`.
  - Landmarks: header, nav, `main#main` and footer. The error card has `role=alert`. On limit, the alert has `role=alert` and the status lines have `role=status`.
  - `lang="en-AU"`.
- **Touch targets at 390:**
  - All main-content actions are at least 44px tall and span the full width (306–358px).
  - Bottom tab bar items are 130×62.
  - The footer has inline text links narrower than 44px: Terms 37, Brain 32 and Brand 35 (each 48 tall), and the Qloo link is 44×15. That footer is shared chrome.
- **Horizontal scroll:**
  - `scrollWidth == clientWidth` at 390, 768 and 1440 on all 4 routes.
  - It still holds at 390 with the root font size at 200%.
- **Reduced motion:** `document.getAnimations()` is empty on every route, both with and without `reduce`. The pages have no motion. `globals.css` guards every keyframe class under `prefers-reduced-motion`.
- **Dark mode:** all 4 routes render correctly at night (see `*-dark.png`), with tokens swapping cleanly. The error cell's lift becomes the night destructive tone.
- **Hard-coded colours:**
  - **0** in the target sources: `not-found.tsx` ×2, `error.tsx`, `global-error.tsx`, `status/*`, `plan-alert.tsx` and `hex-cell.tsx`.
  - The shared `app-header.tsx:17,18,30,31`, which renders on every page here, hard-codes `#f2ede4`, `#a7b0b5` and `#232d33`.
  - `global-error.tsx:6-8` hard-codes font stacks on purpose, because no brand fonts load there.
- **HTTP status and titles:**
  - 404: status 404, title "Page not found · Busk Map", noindex.
  - **planNF: status 200** and title "Plan · Busk Map". It has `noindex`, emitted twice.
  - render: 200, "Something went wrong · Busk Map".
  - limit: 200, "Plan · Busk Map".
- **Try again** (render, 390):
  - Clicking it refetches the RSC payload and the same card comes back.
  - Focus falls to `<body>`. The button gives no pending or busy state, and nothing confirms that a retry happened.
- **Not exercised:** `global-error.tsx`, because no fault breaks the root layout. I reviewed its source only: it has its own `<html lang>`, a `<title>`, the system font stack and a plain `<a href="/">`.

### Audit Health Score

| # | Dimension | Score | Key finding |
|---|---|---|---|
| 1 | Accessibility | 3 | axe clean in 16 runs and every pair at least 5.2:1. Focus drops to `<body>` after Try again. |
| 2 | Performance | 3 | The pages are tiny and have no animations. Each error page fires about 12 footer and nav RSC prefetches, with duplicates. |
| 3 | Responsive Design | 3 | No overflow at 390/768/1440 and main targets at least 44px. Button labels spill their box at large text size (`whitespace-nowrap`). |
| 4 | Theming | 3 | The target files use tokens only and dark mode works. The shared app header hard-codes 3 hex colours. |
| 5 | Implementation Integrity | 3 | The CLI is clean and the overlay findings are mostly false positives. The unknown-plan page is a soft 404 (HTTP 200, "Plan" title), and the StatusCard docstring claims a page it does not render. |
| **Total** | | **15/20** | **Good** |

### Implementation Integrity verdict

**Pass.** The 404, error and global-error pages share one `StatusCard` (`status-card.tsx`) built from product-specific pieces: the honeycomb `HexCell` with a hard 4px offset lift, display caps and a mono reference footnote. The limit state reuses `PlanAlert`, so its copy cannot drift. The CLI detector found nothing.

Of the 5 overlay rules:
- side-tab, dark-glow and all-caps-body are false positives.
- The hatch is intentional.
- Only cream-palette is a true rule hit, and it is a brand token.

Two pieces of verified drift remain:
- (a) `/p/<id>` not-found is served with HTTP 200 and the parent page's title.
- (b) `status-card.tsx:6` says the card sits behind "/p/<id> not found", but `src/app/p/[id]/not-found.tsx` deliberately builds its own card-less layout (board X01).

### Executive summary

- Score **15/20 (Good)**.
- Issues: P0 0 · P1 0 · P2 4 · P3 4.
- Top issues:
  - The unknown plan returns a soft 404.
  - Try again drops focus and gives no feedback.
  - Button labels overflow at large text sizes.
  - The shared header uses hard-coded colours.
- Next steps: `/impeccable harden` for the status code, title and retry feedback, `/impeccable adapt` for text scaling, then `/impeccable polish`.

### Findings by severity

**[P2] Unknown plan id is a soft 404**
- Location: `src/app/p/[id]/page.tsx:22-27` (`notFound()` runs inside `<Suspense>` after streaming has begun, at :42 and :44). Rendered by `src/app/p/[id]/not-found.tsx`.
- Category: Implementation Integrity
- Impact:
  - `/p/ZZZZZZZZZ` returns **HTTP 200**, so link checkers, monitoring and crawlers see a valid page. `noindex` softens the SEO side.
  - The tab title stays "Plan · Busk Map" while the page says "We can't find this busk".
  - Screen-reader users hear a different title from the page they get.
- Standard: HTTP semantics; WCAG 2.4.2 Page Titled (the title does not describe the page).
- Recommendation:
  - Resolve the id before the Suspense boundary (or in `generateMetadata`) so that `notFound()` runs before streaming starts.
  - Give `p/[id]/not-found.tsx` its own title, such as "Busk not found · Busk Map".
  - Drop the duplicate `noindex` meta.
- Suggested: `/impeccable harden`

**[P2] Try again gives no feedback and loses focus**
- Location: `src/components/status/error-card.tsx:36-39`
- Category: Accessibility
- Impact:
  - After a click, the RSC refetch completes and the identical card re-renders.
  - Focus falls to `<body>` (verified), so keyboard and screen-reader users lose their place.
  - Nobody can tell whether the retry ran.
- WCAG: 2.4.3 Focus Order; 4.1.3 Status Messages.
- Recommendation:
  - Keep focus on the button or move it to the `h1` on re-render.
  - Show a brief pending state (`aria-busy`, or a "Trying again…" label).
  - If the retry fails again, say so ("Still not loading").
- Suggested: `/impeccable harden`

**[P2] Button labels overflow at large text sizes**
- Location: `src/components/ui/button.tsx:10` (`whitespace-nowrap`, fixed `h-control` 44px). Seen on `not-found.tsx:21-26` and `error-card.tsx:36-43`.
- Category: Responsive
- Impact: at 390 with the root font size at 200%, "GO TO BUSK MAP HOME" spills past the button and the card edge (`404-390-text200.png`). The second button ends up under the fixed tab bar.
- WCAG: 1.4.4 Resize Text and 1.4.10 Reflow (partial).
- Recommendation: let full-width phone buttons wrap (`max-sm:whitespace-normal`, `min-h-control` instead of `h-control`).
- Suggested: `/impeccable adapt`

**[P2] Shared app header hard-codes colours**
- Location: `src/components/honeycomb/app-header.tsx:17,18,30,31` (`#f2ede4`, `#a7b0b5`, `#232d33`)
- Category: Theming
- Impact: these values bypass the token system on every page, including all 4 audited here. They will drift if the palette changes.
- Recommendation: add `--bar-foreground`, `--bar-muted` and `--bar-hover` tokens next to `--bluestone`.
- Suggested: `/impeccable colorize`

**[P3] Body text sizes are fixed in px**
- Location: `status-card.tsx:52` and `p/[id]/not-found.tsx:15` (`text-[17px] leading-[26px]`), and `status-card.tsx:54` (`text-[13px] leading-4`)
- Category: Accessibility
- Impact: these sizes ignore the user's default font-size preference, though browser zoom still scales them.
- Recommendation: use rem-based tokens.
- Suggested: `/impeccable typeset`

**[P3] The error card's alert role covers the whole card**
- Location: `status-card.tsx:45`
- Category: Accessibility
- Impact: on load, `role=alert` on the whole section announces the title, the body, both button labels and the reference code in one burst.
- Recommendation: put the alert on the title and description only, or use `aria-labelledby`/`aria-describedby` on a region.
- Suggested: `/impeccable harden`

**[P3] StatusCard docstring does not match the code**
- Location: `status-card.tsx:5-7`
- Category: Implementation Integrity
- Impact: the docstring lists "/p/<id> not found", but that page uses its own layout. That misleads maintainers.
- Recommendation: correct the comment, or bring planNF onto the card if X01 changes.
- Suggested: `/impeccable document`

**[P3] Error pages prefetch every link**
- Location: shared chrome (header, footer and tab bar `Link`s)
- Category: Performance
- Impact: about 12–15 RSC prefetch requests fire on a 404 or error page, including duplicate keys for the same route. The cost is small, but it is wasted on a page the user is about to leave.
- Recommendation: use `prefetch={false}` on footer links.
- Suggested: `/impeccable optimize`

### Patterns and systemic issues

- **Fixed control sizing.** `whitespace-nowrap` with a fixed `h-control` is the button baseline, so every full-width phone action breaks when text is enlarged, not just these pages.
- **px type in status surfaces.** The px font sizes repeat across the status surfaces (`text-[17px]` ×2, `text-[13px]`).
- **Not-found semantics.** Status and title handling is only right on the site-wide 404. The scoped not-found under a streamed page loses both.

### Positive findings

- **Accessibility:**
  - axe is clean across 16 runs at both widths and both themes.
  - The lowest text contrast is 5.22:1, and the limit alert is about 15:1.
  - Each page has one `h1`, a working skip link and consistent landmarks.
  - Focus is clearly visible on every stop: the ring on the header bar, and an outline offset to the page ground on buttons (the B-134 note).
- **Error card:**
  - Shows only the digest as "Reference" and never the message or stack. It logs `{digest, name}` only.
  - Uses the correct Next 16 `retry` prop, checked against `node_modules/next/dist/docs/.../error.md`.
  - `global-error` keeps its own document, `lang`, title and system fonts, and uses a plain link home.
- **Theming:** the target sources use tokens only, and night mode renders correctly on all 4 routes.
- **Responsive:** no horizontal scroll at any width, and the phone actions span the full width at 44px or more.
- **Limit state:**
  - Reuses `PlanAlert`, with copy kept in one place.
  - Says plainly that nothing started ("No new plan was started.").
  - Offers one clear way out.
- **Motion:** none on these pages, and every keyframe class in `globals.css` has a reduced-motion guard.

### Recommended actions

1. **[P2] `/impeccable harden`**:
   - Make `/p/<id>` not-found return 404 with its own title.
   - Give Try again focus handling and a pending/failed state.
   - Narrow the error card's alert region.
2. **[P2] `/impeccable adapt`**: let full-width buttons wrap with a minimum height of `h-control`, and re-check at 200% text.
3. **[P2] `/impeccable colorize`**: move the app header's three hex colours to bar tokens.
4. **[P3] `/impeccable typeset`**: use rem-based body and footnote sizes in the status card and planNF.
5. **[P3] `/impeccable optimize`**: stop footer prefetching on error pages.
6. **[P3] `/impeccable document`**: fix the StatusCard docstring.
7. `/impeccable polish`

You can ask me to run these one at a time, all at once, or in any order you prefer. Re-run `/impeccable audit` after fixes to see your score improve.
