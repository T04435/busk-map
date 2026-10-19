# Busk Map bug log (QA)

Severity: **High** blocks a judge path, leaks money or data, or breaks a rule. **Medium**: a judge would notice something wrong or misleading. **Low**: polish, offline-only, or minor a11y.

| ID | Sev | Title | Status |
|---|---|---|---|
| B-001 | High | Playwright could reuse a live server and call paid APIs | Fixed (e3b85fb), verified by QA |
| B-002 | Medium | Plan doesn't say why higher-scored spots aren't in the top 3 (250 m spacing) | Fixed (4161a9f), verified by QA |
| B-003 | Low | Offline own act: picking a searched artist fails with a generic form error | Fixed (cdecbb7), verified by QA |
| B-004 | Medium | Landing search comboboxes: `aria-expanded="true"` and `aria-controls` points at a missing listbox (axe critical) | Fixed (491f506), verified by QA; pre-hydration leftover in B-011 |
| B-005 | Low | Artist and song search inputs show no focus ring | Fixed (2559a05), verified by QA |
| B-006 | Low | Select values are blank in the server HTML until hydration | Fixed (54d3217), verified by QA |
| B-007 | Low | Offline: "Explanations: Claude" chip and credit while the mock model wrote them | Fixed (270c877), verified by QA; other offline Claude text in B-010 |
| B-008 | Low | e2e guard is skipped whenever `PLAYWRIGHT_BASE_URL` is set, even to a localhost live server | Fixed (70eb77e), verified by QA; residual hosts in B-009 |
| B-009 | Low | e2e guard treats this machine's other addresses (0.0.0.0, 127.0.0.2, LAN IP, .local) as a deploy | Fixed (e42ab30), verified by QA |
| B-010 | Low | Offline: steps, Agent vs engine and pitch cards still say Claude wrote them | Fixed (222cf92), verified by QA |
| B-011 | Low | Landing search comboboxes say `aria-expanded="true"` in the server HTML until hydration | Fixed (868c371), verified by QA |
| B-012 | Low | Flaky e2e: example-card test reads the plan stream body after navigating | Fixed (1950bd2), verified by QA |
| B-013 | Low | Fresh-run limit message gives the retry time in Melbourne time with no zone | Fixed (4b6237b), verified by QA |
| B-014 | Low | docs/qloo-data-map.md still calls the week-prefetch comment "about 47 Qloo calls" | Fixed (b88e174), verified by QA |
| B-015 | Medium | /brain: the sticky trace panel hides the focused node while tabbing (WCAG 2.2 AA 2.4.11) | Fixed (2b26dc5), verified by QA |
| B-016 | Low | /repertoire: after Remove, keyboard focus falls to <body> | Fixed (1b00ab4), verified by QA |
| B-017 | Low | /week loading state: `aria-label` on a role-less div (axe serious, aria-prohibited-attr) | Fixed (1b5a4e5), verified by QA |
| B-018 | Medium | Honeycomb landing: hero "Plan a busk" CTA has no visible focus indicator (WCAG 2.4.7) | Fixed (d169cb4), verified by QA on 91b220e |
| B-019 | Medium | Honeycomb landing: "Honeycomb" brand teaser section missing | Fixed (9ef8b9a, user call), verified in Landing · review v4 at 7b1521e |
| B-020 | Medium | Honeycomb landing: "What you get back" lacks research funnel, taste map, Learn these, set length | Fixed (91b220e) with declared deviations, verified by QA; differences in B-033, B-034 |
| B-021 | Low | Honeycomb landing: hero map without zone/event/river; no glowing cells; caption reworded | Glow and caption fixed (774a87f), verified; zone/event/river held for the user (L05) |
| B-022 | Low | Honeycomb landing: act cards lack day/hours and "Plays …" lines | Fixed (ac950fd), verified; other card differences in B-032 |
| B-023 | Low | Honeycomb landing: footer Brand link (removed by decision 121); paper not dark band | Fixed (514d36a), verified by QA |
| B-024 | Low | Honeycomb landing: Brain teaser 4th number "parts of your plan" | Fixed (e2e3240), verified by QA |
| B-025 | Low | Honeycomb landing: H1 orphans "PLAY." at 1440 | Fixed (29695f7), verified by QA |
| B-026 | Low | "For judges" link from decision 104 never designed | Open (BRAND/MANAGER) |
| B-027 | Medium | /repertoire learn feed: tool names, raw UUIDs and finish_suggestions JSON in the default view; oldest first; stays above the list; 10-count grid, not the funnel | Fixed (373ea1c, 524456e, 43343f6), verified by QA (functional) on df3c80c |
| B-028 | Low | /repertoire Qloo down: no "Your songs are safe." and nothing says the run did not count | Fixed (9d374f5), verified by QA (functional + qa/unit) on df3c80c |
| B-029 | Low | /repertoire nothing new: copy says everything was suggested before while the run shows songs checked 0, suggested before 0; no left-out count or next-step hint | Fixed (f15688f), verified by QA on df3c80c |
| B-030 | Low | /repertoire Learn list: older runs do not fold | Deferred to R6 (3034133 reverted in 524456e; absent, checked) |
| B-031 | Low | /repertoire Learn list: no filter chips (All · New · To learn · Learned · Not for me) | Deferred to R6 (dc7c09f reverted in 524456e; absent, checked) |
| B-032 | Low | Honeycomb landing L13: act cards: filled orange initials hex reading "SA" (board: outline, "SX"); action is a plain dark row, not the orange underlined link; Plays lists differ from the board | Accepted by the user (kept as built; reverted in 8b6a21e) |
| B-033 | Low | Honeycomb landing L17: research funnel labels under the hexes, dashes instead of ▸ chevrons, boxed in a card | Fixed (2d8dc86, d74ccd2), verified in v4 at 7b1521e |
| B-034 | Low | Honeycomb landing L20: setlist panel marked built but Learn these is a tan panel (board: bordered box, orange top rule, mono title); set-length line sans; rows 1–4 not 01–04; heading names the pitch; no Copy | Fixed (4b9bff1, fe89b0e), verified in v4 at 7b1521e |
| B-035 | High | design/honeycomb 4b9bff1 doesn't build from a clean export: setlist-panel.tsx imports components/setlist/copy-set-button, which was never committed (untracked in DEV's worktree) | Fixed (fe89b0e), verified: 7b1521e builds from a clean export |
| B-036 | Low | Honeycomb /busks B07: after a song is picked the search results stay open under the field until the query is cleared | Fixed (527a502), verified in Busks · review v3 at 8207373 |
| B-037 | Low | Honeycomb /busks B08: picks list has no “Your picks · N songs · total time” header | Fixed (527a502), verified at 8207373 |
| B-038 | Low | Honeycomb /busks B06: the artists hint “N of 10. Type a comma to add a name that isn't on Spotify.” is missing | Fixed (527a502), verified at 8207373 |
| B-039 | Low | Honeycomb /busks B12: no “Up to 6 hours” hint under To | Fixed (527a502), verified at 8207373 |
| B-040 | Low | Honeycomb /busks B09: Spotify artist link has no visible label; “(optional)” lives in the placeholder (WCAG 3.3.2) | Fixed (527a502, f9bff52), verified at 8207373 |
| B-041 | Low | Honeycomb /busks B11/B14: a focused choice card shows a 2 px dark outline flush on its 2 px dark border, barely visible on the selected card | Fixed (527a502), verified at 8207373 |
| B-042 | Low | Honeycomb /busks B07 at 390: the “By your artist” badge and the time squeeze the song title in the results to one letter | Fixed (527a502), verified at 8207373 |
| B-043 | Medium | Honeycomb plan P17: Qloo down shows only an alert; no “No plan without taste data” panel and no Try again (board) | Fixed at design/honeycomb f83f1a1, verified by QA (v4) |
| B-044 | Medium | Honeycomb plan P19: no legal pitch has no recovery actions (board: Plan with a general permit · Try another day) | Fixed at design/honeycomb f83f1a1, verified by QA (v4) |
| B-045 | Low | Honeycomb plan P18: no artist matched stacks three alerts and has no “Pick your artists from Spotify” action | Fixed at design/honeycomb f83f1a1, verified by QA (v4) |
| B-046 | Low | Honeycomb plan P20: a source down shows only a chip; no alert saying what is estimated | Fixed at design/honeycomb f83f1a1, verified by QA (v4) |
| B-047 | Low | Honeycomb plan P06: weather shows only the slot's hours; no hours either side, slot bracket or updated line | Fixed at design/honeycomb f83f1a1, verified by QA (v4) |
| B-048 | Low | Honeycomb plan: at 1440 the heading outline skips h1 → h3 (the h2 is hidden when wide) | Fixed at design/honeycomb f83f1a1, verified by QA (v4) |
| B-049 | Low | Honeycomb plan P15/P18: fallback copy says “agent” and “engine” where the board says Claude and Busk Map's scores | Fixed at design/honeycomb f83f1a1, verified by QA (v4) |
| B-050 | Medium | Honeycomb plan P24: “Your busk” starts 871 px down at 390 (987 px at 1440): header stack, chips and funnel push the payoff below the fold | Fixed at design/honeycomb f83f1a1, verified by QA (v4) |
| B-051 | Low | Honeycomb plan P02/P03: the plan page keeps the boxed funnel and full-width Agent vs engine rows, unlike the board | Fixed at design/honeycomb f83f1a1, verified by QA (v4) |
| B-052 | Low | Honeycomb /brain BR08: the Pick any piece panel lost the board's two “Try …” prompts (Setlist and learn these; Taste heatmap); one run-on sentence instead | Fixed at design/honeycomb f83f1a1, verified by QA (v4) |
| B-053 | Low | Honeycomb 404 E01: no large “404” above the card; content left-aligned; no poster shadow (board) | Partly fixed at f83f1a1 (v4): the shadow half is fixed (B-138); the rest is open |
| B-054 | Low | Honeycomb error card E02: “!” icon instead of the warning triangle, left-aligned, reference above the buttons instead of under a rule at the foot, no poster shadow | Partly fixed at f83f1a1 (v4): the shadow half is fixed (B-138); the rest is open |
| B-055 | Low | Honeycomb tips T03/T05/T06/T18–T21/T29/T34: copy says “sessions” where the brand word is “busks” (also page metadata and form messages); eyebrow, intro, disclaimer, storage note and How-it copy differ | Won't fix: removed (the user removed Tips, 17 Oct) |
| B-056 | Medium | Honeycomb tips T06/T24/T34/T36: one 896 px column with the form first at 1440 and 768; the board has two columns, and the phone order differs | Won't fix: removed (the user removed Tips, 17 Oct) |
| B-057 | Low | Honeycomb tips T07/T08: the own act's card has no “Open a plan” | Won't fix: removed (the user removed Tips, 17 Oct) |
| B-058 | Low | Honeycomb tips T09/T11: the bonus rule counts 2 busks in the whole log, not 2 at the pitch; “Log one more session” shows only when the whole log has one busk | Won't fix: removed (the user removed Tips, 17 Oct) |
| B-059 | Low | Honeycomb tips T13/T14/T16/T23: dates are ISO (“2026-10-12 · 12 pm–3 pm”) | Won't fix: removed (the user removed Tips, 17 Oct) |
| B-060 | Low | Honeycomb tips T17: loading is a plain line: no card, skeleton rows or aria-busy | Won't fix: removed (the user removed Tips, 17 Oct) |
| B-061 | Low | Honeycomb tips T18: empty state is a dashed box with an inline link, not the “Plan a busk →” button | Won't fix: removed (the user removed Tips, 17 Oct) |
| B-062 | Low | Honeycomb tips T19/T22: 3 example acts with 9 entries each (27 rows); the board has 1 act with 3 | Won't fix: removed (the user removed Tips, 17 Oct) |
| B-063 | Medium | Honeycomb tips T24–T30/T36: at 390 with a recent plan saved, the long Busk select pushes all 7 form controls past the card's right edge (clipped) | Won't fix: removed (the user removed Tips, 17 Oct) |
| B-064 | Low | Honeycomb tips T30: Log takings has no coins icon and isn't full width at 1440 | Won't fix: removed (the user removed Tips, 17 Oct) |
| B-065 | Low | Honeycomb tips T31: after saving, no “Logged” state with a check and no line saying what changed for the pitch | Won't fix: removed (the user removed Tips, 17 Oct) |
| B-066 | Medium | Honeycomb tips T33/T33c: errors show one at a time under the button: no top Alert, no per-field messages or aria-describedby, focus doesn't move; couldn't-save has no Alert or Try again | Won't fix: removed (the user removed Tips, 17 Oct) |
| B-067 | Low | Honeycomb tips T33b: no Saving state | Won't fix: removed (the user removed Tips, 17 Oct) |
| B-068 | Medium | Honeycomb tips T33d: when the log can't be read the page says “No sessions logged in this browser yet.” | Won't fix: removed (the user removed Tips, 17 Oct) |
| B-069 | Low | Honeycomb tips T05/T24/T34: line lengths about 93–136 characters at 1440 | Won't fix: removed (the user removed Tips, 17 Oct) |
| B-070 | Low | Honeycomb brand BD03: eyebrow reads “Busk Map brand · design system v62” (board: “Busk Map design deck · design system v66”) | Fixed at design/honeycomb f83f1a1, verified by QA (v4) |
| B-071 | Medium | Honeycomb brand BD05/06/42/43/51/52: no Screens section or table, no Submission kit table, no Handoff panel; hero line and On-this-page nav trimmed to match | Fixed at design/honeycomb f83f1a1, verified by QA (v4) |
| B-072 | Low | Honeycomb brand BD13/19: no Iconography block (board: 39 icons) | Fixed at design/honeycomb f83f1a1, verified by QA (v4) |
| B-073 | Low | Honeycomb brand BD16/17/55: Foundations specimens drift from the board; no Loader “Working” cell | Fixed at design/honeycomb f83f1a1, verified by QA (v4) |
| B-074 | Medium | Honeycomb brand BD22–BD37/BD41: Components regrouped into 7 cards: 5 of the board's 8 groups, the “90 reusable components” line, the Plan states block, the QlooWordmark specimen and the component lists are missing | Fixed at design/honeycomb f83f1a1, verified by QA (v4) |
| B-075 | Low | Honeycomb brand BD39: StatStrip drops “24–33 Qloo calls for a new busk” | Fixed at design/honeycomb f83f1a1, verified by QA (v4) |
| B-076 | Low | Honeycomb brand BD40: at 1440 the ExampleActCard stretches to 406 px tall with an empty middle | Fixed at design/honeycomb f83f1a1, verified by QA (v4) |
| B-077 | Low | Honeycomb brand BD50: asset links say “Open file” with an external-link icon but download | Fixed at design/honeycomb f83f1a1, verified by QA (v4) |
| B-078 | Low | Honeycomb brand BD56: below 1024 px (including 768) all 21 blocks fold into closed disclosures | Partly fixed at f83f1a1 (v4): 768 is open; 390 still folds |
| B-079 | Low | Honeycomb brand BD18/58: under reduced motion 37 elements keep 150–320 ms transitions while the page says “everything drops to 0 ms” | Fixed at design/honeycomb f83f1a1, verified by QA (v4) |
| B-080 | Low | Honeycomb busks B04: intro at body size on one ~930 px line (board 18/27, max 760 px) | Open (design/honeycomb) |
| B-081 | Low | Honeycomb busks B09: form card has no shadow | Open (design/honeycomb) |
| B-082 | Low | Honeycomb busks B15/B21: search error reads “…Type it in instead.” (spec: “Try again in a moment.”) | Open (design/honeycomb) |
| B-083 | Low | Honeycomb busks B25: no empty line when no songs are picked | Fixed, verified in Busks · review v3 at 8207373 |
| B-084 | Low | Honeycomb busks B28: a bad artist link gives a grey note, not a field error with aria-invalid | Fixed, verified in Busks · review v3 at 8207373 |
| B-085 | Low | Honeycomb busks B33: the city list is hard-coded in the form, not from city coverage | Open (design/honeycomb) |
| B-086 | Low | Honeycomb busks B34: date reads “SAT 17 OCT 2026” with the icon on the right | Open (design/honeycomb) |
| B-087 | Low | Honeycomb busks B35: calendar weeks start on Sunday and the dialog has no accessible name | Open (design/honeycomb) |
| B-088 | Low | Honeycomb busks B36/B37: From/To offer all 24 hours (spec 6 am–12 am) | Open (design/honeycomb) |
| B-089 | Low | Honeycomb busks B38: permit descriptions differ from the board | Open (design/honeycomb) |
| B-090 | Medium | Honeycomb busks B41/B43: the songs error shows the validator's raw text in lower case (“check “…” (Too big: expected string to have <=120 characters)”), from form-errors.ts:37 | Open (design/honeycomb) |
| B-091 | Low | Honeycomb busks B42: the slot error repeats its title (“Check the date and times: …”) | Open (design/honeycomb) |
| B-092 | Medium | Honeycomb busks B44–B46: plan again shows the whole prefilled form, not the “Your act” summary; the title stays “Plan your busk” and the banner has no busk date | Open (design/honeycomb) |
| B-093 | Low | Honeycomb busks B49: takings line adds “they stay in this browser” and the link isn't signal-coloured | Won't fix: Tips removed by the user (the takings line is gone) |
| B-094 | Low | Honeycomb busks B51: the artists combobox gets no aria-invalid or aria-describedby on error | Open (design/honeycomb) |
| B-095 | Low | Honeycomb busks B52: no spinner beside “Searching Spotify…” | Open (design/honeycomb) |
| B-096 | Low | Honeycomb busks B53: under reduced motion the 0.15 s colour transitions remain | Fixed at design/honeycomb f83f1a1, verified by QA (v4) |
| B-097 | Low | Honeycomb busks B24: the “Your song” badge has no music icon | Open (design/honeycomb) |
| B-098 | Low | Honeycomb plan B03/Y01/N01/L01/S02: eyebrow date is ISO (“SUNDAY 2026-10-18”); the replay eyebrow has no “Shared busk” | Fixed at design/honeycomb f83f1a1, verified by QA (v4) |
| B-099 | Low | Honeycomb plan B04: no act line under the H1 | Fixed at design/honeycomb f83f1a1, verified by QA (v4) |
| B-100 | Low | Honeycomb plan B11: no day · slot · permit line under “Your busk” | Fixed at design/honeycomb f83f1a1, verified by QA (v4) |
| B-101 | Low | Honeycomb plan B12/B18: the selected row only gets a heavier border: no white card, orange shadow or filled score cell | Fixed at design/honeycomb f83f1a1, verified by QA (v4) |
| B-102 | Low | Honeycomb plan B14: no caption on the selected pin; pins 2 and 3 aren't smaller | Fixed at design/honeycomb f83f1a1, verified by QA (v4) |
| B-103 | Low | Honeycomb plan B45/R08: “Where your crowd gathers” has no mini map | Fixed at design/honeycomb f83f1a1, verified by QA (v4) |
| B-104 | Low | Honeycomb plan B54: the sheet is 512 px wide (board 720); at 390 it opens from the top with no grab handle | Fixed at design/honeycomb f83f1a1, verified by QA (v4) |
| B-105 | Medium | Honeycomb plan B55–B59: the sheet body is the old pitch card: no foot-traffic sparkline, no Copy on its setlist | Partly fixed at f83f1a1 (v4): the council-rules link row (plan B58) is still missing |
| B-106 | Low | Honeycomb plan B62: lean bars draw as 3–6 px stubs | Fixed at design/honeycomb f83f1a1, verified by QA (v4) |
| B-107 | Low | Honeycomb plan B71: the sheet's slide and fade ignore reduced motion | Open (design/honeycomb) |
| B-108 | Low | Honeycomb plan R01/Y03: “The agent…” copy while running and on replay; Copy link shows while running | Fixed at design/honeycomb f83f1a1, verified by QA (v4) |
| B-109 | Low | Honeycomb plan R09: no “Data used so far” while the run is live | Fixed at design/honeycomb f83f1a1, verified by QA (v4) |
| B-110 | Low | Honeycomb plan N03: the no-pitch run shows eight “Sent back” cards (limit 2); may be the offline mock only | Open (design/honeycomb) |
| B-111 | Low | Honeycomb plan X01: plan not found is a small boxed card aligned left | Fixed at design/honeycomb f83f1a1, verified by QA (v4) |
| B-112 | Low | Honeycomb plan M04: the no-match map shows the taste legend with no taste cells | Fixed at design/honeycomb f83f1a1, verified by QA (v4) |
| B-113 | Low | Honeycomb plan B64: no event diamonds or event popover on the map | Open (design/honeycomb) |
| B-114 | Low | Honeycomb brain BR02: background has only the dot grain; the board's faint hex lattice is missing | Fixed at design/honeycomb f83f1a1, verified by QA (v4) |
| B-115 | Low | Honeycomb brain BR05/10/20–22: wording differs from the board (“11 kinds”, “trace its path”, “9 parts it decides”, “a plan that cites”, quota card, “(/v2/tags)”) | Partly fixed at f83f1a1 (v4): only “11” for “eleven” is left (brain BR05) |
| B-116 | Low | Honeycomb brain BR11: call sub-lines show the URN type, so calls 5–8 all read “urn:entity:artist” | Fixed at design/honeycomb f83f1a1, verified by QA (v4) |
| B-117 | Low | Honeycomb brain BR16/17/25/26: trace styling: rest wires 60% (board 45%), lit 3 px (2.5), others 15% (10); lit nodes no outline; picked node orange-brown fill | Fixed at design/honeycomb f83f1a1, verified by QA (v4) |
| B-118 | Low | Honeycomb brain BR23: back link is paper-coloured and underlined, not orange | Fixed at design/honeycomb f83f1a1, verified by QA (v4) |
| B-119 | Low | Honeycomb brain BR27–BR30/BR33: trace panel: purple title (board orange), “comes from…/feeds…” instead of “Lights up…”, From/To instead of ← →, shadow points down | Partly fixed at f83f1a1 (v4): the trace panel's label colours differ (B-197) |
| B-120 | Low | Honeycomb brain BR29: at 1440 “With two other sources” stays lit when no source is on the path | Fixed at design/honeycomb f83f1a1, verified by QA (v4) |
| B-121 | Low | Honeycomb brain BR40: in the day theme the footer and bottom nav turn light while the page stays night | Fixed at design/honeycomb f83f1a1, verified by QA (v4) |
| B-122 | Low | Honeycomb errors N02/G01: cards sit at the top of main instead of centred vertically | Fixed, verified in Errors · review v3 at 8207373 |
| B-123 | Low | Honeycomb errors N05–N07/E04: the shared StatusCard differs: 72 px dashed hex on the 404 (board 64 px solid), 56 px title (board small), body not muted | Fixed at design/honeycomb f83f1a1, verified by QA (v4) |
| B-124 | Low | Honeycomb errors G03/E05: “while setting up the pitch” on every route error and on the global error | Fixed at design/honeycomb f83f1a1, verified by QA (v4) |
| B-125 | Low | Honeycomb errors E06/G04/U06: missing icons: refresh on Try again, arrow on the plan not-found home link | Fixed at design/honeycomb f83f1a1, verified by QA (v4) |
| B-126 | Low | Honeycomb errors U02/U04/U05/U08: plan not found is boxed and left-aligned (board: no card, centred, max 520 px, 44 px title) | Fixed at design/honeycomb f83f1a1, verified by QA (v4) |
| B-127 | Medium | Honeycomb errors R05/R07/R08/R11: run limit alert is full width (board max 760 px) and starts 672 px down at 390; status line above it; home is an outline button inside the alert, not a bold link below | Partly fixed at f83f1a1 (v4): the run limit's R07 type still differs |
| B-128 | Low | Honeycomb errors R06: “plans” is never pluralised (“1 plans” in the template) | Fixed (pluralises), verified at 8207373 |
| B-129 | Low | Honeycomb site H08/N01: the nav switches at 768 px, not 721: from 721 to 767 px the bottom bar shows and the header has no nav | Fixed at design/honeycomb f83f1a1, verified by QA (v4) |
| B-130 | Low | Honeycomb site H03/N02: no Repertoire item (/repertoire is 404 on design/honeycomb) | Open (design/honeycomb) |
| B-131 | Low | Honeycomb site H07: plan headers have no end slot (no Live data badge, no Share) | Open (design/honeycomb) |
| B-132 | Low | Honeycomb site N06: the current tab has no fade transition | Fixed at design/honeycomb f83f1a1, verified by QA (v4) |
| B-133 | Low | Honeycomb site H02: the home link is named “Busk Map”, not “Busk Map home” | Fixed at design/honeycomb f83f1a1, verified by QA (v4) |
| B-134 | Medium | Honeycomb site-wide (busks B39/B50, plan B70/X01, errors N10/E10, tips T30/T37, brand BD24, site): at night the default (orange) button's focus ring is the same orange as its fill: 1.00:1 against the button (5.8:1 against the ground), so focus shows only as the button growing 2 px; outline buttons' ring is 1.38:1 against their border. DEV's open item “night ring not verified” | Fixed at design/honeycomb f83f1a1, verified by QA (v4) |
| B-135 | Low | Honeycomb site H02/H08/FT02, brand BD07: the lockup files clip the orange offset on the right of the P (paths reach x 325 in a 322-wide viewBox); BRAND's own files have it too | Fixed at design/honeycomb f83f1a1, verified by QA (v4) |
| B-136 | Low | Honeycomb landing L18, plan B20/B13/M04: the map's attribution “i” control is 44 px inside a 24 px box: the icon tiles 2×2 and is cut off | Open (design/honeycomb) |
| B-137 | Low | Honeycomb landing L18, plan B19: at 390 the one-line map legend (F03) wraps to two lines | Open (design/honeycomb) |
| B-138 | Medium | Honeycomb site-wide (errors N04/E02/G03/U02 and every shadow-md/lg): the honeycomb --shadow-sm/md/lg tokens live on :root (globals.css:197–212) but aren't mapped in @theme, so shadow-md/shadow-lg render Tailwind's soft blur, not the poster offset shadow | Fixed at design/honeycomb f83f1a1, verified by QA (v4) |
| B-139 | Medium | Honeycomb landing L08/L24: both “Plan a busk” poster buttons render 44 px tall (hero 76, closing 64): the Button's default size overrides the poster height; the closing one is now 24 px Big Shoulders caps | Fixed at design/honeycomb f83f1a1, verified by QA (v4) |
| B-140 | Low | Honeycomb landing L23: the brand teaser's specimen card lost its app icon | Open (design/honeycomb) |
| B-141 | Low | Honeycomb landing L18: at 1440 the map is 544 px tall in a 699 px column, leaving ~155 px empty below | Fixed at design/honeycomb f83f1a1, verified by QA (v4) |
| B-142 | Medium | Honeycomb busks B24/B56: at 390 the “Your song” and “Typed” badges squeeze picked-song titles to “Lan…” | Open (design/honeycomb) |
| B-143 | Low | Honeycomb busks B20/B21: typed-row copy isn't BRAND's (“Add “<query>” as typed”, “Write it as…”) and the row shows under results, while searching and on error, not only on no match | Partly fixed at f83f1a1 (v4): BRAND's copy landed; the row still shows under results, while searching and on error |
| B-144 | Low | Honeycomb busks B19: the “By your artist” badge has no users icon | Open (design/honeycomb) |
| B-145 | Low | Honeycomb plan B19: the legend's Taste tooltip still says “(test data)” with the mock | Fixed at design/honeycomb f83f1a1, verified by QA (v4) |
| B-146 | Medium | Honeycomb plan B10/B13/B69: the plan map breaks F05: all five shades including the dark ones, not zoomed out (the landing map already filters and zooms out) | Fixed at design/honeycomb f83f1a1, verified by QA (v4) |
| B-147 | Low | Honeycomb plan B49/B61: where the plan names Qloo as a source there is no Qloo logo (F09/F18) | Fixed at design/honeycomb f83f1a1, verified by QA (v4) |
| B-148 | Medium | Honeycomb plan B15: no hatched no-busking honeycomb cells on the plan map (F16) | Fixed at design/honeycomb f83f1a1, verified by QA (v4) |
| B-149 | Medium | Honeycomb brain BR24: a node picked with Enter shows no focus ring while focused: its 4 px orange offset shadow replaces the ring (WCAG 2.4.7) | Fixed at design/honeycomb f83f1a1, verified by QA (v4) |
| B-150 | Medium | Honeycomb brain BR34: picking a node with Enter doesn't keep it in view: at 1440 node 1 ends under the folded panel; at 390 “Taste cells” jumps to −425 px (WCAG 2.4.11) | Fixed at design/honeycomb f83f1a1, verified by QA (v4) |
| B-151 | Low | Honeycomb brand BD21: the --ring token row still describes the old “ground-coloured gap” ring | Fixed at design/honeycomb f83f1a1, verified by QA (v4) |
| B-152 | Medium | Honeycomb brand BD44–46: the Logos group lists the mark and wordmark-only files beside the lockup as unlabelled logo tiles (corrected F12) | Fixed at design/honeycomb f83f1a1, verified by QA (v4) |
| B-153 | Low | Honeycomb brand BD09/BD47: no Qloo logo anywhere in the brand page body (F18/F09) | Fixed at design/honeycomb f83f1a1, verified by QA (v4) |
| B-154 | Medium | Honeycomb brand BD49/BD51: social and kit images unchanged: old tall-M lettering, pink rectangles, Qloo as text, “Melbourne” in the OG caption, placeholder screenshots (F12, F16–F22) | Fixed at design/honeycomb f83f1a1, verified by QA (v4) |
| B-155 | Low | Honeycomb errors N14/E13/G09/U08: at phone width the buttons stretch full width with 16 px gutters (board: natural-width centred, 24 px gutters) | Open (design/honeycomb) |
| B-156 | Low | Honeycomb errors E08/G06: “Reference:” label is mono; the board uses sans for the label, mono only for the number | Open (design/honeycomb) |
| B-157 | Low | Honeycomb site FT02: the footer lockup is not a link home | Fixed at design/honeycomb f83f1a1, verified by QA (v4) |
| B-158 | Low | Honeycomb site FT03: no mid-dot separators; the footer nav is named “Footer”, not “Site” | Fixed at design/honeycomb f83f1a1, verified by QA (v4) |
| B-159 | Low | Honeycomb site FT04/FT05: GitHub, “Built by T04435” and the critter open in the same tab | Partly fixed at f83f1a1 (v4): the GitHub cell still opens in the same tab (site FT04) |
| B-160 | Low | Honeycomb site FT05: the critter links to github.com/T04435, not claude.com/claude-code, and all of “Built by T04435” is the link | Fixed at design/honeycomb f83f1a1, verified by QA (v4) |
| B-161 | Low | Honeycomb site FT06: the critter is DEV's 17×10 approximation, not BRAND's 170×112 path (DEV replaced it in 865999d, after the commit under test) | Fixed at design/honeycomb f83f1a1, verified by QA (v4) |
| B-162 | Low | Honeycomb site-wide (user's glyph rule): text glyphs used as icons: “▸” funnel connectors (landing L17, plan B07/R02), “→” in Open the brain / See the brand (L22, L23), “← Back to Busk Map” and ← → trace lines (brain BR23, BR27, BR29–BR31), “Tokens → shadcn” (brand BD06/BD20), “See the research ↓” (plan B66), lone “–” connectors (brand, plan); source: brain/page.tsx:75, brand/page.tsx:127/290, page.tsx:255/290, brain-map.tsx:341, research-funnel.tsx:49, plan-view.tsx:535, week-view.tsx:246 (qa/tools/glyph-icons.mjs: 26 fail) | Open (design/honeycomb f83f1a1) |
| B-163 | Medium | DS ExampleActCard: build is a tall grid card with day, hours, Plays and a “Watch Busk Map plan this act” foot row; DS is one compact row with hex initials and an arrow at the edge (landing L13, busks B07/B08, brand BD40). Conflicts with the user's keep call (B-032): user's choice | Open (design/honeycomb f83f1a1) |
| B-164 | Medium | DS ResearchFunnel: Big Shoulders numerals, a wrapping grid with labels under the cells; DS is one inline row with small numerals and labels beside the cells (landing L17, brand BD29) | Open (design/honeycomb f83f1a1) |
| B-165 | Medium | DS PitchRow: build rows about twice as tall (slot on its own line, inner rule, sans “Full details”); DS is one compact line with badges and mono caps FULL DETAILS (landing L18, plan B12/B18, brand BD28) | Open (design/honeycomb f83f1a1) |
| B-166 | Medium | DS PitchPin: black hex with a white hex centre and a square rank badge; DS is a dark hex with an orange ring and target dot, hex rank badge, and a Hidden gem pin (landing L18, plan B14) | Open (design/honeycomb f83f1a1) |
| B-167 | Low | DS TasteMapLegend: DS is a boxed panel (TASTE MATCH, a 1–5 ramp, then the symbols); build has the user's F03 one-line bar (landing L18): user's choice | Open (design/honeycomb f83f1a1) |
| B-168 | Low | DS OtherPitches / PlanMap: DS lists the other scored pitches under the list; build only has a “Browse other pitches” button and the popover (landing L18, plan B63) | Open (design/honeycomb f83f1a1) |
| B-169 | Low | DS SetlistPanel: method paragraph subtitle, mono LEARN THESE and Copy, an extra “How the order is worked out” fold, Copy below it at 390 (landing L20, plan B59) | Open (design/honeycomb f83f1a1) |
| B-170 | Medium | DS StatStrip: the landing teasers' numbers sit inline beside mono labels; DS is a framed row of ruled cells, number above label (landing L22, L23) | Open (design/honeycomb f83f1a1) |
| B-171 | Low | Honeycomb landing L27: at 390 and 768 the hero stacks the full-bleed map first, so the headline starts about 375 px down; the board stacks headline, map, CTA | Open (design/honeycomb f83f1a1) |
| B-172 | Low | Honeycomb busks B11: the artists hint sits between the chips and the search field; board and DS ArtistPicker put it under the field | Open (design/honeycomb f83f1a1) |
| B-173 | Low | Honeycomb busks B14: the artist search's “Add … as typed” item has no plus icon (spec, DS ArtistPicker and the song search have one) | Open (design/honeycomb f83f1a1) |
| B-174 | Low | DS Input / RepertoirePicker: the Spotify link field shows a music note, not the Spotify icon (busks B26) | Open (design/honeycomb f83f1a1) |
| B-175 | Low | DS ArtistPicker chips: build wraps chips side by side, writes “(TYPED)”, no divider before the x; DS stacks one per row (busks B12) | Open (design/honeycomb f83f1a1) |
| B-176 | Low | DS PickedSongs: build runs one mono line “YOUR PICKS · N SONGS · m:ss”; DS has the label left and the mono total right (busks B22) | Open (design/honeycomb f83f1a1) |
| B-177 | Medium | DS TimeSlotPicker: selected slot dark/cream not orange; 12-hour copy, no Late slot or Day row (busks B30, held with F27; brand BD26) | Held with F27 (DEV); Open (design/honeycomb f83f1a1) |
| B-178 | Low | DS PermitPicker: no pitch count on each permit card; extra LIVE DATA badge (busks B38, brand BD26) | Open (design/honeycomb f83f1a1) |
| B-179 | Low | DS Alert: the destructive form alert uses a circle icon; DS uses a warning triangle (busks B40–B42) | Open (design/honeycomb f83f1a1) |
| B-180 | Low | DS Banner: the plan-again banner uses a tone the DS doesn't have (a bordered peach box) (busks B44) | Open (design/honeycomb f83f1a1) |
| B-181 | Low | DS CityPicker: the Live data badge icon is footprints; DS uses a bar chart (busks B32) | Open (design/honeycomb f83f1a1) |
| B-182 | Low | DS SongSearch: “By your artist” sits on its own line under the title; DS puts it inline at the right with the users icon (busks B19) | Open (design/honeycomb f83f1a1) |
| B-183 | Low | Honeycomb plan B69: the night ramp's step 3 (#a8460f) reads as the dark cells F05 removed; needs the user's eye | Open (design/honeycomb f83f1a1) |
| B-184 | Low | Honeycomb plan N01: the no-legal-pitch page shows a fallback alert about “these spots” where there are no spots | Open (design/honeycomb f83f1a1) |
| B-185 | Low | Honeycomb plan R09: Data used so far marks every source Live during an offline mock run (the finished plan says test data) | Open (design/honeycomb f83f1a1) |
| B-186 | Low | DS PageHeader: no “Busk Map home” link above the eyebrow; run status is a dot line, not outlined mono badges (plan B02) | Open (design/honeycomb f83f1a1) |
| B-187 | Low | DS CopyLinkButton: chain icon where DS and the board use the copy icon (plan B05) | Open (design/honeycomb f83f1a1) |
| B-188 | Low | DS DiscoveryBadge: Usual pitch uses a dot icon, DS a ringed target (plan B12/B55, brand BD28) | Open (design/honeycomb f83f1a1) |
| B-189 | Low | DS WeatherStrip: at 390 the hours stack as rows; DS keeps a horizontally scrolling strip (plan B21) | Open (design/honeycomb f83f1a1) |
| B-190 | Medium | DS ScoreBreakdown: an unboxed list; DS is a bordered “How this score adds up” card with total, icons, weights and bonus rows (plan B54) | Open (design/honeycomb f83f1a1) |
| B-191 | Low | DS FootfallSparkline: thin black dotted line; DS is a 3 px ochre line on a tan fill (plan B57) | Open (design/honeycomb f83f1a1) |
| B-192 | Medium | DS LeanBar: eight full-width bars; DS is one inline line of group | tick value. Conflicts with BRAND's “bare ticks” issue: user's call (plan B62) | Open (design/honeycomb f83f1a1) |
| B-193 | Low | DS AgentStatusLine: muted sans line without the DS's leading hex state cell in mono (plan R01, Y03) | Open (design/honeycomb f83f1a1) |
| B-194 | Low | DS SourceAttribution / DataStatusBadge: a two-column tile grid with inline dot status; DS is one list with a boxed badge (plan B49, Q03, B61) | Open (design/honeycomb f83f1a1) |
| B-195 | Low | DS SlotPassed: a thin dashed box with a small title; DS is a solid 2 px card with a display title (plan S01, S02) | Open (design/honeycomb f83f1a1) |
| B-196 | Low | Honeycomb brain BR18: the idle panel title is paper (board Qloo purple) and its lead line is in the body face (board mono) | Open (design/honeycomb f83f1a1) |
| B-197 | Low | Honeycomb brain BR27, BR29–BR31: “Comes from:” / “Decides:” labels are orange (board Qloo purple) | Open (design/honeycomb f83f1a1) |
| B-198 | Low | Honeycomb brain BR28: Clear trace border is 1px (board 1.5px) | Open (design/honeycomb f83f1a1) |
| B-199 | Medium | DS BrainMap: Your busk nodes in uppercase Big Shoulders; DS uses the node face in sentence case (brain BR15) | Open (design/honeycomb f83f1a1) |
| B-200 | Low | DS BrainMap: lit and picked nodes' outline sits flush; DS shows a gap between border and outline (brain BR25, BR26) | Open (design/honeycomb f83f1a1) |
| B-201 | Low | DS BrainMap: trace panel lines use orange arrow markers; DS uses plain bullets (brain BR27, BR29–BR31) | Open (design/honeycomb f83f1a1) |
| B-202 | Low | DS Button outline: Clear trace is mono 12px with a 1px border; DS is Atkinson 14px with a 2px border (brain BR28) | Open (design/honeycomb f83f1a1) |
| B-203 | Low | DS NoteCard next: grey bullets on a transparent card; DS has paper bullets on a page fill (brain BR22) | Open (design/honeycomb f83f1a1) |
| B-204 | Low | Honeycomb brand BD38: the FormMessage success specimen is the retired tip log's “Logged A$85 at Hardware Lane.” | Open (design/honeycomb f83f1a1) |
| B-205 | Low | Honeycomb brand BD18, BD21: the --ring and focus-ring rows contradict each other about the gap | Open (design/honeycomb f83f1a1) |
| B-206 | Low | Honeycomb brand BD37: the replayed AgentStatusLine drops the run line (steps, tokens, seconds) | Open (design/honeycomb f83f1a1) |
| B-207 | Low | Honeycomb brand BD43: the Screens table lacks the board's 390 · 768 · 1440 columns | Open (design/honeycomb f83f1a1) |
| B-208 | Low | Honeycomb brand BD27: the Map specimen draws pale and dark brown cells with no streets; the app draws orange cells only (F05) | Open (design/honeycomb f83f1a1) |
| B-209 | Low | Honeycomb brand BD22–BD30: component cards stretch to the row's tallest at 1440 (up to 490 px empty) | Open (design/honeycomb f83f1a1) |
| B-210 | Low | Honeycomb brand BD28: WeatherStrip's h2 and specimen h3s enter the page outline | Open (design/honeycomb f83f1a1) |
| B-211 | Low | DS Badge / Alert / Banner on brand BD25: no badge icons, 2px alert borders and larger titles | Open (design/honeycomb f83f1a1) |
| B-212 | Low | DS StatusCard: centred, solid hex, small title, one outline button; DS is left-aligned, dashed hex, large title, primary + outline (errors N04–N08, E02–E05, E08, G03, G06; brand BD31). The board (centred) and the DS disagree: user's call | Open (design/honeycomb f83f1a1) |
| B-213 | Low | DS Alert / PlanAlert: full-tone 2px borders, larger type, actions as links; DS is a tinted 1px border, small mono title, outline buttons inside (errors R05, R08; brand BD33–BD36) | Open (design/honeycomb f83f1a1) |
| B-214 | Low | DS Loader: an arc spinner icon; DS is the turning pitch ring (brand BD17, BD55) | Open (design/honeycomb f83f1a1) |
| B-215 | Low | DS AppHeader: the header lockup is 36 px tall against the DS's ≈24 px (site H02) | Open (design/honeycomb f83f1a1) |
| B-216 | Low | DS SiteFooter: the footer lockup is 34 px tall against ≈24 px (site FT02) | Open (design/honeycomb f83f1a1) |
| B-217 | Low | DS AppHeader: nav items are 48 px tall (DS 40 px), so the current item's fill nearly fills the bar (site H04) | Open (design/honeycomb f83f1a1) |
| B-218 | High | Honeycomb site-wide (impeccable, verified): in the day OS scheme the focus ring inside pinned-dark areas (/brain, the landing's dark bands and footer) is #141c21 on the dark ground, 1.08:1 (WCAG 2.4.7, 1.4.11); --focus-ring is resolved on :root (globals.css:200), so data-theme=dark never reaches it | Open (design/honeycomb f83f1a1) |
| B-219 | High | Honeycomb plan (impeccable, verified): 1,848 px of blank scroll after the footer at 390 (1,168 at 768): positioned spans inside the closed “Every check” fold escape its overflow clip (honeycomb/fold.tsx) | Open (design/honeycomb f83f1a1) |
| B-220 | Medium | Honeycomb busks (impeccable, verified): after an empty submit focus stays on Plan my busk, far from the error; artist and song errors aren't tied to their inputs (no aria-invalid / aria-describedby) | Open (design/honeycomb f83f1a1) |
| B-221 | Low | Honeycomb busks (impeccable): no visible pending state after Plan my busk; the second action stays live during the request | Open (design/honeycomb f83f1a1) |
| B-222 | Medium | Honeycomb brain (impeccable, verified): the traced panel covers lit pieces (two parts at 1440×900; Pitch ranking at 390, panel 45vh plus the nav) | Open (design/honeycomb f83f1a1) |
| B-223 | Medium | Honeycomb brand (impeccable, verified): at 390 the tokens table is 860 px in a 322 px frame; Day, Night and Use start off-screen, rows 97 px tall | Open (design/honeycomb f83f1a1) |
| B-224 | Low | Honeycomb brand §08 (impeccable, verified): the Handoff points to hackathons/qloo-2026/design-handoff/, which isn't in the repo or linked | Open (design/honeycomb f83f1a1) |
| B-225 | Low | Honeycomb brand (impeccable): heading outline: WeatherStrip h2 in an h3 group, NoteCard h3 under an h4, phone folds turn 28 sub-headings into text; two landmark names repeated | Open (design/honeycomb f83f1a1) |
| B-226 | Medium | Honeycomb landing (impeccable, verified): the ticker scrolls forever with no pause or stop, also on hover; only reduced motion stops it (WCAG 2.2.2) | Open (design/honeycomb f83f1a1) |
| B-227 | Medium | Honeycomb plan (impeccable): on a phone the map takes one-finger vertical drags (touch-action none, no cooperative gestures), so the page can't scroll over it; synthesised touch, not a device | Open (design/honeycomb f83f1a1) |
| B-228 | Low | (not used: the plan heading skip h2 → h4 is inside the feed cards held by DEV, B-048) | Not used |
| B-229 | Medium | Honeycomb errors (impeccable): Try again on the route error gives no pending state, returns the identical card and drops focus to body (WCAG 2.4.3, 4.1.3) | Open (design/honeycomb f83f1a1) |
| B-230 | Low | Honeycomb errors (impeccable, verified): plan-not-found draws an orange ghost pin behind the dashed hex; tab title “Plan · Busk Map”; noindex meta twice. (HTTP 200 is DEV's accepted limit.) | Open (design/honeycomb f83f1a1) |
| B-231 | Low | Honeycomb site-wide (impeccable): targets under 44 px at 390: map-legend keys 32 px, Qloo wordmark links 44×15 / 33 px, inline Week links 18 px, brand Screens links 16 px, chips 40 px | Open (design/honeycomb f83f1a1) |
| B-232 | Low | Honeycomb site FT05 (impeccable): the critter, the only visible content of the Claude Code link, is 2.68:1 on paper (WCAG 1.4.11) | Open (design/honeycomb f83f1a1) |
| B-233 | Low | Honeycomb site (impeccable): the phone bottom nav comes after the footer in the DOM: 12–38 Tabs to reach it at 390 | Open (design/honeycomb f83f1a1) |
| B-234 | Low | Honeycomb site-wide (impeccable): app-header.tsx hard-codes #f2ede4, #a7b0b5, #232d33 and logo.tsx #8C8CC8; brain-map.tsx trace states hard-code 5 hexes | Open (design/honeycomb f83f1a1) |

---

### B-001 · High · Playwright could reuse a live server and call paid APIs
- **Found:** baseline, 16 Oct 2026, by reading `playwright.config.ts`.
- **Steps:** with a live server (no `BUSKMAP_OFFLINE`) on the e2e port, for example `PORT=3200 pnpm test:e2e` while the user's `next dev` runs on 3200.
- **Expected:** the run refuses, or starts its own offline server.
- **Actual (before the fix):** `reuseExistingServer: !process.env.CI` reused it, so the specs drove real Claude, Qloo and Ticketmaster calls.
- **Status:** fixed by DEV in e3b85fb (`tests/e2e/global-setup.ts` checks `GET /api/health` for `offline: true`). **Verified by QA:** `PORT=3200 pnpm exec playwright test tests/e2e/health.spec.ts` aborted in global setup with "e2e aborted: the server on port 3200 is not in offline mode", before any spec ran. Against a deploy (`PLAYWRIGHT_BASE_URL`) it only warns, which is deliberate.

### B-002 · Medium · Plan doesn't say why higher-scored spots aren't in the top 3
- **Steps:** open the acoustic example (offline). Scroll to "Busk Map vs a plain AI".
- **Expected:** if a pitch with a higher score is left out of the top 3, the plan says why (`hotspot-policy`: "the score decides").
- **Actual:** the top 3 are Centre Place 77, Flinders Lane east 74, Alfred Place 60. The plain-AI panel says Busk Map scores Federation Square 65 and Flinders Street Station 63 "higher than one of Busk Map's picks: worth a look". The cause is `pickTopPitches(…, minSpacingM = 250)` in `src/server/scoring/pitch-score.ts`: Federation Square is about 190 m from Flinders Lane east. "How pitches are scored" never mentions the spacing rule, so a judge sees a ranking that contradicts its own scores.
- **Suggestion (DEV/user decide):** one line in "How pitches are scored" and on the plain-AI row ("within 250 m of pick no. 2, so not listed separately").

### B-003 · Low · Offline own act: picking a searched artist fails with a generic form error
- **Steps:** offline server, landing → "Or plan for your own act": type an act name, search "Buena Vista" in "Artists you sound like", pick "Buena Vista (synthetic)", add songs, press "Plan my set".
- **Expected:** a plan opens on `/p/<id>`.
- **Actual:** "Check the form and try again." and no request is sent. The synthetic fixture gives the artist the id `syn-artist-1` (`src/server/adapters/repertoire/fixtures/synthetic.ts`), which fails `spotifyIdSchema` (22 base62 characters) in `src/lib/plan-schema.ts`. Live Spotify ids are 22 characters, so this is offline only. The generic message also names no field, so any other schema failure would leave a user stuck too.
- **Regression test:** `tests/e2e/qa/baseline.spec.ts` "B-003" (marked `test.fail` until fixed).

### B-004 · Medium · Landing search comboboxes have broken ARIA (axe critical)
- **Steps:** axe-core 4.14 (WCAG 2.0–2.2 A/AA tags) on `/`, desktop and Pixel 7.
- **Expected:** 0 violations.
- **Actual:** `aria-valid-attr-value` (critical) on both cmdk inputs ("Search Spotify, e.g. Paul Kelly" and "Search songs, e.g. Riptide"): `aria-expanded="true"` while no list is shown, and `aria-controls` points at an id that isn't in the DOM. A screen reader announces an open list that doesn't exist. Every other page scanned had 0 violations.

### B-005 · Low · Artist and song search inputs show no focus ring
- **Steps:** on `/`, Tab to "Search Spotify, e.g. Paul Kelly", then to "Search songs, e.g. Riptide".
- **Expected:** a visible focus indicator like every other control (WCAG 2.4.7).
- **Actual:** only the text caret shows; neither the input nor its wrapper gets an outline or ring. All 57 other focus stops on `/`, and all 88 on the example plans, have one.

### B-006 · Low · Select values are blank in the server HTML until hydration
- **Steps:** `curl` `/` and `/week?example=folk-duo`, or load them on a slow phone.
- **Expected:** "6 pm", "9 pm", "General", "5", "1" in the select triggers on first paint.
- **Actual:** `<span data-slot="select-value"></span>` is empty in the server HTML. The landing From/To/Permit and the week's "Sessions this week"/"Per day" show empty boxes until JavaScript runs (seen for about 3 s in the walk).

### B-007 · Low · Offline: "Explanations: Claude" while the mock model wrote them
- **Steps:** any plan on the offline server.
- **Expected:** the header chip and the "Data sources" credit say the explanations are mock or test output (as the Qloo and Spotify labels do).
- **Actual:** the chip says "Explanations: Claude" and the credit says "Plan explanations written by Claude (Anthropic) via Vercel AI Gateway". The plan text itself does say "Mock planner summary (offline test mode)". Offline only, but this is the case the learning "never leave a test-mode server running" warns about.

### B-008 · Low · e2e guard is skipped whenever `PLAYWRIGHT_BASE_URL` is set
- **Found:** retest of e3b85fb ("try to make it leak"), by reading `tests/e2e/global-setup.ts`. Not run, because running it would spend money.
- **Steps:** `PLAYWRIGHT_BASE_URL=http://localhost:3200 pnpm test:e2e` while the user's live dev server runs on 3200.
- **Expected:** a localhost base URL is checked like the reused-server case (`/api/health` must report `offline: true`), or needs an explicit opt-in.
- **Actual:** global setup only warns and returns. `LOCAL` is false, so the mock and fault specs skip, but the example, own-act and short-link specs run against the live server and can start real agent runs on uncached plans. It takes a deliberate env var, so the severity is Low. Suggest: apply the health check whenever the base URL host is localhost/127.0.0.1, or require `BUSKMAP_E2E_LIVE=1` to run against a non-offline target.
- **Everything else tried held:** `/api/health` is dynamic, not prerendered, so a server started without `BUSKMAP_ALLOW_FAULTS` from a faults-on build reported `faults: false`. A live server can't inherit `offline: true` from an offline build. A server without the route (older build, production) gives 404, and the run aborts. `VERCEL_ENV=production` forces `offline: false`, and the run aborts. Guard verified to abort against live :3200 (see B-001).

### B-009 · Low · e2e guard treats this machine's other addresses as a deploy
- **Found:** retest of 70eb77e. `guardMode()` from `tests/e2e/guard.ts` was evaluated directly for each URL with `external: true`; Playwright was not run against a live server.
- **Steps:** `PLAYWRIGHT_BASE_URL=http://192.168.1.101:3200 pnpm test:e2e` (the "Network:" URL that `next dev` prints), or the same with `0.0.0.0`, `127.0.0.2` or `<machine>.local`.
- **Expected:** the health check runs, because these are all this machine.
- **Actual:** `localhost`, `127.0.0.1` and `[::1]` give `check`, but `0.0.0.0`, `127.0.0.2`, `192.168.1.101` and `t04435-mbp.local` give `warn`. In those cases the non-mock specs run against the live dev server.
- **Suggestion:** call `/api/health` for every target, and when it isn't `offline: true`, require an explicit opt-in (E2E_ALLOW_LIVE=1, or a deploy flag) instead of deciding by hostname.

### B-010 · Low · Offline: steps, "Agent vs engine" and pitch cards still credit Claude
- **Found:** retest of 270c877, as DEV flagged.
- **Steps:** offline server, `/plan?example=acoustic`.
- **Expected:** with the mock model, nothing says Claude wrote the text.
- **Actual:** the chip and credit are fixed, but the page still shows "Claude kept the engine's top 3.", every step's "Claude: …" prefix (for example "Claude: I'll start with the taste map…"), and "Explained by Claude" on each pitch card. This is offline only. It matters because a test-mode server left running reads as a real Claude run.

### B-011 · Low · Search comboboxes say expanded in the server HTML
- **Found:** retest of 491f506 (a leftover DEV already knows about).
- **Steps:** `curl /` and look at the two `role="combobox"` inputs.
- **Expected:** `aria-expanded="false"` from the first paint.
- **Actual:** both inputs have `aria-expanded="true"` until hydration. After hydration, axe finds 0 violations on `/`. Only screen-reader users who arrive before the JavaScript loads are affected.

### B-012 · Low · Flaky e2e: example-card test reads the plan stream after navigating
- **Found:** fix round 3 (dev/core at 7126c07), full offline e2e with `CI=1` (1 retry).
- **Test:** `tests/e2e/short-links.spec.ts:7` "an example card is inputs only…" (DEV's). It failed once on mobile, then passed on retry: "response.text: Protocol error (Network.getResponseBody): No data found for resource with given identifier".
- **Cause (likely):** the spec reads the `/api/plan` response body after `page.goto("/")` for the second click and after the page has moved on. Chrome drops the body of a streamed response from a page it has left. This is test-only; the app is fine.
- **Suggestion:** read the stream with `request.post` (as the totals test does), or collect the body via `response.body()` before navigating.

### B-013 · Low · Fresh-run limit message gives the retry time in Melbourne time with no zone
- **Found:** code read of `freshRunGate` (`src/server/rate-limit.ts`, e83a94c). Not testable offline, because offline mode is exempt from the limit.
- **Steps:** live, start a 6th fresh plan within an hour from one IP, from outside Melbourne (for example a judge in New York).
- **Expected:** the retry time in the viewer's time zone, or labelled with its zone.
- **Actual:** "…or try again at 3:15 pm." The time is formatted with the plan city's time zone (Australia/Melbourne) and no zone label, so a New York judge reads the wrong hour.
- **Also:** no e2e covers the throttled page, because offline is exempt. Suggest a fault switch (for example `faults=fresh-limit`, honoured only with BUSKMAP_ALLOW_FAULTS) so the 429 UI can be tested offline.

### QA miss (not a bug ID): cut-off placeholder at 390 px
DEV found and fixed it (8afd14d): at 390 px the landing's "Your Spotify artist link (optional)" placeholder was cut off. QA's baseline phone screenshot (375 px) showed "Your Spotify artist link (opt…", but QA didn't file it. QA's layout spec now fails on any placeholder wider than its field (a canvas text measure against the field's content box). The check was proven on a deliberately cut-off field and passes on dev/core 5c6fdfd at 390, 768 and 1440.

### B-014 · Low · Qloo data map doc is stale about the week-prefetch comment
- **Found:** /brain retest (dev/core f9edb1a), checking the facts strip against `docs/qloo-data-map.md`.
- **Actual:** §4 says a comment in `plan-view.tsx` reads "about 47 Qloo calls" and calls it "uncertain, likely stale". 54b1ae3 already changed it to "about N+2 Qloo calls" (`plan-view.tsx:287`).
- **Expected:** the doc describes the current comment, or drops the note.
- The facts strip itself matches the doc and `qloo-map.ts`: 11 kinds, 24–33 calls per new busk, 0 on a rerun, 10,000 a month at 5 a second paced to 3, and 9 parts.

### B-015 · Medium · /brain: the sticky trace panel hides the focused node (WCAG 2.2 AA 2.4.11)
- **Found:** /brain retest (dev/core f9edb1a), `tests/e2e/qa/brain.spec.ts` at 390, 768 and 1440 px, confirmed with screenshots.
- **Steps:** open `/brain`, trace "Setlist and learn these" (click or Enter), then press Tab through the pieces.
- **Expected:** every focused piece stays at least partly visible (2.4.11 Focus Not Obscured (Minimum), AA in WCAG 2.2).
- **Actual:** the browser scrolls each newly focused piece to the bottom edge of the viewport, where the trace panel (`sticky bottom-0`, up to 45vh) sits on top of it. At 390 px, 20 Tab stops landed on fully hidden pieces (c5, c6, Spotify, d_crowd, d_pitchaff, d_trend, f_setlist and others); at 1440, c4 onwards. At 1440 the open panel also covers about half the wiring.
- **Suggestion:** while a trace is open, set `scroll-padding-bottom` on the page (or the scroll container) to the panel's height, so focus scrolling clears it. Or make the panel non-sticky at narrow widths, or scroll the focused piece to the centre on focus.
- **Regression test:** marked `test.fail` in `tests/e2e/qa/brain.spec.ts` until it's fixed.

### B-016 · Low · /repertoire: after Remove, keyboard focus falls to `<body>`
- **Found:** Repertoire R1 retest (dev/core cbda583), `tests/e2e/qa/repertoire.spec.ts` at 390, 768 and 1440.
- **Steps:** on `/repertoire`, add three songs, Tab to "Remove Scar", press Enter.
- **Expected:** focus stays in context: the next song's Remove button, the previous one, or the list heading when it's the last song (WCAG 2.4.3 focus order). The status line already says "Removed Scar.".
- **Actual:** the removed row's button goes away and `document.activeElement` is `<body>`, for any song, not just the last one. Keyboard and screen-reader users have to Tab again from the top of the page. "Move to Songs you can sing" removes its own button the same way, so it likely has the same problem (not separately tested).
- **Regression test:** the 2 specs in `tests/e2e/qa/repertoire.spec.ts` are marked `test.fail` until it's fixed.

### B-017 · Low · /week loading state: `aria-label` on a role-less div
- **Found:** Repertoire R2 retest (dev/core 8e4cd0d), with axe run straight after navigation. It's there since b4035c2 (15 Oct, the first week planner), not from R2; QA's earlier scans always waited for the loaded week.
- **Steps:** open `/week?example=folk-duo` and run axe before "Top sessions" renders (offline it shows for a moment; on a cold live run, for seconds).
- **Expected:** the loading state is announced, and axe passes.
- **Actual:** `src/app/week/page.tsx:35` renders `<div aria-busy="true" aria-label="Loading week">`. axe flags `aria-prohibited-attr` (serious): a `div` with no role can't carry `aria-label`, so screen readers don't announce "Loading week". The same pattern is on two spans in `week-view.tsx` (line 177 "Score N out of 100", line 230 "…: already started"). axe didn't flag those in the loaded state QA scanned, but they're likely ignored by screen readers too.
- **Suggestion:** give the loading wrapper `role="status"` (with the label, or visible sr-only text), and give the spans visible sr-only text instead of `aria-label`. This touches ARIA only, so it doesn't change the frozen Week design.
- Regression spec (added with the fix): `tests/e2e/qa/week-a11y.spec.ts` renders the server HTML without scripts, so the Suspense fallback stays on screen deterministically. It fails on 8e4cd0d and passes on 1b5a4e5.

### B-018 to B-026 · Honeycomb landing (design/honeycomb at 69a6cad)
Details, evidence and the lost-at hop for each are in the visual report on the `design/honeycomb` branch: `qa/reports/honeycomb-landing-audit.html`, indexed by `qa/reports/honeycomb-landing-audit.md`. They're logged here so the ledger stays complete; they apply to the Honeycomb branch, not to dev/core's current look.

### B-027 to B-031 · Repertoire R3, Songs you should learn (dev/core at 23a8d72)
Spec: BRAND's `learn-run-sketch.md` v3 and DEV's contract (`docs/playlist-architecture.md` §7); the published canvas has no Learn* boards yet. Evidence, side by side at 390/768/1440: `qa/reports/repertoire-r3-r5-audit.html`, indexed by `qa/reports/repertoire-r3-r5-audit.md`. All found offline with the mock model.
- **B-027 (Medium):** after a run, every step shows its tool name, Qloo endpoint, raw artist UUIDs and the whole `finish_suggestions` JSON, numbered oldest first, above the songs (at 1440 the new songs start about 1,600 px down). Sketch §2: plain words, raw data only behind "Show raw data", newest first, and once finished the feed moves under the list as "How we found these songs"; totals as the ResearchFunnel with one "left out" count.
- **B-028 (Low):** Qloo down shows "Qloo isn't answering" but not "Your songs are safe." (sketch §1 error, §2 endings), and nothing tells the user the run didn't count (the API doesn't count it).
- **B-029 (Low):** at run 8 (nothing new) the message says everything found was suggested before, while that run's counts read songs checked 0 and suggested before 0. Sketch: "…already in your history (7 left out)", plus a hint to try after a new busk or after learning songs.
- **B-030 (Low):** every run group stays expanded; sketch §3 says the newest run is open and older runs fold.
- **B-031 (Low):** no filter chips; sketch §3 and §6 list All · New · To learn · Learned · Not for me.

### B-032 to B-034 · Honeycomb landing recheck (design/honeycomb at 91b220e)
Checked part by part against BRAND's 29-part inventory (`design-handoff/inventory/landing/`). Evidence at 390/768/1440 is on the `design/honeycomb` branch: `qa/reports/honeycomb-landing-recheck.html`, indexed by `qa/reports/honeycomb-landing-recheck.md`. All three are visual differences from the part's crop that DEV's fix report didn't declare (lost at DEV self-check). The recheck also verified B-018 and B-020 to B-025 (statuses above). After 8 pm the sax example shows "This slot has passed": that's the known evening-slot bug (fixed on dev/core in e220abd, being ported), not a new defect.

**B-027 to B-031 recheck (16 Oct, dev/core df3c80c, functional only per §0 of the test plan).** Offline probe: 46 of 46 checks at 390/768/1440.
- B-027:
  - The default view has no tool names, /v2/, urn:, JSON, ids or step numbers. The steps fold closed under "How we found these songs", newest first, opened with Enter.
  - The funnel's "artists matched" and "new songs" agree with the cards and the end line.
  - "Show raw data" is absent while a run is going, toggles with Space afterwards, and shows the tool names. axe is clean with the fold open and raw on.
- B-028: the Qloo-down and no_match copy match the fix, and the allowance stays full. The next run is allowed.
  - Offline runs are exempt from the limits, so the counting itself is shown by `qa/unit/learn-uncounted-runs.test.ts`. Four uncounted runs leave both limits untouched, three real runs still fit, and timeout and stopped do count.
- B-029: with 0 songs checked (run 7), the copy reads "Couldn't find songs to check this time.". The checked > 0 branch is covered by DEV's unit test.
- B-030 and B-031: no filter chips and no per-run folds in the tree.
- Regression spec: `tests/e2e/qa/learn-feed.spec.ts`. The QA suite passes 225 of 225 at Wednesday 12:00, Friday 21:30 and Saturday 00:15.
- DEV's Postgres smoke log is now committed: `docs/smoke/learn-db-373ea1c.log`, 39 of 39.

### B-035 · High · design/honeycomb HEAD doesn't build (found 16 Oct)
- **How found:** `git archive HEAD` of design/honeycomb (6bc169e, on top of DEV's 4b9bff1), then `next build` fails with "Module not found: Can't resolve '@/components/setlist/copy-set-button'" (src/components/setlist/setlist-panel.tsx:2).
- **Cause:** the file exists only as an untracked file in DEV's worktree. Anything that builds from git (a deploy, CI, another checkout) breaks.
- **Also checked:** bbd1111 (the evening-slot port) builds, and QA's honeycomb suite passes there 153 of 153 at Wednesday 12:00, Friday 21:30 and Saturday 00:15.

### B-036 to B-042 · Busks · review v1 (design/honeycomb at 7b1521e)
Evidence, side by side with the deck at 390/768/1440: `qa/reports/busks.html` on design/honeycomb (rows B06–B14). Parts are provisional until BRAND's busks inventory lands. The user's calls F13, F14, F20, F25, F26 and F27 are tracked in that report, not here.

### B-043 to B-051 · Plan · review v1 (design/honeycomb at 7b1521e)
Evidence, side by side with the deck's 11 Plan boards: `qa/reports/plan.html` on design/honeycomb (rows P01–P26; provisional until BRAND's plan inventory lands). axe is clean on the ready plan and every reachable state; the engine fallback (P15) has no offline switch and is judged from the source.

B-052 evidence: `qa/reports/brain.html` on design/honeycomb, row BR08.

B-053, B-054 evidence: `qa/reports/errors.html` on design/honeycomb, rows E01, E02.

### B-055 to B-133 · Page reviews against BRAND's inventories (design/honeycomb at 7b1521e, 17 Oct)
Each defect is on its row in the living report: `qa/reports/<page>.html` on design/honeycomb (tips v1, brand v1, busks v2, plan v2, brain v2, errors v2, site v2), where the part ids are BRAND's. Ranges: tips B-055–069, brand B-070–079, busks B-080–097, plan B-098–113, brain B-114–121, errors B-122–128, site B-129–133. Judged at 1440 and 390 (768 for breakage), offline with the mock model; states that can't be reached offline are judged from source and say so on the row.

### B-134 to B-161 · v3 recheck at design/honeycomb 8207373 (17 Oct)
All eight living reports re-judged at 8207373 (landing v5; busks, plan, brain, tips, brand, errors, site v3). Findings that appear on several pages carry one number (B-134 night focus ring, B-135 lockup P clip, B-136 map “i” icon, B-137 legend wrap, B-138 shadow tokens). Fixed or partly fixed defects are updated in the table above.


### B-162 to B-234 · v4 recheck at design/honeycomb f83f1a1 (17 Oct)
The one full pass at DEV's closing commit, from QA's clean export, offline. Seven living reports re-judged (landing v6; busks, plan, brain, brand, errors, site v4); tips stays retired. Three new rules applied: the user's **glyph rule** (one defect, B-162, listing every text glyph used as an icon, from `qa/tools/glyph-icons.mjs`), **DS parity** (a component that visibly differs from BRAND's DS specimen is Different, citing the DS component; shared DS issues carry one number: B-163 to B-170, B-177, B-178, B-188, B-212, B-213), and the **real impeccable critique and audit** (skill v4.4.0, dual-agent, 390/768/1440; outputs in `qa/impeccable/` on design/honeycomb; B-218 to B-234 come from it and each was re-measured by QA where marked verified). B-228 is unused. DEV's declared limit (HTTP 200 for /p/&lt;unknown&gt; and the render error, /p noindex) is accepted; only its visible parts are B-230.

### Tips retired (17 Oct)
The user removed Tips from the app for now (a “rate your busks” feature replaces it later). `qa/reports/tips.html` is marked retired and kept as history; B-055 to B-069 are closed as won't fix (removed). From the v4 round, `qa/tools/no-tips-checks.mjs` checks that no /tips route, nav item, link, tip copy or tip factor remains, in the rendered pages and in the source. Baseline at 8207373: 50 of 58 checks fail (route 200, Tips in every nav, /tips links, tip copy on /, /busks, /week, /privacy and plans, and the tips route, components, scoring and example data in src). The nav should read Busks · Week · Brain, plus Repertoire after the merge.

