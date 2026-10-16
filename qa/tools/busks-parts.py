# Busks · review: data for qa/tools/page-review.py. Ids follow BRAND's inventory (design-handoff/inventory/busks, B01-B57).
# v1 used 20 provisional ids (B01-B20) that do not match these; its images stay under qa/screens/honeycomb/busks/.
TITLE = "Busks · review"
ROUTE = "/busks"
VERSION = "v2"
COMMIT = "7b1521e"
DATE = "17 Oct 2026"
IMG = "honeycomb/busks/inv/"
CHANGES = ("Re-keyed to BRAND's inventory: 57 parts B01-B57 (15 spec-only) replace v1's 20 provisional ids. Every part checked at 1440 and 390 "
           "(768 for breakage) against BRAND's crop or spec and the user's calls (F12 as corrected: the lockup is the one logo; F13-F15, F20, F25-F27). "
           "Same commit as v1; v1 defects B-036..B-042 are cited on the matching rows; B-080..B-097 are new placeholders for MANAGER to number.")
HISTORY = [
    (VERSION, COMMIT, DATE, CHANGES),
    ("v1", "7b1521e", "17 Oct 2026", "First version: 20 provisional parts from the deck's Busks board (BRAND's inventory not yet in), the user's calls F13, F14, F20, F25, F26, F27, field strip, site checks, impeccable critique and audit."),
]
SOURCE_NOTE = ("Deck: BRAND's crops from inventory/busks (spec-only parts show the spec text). Build: QA's own export of the commit above, offline "
               "(synthetic Spotify results, so “Synthetic …” names and the “Offline test mode” notes appear; they are not judged). The no-match, "
               "loading and search-error states were reached by answering the page's own /api/repertoire calls in the browser; the error state by "
               "submitting the empty form; plan again with /busks?again=<id> from /plan?example=sax&date=2026-10-12.")

F25 = "F25: remove the textarea; typing a song in is the fallback inside the song search, prefilled from the query, shown when there's no match."
F26 = "F26: remove “Load my songs”; load on Enter, or on blur when the field isn't empty."
F27 = "F27: time of day is shown with the song inputs; “Any time · Busk Map picks” waits for the user's architecture approval. Keep “Lunch” (as built and in the user's screenshot), not the board's “Midday”."
F13 = "F13: a normal input with the search icon only (shadcn InputGroup), one border, one focus ring."
F12 = ("F12 (corrected 17 Oct): the ONE logo is the lockup, hex mark + new wordmark, in header, footer and every asset; F12 only retired the old "
       "wordmark lettering. Wordmark-only or mark-only in a header fails. Supersedes the inventory's “wordmark only”.")
F20 = "F20: no “Melbourne” in an eyebrow or default text; city names only where the data is that city's."
L13 = "Kept as built (the user's call on landing L13): filled hexes, a blurb, a dark action row."
F1314 = "F13, F14, F15: one border and one focus ring per field, shadcn's own pattern, no global CSS overriding states."
DEV_LOGO = "a68440d (after 7b1521e) switched to wordmark-only, which also fails F12 as corrected; not rechecked"
DEVFIX = "Fix claimed in f9bff52 (after 7b1521e; not checked here)"


def P(id, name, qa, note, user="", defect="—", dev="—", deck=True, b1440=True, b390=True, spec=None):
    p = {"id": id, "name": name, "qa": qa, "note": note, "user": user, "defect": defect, "dev": dev,
         "deck": f"deck/{id}.jpg" if deck else None,
         "b1440": f"build/{id}-1440.jpg" if b1440 else None, "b390": f"build/{id}-390.jpg" if b390 else None}
    if spec:
        p["spec"] = spec
        p["deck_empty"] = "Spec only (no crop)"
    return p


PARTS = [
 P("B01", "Header", "Different", "Lockup shape right (hex mark + wordmark) but the OLD lettering: the M rises above the other letters (QA zoomed header crop). Nav Busks · Week · Brain · Tips with Busks current (aria-current), from 721px. The board's wordmark-only header now fails F12; its “Setlist” is stale and the build's nav is the current one.", F12, dev=DEV_LOGO, b390=False),
 P("B02", "Eyebrow", "Different", "Reads “MELBOURNE · YOUR ACT, YOUR HOURS” (mono, bold, uppercase, muted as drawn). F20 wants “Your act, your hours”.", F20),
 P("B03", "Page title", "Present", "h1 “PLAN YOUR BUSK”, Big Shoulders 800, clamp(40px, 6vw, 56px), 0.95 line height."),
 P("B04", "Intro line", "Different", "Copy matches. Set at body size and runs as one ~930 px line at 1440 (board: 18/27, max 760px, two lines).", defect="B-080"),
 P("B05", "Or try a made-up act", "Present", "Heading plus 3 cards in an auto-fit grid (min 260px, board 280px); hidden in the plan-again state."),
 P("B06", "“Or try a made-up act” heading", "Present", "h2, Big Shoulders 800 26px, uppercase."),
 P("B07", "Example act cards ×3", "Different", "Filled orange hexes (AS, SA, FD; board: outline hexes, SX), a blurb (“Guitar and voice, Australian songbook covers. Saturday evening.”) instead of “day · hours” in mono, no “Plays …” line.", L13, "B-032"),
 P("B08", "“Watch Busk Map plan this act →”", "Different", "The whole card is the link; its foot is a dark action row “Watch Busk Map plan this act” with an arrow on the right (board: 15px bold signal-coloured underlined link). Opens /plan?example=<id>.", L13, "B-032"),
 P("B09", "Plan your own busk (form)", "Different", "form “Plan for your own act” (board: “Plan your own busk”), card background, 2px rule border, 28px padding and gaps, groups in order. No shadow (board: md offset shadow). Holds the old textarea and Load my songs (B27, B29) and an extra Time of day group (B30).", "F25, F26, F27", "B-081"),
 P("B10", "Act name", "Present", "Label “Act name”, placeholder “e.g. Jess on acoustic guitar”, maxLength 80, no hint.", "F14: one focus ring."),
 P("B11", "Artists you sound like", "Different", "Visible label (aria-hidden; the combobox is named “Artists you sound like”), chips above, placeholder “Search Spotify, e.g. Paul Kelly”. The search is a box inside a box (cmdk group in a bordered command); the hint “N of 10. Type a comma to add a name that isn’t on Spotify.” is missing.", F13, "B-038"),
 P("B12", "Artist chips", "Present", "ul “Artists you picked”: 26px hex with initials, name, “(TYPED)” tag for typed names, ghost x “Remove <name>”; Backspace in the empty field removes the last chip (source)."),
 P("B13", "Artist search: results", "Present", "Listbox “Artist results”, group “SPOTIFY”: 32px hex, name, “26 releases · 184k Last.fm listeners”, picked shows “Added”. Arrow keys and Enter via cmdk; Esc clears.", deck=False,
   spec="Listbox “Artist results”, group “Spotify”: 32px hex, name, “N releases · N Last.fm listeners”; a picked artist shows a check and “Added”. Arrow keys move, Enter picks, Esc clears."),
 P("B14", "Artist not on Spotify: add as typed", "Present", "Second group “NOT ON SPOTIFY?” with “Add “Zzyzx Nobody” as typed”; a comma also adds the name (B12 shot). No plus icon on the item.", deck=False,
   spec="While text is typed, a group “Not on Spotify?” offers “Add “<name>” as typed” (plus icon). A comma or new line also adds it. A later Spotify pick upgrades the typed chip."),
 P("B15", "Artist search status lines", "Different", "“Type 3 or more letters to search Spotify.”, “Searching Spotify…” (role status, no spinner, see B52) and “No artists on Spotify match “…”.” as specified. The error line reads “Search isn't working right now. Type it in instead.” (spec: “… Try again in a moment.”).", defect="B-082", deck=False,
   spec="“Type 3 or more letters to search Spotify.”; “Searching Spotify…” with a spinner (role status); “No artists on Spotify match “<query>”.”; error (role alert): “Search isn't working right now. Try again in a moment.”"),
 P("B16", "Artist limit reached (10)", "Different", "At 10 chips the field is disabled with placeholder “Up to 10 artists”, as specified; the hint “That’s the most. Remove one to add another.” is missing (no hint line at all).", defect="B-038", dev=DEVFIX, deck=False,
   spec="At 10 artists the field is disabled, placeholder “Up to 10 artists”, hint “That’s the most. Remove one to add another.”"),
 P("B17", "Songs you can play", "Different", "fieldset with legend “Songs you can play”: search, picks, link field + Load my songs, then the old textarea. No “Your picks” header. Time of day is not in this group. Shown in the plan-again state too (B44).", f"{F25} {F26} {F27}", "B-037"),
 P("B18", "Song search", "Different", "Placeholder “Search songs, e.g. Riptide”; box inside a box like B11. Its label is a visually hidden “Search songs on Spotify”, so it does not repeat the legend on screen (the board's double “Songs you can play” is not built).", F13),
 P("B19", "Song search: results", "Different", "Listbox “Song results”, group “SPOTIFY”: muted music hex, title, “artist · album”, length in mono, “BY YOUR ARTIST” badge (no users icon) sorted first, “ADDED” with a check. After a pick the list stays open until the query is cleared; at 390 the badge squeezes the title to “F”.", F13, "B-036, B-042"),
 P("B20", "Song not on Spotify: type it in (F25)", "Missing", "No typed fallback. A no-match search shows the old line “No songs on Spotify match “Laneway Light - The Larkspur Two”. Type it in the song list below instead.”", F25, dev=DEVFIX),
 P("B21", "Song search status lines", "Different", "“Type 3 or more letters…”, “Searching Spotify…” (no spinner) as specified; error reads “Search isn't working right now. Type it in instead.” (spec: “Try again in a moment.”); the no-match line is still there (F25).", F25, "B-082", deck=False,
   spec="“Type 3 or more letters to search Spotify.”; “Searching Spotify…” with spinner; error “Search isn't working right now. Try again in a moment.” (role alert). The no-match line is replaced by the typed fallback (B20)."),
 P("B22", "Your picks", "Different", "ul “Songs you picked” in a 2px rule box, as drawn; no “Your picks” label and no live total (“2 songs · 4:56”).", defect="B-037"),
 P("B23", "Picked song row (Spotify)", "Present", "Muted hex with music icon, title, “artist · album”, length in mono, ghost x “Remove <title>”."),
 P("B24", "Picked song row (your own / typed)", "Different", "Loaded own songs show a solid orange “YOUR SONG” badge, but without the music icon, and keep a length. Songs typed in the textarea never appear in the list, so nothing is tagged Typed.", F25, "B-097", dev=DEVFIX),
 P("B25", "No songs picked", "Missing", "With no picks the list renders nothing: no empty line at all.", "F25: the line must point to the search only (copy to confirm).", "B-083", dev=DEVFIX, deck=False, b1440=False, b390=False,
   spec="PickedSongs empty line: “Search for songs above, or type them below.” Overridden by F25: point to the search only (copy to confirm)."),
 P("B26", "Your Spotify artist link", "Different", "Label is sr-only, “(optional)” sits in the placeholder “Your Spotify artist link (optional)”, no music icon, no hint “Optional: adds your own songs”. The field fills the row (765px at 1440, full width at 390): the placeholder is not cut off.", F26, "B-040", dev=DEVFIX),
 P("B27", "“Load my songs” button", "Different", "Still built: outline button beside the field (below it at 390), disabled until 10 characters.", F26, dev=DEVFIX),
 P("B28", "Artist link: songs loaded / bad link", "Different", "Offline the load adds synthetic “Your song” rows with “Offline test mode: these songs are made up, not from Spotify.”; the live line in the source matches the board. A bad link gives a grey note “Couldn't load songs from that link. Paste an open.spotify.com/artist/… link, or type your songs.” (source), not a field error with aria-invalid; busy shows “Loading your songs from Spotify…”.", F26, "B-084", dev=DEVFIX),
 P("B29", "“Songs Spotify doesn't have” textarea", "Different", "Still built, labelled “Song list: type songs Spotify doesn't have”, 4 rows, instructions only in the placeholder.", F25, dev=DEVFIX),
 P("B30", "Time of day with the song inputs (F27)", "Different", "Toggle group “Time of day”: Morning 9 am–12 pm · Lunch 12 pm–3 pm · Afternoon 3 pm–6 pm · Evening 6 pm–9 pm (pressed = selected, sets From/To); 4 across at 1440, 2×2 at 390. It sits in When and where above Date, not with the song inputs. No “Any time” (correctly held). “Lunch” kept as the user asked.", F27),
 P("B31", "When and where", "Present", "fieldset “When and where”: City, Time of day (B30), Date · From · To in a grid, permit. No sideways scroll at 390/768/1440."),
 P("B32", "City picker", "Present", "Legend “City”, hex radio “Melbourne”, “Taste, foot traffic, busking rules, events and weather”, “LIVE DATA” badge, as drawn.", "F20: the city name is fine here (the data is Melbourne's)."),
 P("B33", "Cities and their data level", "Different", "Not a binding: performer-form.tsx passes one literal city {Melbourne, live, note} to CityPicker, and the request hard-codes city “melbourne”; no default-city text appears.", F20, "B-085", deck=False, b1440=False, b390=False,
   spec="The city list, each city's note and its level (live → “Live data”, otherwise “Less data”) come from the app's city coverage. While null: no default city text (F20); the first city is selected."),
 P("B34", "Date", "Different", "Field-style button “SAT 17 OCT 2026”: uppercase, no comma, the calendar icon on the right (board: “Sun, 18 Oct 2026”, icon on the left). Past days disabled.", defect="B-086"),
 P("B35", "Calendar open", "Different", "Popover with month “October 2026”, previous/next buttons, past days disabled, selected day a filled hex. Weeks start on Sunday (SU…SA; spec Mo–Su) and the dialog has no name (spec “Choose a date”). The “today” mark follows the browser's clock, not the server's fake date (test artefact).", defect="B-087", deck=False,
   spec="Dialog “Choose a date”: month and year, Previous/Next month buttons, Mo–Su, day buttons (selected filled, today marked, past disabled). Picking a day closes it."),
 P("B36", "From", "Different", "Select “From” with chevron, default 6 pm (plan again: the last busk's hours). Offers all 24 hours 12 am … 11 pm (spec: 6 am … 12 am).", "F14: one focus ring.", "B-088"),
 P("B37", "To", "Different", "Select “To”, default 9 pm, offers 1 am … 12 am. No hint “Up to 6 hours”.", "F14: one focus ring.", "B-039, B-088"),
 P("B38", "Your busking permit", "Different", "Legend, three choice cards and the hint “This changes which pitches are shown. Check the council’s rules before you play.” as drawn. Descriptions differ: “Pitches open to every permit. Keep the council's clearances from doors, crossings and seating.” / “Adds the premium-only pitches as well.” / “For a crowd that forms a circle. You take priority at circle-act pitches.” Focus on the selected card is barely visible. Not hidden in plan again.", defect="B-089, B-041"),
 P("B39", "Plan buttons", "Present", "Top border, primary lg “PLAN MY BUSK →”, outline lg “PLAN MY WEEK FROM THIS DATE” with calendar icon; full-width rows at 390.", "F14: one focus ring each (see B50)."),
 P("B40", "Form error: artists", "Present", "Alert above the buttons (role alert, 2px error border, tint): title “ARTISTS YOU SOUND LIKE”. The board's Spotify-id case can't be reached offline; the empty form gives “Add at least one artist you sound like.” and the source's Spotify-id sentence matches the board. Icon is a circle, not the board's triangle."),
 P("B41", "Form error: songs", "Different", "Title “SONGS YOU CAN PLAY”; body “check “<title>” (Too big: expected string to have <=120 characters).”: lower-case start and the validator's raw text (board: “Check “Laneway Light” (the title is empty or too long).”).", defect="B-090"),
 P("B42", "Form error: date and times", "Different", "Title “DATE AND TIMES”; body repeats the field: “Check the date and times: the slot must end after it starts and last at most 6 hours.” (board: “The slot must end after it starts and last at most 6 hours.”). From and To get aria-invalid.", defect="B-091"),
 P("B43", "Form error: act name", "Different", "Not reachable from the form: the input stops at 80 characters (maxLength). If the schema did reject it, form-errors.ts would show the validator's raw text, not “Use 80 characters or fewer.”", defect="B-090", b1440=False, b390=False),
 P("B44", "Plan again: banner", "Different", "Info banner “Planning again for Soul and funk sax player. Your act, artists, songs and permit come from your earlier busk: pick a new date and time.” (no date of that busk). Title stays “Plan your busk” and the intro is the new-act one (board: “Plan your next busk”, “Same act, same songs, same permit…”). Examples hidden; date Mon 19 Oct, the last busk's hours (5–8 pm). The act, artists, songs and permit groups are not hidden.", defect="B-092"),
 P("B45", "Plan again: your act", "Missing", "No “Your act · from your last busk” summary (hex, name, sounds like, song/permit/last-time badges, Change). The full new-act form shows instead, prefilled (crop: what shows in its place).", defect="B-092"),
 P("B46", "Last busk (plan again)", "Different", "?again=<id> prefills the act name, artists, songs, permit and hours from the stored plan, and with no plan the new-act form shows: the data flows. But nothing is hidden and the last busk's date isn't shown.", defect="B-092", deck=False, b1440=False, b390=False,
   spec="Act name, sound-alike artists, song count, permit, last hours and last busk date come from the performer's last busk. While null: the new-act form shows instead."),
 P("B47", "Artists rank the song search", "Present", "The picked artists' names go with the song search; their songs sort first with “BY YOUR ARTIST” (B19: Gillian Welch's Fast Car first). The list stays closed until something is typed.", deck=False, b1440=False, b390=False,
   spec="The picked artists' names feed the song search, so their songs sort first with “By your artist”. Spotify results are live; while null the list is closed."),
 P("B48", "Picks total and artist count", "Missing", "No “N songs · m:ss” total and no “N of 10” count anywhere.", defect="B-037, B-038", deck=False, b1440=False, b390=False,
   spec="“N songs · m:ss” sums the known lengths of Your picks; “N of 10” counts the artist chips. Both update on every add and remove."),
 P("B49", "Log your takings line", "Different", "Adds “they stay in this browser,”: “Played a busk already? Log your takings: they stay in this browser, and the pitches where you earn more get a small bonus in your next plans.” The link is foreground and underlined (board: signal-coloured link).", defect="B-093"),
 P("B50", "Field focus (F13, F14)", "Broken", "Field strip: 0 of 19 fields pass. A focused input keeps its 2px border and adds a 2px paper gap plus a 4px dark ring (box-shadow); the two searches are a box in a box; the selected choice card's focus is a dark outline flush on its dark border.", F1314, "B-041", deck=False, b1440=False, b390=False,
   spec="Every input, select, search and button: one focus ring, shadcn's pattern (border turns --ring plus --focus-ring), no white gap, no nested borders. Radio choices ring the whole choice (focus-within)."),
 P("B51", "Field-level errors", "Different", "Each error shows under its field with a warning icon (role off, the summary alert announces). Name and slot fields get aria-invalid/aria-describedby; the artists combobox gets neither, so its error isn't tied to it. The field line is the whole sentence, not the alert title's words.", defect="B-094", deck=False,
   spec="Each field shows its own error under it (aria-invalid, aria-describedby) in the same words as the alert title's field."),
 P("B52", "Searching spinner", "Missing", "“Searching Spotify…” shows with no Loader (only the field's search icon).", defect="B-095", deck=False,
   spec="The Loader beside “Searching Spotify…” spins (0.9 s linear). Reduced motion: still."),
 P("B53", "Reduced motion", "Different", "With prefers-reduced-motion: reduce, inputs and buttons keep transition-duration 0.15s (colour, border, outline); nothing moves, but the DS rule says every duration goes to 0.", defect="B-096", deck=False, b1440=False, b390=False,
   spec="No other motion on this page; with prefers-reduced-motion every transition (focus, hover, calendar) is instant."),
 P("B54", "Night theme", "Present", "Night background, cards and fields on the dark tokens, orange accent; axe clean at 390 and 1440."),
 P("B55", "Phone header (≤720px)", "Different", "Below 721px the nav hides and only the logo stays, as specified; the logo is the lockup shape with the OLD lettering (raised M). The board's wordmark-only phone header is superseded by F12 as corrected.", F12, dev=DEV_LOGO, b1440=False),
 P("B56", "Phone layout (≤720px)", "Present", "Single column: cards stack, Time of day 2×2, Date/From/To wrap, buttons full rows; no sideways scroll at 390 (crop: first 1800 px of the filled page).", b1440=False),
 P("B57", "Bottom nav (≤720px)", "Present", "Sticky bottom nav Busks · Week · Brain · Tips with icons, Busks current. The board's “Setlist” is stale; the build has the current nav.", b1440=False),
]

SECTIONS = [
 ("field-strip", "Field strip (F13, F14): every field on /busks, unfocused | focused",
  '<p>Columns: day 1440, night 1440, day 390, night 390; each pair unfocused then focused. Rule: one border and one focus ring per field. '
  'Result at 7b1521e: <b>0 of 19 fields pass</b> (every focused field has a paper gap plus a dark ring over its border; the two Spotify searches are a box in a box). Rows: B11, B18, B50.</p>'
  '<a href="../screens/honeycomb/busks/inv/field-strip.jpg"><img src="../screens/honeycomb/busks/inv/field-strip.jpg" alt="Busks field strip"></a>'),
 ("critique", "Impeccable critique (design review)",
  "<ol>"
  "<li><b>P1 · Plan again doesn't feel like planning again.</b> The banner says the act comes from the last busk, but the whole new-act form is still there, the title still says “Plan your busk” and the act summary is missing (B44, B45, B46).</li>"
  "<li><b>P1 · The search fields look broken.</b> A box in a box and a doubled focus ring on the page's most-used inputs (B11, B18, B50; F13, F14).</li>"
  "<li><b>P2 · Three ways to add a song, none finished.</b> Search, the artist link with its button, and the textarea all stay; the no-match fallback F25 asks for isn't there, and the results don't close after a pick (B19, B20, B26, B27, B29; B-036).</li>"
  "<li><b>P2 · The set has no shape.</b> No “Your picks” header, no count or total time, no “N of 10” (B22, B48; B-037, B-038).</li>"
  "<li><b>P2 · Errors speak code.</b> The songs error shows the validator's raw text in lower case; the slot error repeats its own title (B41, B42).</li>"
  "<li><b>P3 · Time asked twice, in the wrong place.</b> Time of day sits beside From/To, not with the song inputs as F27 asks, and From/To offer all 24 hours (B30, B36, B37).</li>"
  "</ol>"),
 ("audit", "Impeccable audit (technical)",
  "<table><tr><th>Check</th><th>Result</th></tr>"
  "<tr><td>axe (WCAG 2.0/2.1/2.2 A+AA tags) at 390 and 1440, day and night: empty form, error state, plan again</td><td>Clean (12 runs)</td></tr>"
  "<tr><td>Sideways scroll at 390, 768, 1440 (same three states, day and night)</td><td>None</td></tr>"
  "<tr><td>Heading outline</td><td>h1 Plan your busk › h2 Or try a made-up act; plan again: h1 only. The form uses fieldset/legend.</td></tr>"
  "<tr><td>Focus visible (2.4.7)</td><td>Present but doubled: 2px border + 2px paper gap + 4px dark ring (B50); the selected choice card's focus is barely visible (B-041)</td></tr>"
  "<tr><td>Error association (3.3.1)</td><td>Name and slot fields: aria-invalid + aria-describedby. Artists combobox: neither (B51)</td></tr>"
  "<tr><td>Live regions</td><td>One role=alert per error (the form Alert, no alert inside or around it); field lines have no role; search status lines role=status</td></tr>"
  "<tr><td>Reduced motion</td><td>No movement; 0.15s colour transitions remain (B53)</td></tr>"
  "<tr><td>Calendar</td><td>Dialog has no accessible name; weeks start Sunday (B35)</td></tr>"
  "<tr><td>Logo (F12 as corrected)</td><td>Header (≥721px and phone) and footer: lockup shape right, old lettering (raised M): fail (B01, B55)</td></tr>"
  "</table>"),
 ("brand-issues", "BRAND's build issues for /busks",
  "<table><tr><th>Issue</th><th>Result</th><th>Evidence</th></tr>"
  "<tr><td>The Spotify link field doesn't grow (placeholder cut off)</td><td>Not reproduced</td><td>The field fills the row: 765px wide at 1440 for a 225px placeholder; full width at 390 and 768 (B26 crops). The cut-off placeholder is on the board's crop, not the build.</td></tr>"
  "<tr><td>The song-search label repeats the legend</td><td>Not reproduced</td><td>The build's search label is a visually hidden “Search songs on Spotify”; on screen only the legend “Songs you can play” shows (B18). The repeat is in the board/spec.</td></tr>"
  "<tr><td>The error alert sits inside a second role=\"alert\"</td><td>Not reproduced</td><td>After an empty submit there is one role=alert (the form Alert) with no alert or live-region ancestor and none inside it; field lines render without a role. Next's route announcer is a separate, empty region outside main.</td></tr>"
  "<tr><td>The nav says “Setlist”</td><td>Not reproduced</td><td>Header and bottom nav read Busks · Week · Brain · Tips (B01, B57). “Setlist” is on the board only.</td></tr>"
  "</table>"),
 ("v1", "v1 images (provisional ids, kept)",
  '<p>v1 crops and whole pages stay under <code>qa/screens/honeycomb/busks/</code> (deck/, build/, field-strip.jpg). Mapping of the v1 defects to BRAND ids: '
  'B-036 → B19 · B-037 → B17, B22, B48 · B-038 → B11, B16, B48 · B-039 → B37 · B-040 → B26 · B-041 → B38, B50 · B-042 → B19.</p>'),
]
