# Brain · review: data for qa/tools/page-review.py. v2: BRAND's 40 parts (design-handoff/inventory/brain, BR01-BR40) replace
# v1's 14 provisional ids. v3: every row re-judged at 8207373. v4: the one full pass at DEV's closing commit f83f1a1.
# The page is night in both themes.
TITLE = "Brain · review"
ROUTE = "/brain"
VERSION = "v4"
COMMIT = "f83f1a1"
DATE = "17 Oct 2026"
IMG = "honeycomb/brain/inv/"
CHANGES = ("Full pass at f83f1a1, every row re-judged. Fixed: B-149 (a picked node keeps a 2px orange focus ring, 2px out: BR24 Present); "
           "B-150 (Enter keeps the picked node in view at 1440, 768 and 390: BR34 Present); B-052 (the two “Try …” lines are back: BR18); "
           "B-114 (hex lattice and 4px dot grain: BR02); B-116 (call sub-lines as the board: BR11); B-117 (wires 45% / 2.5px / 10%, lit outline, #26323a pick, dim #141b20: BR16, BR17, BR25, BR26); "
           "B-118 (orange back link: BR23); B-120 (sub-head hidden: BR13, BR29); B-121 (footer and bottom nav stay night by day: BR40); "
           "B-115 mostly (BR10, BR20, BR21 with the new quota copy, BR22; only “11” for “eleven” left in BR05); B-119 mostly (orange title, “Lights up …”, ← →, upward shadow, mono Clear trace). "
           "Tips gone from the page (nav, bottom nav, copy). New: B-196 idle panel title paper and lead line in the body face (BR18); B-197 “Comes from:”/“Decides:” orange (board purple: BR27, BR29-BR31); "
           "B-198 Clear trace border 1px (BR28). DS parity and glyph rule applied (user, 17 Oct): every component compared with its DS specimen (BrainMap, StatStrip, NoteCard, QlooWordmark, Button; AppHeader, SiteFooter, MobileNav for the chrome). Now Different: BR15 (B-199, DS BrainMap feature names), BR25-BR26 (B-200, DS BrainMap lit outline), BR27 and BR29-BR31 (B-201 markers; B-162 ← → glyphs), BR28 (B-202, DS Button outline), BR22 (B-203, DS NoteCard next), BR23 (B-162 “← Back to Busk Map”). StatStrip, QlooWordmark and the plain NoteCard match their specimens.")
HISTORY = [
    (VERSION, COMMIT, DATE, CHANGES),
    ("v3", "8207373", "17 Oct 2026", "Recheck at 8207373: BR01, BR03, BR38 Present (lockup, linked Qloo logo, F07-F11 footer); BR24 Broken (picked node has no focus ring, B-149); "
           "BR34 Broken (Enter can leave the picked node hidden, B-150); B-052 and B-114..B-121 still open."),
    ("v2", "7b1521e", "17 Oct 2026", "Re-keyed to BRAND's inventory: 40 parts (BR01-BR40) with BRAND's crops, checked at 1440, 768 and 390, day and night; "
           "user's calls F07-F15 on their rows (F12 as corrected: lockup with the new wordmark); BRAND's two build issues checked (nav current, footer): neither reproduced; B-114..B-121 raised."),
    ("v1", "7b1521e", "17 Oct 2026", "First version: 14 provisional parts from the deck's Brain board, trace state, field strip, impeccable critique and audit; B-052."),
]
READY = ("Not ready",
         "The keyboard and board defects are fixed (B-149, B-150, B-052, B-114, B-116..B-118, B-120, B-121), but the user's new rules fail on sight: text arrows as icons in every trace line and the back link (B-162: BR23, BR27, BR29-BR31), "
         "and the Your busk column is set in uppercase Big Shoulders where DS BrainMap uses the node face in sentence case (BR15, B-199); smaller DS gaps in BR22, BR25-BR28 and colour/copy notes in BR05, BR18.")
SOURCE_NOTE = ("Deck: BRAND's crops of the App canvas board Brain (BrainTablet 768, BrainMobile 390). Build: QA's own offline export of f83f1a1 (production build, port 3254), images in inv/v4/; "
               "v3 images at 8207373 stay in inv/v3/, v2 images at 7b1521e in inv/build/. "
               "design/honeycomb predates dev/core's Repertoire R4 (12 kinds, 5 facts, Last.fm, “Suggested set”, Repertoire in the nav); "
               "the board here shows the older numbers (11 kinds, 4 facts, two other sources, 15 data points), so the build is judged against the board and R4 is noted where it changes a row. "
               "F12 as corrected by the user on 17 Oct: the one logo is the lockup [hex mark][new stencil wordmark] in header, footer and assets. Tips is retired (user, 17 Oct): checked that nothing of it remains here.")
F12 = "f83f1a1: Logo is the design system's lockup files as images (header 36 px, footer 34 px, dark on /brain in both themes)"
FOCUS = "Declared: a scoped one-ring focus fallback for plain links and buttons; lit and picked nodes add their own 2px outline at 2px (B-149)"


def P(id, name, qa, note, user="", defect="—", b1440=True, b390=True, deck=True, dev="—", spec=None):
    d = {"id": id, "name": name, "qa": qa, "note": note, "user": user, "defect": defect, "dev": dev,
         "deck": f"deck/{id}.jpg" if deck is True else deck,
         "b1440": f"v4/{id}-1440.jpg" if b1440 is True else b1440,
         "b390": f"v4/{id}-390.jpg" if b390 is True else b390}
    if spec:
        d["spec"] = spec
        d["deck_empty"] = "Spec only (no crop)"
    return d


PARTS = [
 P("BR01", "Header", "Present", "Lockup image (busk-map-lockup-dark.svg, 179×36) with the new stencil wordmark; zoomed at 3×, the P's offset shadow is whole (B-135 fixed at f83f1a1). Nav Busks · Week · Brain with Brain current (aria-current page, orange fill); Tips is gone. Board: Busks · Week · Setlist · Tips, nothing active (BRAND's spec asks for Brain current). Repertoire joins with R4 on dev/core. Nav hides below 721 px. DS parity: DS AppHeader's specimen still shows Busks · Week · Setlist · Tips and a “Melbourne · live data” badge; the user's later calls (Tips retired, F20) override it, so not marked Different; flagged for BRAND to update the specimen.", "F12 (corrected 17 Oct): the one logo is the lockup [hex mark][new stencil wordmark] in header, footer and every asset; wordmark-only or mark-only fails except the favicon.", "— (F12 done)", dev=F12),
 P("BR02", "Page intro", "Present", "Night #0f1416 ground with the board's two layers: a faint hex lattice (56×100 tile, paper at 4.5%) and a 4 px dot grain (checked with the contrast boosted). Intro max 900 px, gap 18 px.", "", "B-114 fixed at f83f1a1"),
 P("BR03", "“Powered by Qloo” eyebrow", "Present", "“Powered by” in Qloo purple with the Qloo wordmark at clamp(120px, 26vw, 200px), a link to https://qloo.com, target _blank, rel “noopener noreferrer”, label “Qloo (opens qloo.com in a new tab)”. Outside the h1; the h1 keeps a hidden “Powered by Qloo:” prefix. DS parity: matches DS QlooWordmark (paper letters, purple bar).", "F09: the Qloo logo links to qloo.com in a new tab (rel=\"noopener noreferrer\").", "— (F09 done)"),
 P("BR04", "Headline", "Present", "“The brain / of Busk Map” on two lines, Big Shoulders 800, uppercase, “brain” in Qloo purple."),
 P("BR05", "Intro line", "Different", "“Qloo knows who likes what, and where. Busk Map asks it 11 kinds of question, and every answer lands somewhere in your busk. Pick any piece below to light up its path.” “light up its path” now matches; the board spells “eleven kinds”. 19/29 px, max 640 px. Trivial copy.", "", "B-115 (only “11”/“eleven” left)"),
 P("BR06", "Numbers strip ×4", "Present", "“11” kinds of Qloo call · “24–33” Qloo calls for a new busk · “0” on a rerun: answers cached for 24 h · “9” parts of your busk it decides, on a purple border; 2×2 at 390 (176 px columns). R4 on dev/core makes it five facts. DS parity: matches DS StatStrip (Qloo variant: purple 1.5px border, hairline cell dividers, purple Big Shoulders numbers over paper labels)."),
 P("BR07", "The wiring", "Present", "Heading and legend, three columns with two wire gutters, then the panel."),
 P("BR08", "“The wiring” heading", "Present", "h2 “The wiring”, Big Shoulders 800 uppercase."),
 P("BR09", "Wire legend", "Present", "Mono 12/16 muted: solid purple “Qloo”, dashed grey “Spotify, Ticketmaster”, solid orange “The path you picked”; wraps under the heading at 390."),
 P("BR10", "Column heads ×3", "Present", "Purple, paper and orange hexes: “Qloo calls” “11 kinds”, “Data points” “what comes back”, “Your busk” “what it decides” (now as the board).", "", "B-115 part fixed at f83f1a1"),
 P("BR11", "Qloo call nodes ×12", "Present", "Twelve nodes (1–11 with 5b) with the board's sub-lines: /search · /entities · external.spotify.ids · /v2/insights · urn:heatmap · … · artist · explainability · artist · no taste signal · artist · signal.location · artist · filter.results · /v2/trending · urn:demographics · urn:tag · /v2/analysis/compare.", "", "B-116 fixed at f83f1a1"),
 P("BR12", "One node (anatomy)", "Present", "Hex number, name and sub-line; every node is a button with aria-pressed; clicking the picked node again clears the trace."),
 P("BR13", "Other sources", "Present", "Sub-head “With two other sources”, dashed transparent nodes “Spotify” and “Ticketmaster”. Hidden (visibility hidden) at 1440 when no source is on the path, removed below 1024. R4 adds Last.fm on dev/core.", "", "B-120 fixed at f83f1a1"),
 P("BR14", "Data point nodes ×15", "Present", "The board's 15 data points with the same sub-lines, in order. R4 adds “Song plays” on dev/core."),
 P("BR15", "Your busk nodes ×9", "Different", "Nine features in Big Shoulders 800 21/24 uppercase, spread down the column, sub-lines as the board. DS parity: differs from DS BrainMap, whose “Your busk” nodes use the node face (Atkinson 700 15/20, sentence case: “Pitch ranking”) like the other two columns; the build sets them in Big Shoulders 800 21/24 uppercase, as the board.", "", "B-199"),
 P("BR16", "Wires: calls → data points", "Present", "aria-hidden svg, 54 curves across both gutters: solid purple 1.5 px Qloo wires, 4 dashed grey; 45% opacity at rest as the board. Hidden below 1024 px.", "", "B-117 fixed at f83f1a1", b390=None),
 P("BR17", "Wires: data points → your busk", "Present", "Same styles; wires out of Events and times and Release years are dashed grey; 45% at rest.", "", "B-117 fixed at f83f1a1", b390=None),
 P("BR18", "Detail panel, nothing picked", "Different", "The board's two orange-arrow lines are back: “Try Setlist and learn these: four Qloo calls and Spotify meet in your setlist” and “Try Taste heatmap: one call that shapes the map, the ranking and the week” (B-052 fixed). Two differences: the title “Pick any piece” is paper (board Qloo purple) and the lead line is the body face, muted (board mono). Picks are announced by a separate polite status line.", "", "B-052 fixed at f83f1a1; B-196"),
 P("BR19", "Notes ×3", "Present", "Three cards on an auto-fit grid (min 320 px), one per row at 390 (358 px). Labelled by a hidden “Notes” h2. DS parity: matches DS NoteCard (card fill, hairline border, Big Shoulders title, body text)."),
 P("BR20", "“Numbers come from data” card", "Present", "“… and a busk that cites a number no call returned is rejected.” as the board. DS parity: matches DS NoteCard (card fill, hairline border, Big Shoulders title, body text).", "", "B-115 part fixed at f83f1a1"),
 P("BR21", "“Light on the quota” card", "Present", "“Answers are cached for 24 hours. Qloo allows 5 calls a second; Busk Map paces itself to 3, because bursts of 4 drew rate-limit errors. One key's 10,000 calls a month cover roughly 300–400 new busks, and reruns are free.” Word for word the board. DS parity: matches DS NoteCard (card fill, hairline border, Big Shoulders title, body text).", "", "B-115 part fixed at f83f1a1"),
 P("BR22", "“Next · not built yet” card", "Different", "Dashed card, orange mono eyebrow, three bullets; the second now reads “Searching Qloo’s genre list directly” (no endpoint), as the board. DS parity: differs from DS NoteCard (next variant): the DS bullets are paper (foreground) on a card filled with the page colour; the build's bullets are muted grey and the card is transparent, so the dot grain shows through.", "", "B-115 part fixed at f83f1a1; B-203"),
 P("BR23", "Back link", "Different", "“← Back to Busk Map”, mono 700 16 px, orange (rgb 255,106,43), no underline (underline on hover), to /. Glyph rule: “←” is a text glyph used as an icon (B-162).", "", "B-118 fixed at f83f1a1; B-162"),
 P("BR24", "Node hover and focus", "Present", "Hover turns the border Qloo purple. Tab onto a node: one 2px orange ring. Enter to pick it: the picked, focused node now draws a 2px orange outline 2px outside its border and offset shadow (measured solid 2px rgb 255,106,43, offset 2px at 1440 and 390), so focus stays visible (image: left Tab, right Enter). A focused lit node gets the same ring. Field strip 38/38.", "F13–F15: one shared focus ring, never a double ring.", "B-149 fixed at f83f1a1", dev=FOCUS),
 P("BR25", "Trace: a part of your busk picked (f_setlist)", "Different", "Calls 5, 6, 8, 9, Spotify and 5 data points light; 10 wires orange 2.5 px, the rest at 10%. Traced nodes: 2px orange border plus a 1px orange outline; dimmed #141b20 with #9aa4aa text, as the board. DS parity: differs from DS BrainMap: there a lit node is a double line, the 2px orange border and an orange outline with a ~2px dark gap between; the build's 1px outline sits flush (offset 0), so it reads as one 3px border.", "", "B-117 fixed at f83f1a1; B-200"),
 P("BR26", "Picked node", "Different", "2 px orange border, 4 px orange offset shadow, #26323a fill and a 1px orange outline, as the board. DS parity: the outline sits flush (offset 0) where DS BrainMap's lit nodes show a gap between border and outline (DS BrainMap).", "", "B-117 fixed at f83f1a1; B-200"),
 P("BR27", "Detail panel, tracing a part of your busk", "Different", "Title “Setlist and learn these” in orange, “Lights up 4 Qloo calls, 5 data points and 1 part of your busk.”, “Comes from: Artists nearby, explained · Affinity at a pitch · Trending · Demographics · Spotify”, lines “← Artists this crowd likes: …” (the arrow hidden from screen readers, “From” read instead), all as the board. One difference: the “Comes from:” label is orange; the board draws it Qloo purple. Glyph rule: the wire lines start with text arrows “←”/“→” used as icons (B-162). DS parity: differs from DS BrainMap, whose lines are plain round bullets reading “From Artists this crowd likes: …” with no arrow and no orange marker; the build adds an orange arrow-shaped marker per line, and the DS draws the “Comes from:”/“Decides:” label Qloo purple (B-197).", "", "B-119 part fixed at f83f1a1; B-197; B-201; B-162"),
 P("BR28", "Clear trace", "Different", "Shown only while tracing; mono 700 12 px uppercase with a paper border, as the board; focus is one 2px orange outline at 2px. The border measures 1px even at 2× (board 1.5px): the variant's border width wins over border-[1.5px]. DS parity: differs from DS Button (outline) and DS BrainMap's Clear trace: Atkinson 700 14px uppercase with a 2px paper border; the build is JetBrains Mono 700 12px with a 1px border.", "F15: shadcn primitives styled through tokens and variants.", "B-198; B-202"),
 P("BR29", "Trace: a Qloo call picked (c3)", "Different", "“Lights up 1 Qloo call, 1 data point and 5 parts of your busk.” and “→ Taste cells: cells across the city, …” as the board; “With two other sources” hides at 1440 (B-120 fixed). Differences: the “Decides:” label is orange (board purple) and the order is “Taste map · Pitch ranking · …” (board “Pitch ranking · Taste map · …”). Glyph rule: the wire lines start with text arrows “←”/“→” used as icons (B-162). DS parity: differs from DS BrainMap, whose lines are plain round bullets reading “From Artists this crowd likes: …” with no arrow and no orange marker; the build adds an orange arrow-shaped marker per line, and the DS draws the “Comes from:”/“Decides:” label Qloo purple (B-197).", "", "B-119 (order); B-197; B-201; B-162"),
 P("BR30", "Trace: a data point picked (d_cells)", "Different", "Both directions with arrows: “← Taste heatmap: …” then “→ Taste map: …” and the rest; “Lights up 1 Qloo call, 1 data point and 5 parts of your busk.”; the panel says “Decides:”, but in orange (board purple). Glyph rule: the wire lines start with text arrows “←”/“→” used as icons (B-162). DS parity: differs from DS BrainMap, whose lines are plain round bullets reading “From Artists this crowd likes: …” with no arrow and no orange marker; the build adds an orange arrow-shaped marker per line, and the DS draws the “Comes from:”/“Decides:” label Qloo purple (B-197).", "", "B-119 part fixed at f83f1a1; B-197; B-201; B-162"),
 P("BR31", "Trace: Plain-AI comparison (f_plain)", "Different", "“Lights up 3 Qloo calls, 3 data points and 1 part of your busk.”, “Comes from: Taste heatmap · Places nearby · Headliner match · Ticketmaster”, three “←” lines, as the board; the “Comes from:” label is orange (board purple). Glyph rule: the wire lines start with text arrows “←”/“→” used as icons (B-162). DS parity: differs from DS BrainMap, whose lines are plain round bullets reading “From Artists this crowd likes: …” with no arrow and no orange marker; the build adds an orange arrow-shaped marker per line, and the DS draws the “Comes from:”/“Decides:” label Qloo purple (B-197).", "", "B-197; B-201; B-162"),
 P("BR32", "Trace transition", "Present", "Nodes transition colour, background and border over 0.15 s; wires opacity over 0.15 s. Off under reduced motion (BR37). No still image.", b1440=None, b390=None),
 P("BR33", "Sticky trace panel", "Present", "While tracing the panel sticks to the viewport bottom, max 45vh, scrolls inside, and now casts the board's upward shadow (0 −8px 24px, 45% black); at 390 it sits on the bottom nav (panel bottom 836 = nav top 836); in the flow when nothing is picked. z-index 10 (board 4), not visible.", "", "B-119 part fixed at f83f1a1"),
 P("BR34", "Keyboard trace: panel folds (B-015)", "Present", "Tab to a node, Enter: the picked node stays in view and clear of the folded panel at every width: 1440 node 1 at 741–796, panel 812–900; 390 “Taste cells” at 96–151, panel 574–662; 768 Taste cells 423–478 and call 5 725–780, panels from 767 and 812; 390 call 5 440–495, panel 718–836. Overlap 0 in all five. scroll-padding-bottom 104 px (1440) / 198 px (390); Tab while tracing keeps the node clear (B-015 stays fixed). Images: 1440 left, 390 right.", "", "B-150 fixed at f83f1a1", deck=None, spec="While tracing and a node has keyboard focus, the panel folds to a slim bar (title and Clear trace) so it never hides the focused node (WCAG 2.4.11); scroll-padding-bottom = panel height + 16px, at least 96px, via ResizeObserver."),
 P("BR35", "Below 1024px: one column", "Present", "At 768 (image in the 1440 column) the columns stack, gutters hide (svg display none), each list a two-column grid (356 px); while tracing all 27 dimmed nodes are hidden and the empty other-sources sub-head is removed. No sideways scroll.", b1440="v4/BR25-768.jpg", b390="v4/BR25-390.jpg"),
 P("BR36", "Phone layout", "Present", "At 390 the header nav hides and the bottom nav shows; numbers 2×2; notes one per row; no sideways scroll.", b1440=None, b390="v4/full-390-night.jpg"),
 P("BR37", "Reduced motion", "Present", "With prefers-reduced-motion the node transition-property is none and the wires' duration 0s; document.getAnimations() = 0.", b1440=None, b390=None),
 P("BR38", "Site footer (added by F07–F11)", "Present", "The F07–F11 footer, night on /brain: left the lockup (34 px, a home link) and “with” the Qloo logo (qloo.com, new tab, noopener noreferrer); centre Privacy · Terms · Brain · Brand with mid-dots; right GitHub in a honeycomb cell and “Built by T04435” with BRAND's built-by mark linking to Claude Code (new tab, “Built with Claude Code (opens in a new tab)”). 97 px at 1440, 125 px at 768, 225 px at 390. No Tips link. DS parity: DS SiteFooter's specimen is the older footer (Taste data by Qloo · MIT licence, Open source, the permit line); the user's F07–F11 footer overrides it, so not marked Different; flagged for BRAND.", "F07–F11: the SiteFooter as on every public page (chrome inventory FT01–FT11). F12 (corrected): the lockup [hex mark][new wordmark], never wordmark-only.", "— (F07–F12 done)", deck=None, dev=F12, spec="Not on the board. SiteFooter at the bottom of /brain: lockup and Qloo left; Privacy · Terms · Brain · Brand centre; GitHub in a honeycomb cell and “Built by T04435” with the pixel critter right. See chrome FT01–FT11."),
 P("BR39", "Bottom nav (phone)", "Present", "Up to 720 px the MobileNav is fixed at the bottom: Busks · Week · Brain (three items; Tips retired) with Brain current (orange tile). Night (rgb 24,32,37) in both themes on /brain. Repertoire joins with R4 on dev/core. DS parity: DS MobileNav shows four items with Setlist and Tips; Tips is retired by the user, so the three-item bar is not marked Different; icon tile and mono labels match.", b1440=None),
 P("BR40", "Night theme only", "Present", "In the day theme the page, header, footer (rgb 15,20,22) and bottom nav (rgb 24,32,37) all stay night; the page no longer ends on a light band.", "", "B-121 fixed at f83f1a1"),
]

SECTIONS = [
 ("field-strip", "Field strip (F13, F14): /brain",
  '<p>At f83f1a1 (fields9 data): 38 of 38 fields pass at 390 and 1440, day and night (152 checks): one border and one 2px orange ring per focused node. No /brain field is among the run\'s 4 fails. The strip measures unpicked nodes; a picked, focused node was measured separately and draws a 2px orange outline at 2px (BR24, B-149 fixed).</p>'
  '<a href="../screens/honeycomb/brain/inv/v4/field-strip.jpg"><img src="../screens/honeycomb/brain/inv/v4/field-strip.jpg" alt="Brain field strip at f83f1a1: 38 nodes, focused and unfocused"></a>'),
 ("critique", "Impeccable critique",
  "<ol>"
  "<li><b>P1 · Text arrows as icons (user's glyph rule).</b> “←” and “→” start every trace line and the back link; DS BrainMap uses plain bullets and words (BR23, BR27, BR29-BR31; B-162).</li>"
  "<li><b>P1 · The Your busk column shouts.</b> Nine uppercase Big Shoulders names against two columns of quiet node text; DS BrainMap sets all three columns in the same node face (BR15; B-199).</li>"
  "<li><b>P3 · DS details.</b> Lit nodes lose the DS double line (BR25-BR26; B-200), orange arrow markers in the panel (B-201), Clear trace in mono 12 where DS Button is Atkinson 14 (BR28; B-202), grey bullets on the Next card (BR22; B-203). StatStrip, QlooWordmark and NoteCard otherwise match.</li>"
  "<li><b>P2 · The panel's labels switched colour.</b> “Comes from:” and “Decides:” went from purple to orange with the title, so title, label, arrows and path are all orange; the board keeps the labels Qloo purple, marking Qloo's side of the story (BR27, BR29-BR31; B-197).</li>"
  "<li><b>P2 · The idle panel lost its Qloo voice.</b> “Pick any piece” is paper and the lead is in the body face, so the invitation reads like a plain card rather than the board's purple, mono panel (BR18; B-196).</li>"
  "<li><b>P3 · Small drift.</b> “11 kinds” for “eleven kinds” (BR05), c3's “Decides:” order (BR29), the Clear trace border 1px for 1.5px (BR28; B-198).</li>"
  "<li><b>Fixed since v3.</b> Keyboard picking keeps the node visible and ringed (BR24, BR34); trace styling, lattice, sub-lines and the night chrome follow the board (BR02, BR11, BR16-BR17, BR25-BR26, BR40).</li>"
  "</ol>"),
 ("audit", "Impeccable audit",
  "<table><tr><th>Check</th><th>Result at f83f1a1</th></tr>"
  "<tr><td>axe (WCAG 2.2 AA tags) at 390 and 1440, day and night; 768 night</td><td>Clean (0 violations, 26 rules passed each)</td></tr>"
  "<tr><td>Sideways scroll at 390, 768, 1440</td><td>None (also none at 768 while tracing)</td></tr>"
  "<tr><td>Heading outline</td><td>h1 › h2 › h3 › h4 › h3 h3 › h2 (Notes, hidden) › h3 h3 h3; no skips</td></tr>"
  "<tr><td>Focus (F13–F14)</td><td>One 2px ring on nodes, links and buttons; picked node focused: 2px orange outline at 2px (B-149 fixed); lit node focused the same; Clear trace one 2px orange outline at 2px against the panel. Field strip 38/38</td></tr>"
  "<tr><td>Focus not obscured (2.4.11)</td><td>Pass: after Enter, overlap 0 between the picked node and the folded panel at 1440, 768 and 390 (5 cases, BR34; B-150 fixed). Tab while tracing: pass</td></tr>"
  "<tr><td>Tips retired</td><td>No Tips nav or bottom-nav item, no /tips link, no tip copy in the page text; “your tip history” dropped from the map data</td></tr>"
  "<tr><td>F20 (city names)</td><td>No “Melbourne” anywhere in the page text, day or tracing</td></tr>"
  "<tr><td>DS parity (user rule)</td><td>Compared with DS BrainMap, StatStrip, NoteCard, QlooWordmark, Button, AppHeader, SiteFooter, MobileNav (dark specimens): StatStrip and QlooWordmark match; BrainMap differs (B-199..B-201, B-197), Button (B-202), NoteCard next (B-203); the chrome specimens predate the user\'s Tips removal and F07–F11 footer</td></tr>"
  "<tr><td>Glyph rule</td><td>B-162: “← Back to Busk Map” (BR23); “←”/“→” in trace lines (BR27, BR29-BR31). The “·” in copy is allowed</td></tr>"
  "<tr><td>Shared defects</td><td>B-135 fixed at f83f1a1 here (lockup P offset whole, zoomed 3×); B-134 not seen (Clear trace, an outline button, rings orange outside the button); B-136 and B-137 not on this page; B-138: the trace panel's shadow is an explicit hard value</td></tr>"
  "<tr><td>Logo (F12 corrected)</td><td>Header and footer: busk-map-lockup-dark.svg, 36 px and 34 px, dark in both themes</td></tr>"
  "<tr><td>Reduced motion</td><td>Node transitions none, wires 0s, 0 running animations (BR37)</td></tr>"
  "<tr><td>Theme</td><td>main, header, footer and bottom nav night in both themes (BR40, B-121 fixed)</td></tr></table>"),
 ("brand-issues", "BRAND's build issues",
  "<table><tr><th>Issue</th><th>Result</th><th>Evidence</th></tr>"
  "<tr><td>No nav item is current on /brain</td><td>Not reproduced</td><td>At f83f1a1 both navs mark Brain with aria-current=\"page\" and an orange fill (header at 1440, bottom nav at 390): BR01, BR39.</td></tr>"
  "<tr><td>There's no footer on /brain</td><td>Not reproduced</td><td>The F07–F11 footer renders at 390, 768 and 1440 (225, 125 and 97 px) with the lockup, Qloo link, Privacy · Terms · Brain · Brand and GitHub / Built by: BR38.</td></tr></table>"),
]

# New defects in v4 (placeholders for QA to number):
# B-196 Low BR18: idle panel title “Pick any piece” is paper (board Qloo purple); its lead line is the body face (board mono).
# B-197 Low BR27, BR29-BR31: trace panel “Comes from:” / “Decides:” labels are orange (board Qloo purple).
# B-198 Low BR28: Clear trace border is 1px (board 1.5px); the outline variant's border width wins over border-[1.5px].
# B-199 Medium BR15: Your busk nodes in Big Shoulders 800 21/24 uppercase; DS BrainMap uses the node face (Atkinson 700 15/20) in sentence case.
# B-200 Low BR25, BR26: lit/picked node outline flush on the border (offset 0); DS BrainMap draws border and outline with a ~2px gap.
# B-201 Low BR27, BR29-BR31: trace panel lines use orange arrow-shaped markers; DS BrainMap uses plain round bullets (“From X: …”).
# B-202 Low BR28: Clear trace is mono 700 12px, 1px border; DS Button outline (as in DS BrainMap) is Atkinson 700 14px uppercase, 2px paper border.
# B-203 Low BR22: NoteCard next bullets muted grey on a transparent card; DS NoteCard next has paper bullets on a page-colour fill.
# B-162 (shared glyph defect): BR23 “← Back to Busk Map”; BR27, BR29-BR31 “←”/“→” in the trace lines.

# Impeccable critique and audit: generated from the skill's own outputs in qa/impeccable/ (see impeccable_sections.py).
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from impeccable_sections import impeccable as _imp
from impeccable_synthesis import SYN as _SYN
_i = next(i for i, s in enumerate(SECTIONS) if s[0] == "critique")
SECTIONS = [s for s in SECTIONS if s[0] not in ("critique", "audit")]
SECTIONS[_i:_i] = _imp("brain", _SYN["brain"])

CHANGES = CHANGES + " The impeccable critique and audit were run for real this round (skill v4.4.0, dual-agent, at f83f1a1, 390/768/1440; provenance at the top of both sections), replacing v3's hand-written sections. New from impeccable, verified by QA: B-218 (High: day-scheme focus ring 1.08:1 on every control), B-222 (the trace panel covers lit pieces), B-231."
READY = (READY[0], READY[1] + ' Impeccable adds B-218 (High) and B-222.')
