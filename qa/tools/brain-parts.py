# Brain · review: data for qa/tools/page-review.py. v2: BRAND's 40 parts (design-handoff/inventory/brain, BR01-BR40) replace
# v1's 14 provisional ids. The page is night in both themes.
TITLE = "Brain · review"
ROUTE = "/brain"
VERSION = "v2"
COMMIT = "7b1521e"
DATE = "17 Oct 2026"
IMG = "honeycomb/brain/inv/"
CHANGES = ("Re-keyed to BRAND's inventory: 40 parts (BR01-BR40) with BRAND's crops, checked at 1440, 768 and 390, day and night; "
           "user's calls F07-F15 on their rows (F12 as corrected: lockup with the new wordmark); BRAND's two build issues checked (nav current, footer): neither reproduced; B-114..B-121 raised.")
HISTORY = [
    (VERSION, COMMIT, DATE, CHANGES),
    ("v1", "7b1521e", "17 Oct 2026", "First version: 14 provisional parts from the deck's Brain board, trace state, field strip, impeccable critique and audit; B-052."),
]
SOURCE_NOTE = ("Deck: BRAND's crops of the App canvas board Brain (BrainTablet 768, BrainMobile 390). Build: QA's own offline export of 7b1521e. "
               "design/honeycomb predates dev/core's Repertoire R4 (12 kinds, 5 facts, Last.fm, “Suggested set”, Repertoire in the nav); "
               "the board here shows the older numbers (11 kinds, 4 facts, two other sources, 15 data points), so the build is judged against the board and R4 is noted where it changes a row. "
               "DEV landed F07-F12 (a68440d) and F13-F15 (e575a69) after 7b1521e; those rows say so under DEV status but are judged at 7b1521e. F12 as corrected by the user on 17 Oct: the one logo is the lockup [hex mark][new wordmark]; only the old wordmark lettering (larger M, other font) is retired; wordmark-only or mark-only in a header or footer fails. The inventory intro's “wordmark only” is superseded.")
F12 = "a68440d (after 7b1521e; not rechecked) made the header and footer wordmark-only, which fails the corrected F12"
F13 = "Done in e575a69 (after 7b1521e; not rechecked)"


def P(id, name, qa, note, user="", defect="—", b1440=True, b390=True, deck=True, dev="—", spec=None):
    d = {"id": id, "name": name, "qa": qa, "note": note, "user": user, "defect": defect, "dev": dev,
         "deck": f"deck/{id}.jpg" if deck is True else deck,
         "b1440": f"build/{id}-1440.jpg" if b1440 is True else b1440,
         "b390": f"build/{id}-390.jpg" if b390 is True else b390}
    if spec:
        d["spec"] = spec
        d["deck_empty"] = "Spec only (no crop)"
    return d


PARTS = [
 P("BR01", "Header", "Different", "Nav Busks · Week · Brain · Tips with Brain current (aria-current page, orange fill). The logo is the lockup (hex mark + wordmark), which is right under the corrected F12, but its word is the OLD lettering: the M stands taller than B-U-S-K-A-P (zoomed crop). Board: Busks · Week · Setlist · Tips, nothing active (BRAND's spec asks for Brain current in the build). Repertoire joins the nav with R4 on dev/core. Nav hides below 721 px as specified.", "F12 (corrected 17 Oct): the one logo is the lockup [hex mark][new wordmark] in the header, footer and every asset; F12 retired only the old wordmark lettering (larger M, other font). Wordmark-only or mark-only in a header or footer fails; the mark alone only at icon size. Supersedes the inventory intro's “wordmark only”.", "— (F12)", dev=F12),
 P("BR02", "Page intro", "Different", "Night #0f1416 ground, intro max 900 px, gap 18 px as the board. The grain is a 6 px dot grid only (.bm-grain); the board's 4 px dot grain and faint hex lattice behind everything are not drawn.", "", "B-114"),
 P("BR03", "“Powered by Qloo” eyebrow", "Different", "“Powered by” in Qloo purple (rgb 140,140,200) with the Qloo wordmark at clamp(120px, 26vw, 200px) as the board, but the wordmark is a plain svg, not a link to qloo.com. The eyebrow also sits inside the h1, so the heading reads “Powered by Qloo The brain of Busk Map”.", "F09: the Qloo logo links to qloo.com in a new tab (rel=\"noopener noreferrer\").", "— (F09)", dev=F12),
 P("BR04", "Headline", "Present", "“The brain / of Busk Map” on two lines, Big Shoulders 800, uppercase, “brain” in Qloo purple."),
 P("BR05", "Intro line", "Different", "Build: “… Busk Map asks it 11 kinds of question … Pick any piece below to trace its path.” Board: “eleven kinds” and “to light up its path”. 19/29 px, max 640 px as the board.", "", "B-115"),
 P("BR06", "Numbers strip ×4", "Present", "“11” kinds of Qloo call · “24–33” Qloo calls for a new busk · “0” on a rerun: answers cached for 24 h · “9” parts of your busk it decides, on a purple border; 2×2 at 390. R4 on dev/core makes it five facts with 12 kinds."),
 P("BR07", "The wiring", "Present", "Heading and legend, three columns with two wire gutters, then the panel. The gutters are 64 px (gap-x-16) where the board has 72 px; not visible as a difference."),
 P("BR08", "“The wiring” heading", "Present", "h2 “The wiring”, Big Shoulders 800 uppercase."),
 P("BR09", "Wire legend", "Present", "Mono 12/16 muted: solid purple “Qloo”, dashed grey “Spotify, Ticketmaster”, solid orange “The path you picked”; wraps under the heading at 390."),
 P("BR10", "Column heads ×3", "Different", "Purple, paper and orange hexes with “Qloo calls” “11 kinds”, “Data points” “what comes back”, “Your busk”, but the third note reads “9 parts it decides” (board “what it decides”).", "", "B-115"),
 P("BR11", "Qloo call nodes ×12", "Different", "Twelve nodes (1–11 with 5b), names as the board, 53 px tall. The endpoint lines differ: build “/search · urn:entity:artist” (board “/search”), “/entities” (board “/entities · external.spotify.ids”), and 5, 5b, 6, 7 and 8 all end “urn:entity:artist” where the board tells them apart (“artist · explainability”, “artist · no taste signal”, “artist · signal.location”, “artist · filter.results”, “/v2/trending”). R4 on dev/core has 12 kinds.", "", "B-116"),
 P("BR12", "One node (anatomy)", "Present", "Hex number, name and sub-line; every node is a button with aria-pressed; clicking the picked node again clears the trace."),
 P("BR13", "Other sources", "Present", "Sub-head “With two other sources”, dashed transparent nodes “Spotify” artist ids, release years and “Ticketmaster” events near each pitch. R4 (B01) adds Last.fm and “three other sources” on dev/core."),
 P("BR14", "Data point nodes ×15", "Present", "The board's 15 data points with the same sub-lines, in order. R4 (B02) adds a 16th, “Song plays”, on dev/core."),
 P("BR15", "Your busk nodes ×9", "Present", "Nine features in Big Shoulders 800 21/24 uppercase, spread down the column, sub-lines as the board. “Setlist and learn these” keeps the board's name here; R4 (B03) renames it on dev/core."),
 P("BR16", "Wires: calls → data points", "Different", "aria-hidden svg, solid purple 1.5 px Qloo wires and dashed grey (4 3) Spotify/Ticketmaster wires; 54 curves across both gutters. At rest the wires are 60% opacity (board 45%). Hidden below 1024 px as specified.", "", "B-117", b390=None),
 P("BR17", "Wires: data points → your busk", "Different", "Same styles; wires out of Events and times and Release years are dashed grey. Rest opacity 60% (board 45%).", "", "B-117", b390=None),
 P("BR18", "Detail panel, nothing picked", "Different", "“Pick any piece” and “Choose a Qloo call, a data point or a part of your busk, and its whole path lights up. Try Setlist and learn these, where four Qloo calls and Spotify meet.” The board's two orange-arrow “Try …” lines (Setlist and learn these; Taste heatmap) are one run-on sentence; the Taste heatmap prompt is gone.", "", "B-052"),
 P("BR19", "Notes ×3", "Present", "Three cards on an auto-fit grid (min 320 px), one per row at 390. The section is labelled by a hidden “Notes” h2 rather than by the first card's title."),
 P("BR20", "“Numbers come from data” card", "Different", "Same text except “a plan that cites a number no call returned is rejected” (board: “a busk that cites …”).", "", "B-115"),
 P("BR21", "“Light on the quota” card", "Different", "Reworded: “Qloo allows 10,000 requests a month per key, at 5 a second. Busk Map paces its calls to 3 a second and caches every answer for 24 h, so a key covers roughly 300–400 new busks a month, and reruns are free.” Same numbers; drops the board's “because bursts of 4 drew rate-limit errors”.", "", "B-115"),
 P("BR22", "“Next · not built yet” card", "Different", "Dashed card, orange mono eyebrow and the three bullets, but the second reads “Searching Qloo’s genre list directly (/v2/tags)” (board has no endpoint).", "", "B-115"),
 P("BR23", "Back link", "Different", "“← Back to Busk Map”, mono 700 16 px to /, but paper-coloured and underlined (board: orange, no underline).", "", "B-118"),
 P("BR24", "Node hover and focus", "Broken", "Hover turns the border Qloo purple as the board. Keyboard focus draws a double ring (2 px night gap plus 4 px orange box-shadow from the global :focus-visible rule) on all 38 nodes, 390 and 1440, day and night: see the field strip.", "F13–F15: one shared focus ring, never a double ring.", "— (F14; Site-wide S09)", dev=F13),
 P("BR25", "Trace: a part of your busk picked (f_setlist)", "Different", "The right path lights: calls 5, 6, 8, 9, Spotify and 5 data points, 10 wires. Differences: traced nodes get a 2 px orange border but no outline; dimmed nodes are #1f282d with #a7b0b5 text (board #141b20, #9aa4aa); lit wires are 3 px (board 2.5 px) and the rest drop to 15% (board 10%).", "", "B-117"),
 P("BR26", "Picked node", "Different", "2 px orange border and the 4 px orange offset shadow as the board, but the fill is dark orange (rgb 58,37,25; board #26323a) and there is no orange outline.", "", "B-117"),
 P("BR27", "Detail panel, tracing a part of your busk", "Different", "Title “Setlist and learn these” in Qloo purple (board orange). Summary “Setlist and learn these comes from 4 Qloo calls, 1 other source and 5 data points.” (board “Lights up 4 Qloo calls, 5 data points and 1 part of your busk.”). “Comes from:” list matches. Wire lines read “From Artists this crowd likes: learn these: the crowd’s top artists” (board “← Artists this crowd likes: …”).", "", "B-119"),
 P("BR28", "Clear trace", "Different", "Shown only while tracing and clears it, as the board. Drawn as the shadcn outline Button: Atkinson 14 px 700 uppercase, 2 px grey (#76828a) border; board: mono 700 12/16 with a 1.5 px paper border. F15 keeps the shadcn Button; the look belongs in a variant.", "F15: shadcn primitives styled through tokens and variants.", "B-119"),
 P("BR29", "Trace: a Qloo call picked (c3)", "Different", "Taste heatmap lights Taste cells and 5 parts. Panel: “Taste heatmap feeds 1 data point and 5 parts of your busk.” (board “Lights up 1 Qloo call, 1 data point and 5 parts of your busk.”), “Decides: Taste map · Pitch ranking · …” (board order Pitch ranking · Taste map), “To Taste cells: …” (board “→”). “With two other sources” stays visible at 1440 (board hides it when no source is on the path); below 1024 it is removed as specified.", "", "B-119, B-120"),
 P("BR30", "Trace: a data point picked (d_cells)", "Different", "Lines go both ways and the panel says “Decides:” as the board, but as words: “From Taste heatmap: …” and “To Taste map: …” (board ← and →). Summary “Taste cells comes from 1 Qloo call, and feeds 5 parts of your busk.”", "", "B-119"),
 P("BR31", "Trace: Plain-AI comparison (f_plain)", "Present", "“Comes from: Taste heatmap · Places nearby · Headliner match · Ticketmaster” as the board; 3 data points (Taste cells, Open places, Headliner taste match) light. Panel wording as BR27 (B-119)."),
 P("BR32", "Trace transition", "Present", "Measured: nodes transition colour, background and border over 0.15 s; wires transition opacity over 0.15 s. Off under reduced motion (BR37). No still image.", b1440=None, b390=None),
 P("BR33", "Sticky trace panel", "Different", "While tracing the panel sticks to the viewport bottom, max 45vh (405 px at 900) and scrolls inside; at 390 it sits on top of the bottom nav (panel bottom 836 = nav top 836); in the flow when nothing is picked. Differences: z-index 10 (board 4) and a downward shadow-lg instead of the board's 0 −8px 24px upward shadow, so it has no lift off the page.", "", "B-119"),
 P("BR34", "Keyboard trace: panel folds (B-015)", "Present", "With a node keyboard-focused the panel folds to title and Clear trace (88 px at 1440, 118 px at 390); scroll-padding-bottom 104 px / 198 px; the focused node stays clear of the panel. Mouse clicks keep the full panel. B-015 stays fixed.", deck=None, spec="While tracing and a node has keyboard focus, the panel folds to a slim bar (title and Clear trace) so it never hides the focused node (WCAG 2.4.11); scroll-padding-bottom = panel height + 16px, at least 96px, via ResizeObserver."),
 P("BR35", "Below 1024px: one column", "Present", "At 768 (image in the 1440 column) the columns stack, the gutters hide, each list is a two-column grid; while tracing all 27 dimmed nodes are hidden and the empty other-sources sub-head is removed. No sideways scroll.", b1440="build/BR25-768.jpg", b390="build/BR25-390.jpg"),
 P("BR36", "Phone layout", "Present", "At 390 the header nav hides and the bottom nav shows; numbers 2×2; notes one per row; no sideways scroll.", b1440=None, b390="build/full-390-night.jpg"),
 P("BR37", "Reduced motion", "Present", "With prefers-reduced-motion the node and wire transition-property is none; no animations run on the page (document.getAnimations() = 0).", b1440=None, b390=None),
 P("BR38", "Site footer (added by F07–F11)", "Different", "A footer is there, but the old one: lockup with the OLD wordmark lettering (taller M; corrected F12 wants the lockup with the new wordmark), “Taste data by Qloo · MIT licence” (Qloo logo not linked), “OPEN SOURCE github.com/T04435/busk-map”, “Built by T04435 (solo), with Claude, during the Qloo Agentic Hackathon” and the legal line. Not the F07–F11 footer (wordmark + Qloo left; Privacy · Terms · Brain · Brand centre; GitHub cell and Built by with the critter right).", "F07–F11: the SiteFooter as on every public page (chrome inventory FT01–FT11). F12 (corrected): the lockup [hex mark][new wordmark], never wordmark-only.", "— (F07–F11)", deck=None, dev=F12, spec="Not on the board. SiteFooter at the bottom of /brain: lockup and Qloo left (F12 corrected; the board spec says wordmark); Privacy · Terms · Brain · Brand centre; GitHub in a honeycomb cell and “Built by T04435” with the pixel critter right. See chrome FT01–FT11."),
 P("BR39", "Bottom nav (phone)", "Present", "Up to 720 px the MobileNav is fixed at the bottom: Busks · Week · Brain · Tips with Brain current (orange). Repertoire joins with R4 on dev/core.", b1440=None),
 P("BR40", "Night theme only", "Different", "In the day theme the page body and the header stay night as the board, but the bottom nav (rgb 251,249,245) and the footer switch to day paper, so the page ends on a light band and the phone has a light nav under a night page.", "", "B-121"),
]

SECTIONS = [
 ("field-strip", "Field strip (F13, F14): /brain",
  '<p>38 of 38 fields fail at 390 and 1440, day and night (152 checks): every node is a button and shows two ring layers when focused (cause: the global :focus-visible double shadow, Site-wide S09). DEV reports this fixed in e575a69, after 7b1521e.</p>'
  '<a href="../screens/honeycomb/brain/inv/field-strip.jpg"><img src="../screens/honeycomb/brain/inv/field-strip.jpg" alt="Brain field strip: 38 nodes, focused and unfocused"></a>'),
 ("critique", "Impeccable critique",
  "<ol>"
  "<li><b>P2 · The invitation got quieter.</b> The idle panel's two concrete “Try …” prompts became one run-on sentence (BR18, B-052); the page's one interaction is easier to miss.</li>"
  "<li><b>P2 · The trace speaks in two colours.</b> The picked node and its wires are orange, but the panel that explains them titles the pick in purple and writes “From …/To …” where the board draws arrows (BR26, BR27, BR29, BR30). The eye can't tie panel to path at a glance.</li>"
  "<li><b>P2 · Day theme breaks the night page.</b> The footer and bottom nav go paper while the page stays night (BR40), so the page ends on a bright band.</li>"
  "<li><b>P3 · Sub-lines don't tell calls apart.</b> Five Qloo calls end “urn:entity:artist” (BR11), so the column reads as repeats where the board shows what makes each call different.</li>"
  "<li><b>P3 · Small texture and copy drift.</b> No hex lattice in the ground (BR02), “plan” for “busk”, and the back link in paper rather than orange (BR05, BR20, BR23).</li>"
  "</ol>"),
 ("audit", "Impeccable audit",
  "<table><tr><th>Check</th><th>Result</th></tr>"
  "<tr><td>axe (WCAG 2.2 AA tags) at 390 and 1440, day and night; 768 night</td><td>Clean (0 violations, 26 rules passed each)</td></tr>"
  "<tr><td>Sideways scroll at 390, 768, 1440</td><td>None (also none at 768 while tracing)</td></tr>"
  "<tr><td>Heading outline</td><td>h1 › h2 › h3 › h4 › h3 … › h2 (Notes, hidden) › h3; no skips. The h1 includes the eyebrow (“Powered by Qloo The brain of Busk Map”)</td></tr>"
  "<tr><td>Focus</td><td>Doubled ring on all 38 nodes (F14, BR24); Escape clears and focus returns to the traced node (QA brain.spec, v1)</td></tr>"
  "<tr><td>Focus not obscured (2.4.11)</td><td>Pass: the panel folds while a node is focused; focused node clear of it at 390 and 1440 (BR34)</td></tr>"
  "<tr><td>Reduced motion</td><td>Transitions off, 0 running animations (BR37)</td></tr>"
  "<tr><td>Theme</td><td>main pinned dark; footer and bottom nav follow the day theme (BR40)</td></tr></table>"),
 ("brand-issues", "BRAND's build issues",
  "<table><tr><th>Issue</th><th>Result</th><th>Evidence</th></tr>"
  "<tr><td>No nav item is current on /brain</td><td>Not reproduced</td><td>At 7b1521e both navs mark Brain with aria-current=\"page\" and an orange fill (header at 1440, bottom nav at 390): BR01, BR39. The board itself draws no item active.</td></tr>"
  "<tr><td>There's no footer on /brain</td><td>Not reproduced</td><td>A footer renders at 390, 768 and 1440 (109 px tall at 1440, 237 px at 390), but it is the old pre-F07–F11 footer: BR38.</td></tr></table>"),
]
