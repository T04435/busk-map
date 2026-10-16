# Honeycomb verification checklist (QA)

Worktree `~/projects/CUBANOSDEV/busk-map-honeycomb`, branch `design/honeycomb` (DEV's). QA only reads and runs things there: build dir `.next-qa`, port **3211**, stopped by its PID. Never 3200 (the user's) or 3210 (DEV's). Offline only (`BUSKMAP_OFFLINE=1`, mock model), per the user, 17 Oct.

Inputs: the deck (https://claude.ai/artifact/CyuynoEo5ssEv6DaqNTgM1, Brand board screen matrix), the plan states (https://claude.ai/artifact/DuUBWHswpfrNBRnvj5rUsc), the design system (https://claude.ai/artifact/EQRAi5mHGVbeVSK3Mzd7aB), `hackathon/…/design-handoff/` (restyle-notes §5), and HQ's 17 defaults (end of `honeycomb-round.md`). Where the deck and HQ's defaults differ, **verify against HQ's defaults**.

Output: `qa/reports/honeycomb-audit.md` (findings by severity, each with a screenshot and a fix) and `qa/screens/honeycomb/<screen>-<width>-<theme>.png`, committed on `dev/core` by path.

## 1. Gates (in the worktree)
- [ ] `pnpm check` (`NEXT_DIST_DIR=.next-qa`)
- [ ] clean-export build (`git archive design/honeycomb`)
- [ ] DEV's full e2e and QA's suite (`qa/playwright.config.ts`, w390/w768/w1440); no test id removed (diff `data-testid` against dev/core)
- [ ] axe WCAG 2.2 AA at 3 widths × day and night: landing, the /busks form, each plan state, /brain (idle and traced), /tips, the not-found pages, the error page, /brand

## 2. Post-sync checks (restyle-notes §5)
- [ ] every screen at 390, 768 and 1440, rendered and looked at; MobileNav below 768, AppHeader from 768 (HQ default 3)
- [ ] day and night via `prefers-color-scheme` (default 4); orange fills keep the 2px rule by day and drop it at night
- [ ] no sideways scroll on any route, including the raw-data tables and the formula
- [ ] focus ring visible on paper, card, popover, orange and the bluestone header; B-015 still passes on /brain
- [ ] `prefers-reduced-motion: reduce`: nothing animates; the Loader stops but stays visible; the shimmer stops
- [ ] tap targets ≥ 48px: pins, remove buttons, nav items, list rows

## 3. HQ's 17 defaults
1. [ ] form at `/busks`; landing links point there; `/#own` redirects
2. [ ] nav: Busks, Week, Brain, Tips (no Setlist)
3. [ ] phone nav < 768; header ≥ 768; /brain stacks ≤ 1023
4. [ ] dark follows the system, no toggle
5. [ ] pitch detail in a Sheet (right, full screen on phone); `?pitch=` deep link works
6. [ ] other pitches as quiet map dots with a popover ("Too close to …"); no list; WeightsPanel copy updated
7. [ ] research feed newest first, no step numbers, plain-words cards, tool names only under raw data
8. [ ] Qloo down: no re-run button
9. [ ] crowd and weights inside each pitch's details
10. [ ] no TipForm on the plan page; /tips works
11. [ ] tip delete asks in a Dialog first
12. [ ] not-found title "We can't find this busk"
13. [ ] no map events or zones drawn
14. [ ] `/brand` public page: brand book, tokens, components, assets
15. [ ] Week unchanged (diff its components against dev/core), no new badges
16. [ ] "engine" wording follows the brand book's words list
17. [ ] setup pickers are choice cards on shadcn radio/toggle, fully keyboard accessible

## 4. Impeccable (critique and audit)
Hierarchy, typography, colour and contrast, spacing, consistency with the deck, motion, accessibility, responsive behaviour, UX copy. Every finding gets a severity, a screenshot and a suggested fix.

## 5. Regression (features unchanged)
- [ ] judge paths J-1 to J-8, the limit and replay states, short links, passed slot, the honesty labels (test model, synthetic data, estimates, sources)
