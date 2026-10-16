# Brain · review: data for qa/tools/page-review.py. v2: BRAND's 40 parts (design-handoff/inventory/brain, BR01-BR40) replace
# v1's 14 provisional ids. v3: every row re-judged at 8207373 (DEV closed the F round). The page is night in both themes.
TITLE = "Brain · review"
ROUTE = "/brain"
VERSION = "v3"
COMMIT = "8207373"
DATE = "17 Oct 2026"
IMG = "honeycomb/brain/inv/"
CHANGES = ("Recheck at 8207373: BR01 now Present (lockup with the new stencil wordmark, F12 corrected); BR03 now Present (Qloo logo links to qloo.com, new tab, F09; eyebrow out of the h1); "
           "BR38 now Present (F07-F11 footer with the lockup); BR24 Broken: the double ring is gone (one 2px orange ring, F13-F14), but a picked node shows no ring at all while focused (B-149); "
           "BR34 Broken: picking a node with Enter can leave it hidden behind the folded panel (1440) or scrolled off screen (390) (B-150). "
           "B-052 and B-114..B-121 still open (copy, trace styling, day-theme footer and bottom nav unchanged).")
HISTORY = [
    (VERSION, COMMIT, DATE, CHANGES),
    ("v2", "7b1521e", "17 Oct 2026", "Re-keyed to BRAND's inventory: 40 parts (BR01-BR40) with BRAND's crops, checked at 1440, 768 and 390, day and night; "
           "user's calls F07-F15 on their rows (F12 as corrected: lockup with the new wordmark); BRAND's two build issues checked (nav current, footer): neither reproduced; B-114..B-121 raised."),
    ("v1", "7b1521e", "17 Oct 2026", "First version: 14 provisional parts from the deck's Brain board, trace state, field strip, impeccable critique and audit; B-052."),
]
SOURCE_NOTE = ("Deck: BRAND's crops of the App canvas board Brain (BrainTablet 768, BrainMobile 390). Build: QA's own offline export of 8207373 (production build, port 3244), images in inv/v3/; v2 images at 7b1521e stay in inv/build/. "
               "design/honeycomb predates dev/core's Repertoire R4 (12 kinds, 5 facts, Last.fm, “Suggested set”, Repertoire in the nav); "
               "the board here shows the older numbers (11 kinds, 4 facts, two other sources, 15 data points), so the build is judged against the board and R4 is noted where it changes a row. "
               "F12 as corrected by the user on 17 Oct: the one logo is the lockup [hex mark][new stencil wordmark] in header, footer and assets; wordmark-only or mark-only fails (favicon excepted). "
               "Checked against design-handoff/user-feedback-2026-10-17/04-wordmark-only-one.png: the header and footer lockups use the new face (M the same height as the other letters).")
F12 = "8207373: Logo is the design system's lockup files as images (header 36 px, footer 34 px, dark/light by theme)"
FOCUS = "Declared: a scoped one-ring focus fallback for plain links and buttons (asking BRAND)"


def P(id, name, qa, note, user="", defect="—", b1440=True, b390=True, deck=True, dev="—", spec=None):
    d = {"id": id, "name": name, "qa": qa, "note": note, "user": user, "defect": defect, "dev": dev,
         "deck": f"deck/{id}.jpg" if deck is True else deck,
         "b1440": f"v3/{id}-1440.jpg" if b1440 is True else b1440,
         "b390": f"v3/{id}-390.jpg" if b390 is True else b390}
    if spec:
        d["spec"] = spec
        d["deck_empty"] = "Spec only (no crop)"
    return d


PARTS = [
 P("BR01", "Header", "Present", "At 8207373: the logo is the lockup image (busk-map-lockup-dark.svg, 176×36) with the NEW stencil wordmark: the M matches the other letters (zoomed, checked against the user's 04-wordmark-only-one.png). Nav Busks · Week · Brain · Tips with Brain current (aria-current page, orange fill); logo and nav links focus with one 2px paper ring. Board: Busks · Week · Setlist · Tips, nothing active (BRAND's spec asks for Brain current in the build). Repertoire joins the nav with R4 on dev/core. Nav hides below 721 px as specified.", "F12 (corrected 17 Oct): the one logo is the lockup [hex mark][new stencil wordmark] in header, footer and every asset; wordmark-only or mark-only fails except the favicon.", "— (F12 done)", dev=F12),
 P("BR02", "Page intro", "Different", "Night #0f1416 ground, intro max 900 px, gap 18 px as the board. The grain is a 6 px dot grid only (.bm-grain); the board's 4 px dot grain and faint hex lattice behind everything are not drawn.", "", "B-114"),
 P("BR03", "“Powered by Qloo” eyebrow", "Present", "At 8207373: “Powered by” in Qloo purple (rgb 140,140,200) with the Qloo wordmark at clamp(120px, 26vw, 200px), now a link: href https://qloo.com, target _blank, rel “noopener noreferrer”, label “Qloo (opens qloo.com in a new tab)”, one 2px orange focus ring. The eyebrow moved out of the h1; the h1 keeps a hidden “Powered by Qloo:” prefix.", "F09: the Qloo logo links to qloo.com in a new tab (rel=\"noopener noreferrer\").", "— (F09 done)"),
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
 P("BR24", "Node hover and focus", "Broken", "At 8207373 the double ring is gone: Tab onto a node draws one 2px orange ring (box-shadow 0 0 0 2px #ff6a2b, no outline), 5.8:1 against the node and 6.5:1 against the page; field strip 38/38 pass. Hover turns the border Qloo purple as the board. But press Enter and the node, now picked and still focused, shows NO ring: its own 4px offset shadow (a utility) replaces the base-layer focus ring, so it looks the same focused or not (image: left Tab, right Enter; 1440 and 390). On path nodes the ring sits flush on the orange 2px border and reads as a thicker border (the board's spec drew a 2px outline with 2px offset; F13–F15's one shared ring wins).", "F13–F15: one shared focus ring, never a double ring.", "B-149", dev=FOCUS),
 P("BR25", "Trace: a part of your busk picked (f_setlist)", "Different", "The right path lights: calls 5, 6, 8, 9, Spotify and 5 data points, 10 wires. Differences: traced nodes get a 2 px orange border but no outline; dimmed nodes are #1f282d with #a7b0b5 text (board #141b20, #9aa4aa); lit wires are 3 px (board 2.5 px) and the rest drop to 15% (board 10%).", "", "B-117"),
 P("BR26", "Picked node", "Different", "2 px orange border and the 4 px orange offset shadow as the board, but the fill is dark orange (rgb 58,37,25; board #26323a) and there is no orange outline.", "", "B-117"),
 P("BR27", "Detail panel, tracing a part of your busk", "Different", "Title “Setlist and learn these” in Qloo purple (board orange). Summary “Setlist and learn these comes from 4 Qloo calls, 1 other source and 5 data points.” (board “Lights up 4 Qloo calls, 5 data points and 1 part of your busk.”). “Comes from:” list matches. Wire lines read “From Artists this crowd likes: learn these: the crowd’s top artists” (board “← Artists this crowd likes: …”).", "", "B-119"),
 P("BR28", "Clear trace", "Different", "Shown only while tracing and clears it, as the board. Drawn as the shadcn outline Button: Atkinson 14 px 700 uppercase, 2 px grey (#76828a) border; board: mono 700 12/16 with a 1.5 px paper border. F15 keeps the shadcn Button; the look belongs in a variant.", "F15: shadcn primitives styled through tokens and variants.", "B-119"),
 P("BR29", "Trace: a Qloo call picked (c3)", "Different", "Taste heatmap lights Taste cells and 5 parts. Panel: “Taste heatmap feeds 1 data point and 5 parts of your busk.” (board “Lights up 1 Qloo call, 1 data point and 5 parts of your busk.”), “Decides: Taste map · Pitch ranking · …” (board order Pitch ranking · Taste map), “To Taste cells: …” (board “→”). “With two other sources” stays visible at 1440 (board hides it when no source is on the path); below 1024 it is removed as specified.", "", "B-119, B-120"),
 P("BR30", "Trace: a data point picked (d_cells)", "Different", "Lines go both ways and the panel says “Decides:” as the board, but as words: “From Taste heatmap: …” and “To Taste map: …” (board ← and →). Summary “Taste cells comes from 1 Qloo call, and feeds 5 parts of your busk.”", "", "B-119"),
 P("BR31", "Trace: Plain-AI comparison (f_plain)", "Present", "“Comes from: Taste heatmap · Places nearby · Headliner match · Ticketmaster” as the board; 3 data points (Taste cells, Open places, Headliner taste match) light. Panel wording as BR27 (B-119)."),
 P("BR32", "Trace transition", "Present", "Measured: nodes transition colour, background and border over 0.15 s; wires transition opacity over 0.15 s. Off under reduced motion (BR37). No still image.", b1440=None, b390=None),
 P("BR33", "Sticky trace panel", "Different", "While tracing the panel sticks to the viewport bottom, max 45vh (405 px at 900) and scrolls inside; at 390 it sits on top of the bottom nav (panel bottom 836 = nav top 836); in the flow when nothing is picked. Differences: z-index 10 (board 4) and a downward shadow-lg instead of the board's 0 −8px 24px upward shadow, so it has no lift off the page.", "", "B-119"),
 P("BR34", "Keyboard trace: panel folds (B-015)", "Broken", "The fold works: with a node keyboard-focused while tracing, the panel folds to title and Clear trace (88 px at 1440, 118 px at 390), scroll-padding-bottom 104 px / 198 px, and Tab keeps the next node clear (B-015 stays fixed). But picking a node with Enter does not bring it back into view: at 1440, node 1 (Tab-focused at 828–883 in a 900 px viewport) ends fully under the folded panel (812–900); at 390, Data point “Taste cells” jumps to −425 px (off screen above) when the dimmed nodes are removed, and the panel sits over the notes (images: 1440 left, 390 right). WCAG 2.4.11 / 2.4.7.", "", "B-150", deck=None, spec="While tracing and a node has keyboard focus, the panel folds to a slim bar (title and Clear trace) so it never hides the focused node (WCAG 2.4.11); scroll-padding-bottom = panel height + 16px, at least 96px, via ResizeObserver."),
 P("BR35", "Below 1024px: one column", "Present", "At 768 (image in the 1440 column) the columns stack, the gutters hide, each list is a two-column grid; while tracing all 27 dimmed nodes are hidden and the empty other-sources sub-head is removed. No sideways scroll.", b1440="v3/BR25-768.jpg", b390="v3/BR25-390.jpg"),
 P("BR36", "Phone layout", "Present", "At 390 the header nav hides and the bottom nav shows; numbers 2×2; notes one per row; no sideways scroll.", b1440=None, b390="v3/full-390-night.jpg"),
 P("BR37", "Reduced motion", "Present", "With prefers-reduced-motion the node and wire transition-property is none; no animations run on the page (document.getAnimations() = 0).", b1440=None, b390=None),
 P("BR38", "Site footer (added by F07–F11)", "Present", "At 8207373 the F07–F11 footer: left the lockup image (34 px, new stencil wordmark; dark file by night, light file by day) and “with” the Qloo logo linking to qloo.com (new tab, noopener noreferrer); centre Privacy · Terms · Brain · Brand; right GitHub in a honeycomb cell and “Built by T04435” with the pixel critter. 97 px tall at 1440, three stacked rows at 390 (211 px). Its day-theme look is BR40.", "F07–F11: the SiteFooter as on every public page (chrome inventory FT01–FT11). F12 (corrected): the lockup [hex mark][new wordmark], never wordmark-only.", "— (F07–F12 done)", deck=None, dev=F12, spec="Not on the board. SiteFooter at the bottom of /brain: lockup and Qloo left (F12 corrected; the board spec says wordmark); Privacy · Terms · Brain · Brand centre; GitHub in a honeycomb cell and “Built by T04435” with the pixel critter right. See chrome FT01–FT11."),
 P("BR39", "Bottom nav (phone)", "Present", "Up to 720 px the MobileNav is fixed at the bottom: Busks · Week · Brain · Tips with Brain current (orange). Repertoire joins with R4 on dev/core.", b1440=None),
 P("BR40", "Night theme only", "Different", "In the day theme the page body and the header stay night as the board, but the bottom nav (rgb 251,249,245) and the footer switch to day paper, so the page ends on a light band and the phone has a light nav under a night page.", "", "B-121"),
]

SECTIONS = [
 ("field-strip", "Field strip (F13, F14): /brain",
  '<p>At 8207373 (fields8 data): 38 of 38 fields pass at 390 and 1440, day and night (152 checks): one border and one 2px orange ring per focused node. The strip measures unpicked nodes only; a picked node shows no ring while focused (BR24, B-149). v2 at 7b1521e: 38 of 38 failed (double ring).</p>'
  '<a href="../screens/honeycomb/brain/inv/v3/field-strip.jpg"><img src="../screens/honeycomb/brain/inv/v3/field-strip.jpg" alt="Brain field strip at 8207373: 38 nodes, focused and unfocused"></a>'),
 ("critique", "Impeccable critique",
  "<ol>"
  "<li><b>P1 · Keyboard picking loses the user.</b> Enter on a node can leave it under the folded panel or scrolled off screen (BR34, B-150), and the picked node has no focus ring anyway (BR24, B-149). The page's one interaction is the one keyboard users can't follow.</li>"
  "<li><b>P2 · The invitation got quieter.</b> The idle panel's two concrete “Try …” prompts are one run-on sentence (BR18, B-052).</li>"
  "<li><b>P2 · The trace speaks in two colours.</b> The picked node and its wires are orange, but the panel titles the pick in purple and writes “From …/To …” where the board draws arrows (BR26, BR27, BR29, BR30; B-117, B-119).</li>"
  "<li><b>P2 · Day theme breaks the night page.</b> The footer and bottom nav go paper while the page stays night (BR40, B-121), so the page ends on a bright band.</li>"
  "<li><b>P3 · Sub-lines don't tell calls apart; small copy drift.</b> Five Qloo calls end “urn:entity:artist” (BR11, B-116); no hex lattice (BR02, B-114); “plan” for “busk” and other wording (B-115); back link in paper (BR23, B-118).</li>"
  "</ol>"),
 ("audit", "Impeccable audit",
  "<table><tr><th>Check</th><th>Result at 8207373</th></tr>"
  "<tr><td>axe (WCAG 2.2 AA tags) at 390 and 1440, day and night; 768 night</td><td>Clean (0 violations, 26 rules passed each)</td></tr>"
  "<tr><td>Sideways scroll at 390, 768, 1440</td><td>None (also none at 768 while tracing)</td></tr>"
  "<tr><td>Heading outline</td><td>h1 › h2 › h3 › h4 › h3 h3 › h2 (Notes, hidden) › h3 h3 h3; no skips. The eyebrow is now outside the h1; the h1 reads “Powered by Qloo: The brain of Busk Map” (hidden prefix)</td></tr>"
  "<tr><td>Focus (F13–F14)</td><td>One 2px ring on nodes (orange, 5.8:1 vs node, 6.5:1 vs page), Qloo links, back link, footer links; header logo and nav one 2px paper ring (14.8:1). Field strip 38/38. Fails: picked node focused shows no ring (BR24, B-149)</td></tr>"
  "<tr><td>Focus not obscured (2.4.11)</td><td>Fail on keyboard pick: 1440 node hidden under the folded panel; 390 node scrolled off screen (BR34, B-150). Tab while tracing: pass</td></tr>"
  "<tr><td>Logo (F12 corrected)</td><td>Header and footer: lockup images busk-map-lockup-dark/light.svg, 36 px and 34 px, new stencil wordmark (BR01, BR38)</td></tr>"
  "<tr><td>Qloo links (F09)</td><td>Eyebrow and footer: https://qloo.com, target _blank, rel noopener noreferrer, labelled “opens qloo.com in a new tab”</td></tr>"
  "<tr><td>Reduced motion</td><td>Transitions off (transition-property none), 0 running animations (BR37)</td></tr>"
  "<tr><td>Theme</td><td>main pinned dark; footer and bottom nav follow the day theme (BR40, B-121)</td></tr></table>"),
 ("brand-issues", "BRAND's build issues",
  "<table><tr><th>Issue</th><th>Result</th><th>Evidence</th></tr>"
  "<tr><td>No nav item is current on /brain</td><td>Not reproduced</td><td>At 8207373 both navs mark Brain with aria-current=\"page\" and an orange fill (header at 1440, bottom nav at 390): BR01, BR39.</td></tr>"
  "<tr><td>There's no footer on /brain</td><td>Not reproduced</td><td>The F07–F11 footer renders at 390, 768 and 1440 (97 px at 1440, 211 px at 390) with the lockup, Qloo link, Privacy · Terms · Brain · Brand and GitHub / Built by: BR38.</td></tr></table>"),
]
