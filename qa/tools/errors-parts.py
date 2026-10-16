# Errors · review: data for qa/tools/page-review.py. Ids follow BRAND's inventory/errors (56 parts): the app 404 (N01–N15),
# route error (E01–E13), global error (G01–G09), plan not found (U01–U08) and run limit (R01–R11). v1's provisional
# E01–E07 are retired: BRAND's ids win (v1 E01 = N03/N04, v1 E02 = E02–E08, v1 E03 = G01–G09, v1 E04 = U01–U08).
# v3 (8207373): every row re-judged; build images in inv/v3/ (older v2 images stay in inv/build/).
import os
TITLE = "Errors · review"
ROUTE = "/this-is-not-a-pitch (404), /plan?example=acoustic&faults=render (route error), global-error.tsx (source), /p/ZZZZZZZZZ (plan not found), /plan?example=sax&faults=fresh-limit (run limit)"
VERSION = "v3"
COMMIT = "8207373"
DATE = "17 Oct 2026"
IMG = "honeycomb/errors/inv/"
CHANGES = ("Recheck at 8207373. Now Present: N01, N12, E01, U01, R01 (F12 lockup, new lettering); N02, G01 (B-122 fixed, centred); "
           "E06, G04 (refresh icon); R06 (B-128 fixed, “1 plan”, “1 minute”); R09 (the alert no longer promises earlier plans). "
           "Different: N03 (the 404 numeral is in, but rust signal-text, not primary orange); "
           "N04, E02, G03 shadow still soft (B-053/B-054 open on the shadow only: the utility ignores the honeycomb --shadow-md token); "
           "G03 copy now about the whole app (B-124 fixed for the global error, open on the route error); N14, E13, G09 now B-155 (phone buttons and gutters); E08, G06 B-156 (mono label). "
           "Broken: N10, E10 by night (B-134: the primary button's focus ring is its own orange, so nothing changes on focus); by day F14 is met (one 2 px ring).")
HISTORY = [
    (VERSION, COMMIT, DATE, CHANGES),
    ("v2", "7b1521e", DATE, "BRAND's 56 parts replace v1's 7 provisional rows; adds the plan not found and the run limit, BRAND's build issues checked, B-122..B-128. Headers judged on the corrected F12 (the lockup is the one logo)."),
    ("v1", "7b1521e", DATE, "First version: 404, error and global error against the deck at 3 widths, day and night; field strip; B-053, B-054."),
]
SOURCE_NOTE = ("Deck: BRAND's crops from inventory/errors (App canvas NotFound, Error, GlobalError; Plan canvas NotFound, RunLimit). Build: QA's own offline "
               "production export of 8207373; the route error comes from faults=render and the run limit from faults=fresh-limit (test only). "
               "The global error can't be triggered offline: G rows are judged from global-error.tsx and the shared ErrorCard/StatusCard at 8207373.")
_ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "screens", IMG)
def _has(rel):
    return rel if os.path.exists(os.path.join(_ROOT, rel)) else None
def P(id, name, qa, note, user="", defect="—", spec=None, dev="—"):
    d = {"id": id, "name": name, "qa": qa, "note": note, "user": user, "defect": defect, "dev": dev,
         "deck": _has(f"deck/{id}.jpg"), "b1440": _has(f"v3/{id}-1440.jpg"), "b390": _has(f"v3/{id}-390.jpg")}
    if spec:
        d["spec"] = spec
        d["deck_empty"] = "Spec only (no crop)"
    return d
F12 = "F12 (corrected 17 Oct): the one logo is the lockup, hex mark + the new wordmark, in the header, footer and every asset; only the old wordmark lettering is retired. Wordmark-only or mark-only in a header fails (the board's wordmark-only header is superseded)."
F14 = "F14: one focus ring, shadcn's own pattern (F15: shadcn Button, no hand-built states)."
LOGO = "The lockup is the design system's file as an image (/brand/busk-map-lockup-*.svg, 36 px tall): hex mark + the new stencil wordmark; zoomed 4× (QA), the M sits level with the other letters, so the old lettering is gone and F12 is met."
SHADOW = "The card has shadow-md, but it renders Tailwind's soft default (0 4px 6px rgba(0,0,0,.1)), not the honeycomb token --shadow-md (4px 4px 0 ink; orange at night): the token is set on :root, not in @theme, so the utility never reads it."
NIGHT_RING = "DEV: the default button's focus ring at night isn't verified yet."
PARTS = [
 # Not found (app 404)
 P("N01", "Header", "Present", LOGO + " Nav Busks · Week · Brain · Tips, none active, as the spec.", F12),
 P("N02", "Page layout", "Present", "Header, main, then the bottom nav on phones. The 404 numeral and card are centred vertically in main (group centre 433 px, main centre 434 px at 1440); card column 576 px. The site footer follows (site chrome, F07).", "", "B-122 fixed at 8207373"),
 P("N03", "“404” numeral", "Different", "“404” above the card, Big Shoulders 800, 160 px at 1440 and 96 px at 390 (clamp 20vw), centred, aria-hidden. Colour is signal-text rgb(177,58,0), a dark rust (5.2:1 on the page), not the board's primary orange; the numeral is decorative (aria-hidden), so BRAND to say whether the board orange stands.", "", "B-053 fixed at 8207373 (numeral)", dev="Deviation (3d59083): signal-text so it passes AA contrast by day"),
 P("N04", "Not-found card", "Different", "Card background, 2 px rule border, 40/24 px padding at 1440, content centred: as the board. " + SHADOW, "", "B-053 (open: shadow only), B-138"),
 P("N05", "Pin hex", "Different", "72 px dashed hex with an orange-offset pin (the plan not found's cell), now centred; board: 64 px solid lifted hex, orange offset behind, plain pin.", "", "B-123"),
 P("N06", "Title", "Different", "“No pitch here” is the page's h1, centred. Set in Big Shoulders 56 px caps (40 px at 390); the board's title is small (about 18 px) under the big numeral.", "", "B-123"),
 P("N07", "Body", "Different", "Copy exact: “This page doesn't exist. It may have moved, or the link may be incomplete.” Centred now; still the full foreground colour (board muted).", "", "B-123"),
 P("N08", "“Go to Busk Map home”", "Present", "An <a href=\"/\"> styled as the primary Button (shadcn asChild), 44 px tall, centred; full width at 390."),
 P("N09", "“Try an example plan”", "Present", "An <a href=\"/plan?example=acoustic\"> styled as the outline Button beside it; full width under it at 390."),
 P("N10", "Focus", "Broken", "By day F14 is met: one 2 px ink ring (box-shadow 0 0 0 2px), no second layer, on both links. By night the primary link's ring is rgb(255,106,43), the same orange as its fill, sitting flush against it: the focused button only grows 2 px and looks unchanged (night crops in the field-strip section: off, then on; 1:1 against the fill). The outline link's orange ring reads fine (5.8:1 on the card). The field strip counts a ring, so it passes there.", F14, "B-134", spec="Not drawn. Both buttons: one focus ring, shadcn's pattern (F14).", dev=NIGHT_RING),
 P("N11", "Night theme", "Present", "Night tokens (body #0f1416, card #182025), lockup on the dark header; axe clean. Carries N03–N07's differences; the soft shadow is invisible at night (the token would be a 4 px orange offset, N04); primary focus: N10."),
 P("N12", "Phone header (≤720px)", "Present", "Below 768 px the header nav hides and only the lockup stays (new lettering, F12 met). Breakpoint 768, board 721; at 768 both read the same.", F12),
 P("N13", "Bottom nav (≤720px)", "Present", "Fixed at the bottom, Busks · Week · Brain · Tips, no item current. Shows under 768 px (board: under 721)."),
 P("N14", "Phone layout (≤720px)", "Different", "The numeral scales to 96 px, everything is centred, no sideways scroll. The wrapped links stretch to the full card width (shadcn max-sm:w-full) and the gutters are 16 px; board: natural-width buttons, centred, 24 px gutters.", "", "B-155"),
 P("N15", "Reduced motion", "Present", "No animations on the page (document.getAnimations() is empty with motion allowed).", "", "—", spec="No motion on this page."),
 # Route error
 P("E01", "Header", "Present", LOGO + " Busks is active because the failing page was /plan (the header follows the URL; the board draws no item active).", F12),
 P("E02", "Error card", "Different", "Card background, 2 px rule border, role alert, 40/24 px padding, centred, the reference under a rule at the foot: as the board. " + SHADOW, "", "B-054, B-138 (open: shadow only)"),
 P("E03", "Warning hex", "Different", "Error-tone lifted hex with the warning triangle (TriangleAlert), as the board; but 72 px (board 64 px), the shared StatusCard size.", "", "B-123"),
 P("E04", "Title", "Different", "“Something went wrong” is the h1 (as the spec) inside the role alert card, centred; 56 px display caps, two lines at 390 (board: small).", "", "B-123"),
 P("E05", "Body", "Different", "Copy matches the board: “Something went wrong while setting up the pitch. Try again, or start over from the home page.” Centred, not muted. The route error boundary is app/error.tsx, so this “pitch” sentence shows for a failure on any page.", "", "B-123, B-124"),
 P("E06", "“Try again”", "Present", "A <button>, primary, with the refresh icon (RotateCw), calls retry() (Next 16's prop, per the bundled docs).", "", "B-125 fixed at 8207373 (refresh icon)"),
 P("E07", "“Go home”", "Present", "An <a href=\"/\"> styled as the outline Button."),
 P("E08", "Reference line", "Different", "“Reference: 2403440468” at the foot under a 1 px rule, centred, 13 px muted: as the board. The “Reference:” label is mono too (board: sans label, mono digest).", "", "B-156"),
 P("E09", "Error digest", "Present", "From the source: the line renders only when error.digest is set (footnote null otherwise); the server render error showed its digest. A client error (no digest) can't be forced offline. The board's errorNote is a note for DEV, not on-page copy; DEV says it isn't done yet, and nothing on the page depends on it.", "", "—", spec="The reference is the error's digest (matches the server log). While null, hide the line.", dev="errorNote not done yet (DEV)"),
 P("E10", "Focus", "Broken", "By day: one 2 px ink ring on Try again and Go home (F14 met). By night Try again (primary) has an orange ring on an orange fill: no visible change on focus (as N10).", F14, "B-134", spec="Not drawn. One focus ring on both buttons (F14).", dev=NIGHT_RING),
 P("E11", "Night theme", "Present", "Night tokens; axe clean at 390 and 1440. Carries E02's shadow and E10's primary focus."),
 P("E12", "Bottom nav (≤720px)", "Present", "Fixed at the bottom; header nav hidden. Busks is current because the failing URL is /plan (board: none current)."),
 P("E13", "Phone layout (≤720px)", "Different", "Card 358 px wide (16 px gutters, board 24), centred; Try again and Go home stack full width (board: natural width, wrapped, centred). No sideways scroll.", "", "B-155"),
 # Global error (source only)
 P("G01", "No layout", "Present", "From the source: global-error.tsx renders its own <html>/<body class=\"flex min-h-full flex-col\">, no header, nav or footer; the card's <main> is flex-1 with justify-center, so it sits centred on the background, as the board.", "", "B-122 fixed at 8207373"),
 P("G02", "System font fallback", "Present", "From the source: the html element sets system-ui, -apple-system, “Segoe UI”, Roboto, sans-serif and maps --font-display/--font-sans to it (mono to the ui-monospace stack); the title stays bold caps."),
 P("G03", "Error card", "Different", "From the source: the same ErrorCard as E02 (soft shadow, B-054). The copy is now its own: “Something went wrong loading Busk Map. Try again, or start over from the home page.” (GLOBAL_ERROR_DESCRIPTION), so it no longer talks about a pitch (BRAND's call over the board's sentence).", "", "B-124 fixed at 8207373 (global error); B-054 (shadow)"),
 P("G04", "“Try again”", "Present", "From the source: a <button>, primary, with the RotateCw refresh icon, calls retry().", "", "B-125 fixed at 8207373 (refresh icon)"),
 P("G05", "“Go home”", "Present", "From the source: a plain <a href=\"/\"> (plainLinks), so a full page load, styled as the outline Button."),
 P("G06", "Reference line", "Different", "From the source: as E08 (at the foot under a rule; the label is mono).", "", "B-156"),
 P("G07", "Error digest", "Present", "From the source: same ErrorCard, the line renders only when the digest is set.", "", "—", spec="As on the route error: the digest from the server log; hide the line while null."),
 P("G08", "Night theme", "Present", "From the source: globals.css is imported and follows prefers-color-scheme with no layout script; not rendered (can't trigger offline). Carries E10's night focus on Try again."),
 P("G09", "Phone layout (≤720px)", "Different", "From the source: same card, 16 px gutters, buttons full width under 640 px (max-sm:w-full), no bottom nav (the layout is gone).", "", "B-155"),
 # Plan not found
 P("U01", "Header", "Present", "Busks active, as the spec. " + LOGO, F12),
 P("U02", "Plan not found", "Different", "Now centred (vertically and horizontally), but still inside the shared bordered card (card background, 2 px rule, 40/24 px padding, soft shadow), 576 px wide; board: no card, on the page background, max 520 px, 48 px top padding. HTTP 200.", "", "B-126"),
 P("U03", "Dashed pin hex", "Present", "72 px lifted dashed hex with the pin, centred, as the board."),
 P("U04", "Title", "Different", "h1 “We can't find this busk”, Big Shoulders 800 caps, centred, but 56 px (40 at 390; board 44 px).", "", "B-126"),
 P("U05", "Body", "Different", "Copy exact: “The link may be cut short or mistyped. Check you copied all of it, or start a new busk.” 17/26 and centred as the board, but the full foreground colour (board muted).", "", "B-126"),
 P("U06", "“Go to Busk Map home”", "Different", "An <a href=\"/\"> styled as the primary Button. Still no arrow-right icon.", "", "B-125 (open: arrow only)"),
 P("U07", "Night theme", "Present", "Night tokens; axe clean. Carries U02's differences and E10's night focus on the primary link."),
 P("U08", "Phone layout (≤720px)", "Different", "Phone header and the bottom nav (Busks current), as the spec asks; stacks centred, but boxed in the card with a full-width button (board: no card, natural-width button).", "", "B-126, B-155"),
 # Run limit
 P("R01", "Header", "Present", "Busks active, as the spec. " + LOGO, F12),
 P("R02", "Plan eyebrow", "Different", "“MELBOURNE · FRIDAY 2026-10-16, 5 PM–8 PM · GENERAL PERMIT”: mono bold caps muted, the requested plan's city · day · hours · permit. ISO date with the full weekday and “5 PM–8 PM” (board “Sat 18 Oct · 6–9 pm”); the plan page's eyebrow format. The city is the plan's own, so F20 is met.", "F20: no “Melbourne” in eyebrows unless the data is that city's (here it is the plan's city).", "B-098"),
 P("R03", "Act title", "Present", "h1 “SOUL AND FUNK SAX PLAYER” (the sax example), Big Shoulders 56 px caps (40 at 390)."),
 P("R04", "Requested plan", "Present", "Eyebrow and title come from the request (city, date, hours, permit, act). The null case (no request in hand) isn't reachable: the page always parses a request before rendering.", "", "—", spec="Eyebrow and title come from the plan request. While null, show only the alert and the home link."),
 P("R05", "Plan limit alert", "Different", "Warning alert, clock icon, “Plan limit reached”, “You've started 5 plans this hour. Try again in about 45 minutes.” (45 is the test fault's wait; the “or open one of your earlier plans” clause is gone, see R09). The alert still spans the full content width (1120 px at 1440; board max 760), holds the home button, and sits under the Plan my week instead · Tip log buttons, the status line and the offline test-data banner and alert.", "", "B-127"),
 P("R06", "Limit and minutes", "Present", "Both are pluralised now: `plan${limit === 1 ? \"\" : \"s\"}` and the same for minutes. The function from the 8207373 source, evaluated: limit 1 and 60 s → “You've started 1 plan this hour. Try again in about 1 minute.”; limit 5 and 45 min → “…5 plans… 45 minutes.” The limit is still the constant 5 (only the minutes are live on the page).", "", "B-128 fixed at 8207373", spec="“5” is the hourly limit and “20” the minutes; with limit 1 the build says “1 plan”, likewise “1 minute”."),
 P("R07", "“No new plan was started.”", "Different", "role status, dashed hex with the clock. Sans 14 px, 24 px hex (board mono 14/20, 28 px), and above the alerts (board: under the alert).", "", "B-127"),
 P("R08", "“Back to Busk Map home”", "Different", "An outline uppercase Button inside the alert (href /); board: a bold signal-coloured text link under the status line.", "", "B-127"),
 P("R09", "Earlier plans link", "Present", "No link to earlier plans, as the board, and the alert no longer says “open one of your earlier plans”, so nothing is promised that the page can't give.", "Open question: DESIGN to confirm whether a link to the performer's plans belongs here.", "—", spec="Not drawn. The alert says “open one of your earlier plans” but the board gives no way to; DESIGN to confirm."),
 P("R10", "Night theme", "Present", "Night tokens; axe clean at 390 and 1440. The outline home button's orange ring is visible at night."),
 P("R11", "Phone layout (≤720px)", "Different", "Single column, the alert fills the width, phone header and bottom nav (Busks current), as the spec. The alert still starts 672 px down, under the act buttons, status line and test-data banner and alert; its home button sits behind the bottom nav at first view.", "", "B-127"),
]
_A = "../screens/honeycomb/errors/inv/v3/"
SECTIONS = [
 ("field-strip", "Field strip (F14): app 404", f'<p>Route /no-such-page (same 404 as /this-is-not-a-pitch), from the 8207373 field-strip data (fields8). Columns: day 1440, night 1440, day 390, night 390; each pair unfocused then focused. Result: <b>2 of 2 pass</b> (8 states): each link shows one ring. The strip counts a ring box-shadow; it can\'t see that the primary link\'s night ring is the same orange as its fill. Looked at by eye:</p>'
  f'<p><a href="{_A}field-strip.jpg"><img src="{_A}field-strip.jpg" alt="404 field strip at 8207373"></a></p>'
  f'<p>Night, 1440, “Go to Busk Map home”: unfocused, then focused (B-134). The only change is 2 px more orange.</p>'
  f'<p><img src="{_A}N10-night-off.jpg" alt="Primary link at night, unfocused"> <img src="{_A}N10-night-on.jpg" alt="Primary link at night, focused"></p>'),
 ("critique", "Impeccable critique", "<ol>"
  "<li><b>P1 · Night focus vanishes on the main action.</b> Every primary button on these pages (Go to Busk Map home, Try again) gets an orange ring on an orange fill at night, so a keyboard user can't tell it's focused (N10, E10, U07; B-134). By day F14 is met.</li>"
  "<li><b>P2 · The poster shadow never arrives.</b> The 404, route error and plan not found cards ask for shadow-md and get Tailwind's soft blur, not the honeycomb 4 px ink offset (orange at night), because the token sits on :root and not in @theme (N04, E02, G03; B-053/B-054). Likely site-wide wherever shadow-md is used.</li>"
  "<li><b>P2 · The run limit is still buried.</b> On a phone the alert starts 672 px down, under the act's buttons, the status line and the test-data banner (R05, R11; B-127); the one thing to read is the last thing seen.</li>"
  "<li><b>P3 · One card scale for every moment.</b> The 404 is now a big numeral over a centred card, much closer to the board, but the title is still 56 px display caps under a 72 px dashed hex, so the card shouts as loud as the numeral (N05–N07, E03–E05; B-123). The plan not found is still boxed (U02; B-126).</li>"
  "<li><b>P3 · Copy now fits the failure.</b> The global error talks about Busk Map, not a pitch (G03), and the limit message pluralises and no longer promises earlier plans (R05, R06, R09). The route error still says “setting up the pitch” for any page (E05; B-124).</li>"
  "</ol>"),
 ("audit", "Impeccable audit", "<table><tr><th>Check</th><th>Result</th></tr>"
  "<tr><td>axe (WCAG 2.2 AA tags) at 390 and 1440, day and night: 404, route error, plan not found, run limit</td><td>Clean (0 violations, 16 runs)</td></tr>"
  "<tr><td>Sideways scroll at 390, 768, 1440 (day and night)</td><td>None on any of the four pages</td></tr>"
  "<tr><td>Heading outline</td><td>One h1 each: “No pitch here”, “Something went wrong”, “We can't find this busk”, the act name on the run limit; no other headings in main. The “404” is a &lt;p aria-hidden&gt;, not a heading. Global error: h1 from the source</td></tr>"
  "<tr><td>Landmarks</td><td>One &lt;main id=main&gt; per page; skip link present (layout)</td></tr>"
  "<tr><td>Focus (2.4.7, 1.4.11)</td><td>Day: one 2 px ink ring on every action (F14 met). Night: outline buttons' orange ring 5.8:1 on the card (pass); primary buttons' ring is rgb(255,106,43) on a rgb(255,106,43) fill, 1:1 against the adjacent fill, the only change is 2 px of extra orange (B-134)</td></tr>"
  "<tr><td>Contrast, 404 numeral</td><td>signal-text rgb(177,58,0) on #f2eee6: 5.2:1 (decorative, aria-hidden)</td></tr>"
  "<tr><td>Target size</td><td>Every action 44 px tall</td></tr>"
  "<tr><td>HTTP status</td><td>404 for an unknown URL; 200 for /p/ZZZZZZZZZ (plan not found) and for the render error (boundary after streaming starts): worth knowing for monitoring</td></tr>"
  "<tr><td>Reduced motion</td><td>No animations on any of the four pages (getAnimations() empty with motion allowed)</td></tr>"
  "<tr><td>Logo (F12)</td><td>Header: /brand/busk-map-lockup-*.svg, 36 px, new stencil lettering (zoomed 4×); the footer shows the same lockup</td></tr>"
  "<tr><td>768</td><td>Header nav shown, bottom nav hidden, cards centred at 576 px; title 54 px; no breakage</td></tr></table>"),
 ("brand-issues", "BRAND's build issues", "<table><tr><th>Issue</th><th>Result</th><th>Evidence</th></tr>"
  "<tr><td>No h1 on the 404 or either error page</td><td>Not reproduced</td><td>Rendered at 8207373: h1 “No pitch here” (404) and h1 “Something went wrong” (route error) at 390, 768 and 1440. Global error: StatusCard renders &lt;h1&gt; unless embedded, and ErrorCard doesn't embed it (source).</td></tr>"
  "<tr><td>The global error's copy is wrong (“while setting up the pitch”)</td><td>Fixed at 8207373</td><td>error-card.tsx now passes GLOBAL_ERROR_DESCRIPTION when plainLinks (global-error.tsx): “Something went wrong loading Busk Map. Try again, or start over from the home page.” The route error keeps the pitch sentence (E05, B-124 open there).</td></tr>"
  "<tr><td>Home and example actions are buttons, not links</td><td>Not reproduced</td><td>Rendered as &lt;a href=\"/\"&gt; and &lt;a href=\"/plan?example=acoustic\"&gt; (shadcn Button asChild + next/link) on the 404, route error, plan not found and run limit; global error uses a plain &lt;a href=\"/\"&gt;. Only Try again is a &lt;button&gt;, as it should be.</td></tr>"
  "<tr><td>The run limit says “1 plans”</td><td>Fixed at 8207373</td><td>rate-limit.ts pluralises both counts; evaluated with limit 1 → “You've started 1 plan this hour. Try again in about 1 minute.” On the page: “You've started 5 plans this hour. Try again in about 45 minutes.” (R06, B-128)</td></tr>"
  "<tr><td>The plan pages don't switch to the bottom nav at phone width</td><td>Not reproduced</td><td>At 390 /p/ZZZZZZZZZ and the run limit hide the header nav and show the fixed bottom nav with Busks current (U08, R11).</td></tr></table>"),
 ("recheck", "DEV's fixes rechecked at 8207373", "<table><tr><th>Defect</th><th>Result</th><th>Evidence</th></tr>"
  "<tr><td>B-053 (573a599, 3d59083)</td><td>Partly fixed</td><td>“404” numeral in (160 px, centred, aria-hidden; rust signal-text, N03), content centred. Still open: the poster shadow (soft Tailwind blur; N04)</td></tr>"
  "<tr><td>B-054 (573a599)</td><td>Partly fixed</td><td>Warning triangle, centred, reference at the foot under a rule. Still open: the poster shadow (E02, G03)</td></tr>"
  "<tr><td>B-122</td><td>Fixed</td><td>Cards centred vertically (N02, G01)</td></tr>"
  "<tr><td>B-123</td><td>Open</td><td>72 px dashed hex, 56 px title, body not muted (N05–N07, E03–E05)</td></tr>"
  "<tr><td>B-124</td><td>Partly fixed</td><td>Global error has its own copy (G03); the route error still says “pitch” on any page (E05)</td></tr>"
  "<tr><td>B-125</td><td>Partly fixed</td><td>Refresh icon on Try again (E06, G04); no arrow on the plan not found's home link (U06)</td></tr>"
  "<tr><td>B-126</td><td>Open</td><td>Plan not found centred now, but still boxed, 576 px, 56 px title, body not muted (U02, U04, U05, U08)</td></tr>"
  "<tr><td>B-127</td><td>Open</td><td>Layout unchanged (R05, R07, R08, R11); copy changed only</td></tr>"
  "<tr><td>B-128</td><td>Fixed</td><td>“plan”/“plans” and “minute”/“minutes” pluralise (R06)</td></tr>"
  "<tr><td>errorNote</td><td>Not done (DEV)</td><td>A DEV note on the board, not on-page copy; nothing on these pages waits on it (E09)</td></tr></table>"),
 ("new-defects", "New defects (to be numbered in bugs.md)", "<ul>"
  "<li><b>B-134 · Medium · N10, E10 (also U07, G08):</b> at night the default (primary) Button's focus ring is the same orange as its fill (rgb(255,106,43), 0 0 0 2px, flush), so focus shows no visible change; by day the ink ring is fine. Likely every primary Button site-wide.</li>"
  "<li><b>B-155 · Low · N14, E13, G09, U08:</b> at phone width the wrapped buttons stretch full width (max-sm:w-full) and the card gutters are 16 px; board: natural-width buttons, centred, 24 px gutters.</li>"
  "<li><b>B-156 · Low · E08, G06:</b> the “Reference:” label is mono like the digest; board: sans label, mono digest.</li>"
  "</ul>"),
]
