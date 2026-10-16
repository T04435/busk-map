"""QA's synthesis of the impeccable critique and audit at f83f1a1, one block per page. This is QA's text, not the skill's:
what QA re-measured, which skill findings became ledger defects, which were dismissed (and why), and which conflict with
a call the user already made (those go to MANAGER as questions, not defects)."""

SYN = {
"landing": """
<p><b>Scores.</b> Critique (A): Nielsen 20/28 (71%, Good; 3 heuristics n/a). Audit (B): 15/20, Good; Implementation Integrity <b>Pass</b>. CLI detector: 0 findings; browser overlay 16 (1440) / 14 (390) hits, about half false positives (B's own table).</p>
<p><b>Verified by QA and filed.</b></p><ul>
<li><b>B-218 · High</b> (A P1 on /brain, B P1 here): in the day OS scheme the focus ring inside pinned-dark bands is the light ring <code>#141c21</code> on the dark ground. QA measured 1.08:1 (in the dark scheme the same ring is orange, 6.49:1). <code>--focus-ring</code> is resolved on <code>:root</code>, so <code>data-theme="dark"</code> bands inherit it. Hero Qloo link, brain-teaser Qloo link and every footer link on /.</li>
<li><b>B-226 · Medium</b> (B P2): the ticker scrolls forever with no pause or stop control, and doesn't stop on hover (QA checked); only reduced motion stops it. WCAG 2.2.2.</li>
<li><b>B-231 · Low</b> (B P2, shared): targets under 44 px at 390: map-legend keys 32 px, Qloo wordmark links 33/25/15 px tall, inline “Week:” links 18 px.</li></ul>
<p><b>Dismissed.</b> Overlay <code>dark-glow #ffba00</code> (the overlay's own colour), <code>side-tab</code> on full-width section rules, <code>text-occlusion</code> (the overlay's labels), <code>cream-palette</code> (the brand's Paper token), stripes (the no-busking hatch).</p>
<p><b>Where impeccable meets the user's calls, the user's call wins</b> (recorded, not a defect or a question). Impeccable suggests removing the demo-video placeholder (A P1, B P2); the user decided to keep the slot (L11). Impeccable suggests naming the city in the hero (A P1); the user decided no city lock (F20). Impeccable suggests moving Beyond buskers, Brain and Brand below the closing CTA (A P2); the user decided the section order (F06). Impeccable suggests grouping the funnel into 3 stats (A P2): that overlaps L17 and B-164 (DS ResearchFunnel).</p>
<p><b>Not filed, recorded.</b> B P3: 104 endless SVG opacity animations in the hero (off-screen too), 13 arbitrary <code>text-[…]</code> h2 sizes, teaser buttons restyled with ~12 overrides on <code>variant="poster"</code>, <code>aria-label</code> on a plain span (setlist-panel.tsx:111). A P3: night mode loses the band rhythm.</p>""",

"busks": """
<p><b>Scores.</b> Critique (A): Nielsen 27/40 (68%, Acceptable). Audit (B): 15/20, Good; Implementation Integrity <b>Pass</b>. CLI detector: 0 findings; overlay 4 hits, 2 false positives.</p>
<p><b>Verified by QA and filed.</b></p><ul>
<li><b>B-220 · Medium</b> (A P1 + B P2): after an empty submit, focus stays on “Plan my busk” and nothing scrolls; at 390 the only invalid field is about 1,100–1,800 px above. The artist and song errors aren't tied to their inputs: no <code>aria-invalid</code>, no <code>aria-describedby</code> (performer-form.tsx:152, artist-picker.tsx:128, repertoire-picker.tsx:196 puts it on the fieldset).</li>
<li><b>B-221 · Low</b> (B P2): no visible pending state after “Plan my busk”; only the primary button is disabled and the second action stays live while the request runs.</li>
<li><b>B-231 · Low</b> (shared): the footer's Qloo link is 44×15 at 390.</li></ul>
<p><b>Dismissed.</b> <code>side-tab</code> (the header's full-width rule), <code>dark-glow</code> (the overlay's colour). <code>kicker-above-heading</code> and <code>cream-palette</code> are true by the rule but are the Honeycomb page header and the Paper token (board).</p>
<p><b>Conflicts with the board: asked of MANAGER.</b> A P1 “put the form before the example acts”: the board (and B07/B08) put the examples first. A P2 “blank act name becomes My act”: a product call. A P3 “one-option City picker”: the board draws it (B32). A's “weak focus on inputs” is not reproduced: B and the field strip measure a 2 px ring on every input (F13).</p>
<p><b>Next round.</b> A and B both name “Plan my week”; the no-week check (removed by the user) covers it at DEV's next closing commit.</p>""",

"plan": """
<p><b>Scores.</b> Critique (A): Nielsen 23/40 (58%, Acceptable). Audit (B): 16/20, Good; Implementation Integrity <b>Pass</b>. CLI detector: 0 findings; overlay 23 (1440) / 19 (390) hits, mostly brand choices or false positives.</p>
<p><b>Verified by QA and filed.</b></p><ul>
<li><b>B-219 · High</b> (A P1; site A P1): blank scroll after the footer. QA measured /p/DuYxRvaHZ at 390: document 8,153 px, footer ends at 6,305 px, so 1,848 px of empty paper (site A: 1,168 px at 768). Cause per site A: absolutely positioned spans inside the closed “Every check” fold escape <code>min-h-0 overflow-hidden</code> because that div isn't their containing block (honeycomb/fold.tsx).</li>
<li><b>B-227 · Medium</b> (B P2): on a phone the map takes one-finger vertical drags (synthesised touch at 390: scroll 244 → 244); the canvas has <code>touch-action: none</code> and no cooperative gestures. Not checked on a real device.</li>
<li><b>B-231 · Low</b> (shared): legend keys 32 px tall (map-legend.tsx:16).</li></ul>
<p><b>Held, not filed.</b> B's heading skip (h2 → h4, tool-results.tsx:152/167) is inside the research feed cards B24–B48, held by DEV (B-048 note). A P2 “Qloo-down page: two retry buttons, spinner under STOPPED” is the held feed beside Q03.</p>
<p><b>Dismissed.</b> <code>clipped-overflow-container</code> (the map clip is deliberate), <code>side-tab</code>, hatch stripes (no-busking zones), <code>cream-palette</code>, <code>text-occlusion</code>, <code>dark-glow</code>.</p>
<p><b>Product questions: asked of MANAGER.</b> A P1 “put the reasons on the pitch rows” and A P2 “research before the answer” (funnel and Agent vs Engine above Your busk at 1440) are layout calls against the board. A P2 “engineering vocabulary” (AGENT VS ENGINE, taste cells) overlaps B-049. Offline fixture names in pitch names (B P3) are mock data only.</p>""",

"brain": """
<p><b>Scores.</b> Critique (A): Nielsen 23/32 (72%, Good). Audit (B): 15/20, Good; Implementation Integrity <b>Pass</b>. CLI detector: 0 findings; every overlay hit (side-tab, cream-palette, dark-glow, low-contrast 1.0:1 on the h1, text-occlusion) is a false positive (B checked each: text is 15.9:1).</p>
<p><b>Verified by QA and filed.</b></p><ul>
<li><b>B-218 · High</b> (A P1 and B P1, independently): in the day OS scheme every /brain control's focus ring is <code>0 0 0 2px #141c21</code> on the pinned-dark page. QA measured 1.08:1 against the ground; in the dark scheme it is orange, 6.49:1. <code>--focus-ring</code> (globals.css:200) is resolved on <code>:root</code>; the page's <code>--ring: #ff6a2b</code> never reaches it. Site-wide, see the site report.</li>
<li><b>B-222 · Medium</b> (A P1 + B P2): the traced panel covers the path it describes: at 1440×900 two lit parts sit under it; at 390 the panel (204 px, <code>max-h-[45vh]</code>) plus the nav cover Pitch ranking. B-015 (focused node) stays fixed: this is lit, unfocused pieces.</li>
<li><b>B-231 · Low</b> (shared): hero Qloo link 41 px tall; footer links 15–37 px.</li></ul>
<p><b>Recorded, not filed.</b> B P2: hard-coded trace-state hexes (brain-map.tsx:176/178/188/199; page.tsx:16), see B-234. A P2: below 1024 the wires are gone and a trace acts as a filter; “Try…” lines sit after the grid. A P3: endpoint noise, “11 kinds” over 12 items (BR05). “Powered by Qloo” read twice (B P3).</p>
<p><b>Questions for the user (via MANAGER).</b> A: a shareable <code>?trace=</code> link; whether the brain should be drawn as real honeycomb cells.</p>""",

"brand": """
<p><b>Scores.</b> Critique (A): Nielsen 23/36 (64%, Acceptable). Audit (B): 16/20, Good; Implementation Integrity <b>Pass</b> (real components, token-only colour). CLI detector: 0 findings; overlay 34 (1440) / 44 (390), most from the showcase's own nesting.</p>
<p><b>Verified by QA and filed.</b></p><ul>
<li><b>B-223 · Medium</b> (A P1): the tokens table at 390 is 860 px wide in a 322 px frame inside a fold; the Day, Night and Use columns start off-screen and each row is 97 px tall (QA measured).</li>
<li><b>B-224 · Low</b> (A P1): §08 Handoff points to <code>hackathons/qloo-2026/design-handoff/</code>, which isn't in this repo and isn't linked (QA checked the export).</li>
<li><b>B-225 · Low</b> (B P2 ×2): heading outline: WeatherStrip's h2 inside an h3 group (weather-strip.tsx:36), NoteCard's h3 under an h4 (note-card.tsx:10), and at 390 the phone folds turn 28 sub-headings into summary text (50 → 22); two landmark names used twice (“The words”, “Screens”).</li>
<li><b>B-231 · Low</b> (shared): legend keys 32 px, chips 40 px, Screens-table route links 16 px tall, header Qloo link 33 px.</li></ul>
<p><b>Same as filed defects.</b> A P2 “the ResearchFunnel specimen's orphan dashes” is B-162 (glyph connectors) and B-164 (DS ResearchFunnel).</p>
<p><b>Dismissed.</b> <code>dark-glow</code>, <code>em-dash-overuse</code> (0 em-dashes on the page), <code>text-occlusion</code>, <code>side-tab</code>; cream ground, hatch stripes and the 01–08 numbering are the brand's own.</p>
<p><b>Recorded, not filed.</b> B P3: the reduced-motion row says the Loader keeps turning but it stops (page.tsx:281); 63 arbitrary type values; an underlined <code>&lt;b&gt;</code> that reads as a link (brand-components.tsx:236). A P2/P3: no section rail on a 16–23k px page; grid orphans; night swatches all near-black.</p>
<p><b>Question for the user (via MANAGER).</b> A: who is the page for: a judge, a studio or the team?</p>""",

"errors": """
<p><b>Scores.</b> Critique (A): Nielsen 23/40 (58%, Acceptable). Audit (B): 15/20, Good; Implementation Integrity <b>Pass</b>. axe 0 violations in 16 runs. CLI detector: 0 findings (B proved it parses TSX with a planted file); overlay hits are the header rule, the Paper token, the overlay's colour, a mono label and the test-data hatch.</p>
<p><b>Verified by QA and filed.</b></p><ul>
<li><b>B-229 · Medium</b> (A P1 + B P2): Try again on the route error gives no pending state, comes back with the identical card and drops focus to <code>&lt;body&gt;</code>; a second failure announces nothing (error-card.tsx:36–39; WCAG 2.4.3, 4.1.3).</li>
<li><b>B-230 · Low</b> (A P2 + B P2): plan-not-found draws an orange ghost pin offset behind the dashed hex (QA saw it at 390), and its tab title is “Plan · Busk Map”; the noindex meta appears twice.</li></ul>
<p><b>DEV's honest limit, judged.</b> /p/&lt;unknown&gt; answers HTTP 200 (and the render error too). B traces it to <code>notFound()</code> running inside <code>&lt;Suspense&gt;</code> after streaming starts (p/[id]/page.tsx:22–27): fixable, but the page is noindex and says the right thing, so QA accepts the 200 as the stated limit and files only the visible parts (B-230).</p>
<p><b>Recorded, not filed.</b> B P2: “Go to Busk Map home” overflows its button at 200% text (button.tsx:10, <code>whitespace-nowrap</code> + fixed height). B P2: the shared header's hard-coded hexes (B-234). A P2: four states in three systems (B-212 is the DS side). A P1 on the limit page's hierarchy and its single exit is a layout call against the board (R05–R08): asked of MANAGER.</p>""",

"site": """
<p><b>Scores.</b> Critique (A): Nielsen 25/36 (69%, Acceptable). Audit (B): 15/20, Good; Implementation Integrity <b>Pass</b>. axe scoped to the chrome: 0 violations in 24 runs. CLI detector: 0 findings; the one chrome hit (<code>side-tab</code>, the header's 4 px rule) is a false positive.</p>
<p><b>Verified by QA and filed.</b></p><ul>
<li><b>B-218 · High</b>: the day-scheme focus ring in pinned-dark chrome (the landing's dark footer, /brain). B measured the ring on the bluestone header as visible (cream); the failure is in <code>data-theme="dark"</code> areas only, measured 1.08:1 by QA.</li>
<li><b>B-219 · High</b> (A P1): blank scroll after the footer on plans at 390 and 768 (see the plan report).</li>
<li><b>B-231 · Low</b> (B P2): the footer's Qloo wordmark link is 44×15; footer text links 32–44 px wide.</li>
<li><b>B-232 · Low</b> (B P2): the critter, the only visible content of “Built with Claude Code”, is 2.68:1 on paper (WCAG 1.4.11; B-161 is its drawing).</li>
<li><b>B-233 · Low</b> (B P2): the phone bottom nav is after the footer in the DOM (layout.tsx:51–53): 12–38 Tabs to reach it at 390.</li>
<li><b>B-234 · Low</b> (B P3, also brain, errors): app-header.tsx:17/18/30/31 hard-code <code>#f2ede4</code>, <code>#a7b0b5</code>, <code>#232d33</code>; logo.tsx:39 hard-codes <code>#8C8CC8</code> though <code>--qloo-brand</code> exists.</li></ul>
<p><b>Recorded, not filed.</b> B P3: <code>--bottom-nav</code> resets at 768 while the nav switches at 721 (64 px of extra scroll padding from 721 to 767); bottom-nav labels 11 px. A P3: the footer grid squeezes at 768.</p>
<p><b>Where impeccable meets the user's calls, the user's call wins</b> (recorded, not a defect or a question). Impeccable suggests splitting the footer, legal apart from product (A P2); the user decided this footer (F08). Impeccable suggests renaming “Brain” in the nav (A); the user decided a features-only main nav, with Brain in the footer (next round). Design calls for BRAND, not defects: the phone nav stays paper under the dark landing, and /brand, /privacy, /terms have no current page (A P2).</p>""",
}
