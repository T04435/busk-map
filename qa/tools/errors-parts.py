# Errors · review: data for qa/tools/page-review.py. Ids follow BRAND's inventory/errors (56 parts): the app 404 (N01–N15),
# route error (E01–E13), global error (G01–G09), plan not found (U01–U08) and run limit (R01–R11). v1's provisional
# E01–E07 are retired: BRAND's ids win (v1 E01 = N03/N04, v1 E02 = E02–E08, v1 E03 = G01–G09, v1 E04 = U01–U08).
import os
TITLE = "Errors · review"
ROUTE = "/this-is-not-a-pitch (404), /plan?example=acoustic&faults=render (route error), global-error.tsx (source), /p/ZZZZZZZZZ (plan not found), /plan?example=sax&faults=fresh-limit (run limit)"
VERSION = "v2"
COMMIT = "7b1521e"
DATE = "17 Oct 2026"
IMG = "honeycomb/errors/inv/"
CHANGES = "BRAND's 56 parts replace v1's 7 provisional rows; adds the plan not found and the run limit, BRAND's build issues checked, B-122..B-128. Headers judged on the corrected F12 (the lockup is the one logo)."
HISTORY = [
    (VERSION, COMMIT, DATE, CHANGES),
    ("v1", COMMIT, DATE, "First version: 404, error and global error against the deck at 3 widths, day and night; field strip; B-053, B-054."),
]
SOURCE_NOTE = "Deck: BRAND's crops from inventory/errors (App canvas NotFound, Error, GlobalError; Plan canvas NotFound, RunLimit). Build: QA's own offline export; the route error comes from faults=render and the run limit from faults=fresh-limit (test only). The global error can't be triggered offline: G rows are judged from global-error.tsx and the shared ErrorCard/StatusCard."
_ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "screens", IMG)
def _has(rel):
    return rel if os.path.exists(os.path.join(_ROOT, rel)) else None
def P(id, name, qa, note, user="", defect="—", spec=None):
    d = {"id": id, "name": name, "qa": qa, "note": note, "user": user, "defect": defect, "dev": "—",
         "deck": _has(f"deck/{id}.jpg"), "b1440": _has(f"build/{id}-1440.jpg"), "b390": _has(f"build/{id}-390.jpg")}
    if spec:
        d["spec"] = spec
        d["deck_empty"] = "Spec only (no crop)"
    return d
F12 = "F12 (corrected 17 Oct): the one logo is the lockup, hex mark + the new wordmark, in the header, footer and every asset; only the old wordmark lettering is retired. Wordmark-only or mark-only in a header fails (the board's wordmark-only header is superseded)."
F14 = "F14: one focus ring, shadcn's own pattern (F15: shadcn Button, no hand-built states)."
PARTS = [
 # Not found (app 404)
 P("N01", "Header", "Different", "Lockup shape (hex mark + wordmark) is what F12 asks, but the word is the OLD lettering (the M rises above the other letters; zoomed header crop, QA 17 Oct), so F12 isn't met yet (the board's wordmark-only header is superseded). Nav Busks · Week · Brain · Tips, none active, as the spec.", F12),
 P("N02", "Page layout", "Different", "Header, main, then the bottom nav on phones. The card sits at the top of main (y 112 at 1440), not centred vertically; card column 576 px with 16 px gutters (board: main max 640, 64/24 px padding); the site footer follows the card (board: none).", "", "B-122"),
 P("N03", "“404” numeral", "Missing", "No “404” anywhere on the page (checked in the DOM); the HTTP status is 404.", "", "B-053"),
 P("N04", "Not-found card", "Different", "Card background and 2 px rule border match. No md shadow; padding 24 px (board 40/24); content left-aligned (board centred).", "", "B-053"),
 P("N05", "Pin hex", "Different", "72 px dashed hex with an orange-offset pin (the plan not found's cell); board: 64 px solid lifted hex, orange offset behind, plain pin.", "", "B-123"),
 P("N06", "Title", "Different", "“No pitch here” is the page's h1, as the spec says. Set in Big Shoulders 56 px caps (40 px at 390), left-aligned; the board's title is small (about 18 px) and centred under a big numeral.", "", "B-123"),
 P("N07", "Body", "Different", "Copy exact: “This page doesn't exist. It may have moved, or the link may be incomplete.” Full foreground colour and left-aligned (board muted, centred).", "", "B-053, B-123"),
 P("N08", "“Go to Busk Map home”", "Present", "An <a href=\"/\"> styled as the primary Button (shadcn asChild), 44 px tall; full width at 390."),
 P("N09", "“Try an example plan”", "Present", "An <a href=\"/plan?example=acoustic\"> styled as the outline Button beside it; full width under it at 390."),
 P("N10", "Focus", "Broken", "Both links show two ring layers when focused (2 px cream gap + 2 px dark ring); field strip: 0 of 2 pass at 390 and 1440, day and night.", F14, "—", spec="Not drawn. Both buttons: one focus ring, shadcn's pattern (F14)."),
 P("N11", "Night theme", "Present", "Night tokens (body #0f1416, card #182025); axe clean. Carries N03–N07's differences."),
 P("N12", "Phone header (≤720px)", "Different", "Below 768 px the header nav hides and only the lockup stays; the word is the OLD lettering (the M rises above the other letters; zoomed header crop, QA 17 Oct), so F12 isn't met yet. Breakpoint 768, board 721; at 768 both read the same.", F12),
 P("N13", "Bottom nav (≤720px)", "Present", "Fixed at the bottom, Busks · Week · Brain · Tips, no item current. Shows under 768 px (board: under 721)."),
 P("N14", "Phone layout (≤720px)", "Different", "No numeral; the two links stack full width and left-aligned (board: they wrap and stay centred). No sideways scroll.", "", "B-053"),
 P("N15", "Reduced motion", "Present", "No animations on the page (document.getAnimations() is empty with motion allowed).", "", "—", spec="No motion on this page."),
 # Route error
 P("E01", "Header", "Different", "Lockup, but the word is the OLD lettering (the M rises above the other letters; zoomed header crop, QA 17 Oct), so F12 isn't met yet. Busks is active because the failing page was /plan (the header follows the URL; the board draws no item active).", F12),
 P("E02", "Error card", "Different", "Card background, 2 px rule border, role alert. No md shadow, 24 px padding, left-aligned, reference above the buttons with no rule.", "", "B-054"),
 P("E03", "Warning hex", "Different", "Error-tone lifted hex, but 72 px and a circled “!” (CircleAlert); board: 64 px with the warning triangle.", "", "B-054"),
 P("E04", "Title", "Different", "“Something went wrong” is the h1 (as the spec) inside the role alert card; 56 px display caps over two lines, left-aligned (board: small, centred).", "", "B-123"),
 P("E05", "Body", "Different", "Copy matches the board: “Something went wrong while setting up the pitch. Try again, or start over from the home page.” Not muted, left-aligned. The same sentence shows for a failure on any page (see G03).", "", "B-054, B-124"),
 P("E06", "“Try again”", "Different", "A <button>, primary, calls retry() (Next 16's prop, per the bundled docs). No refresh icon.", "", "B-125"),
 P("E07", "“Go home”", "Present", "An <a href=\"/\"> styled as the outline Button."),
 P("E08", "Reference line", "Different", "“Reference: 3181619963” in 12 px mono muted, above the buttons, left-aligned, no rule; the label is mono too (board: 13 px sans label, mono digest, under a 1 px rule at the foot, centred). No other error details shown.", "", "B-054"),
 P("E09", "Error digest", "Present", "From the source: the line renders only when error.digest is set (footnote null otherwise); the server render error showed its digest. A client error (no digest) can't be forced offline.", "", "—", spec="The reference is the error's digest (matches the server log). While null, hide the line."),
 P("E10", "Focus", "Broken", "“Try again” and “Go home” both show the two-layer ring (cream gap + dark ring).", F14, "—", spec="Not drawn. One focus ring on both buttons (F14)."),
 P("E11", "Night theme", "Present", "Night tokens; axe clean at 390 and 1440. Carries E02's differences."),
 P("E12", "Bottom nav (≤720px)", "Present", "Fixed at the bottom; header nav hidden. Busks is current because the failing URL is /plan (board: none current)."),
 P("E13", "Phone layout (≤720px)", "Different", "Card 358 px wide (16 px gutters, board 24); buttons stack full width and left-aligned (board: wrap, centred). No sideways scroll.", "", "B-054"),
 # Global error (source only)
 P("G01", "No layout", "Different", "From the source: global-error.tsx renders its own <html>/<body>, no header, nav or footer, as the board. The card uses the same <main> wrapper as the other pages (flex-1, py-8/12), so it sits at the top, not centred on the background.", "", "B-122"),
 P("G02", "System font fallback", "Present", "From the source: the html element sets system-ui, -apple-system, “Segoe UI”, Roboto, sans-serif and maps --font-display/--font-sans to it (mono to the ui-monospace stack); the title stays bold caps."),
 P("G03", "Error card", "Different", "From the source: the same ErrorCard as E02 (so B-054's differences). Copy “Something went wrong while setting up the pitch. Try again, or start over from the home page.” matches the board but is wrong here: the whole app failed, no pitch was being set up (BRAND).", "", "B-054, B-124"),
 P("G04", "“Try again”", "Different", "From the source: a <button>, primary, calls retry(). No refresh icon.", "", "B-125"),
 P("G05", "“Go home”", "Present", "From the source: a plain <a href=\"/\"> (plainLinks), so a full page load, styled as the outline Button."),
 P("G06", "Reference line", "Different", "From the source: as E08 (above the buttons, no rule).", "", "B-054"),
 P("G07", "Error digest", "Present", "From the source: same ErrorCard, the line renders only when the digest is set.", "", "—", spec="As on the route error: the digest from the server log; hide the line while null."),
 P("G08", "Night theme", "Present", "From the source: globals.css is imported and follows prefers-color-scheme with no layout script; not rendered (can't trigger offline)."),
 P("G09", "Phone layout (≤720px)", "Different", "From the source: same card, 16 px gutters, buttons full width under 640 px (max-sm:w-full), no bottom nav (the layout is gone).", "", "B-054"),
 # Plan not found
 P("U01", "Header", "Different", "Busks active, as the spec. Lockup, but the word is the OLD lettering (the M rises above the other letters; zoomed header crop, QA 17 Oct), so F12 isn't met yet.", F12),
 P("U02", "Plan not found", "Different", "Wrapped in the shared bordered card (card background, 2 px rule, 24 px padding), left-aligned, 576 px; board: no card, centred on the page background, max 520 px, 48 px top padding. The page is served with HTTP 200.", "", "B-126"),
 P("U03", "Dashed pin hex", "Present", "72 px lifted dashed hex with the pin, as the board (left-aligned, not centred: U02)."),
 P("U04", "Title", "Different", "h1 “We can't find this busk”, Big Shoulders 800 caps, but 56 px (40 at 390; board 44 px) and left-aligned.", "", "B-126"),
 P("U05", "Body", "Different", "Copy exact: “The link may be cut short or mistyped. Check you copied all of it, or start a new busk.” 17/26 as the board, but full foreground colour (board muted) and left-aligned.", "", "B-126"),
 P("U06", "“Go to Busk Map home”", "Different", "An <a href=\"/\"> styled as the primary Button. No arrow-right icon.", "", "B-125"),
 P("U07", "Night theme", "Present", "Night tokens; axe clean. Carries U02's differences."),
 P("U08", "Phone layout (≤720px)", "Different", "Switches to the phone header and the bottom nav (Busks current), as the spec asks; but stacks left-aligned in the card with a full-width button (board: centred).", "", "B-126"),
 # Run limit
 P("R01", "Header", "Different", "Busks active, as the spec. Lockup, but the word is the OLD lettering (the M rises above the other letters; zoomed header crop, QA 17 Oct), so F12 isn't met yet.", F12),
 P("R02", "Plan eyebrow", "Different", "“MELBOURNE · FRIDAY 2026-10-16, 5 PM–8 PM · GENERAL PERMIT”: mono bold caps muted, the requested plan's city · day · hours · permit. The date is ISO with the full weekday and the hours read “5 PM–8 PM” (board “Sat 18 Oct · 6–9 pm”); same header as Plan · review P01. The city is the plan's own, so F20 is met.", "F20: no “Melbourne” in eyebrows unless the data is that city's (here it is the plan's city)."),
 P("R03", "Act title", "Present", "h1 “SOUL AND FUNK SAX PLAYER” (the sax example), Big Shoulders 56 px caps (40 at 390)."),
 P("R04", "Requested plan", "Present", "Eyebrow and title come from the request (city, date, hours, permit, act). The null case (no request in hand) isn't reachable: the page always parses a request before rendering.", "", "—", spec="Eyebrow and title come from the plan request. While null, show only the alert and the home link."),
 P("R05", "Plan limit alert", "Different", "Warning alert, clock icon, “Plan limit reached”, “You've started 5 plans this hour. Try again in about 45 minutes, or open one of your earlier plans.” (45 is the test fault's wait). The alert spans the full content width (1120 px at 1440; board max 760), holds the home button, and sits under the Plan my week instead · Tip log buttons, the status line and the offline test-data banner and alert.", "", "B-127"),
 P("R06", "Limit and minutes", "Different", "Minutes are pluralised (“1 minute”). “plans” never is: the message is `${FRESH_RUNS_PER_HOUR} plans this hour`; the limit is a constant 5, and the template with 1 reads “You've started 1 plans this hour.” (evaluated). Not a live binding.", "", "B-128", spec="“5” is the hourly limit and “20” the minutes; with limit 1 the build says “1 plan”, likewise “1 minute”."),
 P("R07", "“No new plan was started.”", "Different", "role status, dashed hex with the clock. Sans 14 px, 24 px hex (board mono 14/20, 28 px), and above the alerts (board: under the alert).", "", "B-127"),
 P("R08", "“Back to Busk Map home”", "Different", "An outline uppercase Button inside the alert (href /); board: a bold signal-coloured text link under the status line.", "", "B-127"),
 P("R09", "Earlier plans link", "Present", "No link to earlier plans, as the board. The alert still says “open one of your earlier plans” with no way to.", "Open question: DESIGN to confirm whether a link to the performer's plans belongs here.", "—", spec="Not drawn. The alert says “open one of your earlier plans” but the board gives no way to; DESIGN to confirm."),
 P("R10", "Night theme", "Present", "Night tokens; axe clean at 390 and 1440."),
 P("R11", "Phone layout (≤720px)", "Different", "Single column, the alert fills the width, phone header and bottom nav (Busks current), as the spec. The alert starts 672 px down, under the act buttons, status line and test-data banner and alert.", "", "B-127"),
]
_A = "../screens/honeycomb/errors/inv/"
SECTIONS = [
 ("field-strip", "Field strip (F14): app 404", f'<p>Route /no-such-page (same 404 as /this-is-not-a-pitch), from the existing 7b1521e field-strip data. Columns: day 1440, night 1440, day 390, night 390; each pair unfocused then focused. Result: <b>0 of 2 pass</b>: both links show two ring layers when focused. The route error\'s Try again and Go home and the plan not found\'s link use the same Button (measured: the same two-layer box-shadow).</p><a href="{_A}field-strip.jpg"><img src="{_A}field-strip.jpg" alt="404 field strip"></a>'),
 ("critique", "Impeccable critique", "<ol>"
  "<li><b>P2 · One card for four different moments.</b> The build pushes the 404, route error, global error and plan not found through one left-aligned StatusCard with a 56 px title (N04–N07, E02–E05, U02–U05). The boards give each its own weight: a big orange 404 with a quiet centred card, a calm error card, an unboxed plan not found. Recognition suffers most on the 404 (N03, B-053).</li>"
  "<li><b>P2 · The run limit is buried.</b> On a phone the alert starts 672 px down, under the act's buttons, the status line and the test-data banner (R05, R11); the one thing to read is the last thing seen.</li>"
  "<li><b>P2 · A promise with no path.</b> “open one of your earlier plans” offers nothing to open (R09): an open question for DESIGN, but the copy shouldn't promise it until there is a link.</li>"
  "<li><b>P3 · Copy written for one failure.</b> “while setting up the pitch” shows on every route error and on the global error, where nothing was being set up (E05, G03).</li>"
  "<li><b>P3 · The reference competes with the actions</b> (E08): the board keeps it as a footnote under a rule (B-054).</li>"
  "</ol>"),
 ("audit", "Impeccable audit", "<table><tr><th>Check</th><th>Result</th></tr>"
  "<tr><td>axe (WCAG 2.2 AA tags) at 390 and 1440, day and night: 404, route error, plan not found, run limit</td><td>Clean (0 violations, 16 runs)</td></tr>"
  "<tr><td>Sideways scroll at 390, 768, 1440 (day and night)</td><td>None on any of the four pages</td></tr>"
  "<tr><td>Heading outline</td><td>One h1 each: “No pitch here”, “Something went wrong”, “We can't find this busk”, the act name on the run limit; no other headings in main. Global error: h1 (StatusCard, not embedded) from the source</td></tr>"
  "<tr><td>Landmarks</td><td>One &lt;main id=main&gt; per page; skip link present (layout)</td></tr>"
  "<tr><td>Focus (2.4.7)</td><td>Visible on every action, but two ring layers (F14; N10, E10)</td></tr>"
  "<tr><td>Target size</td><td>Every action 44 px tall</td></tr>"
  "<tr><td>HTTP status</td><td>404 for an unknown URL; 200 for /p/ZZZZZZZZZ (plan not found) and for the render error (boundary after streaming starts): worth knowing for monitoring</td></tr>"
  "<tr><td>Reduced motion</td><td>No animations on the 404, route error or plan not found</td></tr>"
  "<tr><td>768</td><td>Header nav shown, bottom nav hidden, card centred at 576 px; no breakage</td></tr></table>"),
 ("brand-issues", "BRAND's build issues", "<table><tr><th>Issue</th><th>Result</th><th>Evidence</th></tr>"
  "<tr><td>No h1 on the 404 or either error page</td><td>Not reproduced</td><td>Rendered: h1 “No pitch here” (404) and h1 “Something went wrong” (route error) at 390 and 1440. Global error: StatusCard renders &lt;h1&gt; unless embedded, and ErrorCard doesn't embed it (source). Only the /brand page's embedded copy uses h3.</td></tr>"
  "<tr><td>The global error's copy is wrong (“while setting up the pitch”)</td><td>Confirmed</td><td>error-card.tsx ERROR_DESCRIPTION is shared by error.tsx and global-error.tsx: “Something went wrong while setting up the pitch. Try again, or start over from the home page.” (G03, E05; B-124)</td></tr>"
  "<tr><td>Home and example actions are buttons, not links</td><td>Not reproduced</td><td>Rendered as &lt;a href=\"/\"&gt; and &lt;a href=\"/plan?example=acoustic\"&gt; (shadcn Button asChild + next/link) on the 404, route error, plan not found and run limit; global error uses a plain &lt;a href=\"/\"&gt;. Only Try again is a &lt;button&gt;, as it should be.</td></tr>"
  "<tr><td>The run limit says “1 plans”</td><td>Confirmed in source (not renderable)</td><td>rate-limit.ts: `You've started ${FRESH_RUNS_PER_HOUR} plans this hour…`; minutes are pluralised, plans aren't. FRESH_RUNS_PER_HOUR is a constant 5, so a count of 1 can't be rendered without a code change; the template evaluated with 1 reads “You've started 1 plans this hour.” (R06, B-128)</td></tr>"
  "<tr><td>The plan pages don't switch to the bottom nav at phone width</td><td>Not reproduced</td><td>At 390 /p/ZZZZZZZZZ and the run limit hide the header nav and show the fixed bottom nav with Busks current (U08, R11); the nav is in the root layout, md:hidden, on every page.</td></tr></table>"),
 ("new-defects", "New defects (to be numbered in bugs.md)", "<ul>"
  "<li><b>B-122 · Low · N02, G01:</b> the 404, route error and global error cards sit at the top of main instead of centred vertically.</li>"
  "<li><b>B-123 · Low · N05, N06, N07, E04:</b> the shared StatusCard doesn't follow the board's EmptyState/ErrorState: 72 px dashed hex on the 404 (board 64 px solid), 56 px display title (board small), body not muted.</li>"
  "<li><b>B-124 · Low · G03, E05:</b> error copy “while setting up the pitch” shows on every route error and on the global error.</li>"
  "<li><b>B-125 · Low · E06, G04, U06:</b> missing button icons: refresh on Try again, arrow-right on the plan not found's home link.</li>"
  "<li><b>B-126 · Low · U02, U04, U05, U08:</b> plan not found is boxed in a card and left-aligned; board unboxed, centred, max 520 px, 44 px title.</li>"
  "<li><b>B-127 · Medium · R05, R07, R08, R11:</b> run limit layout: alert full width (board max 760) and below the act buttons, status line and test-data blocks (672 px down at 390); status line in sans above the alert; home is an outline button inside the alert, not a bold link under it.</li>"
  "<li><b>B-128 · Low · R06:</b> “plans” isn't pluralised in the limit message (a limit of 1 would read “1 plans”).</li>"
  "</ul>"),
]
