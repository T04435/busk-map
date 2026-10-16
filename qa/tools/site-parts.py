# Site-wide · review: header (H), bottom nav (N) and footer (FT) on every route, by BRAND's chrome inventory (29 parts).
# Data for qa/tools/page-review.py.
TITLE = "Site-wide · review"
ROUTE = "every page (/, /busks, /week, /brain, /tips, /brand, /p/…, /terms, /privacy, 404)"
VERSION = "v3"
COMMIT = "8207373"
DATE = "17 Oct 2026"
IMG = "honeycomb/site/inv/"
CHANGES = ("Recheck at 8207373 (DEV closed the F round). The new footer is in: FT01, FT07, FT08, FT09, FT10 now Present (F07–F11: three parts, /terms holds the legal line, /privacy exists, Qloo links to qloo.com in a new tab with noopener); "
           "FT02–FT06 Different (logo not a home link, no mid-dots, GitHub/Built by/critter open in the same tab, the critter links to GitHub not claude.com/claude-code, the critter is an approximation). "
           "H02/H08/FT02 logo: the lockup with the NEW stencil lettering everywhere (F12 met; the P's orange offset is clipped by the file's box, B-135). "
           "H06, N05 now Present: one 2 px ring (F13–F15). Still open: B-129, B-130, B-131, B-132, B-133. "
           "New section: the default and outline buttons' focus ring at night against WCAG 1.4.11 (DEV's open item). site-checks 24/24; axe 40 runs clean.")
HISTORY = [
    (VERSION, COMMIT, DATE, CHANGES),
    ("v2", "7b1521e", "17 Oct 2026", "BRAND's chrome inventory replaces the 11 provisional rows: 29 parts (H01–H09 header, N01–N09 bottom nav, FT01–FT11 footer), "
     "checked on 9 routes at 390, 768 and 1440, day and night; site checks F07–F12; axe; BRAND's four chrome issues. Logo rows judged by the user's corrected F12 (the lockup with the new lettering)."),
    ("v1", "7b1521e", "17 Oct 2026", "First version: header, phone nav, footer, logos, Qloo links, /terms, field focus on 8 routes (534 field states), the user's calls F07-F15."),
]
SOURCE_NOTE = ("Deck: BRAND's chrome inventory (DS component previews: AppHeader, MobileNav, SiteFooter, BuiltByMark); the user's calls F07–F15 override it. "
               "Build: QA's own export of 8207373, offline; crops from /busks (header, nav, footer, focus), /tips (night, nav on a page), /terms and the folk-duo plan (end slot). "
               "This side-by-side is the chrome crop comparison DEV lists as not done. v3 build images live under inv/v3/; v2 images stay under inv/build/.")


def P(id, name, qa, note, user="", defect="—", dev="—", deck=True, b1440=True, b390=True, spec=None):
    p = {"id": id, "name": name, "qa": qa, "note": note, "user": user, "defect": defect, "dev": dev,
         "deck": f"deck/{id}.jpg" if deck is True else deck,
         "b1440": f"v3/{id}-1440.jpg" if b1440 is True else b1440,
         "b390": f"v3/{id}-390.jpg" if b390 is True else b390}
    if spec:
        p["spec"] = spec
        p["deck_empty"] = "Spec only (no crop)"
    return p


F12 = "F12 (corrected 17 Oct): one logo, the lockup [hex mark][new stencil wordmark], in the header at every width and in the footer; the OLD lettering (larger M, another font) is retired. Wordmark-only or mark-only in the header or footer fails."
F1315 = "F13–F15: one focus ring, shadcn's own pattern; no global CSS over the primitives' states."
FALLBACK = "Declared deviation: a scoped one-ring focus fallback for plain links and buttons (asking BRAND)."
PARTS = [
 # Header
 P("H01", "AppHeader", "Present", "64 px bluestone bar (#141c21), paper text, 4 px orange bottom rule; lockup left, nav after it; same in both themes on all 10 routes. No end slot (H07)."),
 P("H02", "Wordmark (home)", "Different", "The home link holds the design system's lockup file as an image (/brand/busk-map-lockup-dark.svg, 176×36): hex mark + the NEW stencil “BUSK MAP”, even caps with the orange offset, matching the user's reference (04-wordmark-only-one.png; 4× render v3/logo-header-x4.jpg). F12 met. Two gaps: the link has no aria-label, so its name is the image's alt “Busk Map”, not “Busk Map home”; and the file's wordmark box (viewBox 322 wide) cuts the orange offset off the right side of the P (the paths reach 325), which the reference shows (B-135).", F12, "B-133; B-135",
   dev="8207373: the Logo is the design system's lockup files as images (header 36 px)"),
 P("H03", "Nav items", "Different", "nav “Main”: Busks · Week · Brain · Tips, icon + mono uppercase label, #a7b0b5, real links, 48 px tall (h-tap; spec 40 px). No Repertoire: /repertoire is not a route on design/honeycomb. Unchanged since v2.", "Build: Busks · Repertoire · Week · Brain · Tips (Repertoire iteration).", "B-130", b390="v3/H08-390.jpg"),
 P("H04", "Current page", "Present", "aria-current=\"page\" with the orange fill and bluestone text/icon: Busks on /busks and /p/…, Week on /week, Brain on /brain, Tips on /tips; none on /, /brand, /terms, /privacy and 404. Same at 768.", b390=None),
 P("H05", "Item at rest", "Present", "Muted #a7b0b5 icon and label, no fill; hover #232d33 with paper text.", b390=None),
 P("H06", "Keyboard focus", "Present", "One ring now: focus-visible:ring-2 in paper (#f2ede4), a single 2 px box-shadow, no gap layer. It shows on the orange current item (paper on orange), on items at rest (paper on bluestone) and on the home link. Item at rest: v3/H06b-1440.jpg; home link: v3/H06c-1440.jpg.", F1315, "—", b390=None,
   dev="Header items carry their own ring-2 classes (not the global fallback)"),
 P("H07", "End slot", "Missing", "The header still has only the home link and the nav (children A, NAV) on the plan at 1440: no “Live data” badge and no “Share” button. The plan keeps “Copy link” and its data chips in the page header.", "", "B-131", b390=None),
 P("H08", "Up to 720px", "Different", "Below the switch the nav hides, the bottom nav takes over and the header keeps the lockup alone, with the new lettering (F12 met). The switch is still at 768 px: at 720, 721, 740 and 767 the bottom bar shows; at 768 the header nav. Build · 1440 column: the header at 768.", F12, "B-129; B-135", b1440="v3/H01-768.jpg"),
 P("H09", "Night theme", "Present", "Bluestone in both themes; only the rule's orange follows the night token (#ff6a2b)."),
 # Bottom nav
 P("N01", "MobileNav", "Present", "Fixed to the bottom (z 40), 64 px plus the safe-area inset, card ground with a 2 px rule on top, four equal columns ≥ 48 px. Shows up to 767 px, not 720 (B-129). Hidden at 768 and 1440. Source unchanged since v2.", "", "B-129", b1440=None),
 P("N02", "Nav items", "Different", "48×30 icon tile with a 22 px icon over a mono 11 px uppercase muted label: Busks · Week · Brain · Tips. No Repertoire (route absent on this branch).", "Build: Busks · Repertoire · Week · Brain · Tips; four vs five is BRAND's open conflict.", "B-130", b1440=None),
 P("N03", "Current page", "Present", "aria-current=\"page\": foreground label, orange tile with a 2 px bluestone inset rule by day, no rule at night.", b1440=None),
 P("N04", "Item at rest", "Present", "Muted icon and label, no tile fill.", b1440=None),
 P("N05", "Keyboard focus", "Present", "One ring now: the global fallback draws a single 2 px bluestone box-shadow (--focus-ring: 0 0 0 2px var(--ring)) around the whole item, at rest and on the current item (v3/N05b-390.jpg). No gap layer.", F1315, b1440=None, dev=FALLBACK),
 P("N06", "Current tile", "Missing", "The tile still has no transition (computed: all 0s); the orange fill appears instantly. Nothing to switch off for reduced motion.", "", "B-132", b1440=None, b390=None),
 P("N07", "On a page (390)", "Present", "/tips at 390: the bar at the bottom, full width, Tips current, below the content.", b1440=None),
 P("N08", "Hidden", "Present", "Carried from v2 (mobile-nav and sheet source unchanged at 8207373): the plan's pitch sheet opens full screen (z 50) over the bar at 390 and Radix sets aria-hidden on it. The agent-working screen needs a live model run: not checked.", deck=None, b1440=None, b390="build/N08-390.jpg",
   spec="Hide it while a bottom Sheet is open and on the agent-working screen (README). Not drawn."),
 P("N09", "Night theme", "Present", "Card #182025, paper rule on top, muted labels; the current tile orange without the inset rule.", b1440=None),
 # Footer
 P("FT01", "SiteFooter", "Present", "The new footer on every route: three parts on a 1fr · auto · 1fr grid (568 · 209 · 568 px at 1440; 232 · 209 · 232 at 768), 24 px padding, 1 px border on top, 13/20 muted text. On / it keeps the night ground (data-theme dark, under the closing band) with the same content (v3/FT01b-1440.jpg); on every other page it sits on paper. 768: v3/FT01-768.jpg.", "F11: left wordmark + Qloo logo, centre Privacy · Brain · Brand, right GitHub + Built by."),
 P("FT02", "Left: wordmark and Qloo", "Different", "Lockup at 34 px with the NEW lettering (F12 met; 4× render v3/logo-footer-x4.jpg; same P offset clip as H02), then “with” and Qloo's wordmark (44 px, currentColor letters, purple bar). Qloo is a link to https://qloo.com, target _blank, rel “noopener noreferrer”, named “Qloo (opens qloo.com in a new tab)” on all 10 routes (F09 met). Differs: the footer lockup is not a link home (spec: links home, “Busk Map home”); the Qloo link is 44×15 px (passes 2.5.8 by spacing only).", "F12 (corrected): the lockup with the new stencil lettering. F09: every Qloo logo links to qloo.com in a new tab, rel=\"noopener noreferrer\".", "B-135; B-157",
   dev="8207373: footer Logo 34 px, dark/light by theme"),
 P("FT03", "Centre: site links", "Different", "nav “Footer”: Privacy · Terms · Brain · Brand, bold underlined foreground links, each 48 px tall, centred. /privacy (“What Busk Map keeps”) and /terms (“What Busk Map promises”) are 200 pages. Differs from the crop: no mid-dot separators between the links, and the nav is labelled “Footer”, not “Site”.", "F11: Privacy · Brain · Brand in the centre (Terms added for F10).", "B-158"),
 P("FT04", "Right: GitHub in a honeycomb cell", "Different", "A 40 px outline hex cell with the GitHub mark, linking https://github.com/T04435/busk-map, named “Busk Map on GitHub” (F07 met). It opens in the same tab (no target), so the name has no “(opens in a new tab)” as the spec asks.", "F07: a GitHub icon in a honeycomb cell, linked.", "B-159"),
 P("FT05", "Right: Built by T04435", "Different", "“Built by T04435” is one bold underlined link to github.com/T04435 (spec: “Built by” plain, “T04435” the link), then the critter as a second link to the same github.com/T04435, named “T04435 on GitHub”. Spec: the critter links to https://claude.com/claude-code, named “with Claude Code (opens in a new tab)”; all links in a new tab. Same tab here.", "F08: “Built by T04435” plus the pixel mark, each linked.", "B-159; B-160"),
 P("FT06", "BuiltByMark", "Different", "A pixel critter is there, decorative (aria-hidden), 20 px tall, but it is DEV's approximation: a 17×10 grid of rects in #d77f5c with dark-filled eyes (#1d2125), not BRAND's built-by-mark path (170×112, #d97757, eye holes cut out). Close in silhouette at footer size.", "F08: an SVG of the Claude Code critter, not the Claude logo.", "B-161",
   dev="Replaced by BRAND's path in 865999d, after 8207373: not checked"),
 P("FT07", "Legal line on /terms", "Present", "/terms (200, “Terms · Busk Map”) opens with “Check your permit” and “Busk Map never confirms a pitch is legal: check your permit conditions.”, then data credits (new-tab links with noopener) and the licence. The line is gone from every footer; the footer links Terms (site checks F10: pass on 10 routes).", "F10: the legal line moves to /terms, linked from the footer.", deck=None,
   spec="F10: the legal line leaves the footer and lives on /terms, which the footer links. No board draws /terms yet."),
 P("FT08", "Link focus", "Present", "One ring: the global fallback, a single 2 px bluestone box-shadow, on the text links, the GitHub cell (square ring around the hex, v3/FT08b-1440.jpg) and the Qloo link (v3/FT08c-1440.jpg). No gap layer.", F1315, dev=FALLBACK),
 P("FT09", "Up to 720px", "Present", "At 390 the three parts stack in one left-aligned column in order: lockup + “with Qloo”, Privacy · Terms · Brain · Brand, GitHub cell + Built by + critter. No sideways scroll.", "F11", b1440=None),
 P("FT10", "Night theme", "Present", "Bluestone ground, paper lockup (dark file) and links, border #2e3a41; the critter stays clay.", "F07–F11"),
 P("FT11", "Reduced motion", "Present", "Nothing in the footer animates or transitions (0 animations, 0 non-zero transitions), with and without prefers-reduced-motion.", deck=None, b1440=None, b390=None,
   spec="Nothing in the footer moves."),
]

FIELDS = ("<p>The chrome has no form fields; each page's report carries its own strip. Site-wide at 8207373 (scratchpad fields8): <b>586 field states, 4 fail</b>: three are the disabled “DISABLED” specimen on /brand (exempt) and one is the plan's “≈612 people an hour est.” button at 390 (the plan report checks it). "
          "Was 514 of 534 failing at 7b1521e. The 404 page's strip (its two buttons, 2 of 2 pass):</p>"
          '<a href="../screens/honeycomb/site/inv/v3/field-strip.jpg"><img src="../screens/honeycomb/site/inv/v3/field-strip.jpg" alt="404 field strip at 8207373"></a>'
          "<p>Chrome focus at 8207373 (H06, N05, FT08): header home link, current item and item at rest (paper ring-2), bottom-nav item and current item, footer link, GitHub cell and Qloo link (the global one-ring fallback). One ring everywhere:</p>"
          '<a href="../screens/honeycomb/site/inv/v3/chrome-focus.jpg"><img src="../screens/honeycomb/site/inv/v3/chrome-focus.jpg" alt="Focus on header, bottom nav and footer"></a>')

CHECKS = """<p><code>node qa/tools/site-checks.mjs &lt;export&gt; 3248</code> at 8207373: <b>24 pass, 0 fail</b> (routes /, /busks, /week, /brain, /tips, /brand, /terms, /plan, 404), plus QA's own look:</p><table>
<tr><th>Call</th><th>Result</th><th>Evidence</th></tr>
<tr><td>F07 GitHub icon in a hex cell</td><td>Pass</td><td>Hex cell + GitHub mark, link to the repo, “Busk Map on GitHub” (same tab: B-159).</td></tr>
<tr><td>F08 Built by + pixel mark, each linked</td><td>Pass</td><td>“Built by T04435” and the critter are links (both to github.com/T04435: B-160; critter shape B-161).</td></tr>
<tr><td>F09 Qloo logos link to qloo.com, new tab, noopener</td><td>Pass on all routes</td><td>Every Qloo logo: https://qloo.com · _blank · noopener noreferrer (3 on /, 2 on /brain).</td></tr>
<tr><td>F10 /terms holds the legal line; footer links it</td><td>Pass</td><td>/terms 200 with the line; no legal line in any footer; Terms link in every footer. /privacy 200 too.</td></tr>
<tr><td>F11 layout</td><td>Pass</td><td>Left: lockup + Qloo; centre: Privacy · Terms · Brain · Brand; right: GitHub + Built by (1fr · auto · 1fr at 768 and 1440; stacked at 390).</td></tr>
<tr><td>F12 one logo, the lockup with the new lettering</td><td>Pass (lettering checked by eye)</td><td>16 placements, all the lockup files; no mark-only or wordmark-only outside /brand's specimens. The lettering at 4× (<a href="../screens/honeycomb/site/inv/v3/logo-header-x4.jpg">header</a>, <a href="../screens/honeycomb/site/inv/v3/logo-footer-x4.jpg">footer</a>) is the reference's even stencil caps with the orange offset; no tall M. One flaw in the file: the P's right-hand offset is clipped (B-135).</td></tr>
<tr><td>F13–F15 one ring</td><td>Pass in the chrome</td><td>Header ring-2 paper; bottom nav and footer the one-ring fallback (H06, N05, FT08). Field states 582 of 586 pass.</td></tr></table>"""

RING = """<p>DEV's open item: the default button's focus ring at night (dark scheme) against WCAG 1.4.11 (3:1 against adjacent colours). Measured from screen pixels on /busks and / at 390 and 1440, dark scheme, keyboard focus (:focus-visible true). / has no <code>default</code>-variant button, so its primary orange button is the <code>poster</code> CTA “PLAN A BUSK”.</p><table>
<tr><th>Button</th><th>Ring</th><th>vs button edge</th><th>vs ground beside it</th><th>Result</th></tr>
<tr><td>/busks 390 and 1440 · “PLAN MY BUSK” (default)</td><td>ring-2 #ff6a2b (2 px, no offset)</td><td>fill #ff6a2b (border transparent): <b>1.00:1</b></td><td>card #182025: <b>5.78:1</b></td><td>Fails the adjacent-colour reading: the ring is the fill colour, so focus reads as the button growing 2 px (at rest vs focused: the first two rows of the sheet). The 2 px band does change from #182025 to orange (5.78:1), so it passes a change-of-state measure.</td></tr>
<tr><td>/busks 390 and 1440 · “PLAN MY WEEK FROM THIS DATE” (outline)</td><td>ring-2 #ff6a2b</td><td>border #76828a: <b>1.38:1</b></td><td>card #182025: <b>5.78:1</b></td><td>Visible as an orange line outside the grey border; passes against the ground, not against the border it touches.</td></tr>
<tr><td>/ 390 and 1440 · “SHOW THE MAP” (outline)</td><td>ring-2 #ff6a2b</td><td>border #76828a: <b>1.38:1</b></td><td>map panel #222b2f–#242d31: <b>5.05:1 / 4.92:1</b></td><td>Same as above. (No 390 crop could be taken; colours sampled from the screen.)</td></tr>
<tr><td>/ 390 and 1440 · “PLAN A BUSK” (poster, primary orange)</td><td>outline 3 px #fd692b, 10 px offset</td><td>page #0f1416 in the gap: <b>6.49:1</b></td><td>page #0f1416: <b>6.49:1</b></td><td>Pass on both sides.</td></tr>
</table><p>By day the default ring is bluestone #141c21: 5.53:1 against the orange fill, 14.9:1 against the paper. Verdict: the night default ring is the open problem (B-134). Paper would not fix it (#f2ede4 on #ff6a2b is 2.45:1); a 2 px offset in the ground colour, as the poster does, would put a 5.78:1 edge on both sides of the ring.</p>
<a href="../screens/honeycomb/site/inv/v3/ring-night.jpg"><img src="../screens/honeycomb/site/inv/v3/ring-night.jpg" alt="Night focus rings on default, outline and poster buttons"></a>"""

CRITIQUE = """<ol>
<li><b>P2 · The footer's links are all same-tab and the critter points to the wrong place</b> (FT04, FT05): GitHub, “Built by T04435” and the critter open in the same tab, and the critter goes to github.com/T04435 instead of claude.com/claude-code. Two of the three right-hand links go to the same URL.</li>
<li><b>P2 · At night the primary button's focus is a bigger button, not a ring</b> (ring section, B-134): the ring is the fill colour. Outline buttons read fine but touch their border at 1.38:1.</li>
<li><b>P3 · The logo is right, but its file clips the P</b> (H02, H08, FT02): the new stencil lettering is in every place; only the P's right-hand orange offset is cut by the file's box (B-135).</li>
<li><b>P3 · Small footer drift from the crop</b> (FT02, FT03, FT06): the footer lockup is not a home link, no mid-dots between the centre links, and the critter is an approximation (replaced after this commit).</li>
<li><b>P3 · Navigation gaps unchanged</b>: no Repertoire (H03, N02, B-130), switch at 768 not 721 (H08, B-129), no header end slot on plans (H07, B-131), no tile fade (N06, B-132), home link named “Busk Map” (H02, B-133).</li>
</ol>"""

AUDIT = """<table><tr><th>Check</th><th>Result</th></tr>
<tr><td>axe (WCAG 2.0/2.1 A–AA, 2.2 AA) at 390 and 1440, day and night, on /, /busks, /week, /brain, /tips, /brand, /p/…, 404, /terms and /privacy (40 runs)</td><td>Clean: 0 violations</td></tr>
<tr><td>Sideways scroll at 390, 768, 1440, day and night (60 page loads)</td><td>None</td></tr>
<tr><td>Landmarks</td><td>One banner header, one visible nav “Main” at each width, footer nav “Footer”, one footer; skip link to #main on every route</td></tr>
<tr><td>Heading outline</td><td>The chrome adds no headings (correct). /terms: h1 “What Busk Map promises”, h2s Check your permit · Data credits · The code; /privacy: h1 + an h2 per item</td></tr>
<tr><td>Focus visible (2.4.7)</td><td>One ring on every chrome stop (H06, N05, FT08)</td></tr>
<tr><td>Focus contrast at night (1.4.11)</td><td>Default button ring vs fill 1.00:1, vs ground 5.78:1; outline ring vs border 1.38:1, vs ground 4.92–5.78:1; poster 6.49:1 (ring section)</td></tr>
<tr><td>Target size (2.5.8)</td><td>Header items 48 px tall; bottom-nav items ≥ 48 × 64; footer links 48 px tall; Qloo link 44 × 15 (passes by spacing)</td></tr>
<tr><td>Accessible names</td><td>Home link “Busk Map” (spec “Busk Map home”, B-133); Qloo “Qloo (opens qloo.com in a new tab)”; GitHub “Busk Map on GitHub”; critter “T04435 on GitHub”</td></tr>
<tr><td>Breakpoint</td><td>Header nav from 768, bottom bar up to 767 (spec 721 / 720, B-129)</td></tr>
<tr><td>Reduced motion</td><td>Footer: nothing moves. Bottom nav: no transition at all (N06)</td></tr></table>"""

BRAND = """<table><tr><th>BRAND's issue</th><th>Result</th><th>Evidence at 8207373</th></tr>
<tr><td>The nav says “Setlist” anywhere</td><td>Not reproduced</td><td>Busks · Week · Brain · Tips in both navs on 10 routes, 390/768/1440, day and night.</td></tr>
<tr><td>No nav item current on /brain</td><td>Not reproduced</td><td>Brain is current on /brain at 390 (bottom bar), 768 and 1440 (header).</td></tr>
<tr><td>No footer on /brain</td><td>Not reproduced</td><td>One footer on /brain at every width, the new one.</td></tr>
<tr><td>Plan pages never switch to the bottom nav at phone width</td><td>Not reproduced</td><td>The folk-duo plan at 390: bottom bar with Busks current, header lockup only.</td></tr></table>"""

NEW = """<p>Still open from v2: B-129 (switch at 768), B-130 (no Repertoire), B-131 (no plan end slot), B-132 (no tile fade), B-133 (home link name). New at 8207373:</p><ol>
<li><b>B-135 · Low · H02/H08/FT02</b>: the lockup files (/brand/busk-map-lockup-dark.svg and -light.svg) clip the orange offset off the right side of the P: the wordmark paths reach x 325 in a 322-wide viewBox; the user's reference shows the offset.</li>
<li><b>B-157 · Low · FT02</b>: the footer lockup is not a link home (spec: links /, named “Busk Map home”).</li>
<li><b>B-158 · Low · FT03</b>: no mid-dot separators between Privacy · Terms · Brain · Brand, and the nav is named “Footer”, not “Site”.</li>
<li><b>B-159 · Low · FT04/FT05</b>: GitHub, “Built by T04435” and the critter open in the same tab (no target, no rel, no “(opens in a new tab)” in the names); spec: new tab.</li>
<li><b>B-160 · Low · FT05</b>: the critter links to github.com/T04435 (“T04435 on GitHub”), not https://claude.com/claude-code (“with Claude Code (opens in a new tab)”); the whole “Built by T04435” is the link, not “T04435” alone.</li>
<li><b>B-161 · Low · FT06</b>: the critter is a 17×10 rect approximation (#d77f5c, dark-filled eyes), not BRAND's 170×112 path (#d97757, eye holes cut out). DEV replaced it in 865999d, after the commit under test.</li>
<li><b>B-134 · Low · ring section</b>: at night the default button's focus ring is the fill colour (#ff6a2b on #ff6a2b, 1.00:1), so focus shows only as the button growing 2 px; the outline button's ring touches its border at 1.38:1. Both pass against the ground (4.92–5.78:1).</li></ol>"""

EXTRA = ('<p>Build only, for context: <a href="../screens/honeycomb/site/inv/v3/FT01b-1440.jpg">landing footer (night ground)</a> · '
         '<a href="../screens/honeycomb/site/inv/v3/terms-1440.jpg">/terms at 1440</a> · <a href="../screens/honeycomb/site/inv/v3/terms-390.jpg">/terms at 390</a> · '
         '<a href="../screens/honeycomb/site/inv/v3/privacy-1440.jpg">/privacy at 1440</a> · <a href="../screens/honeycomb/site/inv/v3/privacy-390.jpg">/privacy at 390</a> · '
         '<a href="../screens/honeycomb/site/inv/v3/H07-1440.jpg">plan header at 1440</a> · '
         '<a href="../screens/honeycomb/site/inv/v3/N05b-390.jpg">bottom-nav focus on the current item</a>. v2 images stay under <code>qa/screens/honeycomb/site/inv/build/</code>.</p>')

SECTIONS = [
    ("fields", "Field strip and focus (F13–F15)", FIELDS),
    ("checks", "Site checks (qa/tools/site-checks.mjs) at 8207373", CHECKS),
    ("ring", "Default button focus ring at night (WCAG 1.4.11)", RING),
    ("critique", "Impeccable critique", CRITIQUE),
    ("audit", "Impeccable audit", AUDIT),
    ("brand", "BRAND's build issues (chrome)", BRAND),
    ("new", "Defects (still open, and placeholders for QA to file)", NEW),
    ("extra", "More build shots", EXTRA),
]
