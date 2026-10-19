# Errors · review: data for qa/tools/page-review.py. Ids follow BRAND's inventory/errors (56 parts): the app 404 (N01–N15),
# route error (E01–E13), global error (G01–G09), plan not found (U01–U08) and run limit (R01–R11). v1's provisional
# E01–E07 are retired: BRAND's ids win (v1 E01 = N03/N04, v1 E02 = E02–E08, v1 E03 = G01–G09, v1 E04 = U01–U08).
# v4 (f83f1a1, DEV's closing commit): every row re-judged; build images in inv/v4/ (v3 images stay in inv/v3/, v2 in inv/build/).
import os
TITLE = "Errors · review"
ROUTE = "/this-is-not-a-pitch (404), /plan?example=acoustic&faults=render (route error), global-error.tsx (source), /p/ZZZZZZZZZ (plan not found), /plan?example=sax&faults=fresh-limit (run limit)"
VERSION = "v4"
COMMIT = "f83f1a1"
DATE = "17 Oct 2026"
IMG = "honeycomb/errors/inv/"
READY = ("Not ready",
         "New user rule: every component must match its DS specimen. The 404 and route/global error cards differ on sight from DS StatusCard (centred, 64 px solid hex, 24 px title, muted body, shadow, footnote at the foot; DS: left-aligned, 72 px hex, 40–56 px title, footnote above the actions, arrow on the 404 home button): N04–N08, E02–E05, E08, G03, G06 (B-212). "
         "The board draws the centred version DEV followed, so the user must pick board or DS first. Smaller: run limit alert border (R05, B-213), home action placement (R08, B-213), status line font (R07), phone buttons (B-155), numeral colour (N03).")
CHANGES = ("DS parity and glyph rule applied (same commit): StatusCard, ErrorState, EmptyState, PlanNotFound, PlanAlert, AgentStatusLine and Button compared with BRAND's DS specimens. Now Different against DS StatusCard: N04–N08, E02–E04, E05, G03 (B-212); R05 against DS Alert/PlanAlert (B-213); R08 against DS PlanAlert (B-213). PlanNotFound and Button match the DS. No glyph icons (U06's arrow is an SVG). READY now Not ready. "
           "Full pass at f83f1a1. Fixed: B-138 and the shadow half of B-053/B-054 (cards show the 4 px ink offset, orange at night: N04, E02, G03, N11, E11); "
           "B-134 (one 2 px outline 2 px outside every button, so the night ring sits on the card, not the fill: N10, E10, U07, G08); "
           "B-123 (64 px solid lifted cell, 24 px title, muted 42ch body: N05–N07, E03–E05); B-124 on the route error too (“loading this page”, E05); "
           "B-125 (arrow on the plan not found's home link, U06); B-126 (plan not found unboxed, 520 px, 44 px title, muted: U02, U04, U05); "
           "B-127 mostly (run limit at 760 px, status line under the alert, signal-text home link, alert near the top on phones: R05, R08, R11); "
           "B-098/F20 (run limit eyebrow “Fri 16 Oct · 5–8 pm · General permit”, R02). Still open: N03 colour (DEV deviation), B-155 (N14, E13, G09, U08), "
           "B-156 (E08, G06), R07 type. No Tips anywhere. Recorded DEV's declared limit: the render error and /p/<unknown> answer HTTP 200 (/p is noindex).")
HISTORY = [
    (VERSION, COMMIT, DATE, CHANGES),
    ("v3", "8207373", DATE, "Recheck at 8207373: F12 lockup, B-122 and B-128 fixed, refresh icon; B-053/B-054 open on the soft shadow; new B-134, B-155, B-156."),
    ("v2", "7b1521e", DATE, "BRAND's 56 parts replace v1's 7 provisional rows; adds the plan not found and the run limit, BRAND's build issues checked, B-122..B-128. Headers judged on the corrected F12 (the lockup is the one logo)."),
    ("v1", "7b1521e", DATE, "First version: 404, error and global error against the deck at 3 widths, day and night; field strip; B-053, B-054."),
]
SOURCE_NOTE = ("Deck: BRAND's crops from inventory/errors (App canvas NotFound, Error, GlobalError; Plan canvas NotFound, RunLimit). Build: QA's own offline "
               "production export of f83f1a1 (scratchpad/hc9, .next-qa); the route error comes from faults=render and the run limit from faults=fresh-limit (test only). "
               "The global error can't be triggered offline: G rows are judged from global-error.tsx and the shared ErrorCard/StatusCard at f83f1a1.")
_ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "screens", IMG)
def _has(rel):
    return rel if os.path.exists(os.path.join(_ROOT, rel)) else None
def P(id, name, qa, note, user="", defect="—", spec=None, dev="—"):
    d = {"id": id, "name": name, "qa": qa, "note": note, "user": user, "defect": defect, "dev": dev,
         "deck": _has(f"deck/{id}.jpg"), "b1440": _has(f"v4/{id}-1440.jpg"), "b390": _has(f"v4/{id}-390.jpg")}
    if spec:
        d["spec"] = spec
        d["deck_empty"] = "Spec only (no crop)"
    return d
F12 = "F12 (corrected 17 Oct): the one logo is the lockup, hex mark + the new wordmark, in the header, footer and every asset; only the old wordmark lettering is retired. Wordmark-only or mark-only in a header fails (the board's wordmark-only header is superseded)."
F14 = "F14: one focus ring, shadcn's own pattern (F15: shadcn Button, no hand-built states)."
LOGO = "The lockup (/brand/busk-map-lockup-*.svg, B-135's new files): hex mark + the new stencil wordmark, F12 met."
NAV = "Nav Busks · Week · Brain (Tips retired, no /tips link anywhere on the page)."
SHADOW = "Shadow is now the honeycomb token: 4px 4px 0 ink by day, 4px 4px 0 orange (#ff6a2b) at night (measured), so the poster offset arrives."
RING = "One 2 px outline in the ring token, 2 px outside the button (outline-offset 2px, no ring box-shadow): ink by day; at night orange rgb(255,106,43) sitting on the card ground rgb(24,32,37), a clear gap from the orange fill (night crops in the field-strip section)."
LIMIT_200 = "HTTP 200 (DEV's declared limit: Next's PPR shell commits before the page code runs, so the status can't change)"
DSSC = "Differs from DS StatusCard (v62/v63 specimen, same copy): DS is left-aligned, max 560 px, 24 px padding, no shadow, a 72 px lifted hex (dashed for not-found, error tone for errors), title clamp(40px,7vw,56px), body 17/26 in the foreground colour, the mono footnote (12/16, label and digest) above the actions, and the 404 primary button with an arrow-right icon. The board's App canvas draws the centred EmptyState card the build now follows (cb96ada), so board and DS disagree: BRAND/the user to pick."
PARTS = [
 # Not found (app 404)
 P("N01", "Header", "Present", LOGO + " " + NAV + " None active, as the spec.", F12),
 P("N02", "Page layout", "Present", "Header, main (max 640 px, 64/24 px padding from 768; 32/16 on phones), centred vertically, then the footer; the bottom nav on phones. HTTP 404 with robots noindex.", "", "B-122 fixed (v3)"),
 P("N03", "“404” numeral", "Different", "“404” above the card, Big Shoulders 800, 160 px at 1440 and 96 px at 390, line-height .85, centred, aria-hidden. Colour is still signal-text rgb(177,58,0), a dark rust, not the board's primary orange. It's decorative (aria-hidden), so the AA reason doesn't bind: the user's / BRAND's eye.", "", "B-053 (numeral colour only)", dev="Deviation (3d59083): signal-text so it passes AA contrast by day"),
 P("N04", "Not-found card", "Different", "Card background, 2 px rule border, 40/24 px padding at 1440, 576 px, content centred; matches the board. " + SHADOW + " " + DSSC + " Here: centred vs left, 576 vs 560 px, 40/24 vs 24 px padding, shadow vs none.", "", "B-212 (B-053, B-138 fixed at f83f1a1)"),
 P("N05", "Pin hex", "Different", "64 px solid lifted hex with the orange offset and the pin, as the board. Differs from DS StatusCard: 72 px lifted DASHED hex (tone dashed, pin 30 px).", "", "B-212 (B-123 fixed against the board)"),
 P("N06", "Title", "Different", "“No pitch here” is the page's h1, centred, Big Shoulders 800 caps, 24 px at every width (the board's small title). Differs from DS StatusCard: title clamp(40px,7vw,56px)/0.95, left-aligned.", "", "B-212"),
 P("N07", "Body", "Different", "Copy exact: “This page doesn't exist. It may have moved, or the link may be incomplete.” Centred, muted rgb(86,96,106), 17/26, max 42ch (the board). Differs from DS StatusCard: 17/26 in the foreground colour, left-aligned, no 42ch cap. (The DS specimen's bold body comes from a class clash in the DS bundle: .bm-status is also DataStatusBadge's bold 13 px class, so bold isn't the intent.)", "", "B-212"),
 P("N08", "“Go to Busk Map home”", "Different", "An <a href=\"/\"> styled as the primary Button (shadcn asChild), 44 px tall, natural width at 1440 and 768; matches DS Button primary. Differs from DS StatusCard: its 404 example gives this button iconEnd arrow-right (an SVG icon); the build has no arrow (the board has none either).", "", "B-212"),
 P("N09", "“Try an example plan”", "Present", "An <a href=\"/plan?example=acoustic\"> styled as the outline Button beside it."),
 P("N10", "Focus", "Present", RING + " Field strip 2/2 pass.", F14, "B-134 fixed at f83f1a1", spec="Not drawn. Both buttons: one focus ring, shadcn's pattern (F14)."),
 P("N11", "Night theme", "Present", "Night tokens (body #0f1416, card #182025, cream border), lockup on the dark header, the card's orange 4 px offset; axe clean. Carries N03's numeral colour and B-212."),
 P("N12", "Phone header (≤720px)", "Present", "Below 721 px (be63a53, the board's switch) the header nav hides and only the lockup stays; at 768 the nav shows.", F12),
 P("N13", "Bottom nav (≤720px)", "Present", "Fixed at the bottom, Busks · Week · Brain, no item current."),
 P("N14", "Phone layout (≤720px)", "Different", "Numeral 96 px, centred, no sideways scroll. The links still stretch to the card's full width (306 px, shadcn max-sm:w-full) and the gutters are 16 px; board: natural-width buttons, wrapped and centred, 24 px gutters; DS StatusCard at 390 also keeps natural-width buttons.", "", "B-155, B-212"),
 P("N15", "Reduced motion", "Present", "No animations on the page (document.getAnimations() empty with motion allowed).", "", "—", spec="No motion on this page."),
 # Route error
 P("E01", "Header", "Present", LOGO + " " + NAV + " Busks is active because the failing page was /plan (the header follows the URL; the board draws none active).", F12),
 P("E02", "Error card", "Different", "Card background, 2 px rule border, role alert, 40/24 px padding (board 40/24/28 bottom), 20 px gap, centred, the reference under a rule at the foot. " + SHADOW + " " + LIMIT_200 + "; no robots meta on this response. " + DSSC, "", "B-212 (B-054, B-138 fixed at f83f1a1)"),
 P("E03", "Warning hex", "Different", "64 px lifted hex in the error tone with the warning triangle, as the board. Differs from DS StatusCard: 72 px.", "", "B-212"),
 P("E04", "Title", "Different", "“Something went wrong” is the h1 inside the role alert card, 24 px display caps, centred (the board). Differs from DS StatusCard: clamp(40px,7vw,56px), left-aligned (two lines at 390).", "", "B-212"),
 P("E05", "Body", "Present", "“Something went wrong loading this page. Try again, or start over from the home page.” Muted, 42ch, centred. The board's “while setting up the pitch” is replaced, as BRAND asked, because error.tsx catches every page (the DS specimen still has the pitch sentence: BRAND's B-124 call stands). Differs from DS StatusCard: foreground colour, left-aligned.", "", "B-212 (B-124 fixed at f83f1a1)"),
 P("E06", "“Try again”", "Present", "A <button>, primary, with the refresh icon (RotateCw), calls retry() (Next 16's prop)."),
 P("E07", "“Go home”", "Present", "An <a href=\"/\"> styled as the outline Button."),
 P("E08", "Reference line", "Different", "“Reference: 190861489” at the foot under a 1 px rule, centred, 13 px muted, as the board. The “Reference:” label is JetBrains Mono like the digest (board: sans label). Differs from DS StatusCard in place and size: DS puts the footnote ABOVE the actions, 12/16 mono 500, no rule; its label is mono too, so DS sides with the build on B-156 (BRAND to re-rule B-156).", "", "B-212, B-156 (board; DS agrees with the build)"),
 P("E09", "Error digest", "Present", "From the source: the line renders only when error.digest is set; the server render error showed its digest. A client error (no digest) can't be forced offline.", "", "—", spec="The reference is the error's digest (matches the server log). While null, hide the line."),
 P("E10", "Focus", "Present", RING + " Same on Try again and Go home.", F14, "B-134 fixed at f83f1a1", spec="Not drawn. One focus ring on both buttons (F14)."),
 P("E11", "Night theme", "Present", "Night tokens, orange card offset, visible night focus; axe clean at 390 and 1440. Carries B-212."),
 P("E12", "Bottom nav (≤720px)", "Present", "Fixed at the bottom; header nav hidden. Busks is current because the failing URL is /plan (board: none current)."),
 P("E13", "Phone layout (≤720px)", "Different", "Card 358 px wide (16 px gutters, board 24), centred; Try again and Go home stack full width (306 px; board and DS StatusCard: natural width). No sideways scroll.", "", "B-155, B-212"),
 # Global error (source only)
 P("G01", "No layout", "Present", "From the source: global-error.tsx renders its own <html>/<body class=\"flex min-h-full flex-col\">, no header, nav or footer; the card's <main> is flex-1 justify-center, centred on the background."),
 P("G02", "System font fallback", "Present", "From the source: the html sets system-ui, -apple-system, “Segoe UI”, Roboto, sans-serif and maps --font-display/--font-sans to it (mono to the ui-monospace stack); the title stays bold caps."),
 P("G03", "Error card", "Different", "From the source: the same ErrorCard/StatusCard as E02 (so the same DS StatusCard differences, B-212), so the 64 px cell, small title, muted body and the hard 4 px shadow token (globals.css is imported). Copy is its own: “Something went wrong loading Busk Map. Try again, or start over from the home page.” (BRAND's call over the board's pitch sentence).", "", "B-212 (B-054, B-124 fixed)"),
 P("G04", "“Try again”", "Present", "From the source: a <button>, primary, RotateCw icon, calls retry()."),
 P("G05", "“Go home”", "Present", "From the source: a plain <a href=\"/\"> (plainLinks), so a full page load, styled as the outline Button."),
 P("G06", "Reference line", "Different", "From the source: as E08 (at the foot under a rule, 13 px; DS StatusCard: above the actions, 12/16, no rule; label mono in both).", "", "B-212, B-156"),
 P("G07", "Error digest", "Present", "From the source: same ErrorCard, the line renders only when the digest is set.", "", "—", spec="As on the route error: the digest from the server log; hide the line while null."),
 P("G08", "Night theme", "Present", "From the source: globals.css follows prefers-color-scheme; the shared Button's outline focus (B-134 fix) applies. Not rendered (can't trigger offline)."),
 P("G09", "Phone layout (≤720px)", "Different", "From the source: same card, 16 px gutters, buttons full width under 640 px (max-sm:w-full), no bottom nav.", "", "B-155"),
 # Plan not found
 P("U01", "Header", "Present", "Busks active, as the spec. " + LOGO + " " + NAV, F12),
 P("U02", "Plan not found", "Present", "No card: on the page background, centred, max 520 px, 48 px top padding (py-12), as the board and DS PlanNotFound (72 px lifted dashed pin hex, 44 px balanced title, muted 42ch body, primary button with arrow-right: all match). " + LIMIT_200 + " with <meta name=\"robots\" content=\"noindex\">, so search engines drop it; acceptable.", "", "B-126 fixed at f83f1a1"),
 P("U03", "Dashed pin hex", "Present", "72 px lifted dashed hex with the pin, centred, as the board."),
 P("U04", "Title", "Present", "h1 “We can't find this busk”, Big Shoulders 800 caps, 44 px at 1440 and 768 (clamp, 36 px at 390), centred.", "", "B-126 fixed at f83f1a1"),
 P("U05", "Body", "Present", "Copy exact: “The link may be cut short or mistyped. Check you copied all of it, or start a new busk.” 17/26, muted, 42ch, centred.", "", "B-126 fixed at f83f1a1"),
 P("U06", "“Go to Busk Map home”", "Present", "An <a href=\"/\"> styled as the primary Button with the arrow-right icon, a lucide ArrowRight SVG (aria-hidden), not a “→” glyph, so the glyph rule is met; the link text is just “Go to Busk Map home”. Matches DS PlanNotFound (iconEnd arrow-right).", "", "B-125 fixed at f83f1a1"),
 P("U07", "Night theme", "Present", "Night tokens; axe clean; the primary link's orange outline sits 2 px out on the dark ground (B-134 fixed)."),
 P("U08", "Phone layout (≤720px)", "Different", "Phone header and the bottom nav (Busks current), unboxed and centred, the title wraps (36 px). The home button stretches full width (358 px, max-sm:w-full); board: natural width.", "", "B-155"),
 # Run limit
 P("R01", "Header", "Present", "Busks active, as the spec. " + LOGO + " " + NAV, F12),
 P("R02", "Plan eyebrow", "Present", "“Fri 16 Oct · 5–8 pm · General permit”, mono bold caps muted: day · hours · permit in the board's format. The city is dropped (B-098's ruling for plan eyebrows; F20 only allowed it).", "F20: no “Melbourne” in eyebrows unless the data is that city's.", "B-098 fixed"),
 P("R03", "Act title", "Present", "h1 “Soul and funk sax player” (the sax example), Big Shoulders 56 px caps (46 at 768, 40 at 390)."),
 P("R04", "Requested plan", "Present", "Eyebrow and title come from the request. The null case isn't reachable: the page always parses a request before rendering.", "", "—", spec="Eyebrow and title come from the plan request. While null, show only the alert and the home link."),
 P("R05", "Plan limit alert", "Different", "Differs from DS PlanAlert (limit) / DS Alert: the warning border is the full tone rgb(168,22,79) at 2 px; DS mixes the tone 45% into the card (about rgb(213,151,166) by day), so the build's frame is much darker; the tint matches. DS copy also keeps “…or open one of your earlier plans.” (R09 open question). Warning alert, clock icon, max 760 px: “Plan limit reached”, “You've started 5 plans this hour. Try again in about 45 minutes.” (45 is the test fault's wait; no earlier-plans clause, R09). The act buttons are gone; only the offline “Qloo test data” banner sits above it (test builds only).", "", "B-213; B-127 fixed at f83f1a1 (layout)"),
 P("R06", "Limit and minutes", "Present", "Both pluralise (rate-limit.ts unchanged since v3: limit 1 and 60 s → “1 plan … 1 minute”). The limit is the constant 5.", "", "B-128 fixed (v3)", spec="“5” is the hourly limit and “20” the minutes; with limit 1 the build says “1 plan”, likewise “1 minute”."),
 P("R07", "“No new plan was started.”", "Different", "role status, under the alert now (as the board), dashed hex with the clock. Still Atkinson sans 14/20; DS AgentStatusLine: mono 500 14/20 (its 24 px dashed hex matches the build; the board drew 28 px).", "", "B-127 (open: status line type; DS AgentStatusLine)"),
 P("R08", "“Back to Busk Map home”", "Different", "A bold signal-text underlined link under the status line, href /, 48 px tap height, as the board. Differs from DS PlanAlert (limit): the home action is an outline size-sm Button (“BACK TO BUSK MAP HOME”) in the alert's actions row, inside the alert. Board and DS disagree.", "", "B-213"),
 P("R09", "Earlier plans link", "Present", "No link to earlier plans and no promise of one in the alert.", "Open question: DESIGN to confirm whether a link to the performer's plans belongs here.", "—", spec="Not drawn. The alert says “open one of your earlier plans” but the board gives no way to; DESIGN to confirm."),
 P("R10", "Night theme", "Present", "Night tokens; axe clean at 390 and 1440; the home link's focus ring is visible."),
 P("R11", "Phone layout (≤720px)", "Present", "Single column; the alert fills the width (358 px) and starts 266 px down (v3: 672), status line and home link above the fold; phone header and bottom nav (Busks current).", "", "B-127 fixed at f83f1a1"),
]
_A = "../screens/honeycomb/errors/inv/v4/"
SECTIONS = [
 ("field-strip", "Field strip (F14): app 404", f'<p>Route /no-such-page (same 404 as /this-is-not-a-pitch), from the f83f1a1 field-strip data (fields9). Columns: day 1440, night 1440, day 390, night 390; each pair unfocused then focused. Result: <b>2 of 2 pass</b> (8 states): each link shows one outline ring 2 px out.</p>'
  f'<p><a href="{_A}field-strip.jpg"><img src="{_A}field-strip.jpg" alt="404 field strip at f83f1a1"></a></p>'
  f'<p>Night, 1440, “Go to Busk Map home”: unfocused, then focused; and the route error card at night with Try again focused (B-134 fixed: the ring sits on the card, apart from the fill).</p>'
  f'<p><img src="{_A}N10-night-off.jpg" alt="Primary link at night, unfocused"> <img src="{_A}N10-night-on.jpg" alt="Primary link at night, focused"></p>'
  f'<p><img src="{_A}E10-night-focus.jpg" alt="Route error at night, Try again focused"></p>'),
 ("critique", "Impeccable critique", "<ol>"
  "<li><b>P1 · The status cards don't match the design system.</b> DS StatusCard is a left-aligned poster card: a 72 px lifted hex, a 40–56 px display title, body in full colour, the reference above the buttons, an arrow on the 404 home button, no shadow. The build is the board's centred EmptyState-style card with a 24 px title (N04–N08, E02–E05, E08, G03, G06; B-212). Board and DS disagree, so this needs the user's pick before DEV ports.</li>"
  "<li><b>P2 · The run limit alert is framed darker than the DS.</b> Full-tone 2 px crimson border vs the DS 45% mix, and the home action sits outside the alert as a text link instead of the DS outline button inside it (R05, R08; B-213, B-213).</li>"
  "<li><b>P3 · Phones still get stretched buttons.</b> On the 404, route error, global error and plan not found, the actions fill the card at 390 (306–358 px) with 16 px gutters, where the board keeps natural-width buttons centred in 24 px gutters (N14, E13, G09, U08; B-155). It reads heavier than the board, not broken.</li>"
  "<li><b>P3 · The 404 numeral is rust, not orange.</b> DEV darkened it to signal-text for contrast, but it's aria-hidden decoration, so the board's orange would be allowed; it's the one loud thing on the page and it reads brown (N03). The user's call.</li>"
  "<li><b>P3 · Two small type slips.</b> The “Reference:” label is mono with the digest (E08, G06; B-156), and the run limit's “No new plan was started.” is sans with a 24 px cell instead of mono with 28 px (R07).</li>"
  "<li><b>Fixed · The pages now feel like one family.</b> Hard poster shadow, 64 px cell, small title and muted body on every card; the plan not found is unboxed; the run limit is short and near the top on phones; night focus is visible (N04–N10, E02–E10, U02–U06, R05, R11).</li>"
  "</ol>"),
 ("audit", "Impeccable audit", "<table><tr><th>Check</th><th>Result</th></tr>"
  "<tr><td>axe (WCAG 2.2 AA tags) at 390 and 1440, day and night: 404, route error, plan not found, run limit</td><td>Clean (0 violations, 16 runs)</td></tr>"
  "<tr><td>Sideways scroll at 390, 768, 1440 (day and night)</td><td>None on any of the four pages (24 loads)</td></tr>"
  "<tr><td>Heading outline</td><td>One h1 each: “No pitch here”, “Something went wrong”, “We can't find this busk”, the act name on the run limit; no other headings in main. The “404” is a &lt;p aria-hidden&gt;. Global error: h1 from the source</td></tr>"
  "<tr><td>Landmarks</td><td>One &lt;main id=main&gt; per page; skip link present (layout)</td></tr>"
  "<tr><td>Focus (2.4.7, 1.4.11)</td><td>Every Button: one 2 px outline in the ring token, offset 2 px, no box-shadow ring (ink by day; orange rgb(255,106,43) on the card rgb(24,32,37) at night). The run limit's text link: a 2 px box-shadow ring (ink / orange). B-134 fixed at f83f1a1</td></tr>"
  "<tr><td>Shadows</td><td>Cards: 4px 4px 0 rgb(20,28,33) by day, 4px 4px 0 rgb(255,106,43) at night, no blur. B-138 fixed at f83f1a1</td></tr>"
  "<tr><td>Contrast, 404 numeral</td><td>signal-text rgb(177,58,0) on #f2eee6: 5.2:1 (decorative, aria-hidden)</td></tr>"
  "<tr><td>Target size</td><td>Buttons 44 px tall; the run limit's link 48 px</td></tr>"
  "<tr><td>HTTP status and robots (DEV's declared limit)</td><td>/this-is-not-a-pitch: <b>404</b>, robots noindex. /p/ZZZZZZZZZ: <b>200</b>, robots noindex. Render error: <b>200</b>, no robots meta. Run limit: 200 (the refusal is the API's 429). DEV: Next's PPR shell commits before the page code runs, so a streamed notFound()/error can't change the status. Judged acceptable: the plan link is noindex so it won't be indexed, and a render error is transient (monitoring should key on the logged digest, not the status). Recorded as DEV's declared limit, not a defect</td></tr>"
  "<tr><td>Tips retired</td><td>No Tips nav item, /tips link, tip copy, badge or Tip log button on any of the four pages (served HTML and rendered DOM)</td></tr>"
  "<tr><td>Reduced motion</td><td>No animations on the 404, route error or plan not found (getAnimations() empty with motion allowed)</td></tr>"
  "<tr><td>Logo (F12)</td><td>Header and footer: the lockup with the new lettering</td></tr>"
  "<tr><td>DS parity (new user rule)</td><td>Compared with the DS specimens (light 1440/390, dark 1440): StatusCard differs (B-212); EmptyState and ErrorState are the board's inner content, and the build's centred card follows them, not StatusCard; PlanNotFound matches; PlanAlert limit differs (B-213 border via DS Alert, B-213 home action); AgentStatusLine differs in font (R07); Button matches (primary, outline, link). DS AppHeader still shows Setlist/Tips; the build follows the user's nav (Tips retired)</td></tr>"
  "<tr><td>Glyph rule</td><td>No text glyph used as an icon on the five pages: the plan not found's arrow is a lucide ArrowRight SVG, the refresh and clock are SVGs; the “·” in the run limit eyebrow is inside copy (allowed). No B-162 rows</td></tr>"
  "<tr><td>768</td><td>Header nav shown, bottom nav hidden, cards 576 px centred, plan not found title 44 px, run limit alert 736 px; no breakage</td></tr></table>"),
 ("brand-issues", "BRAND's build issues", "<table><tr><th>Issue</th><th>Result</th><th>Evidence</th></tr>"
  "<tr><td>No h1 on the 404 or either error page</td><td>Not reproduced</td><td>Rendered at f83f1a1: h1 “No pitch here” and h1 “Something went wrong” at 390, 768 and 1440. Global error: StatusCard renders &lt;h1&gt; unless embedded (source).</td></tr>"
  "<tr><td>The global error's copy is wrong (“while setting up the pitch”)</td><td>Fixed</td><td>Global: “Something went wrong loading Busk Map…”; route error: “Something went wrong loading this page…” (G03, E05).</td></tr>"
  "<tr><td>Home and example actions are buttons, not links</td><td>Not reproduced</td><td>&lt;a href=\"/\"&gt; and &lt;a href=\"/plan?example=acoustic\"&gt; on the 404, route error, plan not found and run limit; global error a plain &lt;a href=\"/\"&gt;. Only Try again is a &lt;button&gt;.</td></tr>"
  "<tr><td>The run limit says “1 plans”</td><td>Fixed (v3)</td><td>Pluralises both counts (R06).</td></tr>"
  "<tr><td>The plan pages don't switch to the bottom nav at phone width</td><td>Not reproduced</td><td>At 390 /p/ZZZZZZZZZ and the run limit hide the header nav and show the bottom nav with Busks current (U08, R11).</td></tr></table>"),
 ("recheck", "DEV's fixes rechecked at f83f1a1", "<table><tr><th>Defect</th><th>Result</th><th>Evidence</th></tr>"
  "<tr><td>B-053</td><td>Fixed, one deviation</td><td>Hard shadow now (N04). The numeral stays rust signal-text by DEV's choice (N03)</td></tr>"
  "<tr><td>B-054</td><td>Fixed</td><td>Hard shadow on the error card (E02, G03)</td></tr>"
  "<tr><td>B-123</td><td>Fixed</td><td>64 px solid cell, 24 px title, muted 42ch body (N05–N07, E03–E05)</td></tr>"
  "<tr><td>B-124</td><td>Fixed</td><td>Route error “loading this page” (E05); global its own (G03)</td></tr>"
  "<tr><td>B-125</td><td>Fixed</td><td>Refresh icon (E06, G04); arrow on the plan not found's link (U06)</td></tr>"
  "<tr><td>B-126</td><td>Fixed</td><td>Unboxed, 520 px, 48 px top, 44 px title, muted body (U02, U04, U05); the phone button width is B-155</td></tr>"
  "<tr><td>B-127</td><td>Mostly fixed</td><td>760 px alert, status line under it, signal-text link, near the top on phones (R05, R08, R11). Open: the status line is sans with a 24 px cell (R07)</td></tr>"
  "<tr><td>B-134</td><td>Fixed</td><td>Outline 2 px out on every Button, visible at night (N10, E10, U07)</td></tr>"
  "<tr><td>B-138</td><td>Fixed</td><td>--shadow-sm/md/lg mapped in @theme: hard offsets day and night (N04, E02)</td></tr>"
  "<tr><td>B-155</td><td>Open</td><td>Full-width phone buttons, 16 px gutters (N14, E13, G09, U08)</td></tr>"
  "<tr><td>B-156</td><td>Open</td><td>“Reference:” label in mono (E08, G06)</td></tr></table>"),
 ("new-defects", "New defects (to be numbered in bugs.md)", "<ul>"
  "<li><b>B-212 · Medium · DS StatusCard · N04–N08, E02–E05, E08, G03, G06 (and N11, E11, N14, E13):</b> the build's StatusCard is centred, max 576 px, 40/24 px padding, shadow-md, a 64 px solid lifted hex, a 24 px title, a muted 42ch body, the footnote last under a 1 px rule (13 px), no arrow on the 404 home button. DS StatusCard: left-aligned (align-items flex-start), max 560 px, 24 px padding, 2 px rule border and no shadow, 72 px lifted hex (dashed + pin for not-found, error tone + warning for errors, icon 30 px), title 800 clamp(40px,7vw,56px)/0.95 caps, body 17/26 foreground, footnote mono 500 12/16 muted ABOVE the actions, actions wrap at natural width, the 404 primary has iconEnd arrow-right. The board's App canvas draws the centred version: board and DS conflict.</li>"
  "<li><b>B-213 · Low · DS Alert / PlanAlert (limit) · R05:</b> the warning alert's 2 px border is the full tone (rgb(168,22,79)); DS Alert mixes the tone 45% into the card (about rgb(213,151,166) by day, rgb(111,77,94) at night). Shared Alert, so likely on every alert site-wide. DS copy also keeps “…or open one of your earlier plans.” (R09 still open).</li>"
  "<li><b>B-213 · Low · DS PlanAlert (limit) · R08:</b> “Back to Busk Map home” is a signal-text link under the status line (as the board); DS PlanAlert puts it inside the alert as an outline size-sm Button in the actions row.</li>"
  "</ul><p>The HTTP 200 on the render error and /p/&lt;unknown&gt; is DEV's declared limit (audit), not a defect. No glyph icons, so no B-162 rows.</p>"),
]

# Impeccable critique and audit: generated from the skill's own outputs in qa/impeccable/ (see impeccable_sections.py).
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from impeccable_sections import impeccable as _imp
from impeccable_synthesis import SYN as _SYN
_i = next(i for i, s in enumerate(SECTIONS) if s[0] == "critique")
SECTIONS = [s for s in SECTIONS if s[0] not in ("critique", "audit")]
SECTIONS[_i:_i] = _imp("errors", _SYN["errors"])

CHANGES = CHANGES + " The impeccable critique and audit were run for real this round (skill v4.4.0, dual-agent, at f83f1a1, 390/768/1440; provenance at the top of both sections), replacing v3's hand-written sections. New from impeccable, verified by QA: B-229 (Try again silent, focus lost), B-230 (ghost pin and wrong tab title on plan-not-found). DEV's limit (HTTP 200 on /p/<unknown> and the render error, noindex) is accepted."
READY = (READY[0], READY[1] + ' Impeccable adds B-229 and B-230.')
