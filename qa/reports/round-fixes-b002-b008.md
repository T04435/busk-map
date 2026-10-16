# QA round: fixes for B-002 to B-008, 16 Oct 2026

**Verdict: PASS.** All 7 fixes are verified. No High or Medium defects are open. 3 new Low: B-009 (a guard gap), B-010 and B-011 (both offline-only or pre-hydration). Nothing blocks a judge path.

**Build:** `dev/core` at 70eb77e (DEV's commits 4161a9f to 70eb77e on top of QA's 30c1f79), local only. QA builds now go to `NEXT_DIST_DIR=.next-qa`, so DEV's builds no longer break QA's servers.

## Gates

| Gate | Result |
|---|---|
| `NEXT_DIST_DIR=.next-qa pnpm check` | Pass. 365 unit tests in 45 files; coverage 96.5% statements, 87.7% branches; fixture provenance OK (243 files) |
| Offline e2e, full suite, desktop + mobile (`CI=1 PORT=3111`) | **146 passed**, 0 failed: DEV's suite plus QA's specs |
| QA specs, new this round | B-003 flipped from `test.fail` to a regression test (it passes); B-002 and B-007 regression tests; `tests/e2e/qa/a11y.spec.ts` scans 7 judge pages (landing, 2 example plans, week, tips, both not-found pages) for **any** WCAG 2.0–2.2 A/AA violation, at both sizes. All pass |

## Fix verification

| Bug | Fix | How QA verified | Result |
|---|---|---|---|
| B-002 spacing unexplained | 4161a9f | Acoustic example page text. "How pitches are scored": "The top 3 are at least 250 m apart … marked 'too close to' that pick". The other pitches are marked (for example "Federation Square · usual spot · too close to Footpath near … Flinders Lane east"). The plain-AI rows say "Scored higher, but within 250 m of …, so the plan picked a spot further away." | ✓ |
| B-003 offline artist pick | cdecbb7 | QA spec: a searched synthetic artist now opens `/p/<id>` on desktop and mobile | ✓ |
| B-004 combobox ARIA | 491f506 | DEV's a11y spec plus QA's all-impact axe on `/`: 0 violations | ✓ (leftover before hydration: **B-011**) |
| B-005 focus ring | 2559a05 | Keyboard Tab to both search inputs: the wrapper gets the 3px shadcn ring (`box-shadow … 0 0 0 3px`), the same as every other control | ✓ |
| B-006 blank selects | 54d3217 | `curl`: the server HTML has "6 pm", "9 pm", "General" (landing) and "5", "1" (week) | ✓ |
| B-007 offline explanations chip | 270c877 | QA spec: "Explanations: test model (offline)" is shown, with no "Explanations: Claude" and no Claude credit | ✓ (other offline Claude text: **B-010**) |
| B-008 guard skipped on PLAYWRIGHT_BASE_URL | 70eb77e | `guardMode()` evaluated directly: localhost, 127.0.0.1 and [::1] are now checked; a remote deploy only warns | ✓ (residual hosts: **B-009**) |

## New defects (details in `qa/bugs.md`)
- **B-009 Low:** the guard treats `0.0.0.0`, `127.0.0.2`, the LAN IP that `next dev` prints as "Network:", and `<machine>.local` as a deploy, so a live local server there only gets a warning. Suggest calling `/api/health` for every target and requiring an explicit opt-in when the server isn't offline.
- **B-010 Low:** offline only. "Claude kept the engine's top 3.", the "Claude: …" step prefixes and "Explained by Claude" on the pitch cards still credit Claude while the mock model wrote the text.
- **B-011 Low:** before hydration, both search comboboxes have `aria-expanded="true"` in the server HTML.

## Observation (not a defect)
The shadcn focus ring is mid-grey at 50% alpha on white, so it's faint. It's the same on every control and meets 2.4.7 (focus visible). The stronger 2.4.13 rule is AAA, not required. Worth a look when BRAND's design syncs.

## Not done this round
- **Live checks:** 0 of 5. The classifier blocked a QA live server earlier, so this still needs the user's approval.
- **Lighthouse:** DEV suggests `npx lighthouse` against the QA server. That downloads a package, which needs the user's approval.
- `global-error.tsx` could not be forced from the browser.

## Counts
Open: High 0, Medium 0, Low 3 (B-009, B-010, B-011). Fixed and verified to date: 8 (B-001 to B-008).
