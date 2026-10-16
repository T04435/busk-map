# Site-wide · review: header (H), bottom nav (N) and footer (FT) on every route, by BRAND's chrome inventory (29 parts).
# Data for qa/tools/page-review.py.
TITLE = "Site-wide · review"
ROUTE = "every page (/, /busks, /week, /brain, /tips, /brand, /p/…, 404)"
VERSION = "v2"
COMMIT = "7b1521e"
DATE = "17 Oct 2026"
IMG = "honeycomb/site/inv/"
CHANGES = ("BRAND's chrome inventory replaces the 11 provisional rows: 29 parts (H01–H09 header, N01–N09 bottom nav, FT01–FT11 footer), "
           "checked on 9 routes at 390, 768 and 1440, day and night; site checks F07–F12; axe; BRAND's four chrome issues. Logo rows judged by the user's corrected F12 (the lockup with the new lettering).")
HISTORY = [
    (VERSION, COMMIT, DATE, CHANGES),
    ("v1", "7b1521e", "17 Oct 2026", "First version: header, phone nav, footer, logos, Qloo links, /terms, field focus on 8 routes (534 field states), the user's calls F07-F15."),
]
SOURCE_NOTE = ("Deck: BRAND's chrome inventory (DS component previews: AppHeader, MobileNav, SiteFooter, BuiltByMark); the user's calls F07–F15 override it. "
               "Build: QA's own export of 7b1521e, offline; crops from /busks (header, nav, footer), /tips (night, nav on a page) and the folk-duo plan /p/P2JaME9NH (end slot, sheet).")


def P(id, name, qa, note, user="", defect="—", dev="—", deck=True, b1440=True, b390=True, spec=None):
    p = {"id": id, "name": name, "qa": qa, "note": note, "user": user, "defect": defect, "dev": dev,
         "deck": f"deck/{id}.jpg" if deck is True else deck,
         "b1440": f"build/{id}-1440.jpg" if b1440 is True else b1440,
         "b390": f"build/{id}-390.jpg" if b390 is True else b390}
    if spec:
        p["spec"] = spec
        p["deck_empty"] = "Spec only (no crop)"
    return p


F12 = "F12 (corrected 17 Oct): one logo, the lockup [hex mark][new stencil wordmark], in the header at every width and in the footer; only the OLD wordmark lettering (larger M, another font) is retired. Wordmark-only or mark-only in the header or footer fails."
F1315 = "F13–F15: one focus ring, shadcn's own pattern; no global CSS over the primitives' states."
PARTS = [
 # Header
 P("H01", "AppHeader", "Present", "64 px bluestone bar (#141c21) with paper text and a 4 px orange bottom rule, logo left, nav after it; same in both themes on all 9 routes. The logo is H02's issue and the switch width H08's."),
 P("H02", "Wordmark (home)", "Different", "The home link holds the lockup (hex mark + wordmark, SVG viewBox 2 0 256 48) at 1440, 768 and 390: the right structure. But the lettering is the OLD wordmark: the M is taller than the other letters and “ap” is set smaller, in a different face from the user's reference (04-wordmark-only-one.png: even stencil caps “BUSK MAP” with the orange offset). 4× render: build/logo-header-x4.jpg. Accessible name “Busk Map” (from the SVG title), not “Busk Map home”. The deck crop (wordmark alone) is overridden by the corrected F12.", F12, "B-133", dev="a68440d (later): switched to wordmark-only, which also fails the corrected F12; not rechecked"),
 P("H03", "Nav items", "Different", "nav “Main”: Busks · Week · Brain · Tips, icon + mono uppercase label, #a7b0b5, real links. Brain in place of Setlist (HQ default 2) as specced, but no Repertoire: /repertoire is 404 on design/honeycomb. Items are 48 px tall (h-tap; spec 40 px). At 390 the header shows the logo alone (H08).", "Build: Busks · Repertoire · Week · Brain · Tips (Repertoire iteration).", "B-130", b390="build/H08-390.jpg"),
 P("H04", "Current page", "Present", "aria-current=\"page\" with an orange fill and bluestone text/icon: Busks on /busks and /p/…, Week on /week, Brain on /brain, Tips on /tips; none on /, /brand and 404. Same at 768.", b390=None),
 P("H05", "Item at rest", "Present", "Muted #a7b0b5 icon and label, no fill; hover lifts to #232d33 with paper text.", b390=None),
 P("H06", "Keyboard focus", "Different", "The header draws its own focus: box-shadow 0 0 0 2px #141c21, 0 0 0 4px #f2ede4 (two layers). On the orange current item it reads as a dark gap plus a paper ring; on a resting item the gap vanishes into the bar. Second item at rest: build/H06b-1440.jpg.", F1315, b390=None),
 P("H07", "End slot", "Missing", "The header has no end slot on the plan (/p/P2JaME9NH at 1440): no “Live data” badge and no “Share” button. The plan shows “Copy link” and its data chips (“Qloo test data (local mock)” …) in the page header instead.", "", "B-131", b390=None),
 P("H08", "Up to 720px", "Different", "The nav hides and the bottom nav takes over, header keeps the logo alone, and the lockup stays at 390 (right by the corrected F12; old lettering, see H02), but the switch is at 768 px (md), not 721: at 721, 740 and 767 px the header has no nav and the bottom nav shows. Build · 1440 column: the header at 768.", F12, "B-129", b1440="build/H01-768.jpg", dev="a68440d (later): switched to wordmark-only, which also fails the corrected F12; not rechecked"),
 P("H09", "Night theme", "Present", "Bluestone in both themes; only the rule's orange follows the night token (#ff6a2b)."),
 # Bottom nav
 P("N01", "MobileNav", "Present", "Fixed to the bottom (z 40), 64 px plus the safe-area inset, card ground (#fbf9f5) with a 2 px rule on top; four equal columns, each at least 48 px. Body pads by the bar's height. Shows up to 767 px, not 720 (B-129). Hidden at 768 and 1440.", "", "B-129", b1440=None),
 P("N02", "Nav items", "Different", "48×30 icon tile with a 22 px icon over a mono 11 px uppercase muted label: Busks · Week · Brain · Tips. No Repertoire (route absent on this branch); the build keeps the README's “four items, never five”.", "Build: Busks · Repertoire · Week · Brain · Tips; four vs five is BRAND's open conflict.", "B-130", b1440=None),
 P("N03", "Current page", "Present", "aria-current=\"page\": label in foreground, orange tile with a 2 px bluestone inset rule by day, no rule at night (border transparent).", b1440=None),
 P("N04", "Item at rest", "Present", "Muted icon and label, no tile fill.", b1440=None),
 P("N05", "Keyboard focus", "Different", "The items have no focus style of their own, so the global :focus-visible { box-shadow: var(--focus-ring) } (globals.css:352–355) draws a 2 px paper gap plus a 2 px bluestone ring around the whole item: two layers.", F1315, b1440=None),
 P("N06", "Current tile", "Missing", "The tile has no transition (computed transition: all 0s): the orange fill appears instantly when the current item changes. Nothing to switch off for reduced motion.", "", "B-132", b1440=None, b390=None),
 P("N07", "On a page (390)", "Present", "/tips at 390: the bar sits at the bottom, full width, Tips current, below the content.", b1440=None),
 P("N08", "Hidden", "Present", "The only sheet in the build is the plan's pitch sheet; at 390 it opens full screen (z 50) over the bar, and Radix sets aria-hidden on the bar. The agent-working screen was not checked (it needs a live model run).", deck=None, b1440=None,
   spec="Hide it while a bottom Sheet is open and on the agent-working screen (README). Not drawn."),
 P("N09", "Night theme", "Present", "Card #182025, paper rule on top, muted labels; the current tile is orange without the inset rule.", b1440=None),
 # Footer
 P("FT01", "SiteFooter", "Different", "Still the old footer on every route: lockup · “Taste data by Qloo · MIT licence” · “OPEN SOURCE github.com/T04435/busk-map” · “Built by T04435 (solo), with Claude, during the Qloo Agentic Hackathon”, then the legal line on its own row; flex-wrap with space-between, not three groups on a 1fr · auto · 1fr grid. On / it is still the dark band (build/FT01b-1440.jpg).", "F11: left wordmark + Qloo logo, centre Privacy · Brain · Brand, right GitHub + Built by."),
 P("FT02", "Left: wordmark and Qloo", "Different", "Lockup (hex mark + wordmark, viewBox 2 0 256 48) at 28 px: the right structure by the corrected F12, but with the OLD lettering (taller M, smaller “ap”; 4× render build/logo-footer-x4.jpg). “Taste data by Qloo · MIT licence”, not “with Qloo”; Qloo's wordmark sits in “Taste data by Qloo · MIT licence” (build/FT02b-1440.jpg) and is not a link on any route (site checks: “NO LINK” on all 9).", "F12 (corrected): the lockup with the new stencil lettering. F09: every Qloo logo links to qloo.com in a new tab, rel=\"noopener noreferrer\".", dev="a68440d (later): switched to wordmark-only, which also fails the corrected F12; not rechecked"),
 P("FT03", "Centre: site links", "Missing", "No “Site” nav: no Privacy, Terms, Brain or Brand links in the footer. /privacy and /terms are both 404.", "F11: Privacy · Brain · Brand in the centre (Terms added for F10).", b1440=None, b390=None),
 P("FT04", "Right: GitHub in a honeycomb cell", "Missing", "A text link “github.com/T04435/busk-map” after “OPEN SOURCE”, same tab; no hex cell, no GitHub icon, no new tab or label.", "F07: a GitHub icon in a honeycomb cell, linked."),
 P("FT05", "Right: Built by T04435", "Different", "“Built by T04435 (solo), with Claude, during the Qloo Agentic Hackathon”: T04435 links to github.com/T04435 (same tab, no target); the rest is plain text and there is no critter link to claude.com/claude-code.", "F08: “Built by T04435” plus the pixel mark, each linked."),
 P("FT06", "BuiltByMark", "Missing", "No pixel critter anywhere in the footer (or the app).", "F08: an SVG of the Claude Code critter, not the Claude logo.", b1440=None, b390=None),
 P("FT07", "Legal line on /terms", "Missing", "/terms is 404; “Busk Map never confirms a pitch is legal: check your permit conditions.” is still in every footer (site checks F10: fail on all routes).", "F10: the legal line moves to /terms, linked from the footer.", deck=None, b1440=None, b390=None,
   spec="F10: the legal line leaves the footer and lives on /terms, which the footer links. No board draws /terms yet."),
 P("FT08", "Link focus", "Different", "Footer links take the global ring: 2 px paper gap + 2 px bluestone (two layers), so each link shows a box inside a box.", F1315, b390=None),
 P("FT09", "Up to 720px", "Different", "At 390 the groups stack in one left-aligned column (lockup, Taste data line, Open source + Built by, legal line), but with the old content (FT01–FT07).", "F11", b1440=None),
 P("FT10", "Night theme", "Different", "Night tokens work: bluestone ground, paper lockup and text, orange repo link. The content is the old footer and there is no clay critter to keep.", "F07–F11"),
 P("FT11", "Reduced motion", "Present", "Nothing in the footer animates or transitions (0 animations, 0 non-zero transitions), with and without prefers-reduced-motion.", deck=None, b1440=None, b390=None,
   spec="Nothing in the footer moves."),
]

counts = """<table><tr><th>Route</th><th>Field states</th><th>Fail</th></tr>
<tr><td>/busks</td><td>76</td><td>76</td></tr><tr><td>/tips</td><td>40</td><td>40</td></tr><tr><td>/week</td><td>124</td><td>124</td></tr>
<tr><td>/</td><td>28</td><td>24</td></tr><tr><td>/brain</td><td>152</td><td>152</td></tr><tr><td>/p/… (plan)</td><td>60</td><td>44</td></tr>
<tr><td>/brand</td><td>46</td><td>46</td></tr><tr><td>404</td><td>8</td><td>8</td></tr><tr><th>Total</th><th>534</th><th>514</th></tr></table>"""
FIELDS = ("<p>The chrome has no form fields; the field strips live in each page's report. Site-wide at 7b1521e: <b>514 of 534 field states fail</b> "
          "(each field × day/night × 390/1440): every focused field shows two ring layers, from globals.css:352–355 (<code>:focus-visible { box-shadow: var(--focus-ring) }</code>) "
          "with <code>--focus-ring</code> at globals.css:200–214 being two shadows (2 px gap + 2 px ring). The 404 page's strip (its two buttons, 0 of 2 pass):</p>"
          '<a href="../screens/honeycomb/site/inv/field-strip.jpg"><img src="../screens/honeycomb/site/inv/field-strip.jpg" alt="404 field strip"></a>'
          + counts +
          "<p>Chrome focus, the same pattern on nav items and links (H06, N05, FT08): header item current and at rest (its own 2-layer shadow), bottom-nav item and footer link (the global ring):</p>"
          '<a href="../screens/honeycomb/site/inv/chrome-focus.jpg"><img src="../screens/honeycomb/site/inv/chrome-focus.jpg" alt="Focus on header, bottom nav and footer"></a>')

CHECKS = """<p><code>node qa/tools/site-checks.mjs &lt;export&gt; 3237</code> at 7b1521e (routes /, /busks, /week, /brain, /tips, /brand, /terms, /plan, 404):</p><table>
<tr><th>Call</th><th>Result</th><th>Evidence</th></tr>
<tr><td>F07 GitHub icon in a hex cell</td><td>Fail</td><td>Text link “github.com/T04435/busk-map”, no SVG.</td></tr>
<tr><td>F08 Built by + pixel mark, each linked</td><td>Fail</td><td>Only “T04435” is a link; no mark.</td></tr>
<tr><td>F09 Qloo logos link to qloo.com, new tab, noopener</td><td>Fail on all 9 routes</td><td>Every Qloo logo: “NO LINK” (3 on /, 2 on /brain).</td></tr>
<tr><td>F10 /terms holds the legal line; footer links it</td><td>Fail</td><td>/terms 404; the legal line in every footer; no /terms link.</td></tr>
<tr><td>F11 layout</td><td>Fail</td><td>No Privacy · Brain · Brand group; repo link in the centre third.</td></tr>
<tr><td>F12 one logo (corrected rule: the lockup in header and footer)</td><td>Lockup in header/footer: pass. One design: fail. Lettering: fail</td><td>Updated checks: “16 placements, all lockup” (viewBox 2 0 256 48) in the header and footer; one-design check fails: lockup + mark-only (0 0 48 48, a 44 px mark in the brand section of /). The lettering is the old one (the M rises above the other letters, “ap” smaller), not the reference's even stencil caps (zoomed crops build/logo-header-x4.jpg, logo-footer-x4.jpg).</td></tr>
<tr><td>F13–F15 one border, one ring</td><td>Fail</td><td>514 of 534 field states; header, bottom-nav and footer focus are two layers too (H06, N05, FT08).</td></tr></table>"""

CRITIQUE = """<ol>
<li><b>P1 · The footer is the old one everywhere</b> (FT01–FT07, FT09, FT10): the user's whole F07–F11 layout is unbuilt: no Site links, no GitHub cell, no critter, the legal line still in fine print, /terms and /privacy 404. One component change fixes eight rows.</li>
<li><b>P1 · Focus is drawn twice in the chrome too</b> (H06, N05, FT08): the header's own two-layer shadow and the global ring give a gap-plus-ring on every nav item and link, the pattern F14 calls “two borders”.</li>
<li><b>P2 · The logo still has the old lettering</b> (H02, H08, FT02): the lockup is in the right places (header at every width, footer), but its wordmark is the retired one with the oversized M, not the even stencil caps of the user's reference; and / still shows a mark-only logo, a second design (site checks F12).</li>
<li><b>P2 · Qloo's logo is a dead image</b> (FT02): on every route, where the user expects a link to qloo.com (F09).</li>
<li><b>P3 · Navigation gaps</b>: no Repertoire item (H03, N02, B-130), the switch at 768 not 721 (H08, B-129), no header end slot on plans (H07, B-131), and the current tile snaps without its fade (N06, B-132).</li>
</ol>"""

AUDIT = """<table><tr><th>Check</th><th>Result</th></tr>
<tr><td>axe (WCAG 2.0/2.1 A–AA, 2.2 AA) at 390 and 1440, day and night, on /, /busks, /week, /brain, /tips, /brand, /p/…, 404 and /terms (36 runs)</td><td>Clean: 0 violations</td></tr>
<tr><td>Sideways scroll at 390, 768, 1440, day and night (54 page loads)</td><td>None</td></tr>
<tr><td>Landmarks</td><td>One banner header, one visible nav “Main” at each width (header from 768, bottom bar below), one footer; skip link to #main on every route</td></tr>
<tr><td>Heading outline</td><td>The chrome adds no headings (correct)</td></tr>
<tr><td>Focus visible (2.4.7)</td><td>Present on every chrome stop, but two layers (H06, N05, FT08)</td></tr>
<tr><td>Target size (2.5.8)</td><td>Header items 48 px tall; bottom-nav items ≥ 48 × 64; footer text links inline (exempt)</td></tr>
<tr><td>Accessible names</td><td>Home link “Busk Map” (spec: “Busk Map home”, B-133); Qloo logos are images with no link</td></tr>
<tr><td>Breakpoint</td><td>Header nav from 768, bottom bar up to 767 (spec 721 / 720, B-129)</td></tr>
<tr><td>Reduced motion</td><td>Footer: nothing moves. Bottom nav: no transition at all (N06)</td></tr></table>"""

BRAND = """<table><tr><th>BRAND's issue</th><th>Result</th><th>Evidence</th></tr>
<tr><td>The nav says “Setlist” anywhere</td><td>Not reproduced</td><td>Header and bottom nav read Busks · Week · Brain · Tips on all 9 routes, 390/768/1440, day and night; no “Setlist” in any nav. (The boards and DS previews still say Setlist.)</td></tr>
<tr><td>No nav item current on /brain</td><td>Not reproduced</td><td>Brain has aria-current="page" and the orange fill on /brain at 390 (bottom bar), 768 and 1440 (header). The Brain board passes none; the build is right.</td></tr>
<tr><td>No footer on /brain</td><td>Not reproduced</td><td>The footer renders on /brain at every width (1440: at 2181 px of 2290; <a href="../screens/honeycomb/site/inv/build/brain-bottom-1440.jpg">screenshot</a>). It is the old footer (FT01).</td></tr>
<tr><td>Plan pages never switch to the bottom nav at phone width</td><td>Not reproduced</td><td>/p/P2JaME9NH at 390: header logo only, bottom bar with Busks current (<a href="../screens/honeycomb/site/inv/build/plan-390.jpg">screenshot</a>); same as every route.</td></tr></table>"""

NEW = """<ol>
<li><b>B-129 · Low · H08/N01</b>: the header nav and bottom bar switch at 768 px (md), not 721/720: from 721 to 767 px the header has no nav and the bottom bar shows.</li>
<li><b>B-130 · Low · H03/N02</b>: no Repertoire item in either nav; /repertoire is 404 on design/honeycomb.</li>
<li><b>B-131 · Low · H07</b>: the plan's header has no end slot (no “Live data” badge, no “Share”); the plan uses “Copy link” and data chips in its page header.</li>
<li><b>B-132 · Low · N06</b>: the bottom-nav current tile has no fade (transition none, spec 200 ms ease-out).</li>
<li><b>B-133 · Low · H02</b>: the home link's accessible name is “Busk Map”, not “Busk Map home”.</li></ol>"""

EXTRA = ('<p>Build only, for context: <a href="../screens/honeycomb/site/inv/build/FT01b-1440.jpg">landing footer (dark band)</a> · '
         '<a href="../screens/honeycomb/site/inv/build/plan-top-1440.jpg">plan header at 1440</a> · '
         '<a href="../screens/honeycomb/site/inv/build/N08-390.jpg">pitch sheet over the bar at 390</a> · '
         '<a href="../screens/honeycomb/site/inv/build/N05b-390.jpg">bottom-nav focus on Busks</a> · '
         '<a href="../screens/honeycomb/site/inv/build/brain-top-1440.jpg">/brain top at 1440</a>. v1 images stay under <code>qa/screens/honeycomb/site/</code>.</p>')

SECTIONS = [
    ("fields", "Field strip and focus (F13–F15)", FIELDS),
    ("checks", "Site checks (qa/tools/site-checks.mjs) at 7b1521e", CHECKS),
    ("critique", "Impeccable critique", CRITIQUE),
    ("audit", "Impeccable audit", AUDIT),
    ("brand", "BRAND's build issues (chrome)", BRAND),
    ("new", "New defects (placeholders for QA to file)", NEW),
    ("extra", "More build shots", EXTRA),
]
