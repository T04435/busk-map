# Site-wide · review: header (H), bottom nav (N) and footer (FT) on every route, by BRAND's chrome inventory (29 parts). v4 at f83f1a1.
# Data for qa/tools/page-review.py.
TITLE = "Site-wide · review"
ROUTE = "every page (/, /busks, /week?example=acoustic, /brain, /brand, /p/…, /terms, /privacy, 404; /tips is now a 404)"
VERSION = "v4"
COMMIT = "f83f1a1"
DATE = "17 Oct 2026"
IMG = "honeycomb/site/inv/"
CHANGES = ("Full pass at DEV's closing commit f83f1a1; every row re-judged. Fixed since v3: B-129 (nav switches at 721: bottom bar at 720, header nav at 721), "
           "B-132 (the bottom-nav tile fades over 200 ms ease-out, none with reduced motion), B-133 (home link named “Busk Map home”), "
           "B-134 (night focus rings now sit 2 px off the button on the ground: 5.78:1 on /busks; paper ring 12.0:1 on /), B-135 (the lockup's wordmark box is 330 wide, so the P keeps its orange offset), "
           "B-157 (footer lockup links home), B-158 (mid-dots, nav “Site”), B-160 and B-161 (the agreed F08: “Built by” plain, “T04435” links to github.com/T04435, the critter is BRAND's 170×112 path linking claude.com/claude-code in a new tab). "
           "Partly fixed: B-159, the GitHub cell still opens in the same tab (FT04). Tips is gone: three nav items, /tips is a 404, no Tips text or links in any chrome. "
           "H03, N02 (Repertoire) and H07 (plan end slot) are now Held by DEV (B-130, B-131). N07's deck crop shows Tips (retired); judged on /busks. site-checks 27/0; axe 40 runs clean. DS parity and glyph rule applied (same commit): H02, H04 and FT02 now Different against DS AppHeader / SiteFooter / Logo sizes (B-215..B-217); no glyph icons in the chrome (B-162 not cited); DS SiteFooter and Logo specimens are older than the user's F07–F12 and are flagged, not used, where the calls override them.")
READY = ("Ready with notes", "The chrome matches the user's calls on every width and theme. Small visible differences from the DS: the lockup is larger than DS AppHeader's and SiteFooter's (H02, FT02: B-215, B-216), header items are 48 px against DS AppHeader's 40 (H04: B-217), and the GitHub cell opens in the same tab (FT04, B-159). "
         "H03, N02 (Repertoire, added with the merge) and H07 (plan end slot) are held by DEV.")
HISTORY = [
    (VERSION, COMMIT, DATE, CHANGES),
    ("v3", "8207373", "17 Oct 2026", "Recheck at 8207373 (DEV closed the F round). The new footer is in: FT01, FT07–FT10 Present; FT02–FT06 Different (logo not a home link, no mid-dots, same-tab links, critter to GitHub, critter approximated). "
     "Logo with the new stencil lettering everywhere (F12 met; P offset clipped, B-135). H06, N05 Present: one 2 px ring. Night default-button ring measured against 1.4.11 (B-134). site-checks 24/24; axe 40 runs clean."),
    ("v2", "7b1521e", "17 Oct 2026", "BRAND's chrome inventory replaces the 11 provisional rows: 29 parts (H01–H09 header, N01–N09 bottom nav, FT01–FT11 footer), "
     "checked on 9 routes at 390, 768 and 1440, day and night; site checks F07–F12; axe; BRAND's four chrome issues. Logo rows judged by the user's corrected F12 (the lockup with the new lettering)."),
    ("v1", "7b1521e", "17 Oct 2026", "First version: header, phone nav, footer, logos, Qloo links, /terms, field focus on 8 routes (534 field states), the user's calls F07-F15."),
]
SOURCE_NOTE = ("Deck: BRAND's chrome inventory (DS component previews: AppHeader, MobileNav, SiteFooter, BuiltByMark); the user's calls F07–F15 and the agreed F08 footer override it. DS specimens (BRAND's DS v62/v63, rendered: qa/screens/honeycomb/ds/AppHeader, MobileNav, SiteFooter, Logo, QlooWordmark) checked for parity. "
               "Build: QA's own export of f83f1a1, offline; crops from /busks (header, nav, footer, focus), /brain (night), /terms, /privacy and the folk-duo plan (end slot, sheet). "
               "v4 build images live under inv/v4/; v3 under inv/v3/, v2 under inv/build/.")

def P(id, name, qa, note, user="", defect="—", dev="—", deck=True, b1440=True, b390=True, spec=None):
    p = {"id": id, "name": name, "qa": qa, "note": note, "user": user, "defect": defect, "dev": dev,
         "deck": f"deck/{id}.jpg" if deck is True else deck,
         "b1440": f"v4/{id}-1440.jpg" if b1440 is True else b1440,
         "b390": f"v4/{id}-390.jpg" if b390 is True else b390}
    if spec:
        p["spec"] = spec
        p["deck_empty"] = "Spec only (no crop)"
    return p


F12 = "F12 (corrected 17 Oct): one logo, the lockup [hex mark][new stencil wordmark], in the header at every width and in the footer; the OLD lettering (larger M, another font) is retired. Wordmark-only or mark-only in the header or footer fails."
F1315 = "F13–F15: one focus ring, shadcn's own pattern; no global CSS over the primitives' states."
FALLBACK = "Declared deviation: a scoped one-ring focus fallback for plain links and buttons (asking BRAND)."
F08 = "F08 (agreed footer): “Built by” is plain text, “T04435” links to github.com/T04435, and the critter links to claude.com/claude-code in a new tab, rel noopener noreferrer, named “Built with Claude Code (opens in a new tab)”."
NAV = "Nav: Busks · Week · Brain, no Tips (Tips removed 17 Oct). Repertoire is added later, with the merge."
HELD = "held by DEV"
PARTS = [
 # Header
 P("H01", "AppHeader", "Present", "DS parity: bar, rule, colours and type match DS AppHeader (bluestone bar 60 px + 4 px orange rule, mono uppercase items); sizes inside it differ (H02, H04). 64 px bluestone bar (#141c21), paper text, 4 px orange bottom rule; lockup left, nav after it; same in both themes on all 10 routes at 768 and 1440 (and from 721). No end slot (H07, held)."),
 P("H02", "Wordmark (home)", "Different", "DS parity: differs from DS AppHeader in size: the lockup is 36 px tall (drawn 171×30 px) against the DS AppHeader specimen's ≈24 px lockup (drawn 146×23), about 1.3× larger, so the bar reads fuller. Otherwise: the home link (aria-label “Busk Map home”, B-133 fixed) holds the lockup file /brand/busk-map-lockup-dark.svg at 179×36: hex mark + the NEW stencil “BUSK MAP”, even caps with the orange offset, matching the user's reference 04-wordmark-only-one.png (4× render v4/logo-header-x4.jpg). The wordmark box is now 330 wide (paths reach 325), so the P keeps its orange offset on the right (B-135 fixed at f83f1a1).", F12, "B-215; B-133, B-135 fixed at f83f1a1"),
 P("H03", "Nav items", "Held", "Held by DEV (Repertoire comes with the merge). DS AppHeader's Setlist and Tips are overridden by the user's nav; the item height is logged on H04 (B-217). nav “Main”: Busks · Week · Brain, icon + mono uppercase label, #a7b0b5, real links, 48 px tall (h-tap; spec 40 px). No Tips item and no /tips link anywhere in the chrome (10 routes × 390/768/1440 × day/night).", NAV, "B-130 (held by DEV)", b390="v4/H08-390.jpg"),
 P("H04", "Current page", "Different", "DS parity: differs from DS AppHeader in height: the current item's orange fill is 48 px tall (h-tap; drawn 87×46) and nearly fills the 60 px bar, against DS AppHeader's 40 px item (drawn 82×38) with 10 px of bluestone above and below. Same height on items at rest (invisible there). Otherwise: aria-current=\"page\" with the orange fill and bluestone text/icon: Busks on /busks and /p/…, Week on /week, Brain on /brain; none on /, /brand, /terms, /privacy and 404 (/tips is a 404 too). Same at 768.", "", "B-217", b390=None),
 P("H05", "Item at rest", "Present", "Muted #a7b0b5 icon and label, no fill; hover #232d33 with paper text.", b390=None),
 P("H06", "Keyboard focus", "Present", "One ring: focus-visible:ring-2 in paper (#f2ede4), a single 2 px box-shadow, no gap layer. Shows on the orange current item, on items at rest and on the home link (v4/H06b-1440.jpg, v4/H06c-1440.jpg; sheet in the focus section).", F1315, b390=None,
   dev="Header items carry their own ring-2 classes (not the global fallback)"),
 P("H07", "End slot", "Held", "Held by DEV. DS AppHeader's specimen shows a DataStatusBadge reading “Melbourne · live data” and a Share button; when DEV builds it, the badge label must follow F20 (no city in default text unless the data is that city's). The plan header (folk-duo plan, 1440) still has only the home link and the nav: no “Live data” badge and no “Share” button; the plan keeps “Copy link” and its data chips in the page header.", "", "B-131 (held by DEV)", b390=None),
 P("H08", "Up to 720px", "Present", "The switch is now at 721 (nav class min-[721px]): at 720 the header keeps the lockup alone and the bottom bar shows; at 721, 740, 767 and 768 the header nav shows (B-129 fixed at f83f1a1). No sideways scroll at 721 on 9 routes; the three items fit. Build · 1440 column: the page at 720; at 721: v4/switch-721.jpg.", F12, "B-129 fixed at f83f1a1", b1440="v4/switch-720.jpg"),
 P("H09", "Night theme", "Present", "Bluestone in both themes; only the rule's orange follows the night token (#ff6a2b). Crops from /brain at night."),
 # Bottom nav
 P("N01", "MobileNav", "Present", "Fixed to the bottom (z 40), 64 px plus the safe-area inset, card ground with a 2 px rule on top, three equal columns ≥ 48 px. Shows up to 720 px, hidden from 721 (B-129 fixed).", "", "B-129 fixed at f83f1a1", b1440=None),
 P("N02", "Nav items", "Held", "Held by DEV (Repertoire with the merge). DS parity: tile 48×30, icon 22 px, label sizes and colours match DS MobileNav; the DS specimen's Setlist and Tips are overridden (Tips removed, Brain replaces Setlist). 48×30 icon tile with a 22 px icon over a mono 11 px uppercase muted label: Busks · Week · Brain. No Tips.", NAV, "B-130 (held by DEV)", b1440=None),
 P("N03", "Current page", "Present", "aria-current=\"page\": foreground label, orange tile with a 2 px bluestone inset rule by day, no rule at night (N09).", b1440=None),
 P("N04", "Item at rest", "Present", "Muted icon and label, no tile fill.", b1440=None),
 P("N05", "Keyboard focus", "Present", "One ring: the global fallback draws a single 2 px bluestone box-shadow around the whole item, at rest and on the current item (v4/N05b-390.jpg). No gap layer.", F1315, b1440=None, dev=FALLBACK),
 P("N06", "Current tile", "Present", "The tile now has transition-colors 200 ms ease-out (computed 0.2s on background-color); with prefers-reduced-motion it computes to none 0s (motion-reduce:transition-none). B-132 fixed at f83f1a1. A fade has no still image.", "", "B-132 fixed at f83f1a1", b1440=None, b390=None),
 P("N07", "On a page (390)", "Present", "The inventory retires this crop (it shows Tips current; Tips is removed). Judged on /busks at 390 instead: the bar at the bottom, full width, Busks current, below the content.", "Tips removed 17 Oct (inventory: drop this).", b1440=None),
 P("N08", "Hidden", "Present", "Re-checked at f83f1a1: on the folk-duo plan at 390, “Full details” opens the pitch sheet full screen over the bar (the sheet is on top at the bar's position) and Radix sets aria-hidden on the bar. The agent-working screen needs a live model run: not checked.", deck=None, b1440=None,
   spec="Hide it while a bottom Sheet is open and on the agent-working screen (README). Not drawn."),
 P("N09", "Night theme", "Present", "Card #182025, paper rule on top, muted labels; the current tile (Brain on /brain) orange without the inset rule.", b1440=None),
 # Footer
 P("FT01", "SiteFooter", "Present", "DS parity note: the rendered DS SiteFooter specimen (v62/v63) is still the OLD footer (“Taste data by Qloo · MIT licence”, “Open source github.com/…”, “Built by T04435 (solo), with Claude…”, legal line in the footer), which the user's F07–F11 replaced; the build follows the calls and BRAND's newer SiteFooter preview (the inventory crop), so it is not marked Different against the stale specimen. BRAND must update DS SiteFooter before a 1:1 port. The new footer on every route: three parts on a 1fr · auto · 1fr grid (569 · 206 · 569 px at 1440; 233 · 206 · 233 at 768), 24 px padding, 1 px border on top (#cfc7b8 day, #2e3a41 night), 13/20 muted text. On / it keeps the night ground under the closing band (v4/FT01b-1440.jpg); elsewhere it sits on paper. 768: v4/FT01-768.jpg. Matches the crop.", "F11: left wordmark + Qloo logo, centre Privacy · Brain · Brand, right GitHub + Built by."),
 P("FT02", "Left: wordmark and Qloo", "Different", "DS parity: differs from DS SiteFooter and the inventory spec (22 px) in size: the footer lockup is 34 px tall against DS SiteFooter's ≈24 px lockup (drawn 146×27). DS QlooWordmark matches (currentColor letters, bar #8C8CC8, 44 px here, DS default 48). Otherwise: the lockup at 34 px (new lettering, P offset intact; 4× v4/logo-footer-x4.jpg) is now a link home named “Busk Map home” (B-157 fixed), then “with” and Qloo's wordmark (44 px, currentColor letters, purple bar) linking https://qloo.com, _blank, rel “noopener noreferrer”, named “Qloo (opens qloo.com in a new tab)” on every route (F09). The Qloo link is 44×15 px (passes 2.5.8 by spacing).", "F12 (corrected): the lockup with the new stencil lettering. F09: every Qloo logo links to qloo.com in a new tab, rel=\"noopener noreferrer\".", "B-216; B-157 fixed at f83f1a1"),
 P("FT03", "Centre: site links", "Present", "nav “Site”: Privacy · Terms · Brain · Brand, bold underlined foreground links, 48 px tall, with aria-hidden mid-dots between them (B-158 fixed). /privacy (“What Busk Map keeps”) and /terms (“What Busk Map promises”) are 200 pages.", "F11: Privacy · Brain · Brand in the centre (Terms added for F10).", "B-158 fixed at f83f1a1"),
 P("FT04", "Right: GitHub in a honeycomb cell", "Different", "A 40 px outline hex cell with the GitHub mark, 48×48 target, linking https://github.com/T04435/busk-map, named “Busk Map on GitHub” (F07 met). Still opens in the same tab (no target, no rel), so the name has no “(opens in a new tab)” as the spec asks. The agreed F08 does not cover this link.", "F07: a GitHub icon in a honeycomb cell, linked.", "B-159 (partly fixed: this link remains)"),
 P("FT05", "Right: Built by T04435", "Present", "Matches the agreed F08: “Built by” is plain text; “T04435” is a bold underlined link to https://github.com/T04435 (same tab; BRAND's spec said new tab, the agreed F08 does not); the critter links https://claude.com/claude-code, target _blank, rel “noopener noreferrer”, named “Built with Claude Code (opens in a new tab)”, 48×48 target. site-checks F08: 4 of 4 pass.", F08, "B-160 fixed at f83f1a1; B-159 fixed for the critter"),
 P("FT06", "BuiltByMark", "Present", "No DS BuiltByMark specimen was rendered (not in the 82); judged against BRAND's logos/built-by-mark.svg. BRAND's built-by-mark path, character for character (viewBox 170×112, #d97757, fill-rule evenodd so the eyes are holes), decorative (aria-hidden), inside the labelled link. 20 px tall in the footer (spec 18 px). Clay in both themes.", "F08: an SVG of the Claude Code critter, not the Claude logo.", "B-161 fixed at f83f1a1"),
 P("FT07", "Legal line on /terms", "Present", "/terms (200, “Terms · Busk Map”, h1 “What Busk Map promises”) holds “Busk Map never confirms a pitch is legal: check your permit conditions.”, then data credits (new-tab links with noopener; the City of Melbourne sources are real data, allowed under F20) and the licence. The line is in no footer; every footer links Terms.", "F10: the legal line moves to /terms, linked from the footer.", deck=None,
   spec="F10: the legal line leaves the footer and lives on /terms, which the footer links. No board draws /terms yet."),
 P("FT08", "Link focus", "Present", "One ring: the global fallback, a single 2 px bluestone box-shadow, on the text links, the home lockup, the GitHub cell (square ring around the hex, v4/FT08b-1440.jpg), the Qloo link (v4/FT08c-1440.jpg) and the critter. No gap layer.", F1315, dev=FALLBACK),
 P("FT09", "Up to 720px", "Present", "At 390 the three parts stack in one left-aligned column in order: lockup + “with Qloo”, Privacy · Terms · Brain · Brand, GitHub cell + Built by T04435 + critter. No sideways scroll.", "F11", b1440=None),
 P("FT10", "Night theme", "Present", "Night ground (#0f1416), paper lockup (dark file) and links, border #2e3a41; the critter stays clay #d97757. Matches the crop.", "F07–F11"),
 P("FT11", "Reduced motion", "Present", "Nothing in the footer animates or transitions (0 animations, 0 non-zero transitions), with and without prefers-reduced-motion.", deck=None, b1440=None, b390=None,
   spec="Nothing in the footer moves."),
]

V4 = "../screens/honeycomb/site/inv/v4/"
FIELDS = ("<p>The chrome has no form fields; each page's report carries its own strip. Site-wide at f83f1a1 (scratchpad fields9): <b>542 field states, 4 fail</b>: three are the exempt disabled “DISABLED” specimen on /brand and one is the plan's “≈612 people an hour est.” button at 390 inside a closed fold (focus visible when open, v3 confirmed). "
          "The 404 page's strip (its two buttons): 2 of 2 pass.</p>"
          f'<a href="{V4}field-strip.jpg"><img src="{V4}field-strip.jpg" alt="404 field strip at f83f1a1"></a>'
          "<p>Chrome focus at f83f1a1 (H06, N05, FT08): header home link, current item and item at rest (paper ring-2), bottom-nav item and current item, footer link, GitHub cell, Qloo link and a footer link at 390. One ring everywhere (the bottom-nav ring's lower edge meets the viewport edge):</p>"
          f'<a href="{V4}chrome-focus.jpg"><img src="{V4}chrome-focus.jpg" alt="Focus on header, bottom nav and footer"></a>')

CHECKS = """<p><code>node qa/tools/site-checks.mjs &lt;export&gt; 3257</code> at f83f1a1: <b>27 pass, 0 fail</b> (routes /, /busks, /week, /brain, /brand, /terms, /plan, 404), plus QA's own look:</p><table>
<tr><th>Call</th><th>Result</th><th>Evidence</th></tr>
<tr><td>F07 GitHub icon in a hex cell</td><td>Pass</td><td>Hex cell + GitHub mark, link to the repo, “Busk Map on GitHub” (same tab: FT04, B-159).</td></tr>
<tr><td>F08 agreed footer</td><td>Pass</td><td>“Built by” plain text; “T04435” → https://github.com/T04435; the critter → https://claude.com/claude-code, _blank, noopener noreferrer, “Built with Claude Code (opens in a new tab)”; BRAND's path; no “@…” text.</td></tr>
<tr><td>F09 Qloo logos link to qloo.com, new tab, noopener</td><td>Pass on all routes</td><td>Every Qloo logo: https://qloo.com · _blank · noopener noreferrer.</td></tr>
<tr><td>F10 /terms holds the legal line; footer links it</td><td>Pass</td><td>/terms 200 with the line; no legal line in any footer; Terms link in every footer. /privacy 200.</td></tr>
<tr><td>F11 layout</td><td>Pass</td><td>Left: lockup + Qloo; centre: Privacy · Terms · Brain · Brand; right: GitHub + Built by (1fr · auto · 1fr at 768 and 1440; stacked at 390).</td></tr>
<tr><td>F12 one logo, the lockup with the new lettering</td><td>Pass (lettering checked by eye)</td><td>16 placements, all the lockup files. At 4× (<a href="../screens/honeycomb/site/inv/v4/logo-header-x4.jpg">header</a>, <a href="../screens/honeycomb/site/inv/v4/logo-footer-x4.jpg">footer</a>) the lettering is the reference's even stencil caps with the orange offset, no tall M; the P's offset is now whole (B-135 fixed).</td></tr>
<tr><td>F13–F15 one ring</td><td>Pass in the chrome</td><td>Header ring-2 paper; bottom nav and footer the one-ring fallback (H06, N05, FT08).</td></tr>
<tr><td>Tips retired</td><td>Pass</td><td>No Tips nav item, no /tips link, no “tip” word in header, bottom nav or footer on 10 routes × 3 widths × 2 themes; /tips is a 404 with the normal chrome.</td></tr>
<tr><td>F20 city names</td><td>Pass</td><td>No “Melbourne” in the header, bottom nav or footer on any route; on /terms only the City of Melbourne data credits (real data).</td></tr></table>"""

RING = """<p>B-134 re-measured at f83f1a1 from screen pixels on /busks and / at 390 and 1440, dark scheme, keyboard focus (:focus-visible true), against WCAG 1.4.11 (3:1 against adjacent colours). The rings are now outlines 2 px off the button, so the colour beside the ring on both sides is the ground. / has no <code>default</code>-variant button; its primary orange button is the <code>poster</code> CTA “PLAN A BUSK”.</p><table>
<tr><th>Button</th><th>Ring</th><th>Inside the ring (gap)</th><th>Outside the ring</th><th>Result</th></tr>
<tr><td>/busks 390 and 1440 · “PLAN MY BUSK” (default)</td><td>outline 2 px #ff6a2b, offset 2 px</td><td>card #182025 (2 px gap between fill and ring): <b>5.78:1</b></td><td>card #182025: <b>5.78:1</b></td><td>Pass. The ring no longer touches the fill (was 1.00:1 in v3).</td></tr>
<tr><td>/busks 390 and 1440 · “PLAN MY WEEK FROM THIS DATE” (outline)</td><td>outline 2 px #ff6a2b, offset 2 px</td><td>card #182025: <b>5.78:1</b></td><td>card #182025: <b>5.78:1</b></td><td>Pass. The ring no longer touches the grey border (was 1.38:1).</td></tr>
<tr><td>/ 390 and 1440 · “SHOW THE MAP” (outline)</td><td>outline 2 px paper #f2ede4, offset 2 px</td><td>map panel #222b2f: <b>12.38:1</b></td><td>map panel #242d32: <b>12.03:1</b></td><td>Pass.</td></tr>
<tr><td>/ 390 and 1440 · “PLAN A BUSK” (poster, primary orange)</td><td>outline 3 px #ff6a2b, 10 px offset</td><td>page #0f1416: <b>6.49:1</b></td><td>page #0f1416: <b>6.49:1</b></td><td>Pass on both sides.</td></tr>
</table><p>Verdict: B-134 fixed at f83f1a1 on both pages and both widths. Crops (focused, night):</p>
<a href="../screens/honeycomb/site/inv/v4/ring-night.jpg"><img src="../screens/honeycomb/site/inv/v4/ring-night.jpg" alt="Night focus rings on default, outline and poster buttons at f83f1a1"></a>"""

CRITIQUE = """<ol>
<li><b>P3 · One footer link still behaves differently</b> (FT04): the GitHub cell opens in the same tab while the critter and Qloo open new tabs; in a three-link cluster, the mixed behaviour is the only thing left from the footer round (B-159).</li>
<li><b>P3 · Navigation waits on the merge</b> (H03, N02, H07): three items, no Repertoire and no plan end slot; held by DEV, so the chrome reads complete but the deck's fourth item and Share are absent.</li>
<li><b>P3 · Small size drift</b> (H03, FT06): header items are 48 px tall (deck 40), the critter 20 px (deck 18). Both are improvements for touch and legibility, not defects.</li>
<li><b>Fixed and now solid</b> (H02, H08, N06, FT02, FT03, FT05, FT06): the lockup, the 721 switch, the tile fade, the home-linked footer logo, the mid-dots and the agreed Built by line all match.</li>
</ol>"""

AUDIT = """<table><tr><th>Check</th><th>Result</th></tr>
<tr><td>axe (WCAG 2.0/2.1 A–AA, 2.2 AA) at 390 and 1440, day and night, on /, /busks, /week?example=acoustic, /brain, /brand, /p/…, 404, /terms, /privacy and /tips (404) (40 runs)</td><td>Clean: 0 violations</td></tr>
<tr><td>Sideways scroll at 390, 768, 1440, day and night (60 page loads), and at 721 (9 routes)</td><td>None</td></tr>
<tr><td>Landmarks</td><td>One banner header, one visible nav “Main” at each width, footer nav “Site”, one footer; skip link to #main on every route</td></tr>
<tr><td>Heading outline</td><td>The chrome adds no headings (correct). /terms: h1 “What Busk Map promises”; /privacy: h1 “What Busk Map keeps”</td></tr>
<tr><td>Focus visible (2.4.7)</td><td>One ring on every chrome stop (H06, N05, FT08)</td></tr>
<tr><td>Focus contrast at night (1.4.11)</td><td>Default and outline rings 5.78:1 on both sides (/busks); paper ring 12.0–12.4:1 (/); poster 6.49:1 (ring section). B-134 fixed</td></tr>
<tr><td>Target size (2.5.8)</td><td>Header items 48 px tall; bottom-nav items ≥ 48 × 64; footer links, home lockup, GitHub cell and critter 48 px; Qloo link 44 × 15 (passes by spacing)</td></tr>
<tr><td>Accessible names</td><td>Home links “Busk Map home” (header and footer); Qloo “Qloo (opens qloo.com in a new tab)”; GitHub “Busk Map on GitHub”; “T04435”; critter “Built with Claude Code (opens in a new tab)”</td></tr>
<tr><td>Breakpoint</td><td>Bottom bar up to 720, header nav from 721 (B-129 fixed)</td></tr>
<tr><td>Reduced motion</td><td>Footer: nothing moves. Bottom-nav tile: 200 ms fade, none with reduce (N06)</td></tr>
<tr><td>Tips residue</td><td>None in the chrome; /tips is a 404</td></tr></table>"""

BRAND = """<table><tr><th>BRAND's issue</th><th>Result</th><th>Evidence at f83f1a1</th></tr>
<tr><td>The nav says “Setlist” anywhere</td><td>Not reproduced</td><td>Busks · Week · Brain in both navs on 10 routes, 390/768/1440, day and night.</td></tr>
<tr><td>No nav item current on /brain</td><td>Not reproduced</td><td>Brain is current on /brain at 390 (bottom bar), 768 and 1440 (header).</td></tr>
<tr><td>No footer on /brain</td><td>Not reproduced</td><td>One footer on /brain at every width, the new one.</td></tr>
<tr><td>Plan pages never switch to the bottom nav at phone width</td><td>Not reproduced</td><td>The folk-duo plan at 390: bottom bar with Busks current, header lockup only.</td></tr></table>"""

NEW = """<p>New from the DS-parity rule (same commit f83f1a1):</p><ol>
<li><b>B-215 · Low · H02 · DS AppHeader</b>: the header lockup is 36 px tall (drawn 171×30) against DS AppHeader's ≈24 px lockup (drawn 146×23).</li>
<li><b>B-216 · Low · FT02 · DS SiteFooter</b>: the footer lockup is 34 px tall against DS SiteFooter's ≈24 px (inventory spec 22 px).</li>
<li><b>B-217 · Low · H04 · DS AppHeader</b>: header nav items are 48 px tall (h-tap) against DS AppHeader's 40 px; the current item's orange fill nearly fills the bar instead of sitting with 10 px of bluestone above and below.</li></ol>
<p>Glyph rule (B-162): no text glyph is used as an icon in the header, bottom nav or footer; the footer's aria-hidden “·” separators are the DS SiteFooter spec. No row cites B-162.</p>
<p>Stale DS specimens (for BRAND, not build defects): DS Logo's lockup specimen still draws the RETIRED lettering (tall M), which F12 retired; DS SiteFooter is the pre-F07 footer; DS AppHeader and MobileNav default to Setlist and Tips and a “Melbourne · live data” badge. A 1:1 port of these specimens would undo F07–F12, the Tips removal and F20.</p>
<p>Earlier defects:</p><ul>
<li><b>Fixed at f83f1a1</b>: B-129 (switch at 721), B-132 (tile fade), B-133 (home link name), B-134 (night rings), B-135 (P offset), B-157 (footer lockup links home), B-158 (mid-dots, nav “Site”), B-160 (critter to claude.com/claude-code; “Built by” plain), B-161 (BRAND's critter path).</li>
<li><b>Partly fixed</b>: B-159 · Low · FT04: the critter now opens in a new tab; the GitHub cell still opens in the same tab without “(opens in a new tab)”. (“T04435” opens in the same tab, which the agreed F08 allows.)</li>
<li><b>Held by DEV</b>: B-130 (Repertoire, with the merge: H03, N02), B-131 (plan end slot: H07).</li></ul>"""

EXTRA = ('<p>Build only, for context: <a href="../screens/honeycomb/site/inv/v4/FT01b-1440.jpg">landing footer (night ground)</a> · '
         '<a href="../screens/honeycomb/site/inv/v4/switch-720.jpg">/busks at 720</a> · <a href="../screens/honeycomb/site/inv/v4/switch-721.jpg">/busks at 721</a> · '
         '<a href="../screens/honeycomb/site/inv/v4/terms-1440.jpg">/terms at 1440</a> · <a href="../screens/honeycomb/site/inv/v4/terms-390.jpg">/terms at 390</a> · '
         '<a href="../screens/honeycomb/site/inv/v4/privacy-1440.jpg">/privacy at 1440</a> · <a href="../screens/honeycomb/site/inv/v4/privacy-390.jpg">/privacy at 390</a> · '
         '<a href="../screens/honeycomb/site/inv/v4/H07-1440.jpg">plan header at 1440</a> · '
         '<a href="../screens/honeycomb/site/inv/v4/N05b-390.jpg">bottom-nav focus on the current item</a>. v3 images stay under <code>inv/v3/</code>, v2 under <code>inv/build/</code>.</p>')

SECTIONS = [
    ("fields", "Field strip and focus (F13–F15)", FIELDS),
    ("checks", "Site checks (qa/tools/site-checks.mjs) at f83f1a1", CHECKS),
    ("ring", "Night focus rings, re-measured (WCAG 1.4.11, B-134)", RING),
    ("critique", "Impeccable critique", CRITIQUE),
    ("audit", "Impeccable audit", AUDIT),
    ("brand", "BRAND's build issues (chrome)", BRAND),
    ("new", "Defects", NEW),
    ("extra", "More build shots", EXTRA),
]

# Impeccable critique and audit: generated from the skill's own outputs in qa/impeccable/ (see impeccable_sections.py).
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from impeccable_sections import impeccable as _imp
from impeccable_synthesis import SYN as _SYN
_i = next(i for i, s in enumerate(SECTIONS) if s[0] == "critique")
SECTIONS = [s for s in SECTIONS if s[0] not in ("critique", "audit")]
SECTIONS[_i:_i] = _imp("site", _SYN["site"])

CHANGES = CHANGES + " The impeccable critique and audit were run for real this round (skill v4.4.0, dual-agent, at f83f1a1, 390/768/1440; provenance at the top of both sections), replacing v3's hand-written sections. New from impeccable, verified by QA: B-218 and B-219 (both High, site-wide), B-231 to B-234."
READY = ("Not ready", "Two High defects reach the chrome: B-218 (in the day OS scheme the focus ring in pinned-dark chrome is 1.08:1, landing footer and /brain) and B-219 (blank scroll after the footer on plans at 390 and 768). Otherwise the chrome is ready with notes: F12 lockup met, nav switch exact at 720/721, footer as agreed (F08); DS AppHeader and SiteFooter sizes differ (B-215 to B-217); B-231 to B-234 are Low.")
