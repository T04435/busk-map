# Busks · review: data for qa/tools/page-review.py. Ids follow BRAND's inventory (design-handoff/inventory/busks, B01-B57).
# v1 used 20 provisional ids (B01-B20) that do not match these; its images stay under qa/screens/honeycomb/busks/.
# v2 images: qa/screens/honeycomb/busks/inv/build/ (7b1521e). v3 images: inv/v3/ (8207373).
TITLE = "Busks · review"
ROUTE = "/busks"
VERSION = "v3"
COMMIT = "8207373"
DATE = "17 Oct 2026"
IMG = "honeycomb/busks/inv/"
V2_CHANGES = ("Re-keyed to BRAND's inventory: 57 parts B01-B57 (15 spec-only) replace v1's 20 provisional ids. Every part checked at 1440 and 390 "
              "(768 for breakage) against BRAND's crop or spec and the user's calls (F12 as corrected: the lockup is the one logo; F13-F15, F20, F25-F27). "
              "Same commit as v1; v1 defects B-036..B-042 are cited on the matching rows; B-080..B-097 are new placeholders for MANAGER to number.")
CHANGES = ("Recheck at 8207373, every row re-judged at 1440 and 390 (768 for breakage). Fixed and now Present: B01/B55 (F12 lockup, new lettering), "
           "B11/B18 (F13 one border, one ring; B-038 hint), B16 (limit hint), B22/B48 (B-037 picks header and total, “N of 10”), "
           "B25 (B-083 “Search for songs above.”), B26 (B-040 visible label, icon, hint), B27 and B29 removed (F26, F25), B28 (B-084 field error with aria-invalid). "
           "Fixed on rows still Different for other reasons: B-036 and B-042 (B19), B-039 (B37), B-041 (B38). "
           "Still Different: B20 (F25 single row, DEV's declared deviation, but not BRAND's copy: B-143), B24 (B-097; B-142 squeeze at 390), B30 (F27 not done), "
           "B44-B46 (B-092), B41 (B-090), B50 (radio ring on the radio, declared deviation). New: B-134 night focus on the default button (B39, B50), "
           "B-142 picked-song titles squeezed by badges at 390 (B24, B56), B-143 typed-song row copy and visibility (B20, B21), B-144 no users icon on “By your artist” (B19). "
           "Deck crops B01, B20, B44, B45, B54, B55, B57 re-copied from BRAND's updated inventory.")
HISTORY = [
    (VERSION, COMMIT, DATE, CHANGES),
    ("v2", "7b1521e", "17 Oct 2026", V2_CHANGES),
    ("v1", "7b1521e", "17 Oct 2026", "First version: 20 provisional parts from the deck's Busks board (BRAND's inventory not yet in), the user's calls F13, F14, F20, F25, F26, F27, field strip, site checks, impeccable critique and audit."),
]
SOURCE_NOTE = ("Deck: BRAND's crops from inventory/busks (spec-only parts show the spec text). Build: QA's own clean export of 8207373, offline "
               "(synthetic Spotify results, so “Synthetic …” names and the “Offline test mode” notes appear; they are not judged). The no-match, "
               "loading and search-error states were reached by answering the page's own /api/repertoire calls in the browser; the error state by "
               "submitting the empty form; plan again with /busks?again=<id> from /plan?example=sax&date=2026-10-12. Commits after 8207373 that touch "
               "this page (d24caef card focus-within, b39fd5f F25 row copy, 55a8412 permit param) are not under test.")

F25 = "F25: remove the textarea; typing a song in is the fallback inside the song search, prefilled from the query, shown when there's no match."
F26 = "F26: remove “Load my songs”; load on Enter, or on blur when the field isn't empty."
F27 = "F27: time of day is shown with the song inputs; “Any time · Busk Map picks” waits for the user's architecture approval. Keep “Lunch” (as built and in the user's screenshot), not the board's “Midday”."
F13 = "F13: a normal input with the search icon only (shadcn InputGroup), one border, one focus ring."
F12 = ("F12 (corrected 17 Oct): the ONE logo is the lockup, hex mark + new wordmark, in header, footer and every asset; F12 only retired the old "
       "wordmark lettering. Wordmark-only or mark-only in a header fails. Supersedes the inventory's “wordmark only”.")
F20 = "F20: no “Melbourne” in an eyebrow or default text; city names only where the data is that city's."
L13 = "Kept as built (the user's call on landing L13): filled hexes, a blurb, a dark action row."
F1314 = "F13, F14, F15: one border and one focus ring per field, shadcn's own pattern, no global CSS overriding states."
DEV_F12 = "8207373: the design system's lockup files as images (header 36px, footer 34px)"
DEV_527 = "Fix claimed in 527a502"
DEV_F25 = "Declared deviation: a single “Add '<query>' as typed” row inside the song search, not B20's two fields (4e26406, f9bff52); BRAND's copy landed later in b39fd5f (not under test)"
DEV_F26 = "Fix claimed in 4e26406 / f9bff52"
DEV_RADIO = "Declared deviation: radio focus is a 3px outline at 4px offset on the radio (d24caef, later, moves it to the card)"
DEV_NIGHT = "DEV: the default button's focus ring at night isn't verified yet"


def P(id, name, qa, note, user="", defect="—", dev="—", deck=True, b1440=True, b390=True, spec=None):
    p = {"id": id, "name": name, "qa": qa, "note": note, "user": user, "defect": defect, "dev": dev,
         "deck": f"deck/{id}.jpg" if deck else None,
         "b1440": f"v3/{id}-1440.jpg" if b1440 else None, "b390": f"v3/{id}-390.jpg" if b390 else None}
    if spec:
        p["spec"] = spec
        p["deck_empty"] = "Spec only (no crop)"
    return p


PARTS = [
 P("B01", "Header", "Present", "The lockup [hex mark][new stencil wordmark] as an image (busk-map-lockup-dark.svg, 36px), lettering checked against the user's 04-wordmark-only-one.png: the M is no taller than the other letters. Nav Busks · Week · Brain · Tips, Busks current, from 721px. The board's wordmark-only header and “Setlist” are superseded.", F12, dev=DEV_F12, b390=False),
 P("B02", "Eyebrow", "Different", "Still reads “MELBOURNE · YOUR ACT, YOUR HOURS” (mono, bold, uppercase, muted). F20 wants “Your act, your hours”.", F20),
 P("B03", "Page title", "Present", "h1 “PLAN YOUR BUSK”, Big Shoulders 800, uppercase."),
 P("B04", "Intro line", "Different", "Copy matches. Still 16/24 with no max width: one 915px line at 1440 (board 18/27, max 760px).", defect="B-080"),
 P("B05", "Or try a made-up act", "Present", "Heading plus 3 cards in an auto-fit grid (min 260px, board 280px); hidden in the plan-again state."),
 P("B06", "“Or try a made-up act” heading", "Present", "h2, Big Shoulders 800 26px, uppercase."),
 P("B07", "Example act cards ×3", "Different", "As v2: filled orange hexes (AS, SA, FD), a blurb instead of “day · hours”, no “Plays …” line.", L13, "B-032"),
 P("B08", "“Watch Busk Map plan this act →”", "Different", "As v2: the whole card is the link, its foot a dark action row with an arrow (board: signal-coloured underlined link).", L13, "B-032"),
 P("B09", "Plan your own busk (form)", "Different", "form “Plan for your own act”, card background, 2px rule border, 28px padding (16px at 390), groups in order. Still no shadow. The textarea and Load my songs are gone (F25, F26); Time of day still sits in When and where (B30).", "F25, F26, F27", "B-081"),
 P("B10", "Act name", "Present", "Label “Act name”, placeholder “e.g. Jess on acoustic guitar”, maxLength 80, no hint. Focus: one 2px border plus one 2px ring, no paper gap.", "F14: one focus ring."),
 P("B11", "Artists you sound like", "Present", "One InputGroup border with the search icon only (box in a box gone), placeholder “Search Spotify, e.g. Paul Kelly”, live hint “0 of 10. Type a comma to add a name that isn’t on Spotify.” (2 of 10 with two chips).", F13, "B-038 fixed at 8207373", DEV_527),
 P("B12", "Artist chips", "Present", "ul “Artists you picked”: 26px hex with initials, name, “(TYPED)” tag for typed names, ghost x “Remove <name>”."),
 P("B13", "Artist search: results", "Present", "Listbox “Artist results”, group “SPOTIFY”: 32px hex, name, “26 releases · 184k Last.fm listeners”. After a pick the list closes and the field keeps focus.", deck=False,
   spec="Listbox “Artist results”, group “Spotify”: 32px hex, name, “N releases · N Last.fm listeners”; a picked artist shows a check and “Added”. Arrow keys move, Enter picks, Esc clears."),
 P("B14", "Artist not on Spotify: add as typed", "Present", "Group “NOT ON SPOTIFY?” with “Add “Zzyzx Nobody” as typed”; a comma also adds the name. No plus icon on the item.", deck=False,
   spec="While text is typed, a group “Not on Spotify?” offers “Add “<name>” as typed” (plus icon). A comma or new line also adds it. A later Spotify pick upgrades the typed chip."),
 P("B15", "Artist search status lines", "Different", "“Type 3 or more letters to search Spotify.”, “Searching Spotify…” (role status, no spinner), “No artists on Spotify match “…”.” as specified. Error still “Search isn't working right now. Type it in instead.” (spec: “… Try again in a moment.”), no warning icon.", defect="B-082", deck=False,
   spec="“Type 3 or more letters to search Spotify.”; “Searching Spotify…” with a spinner (role status); “No artists on Spotify match “<query>”.”; error (role alert): “Search isn't working right now. Try again in a moment.”"),
 P("B16", "Artist limit reached (10)", "Present", "At 10 chips the field is disabled, placeholder “Up to 10 artists”, hint “That’s the most. Remove one to add another.”", defect="B-038 fixed at 8207373", dev=DEV_527, deck=False,
   spec="At 10 artists the field is disabled, placeholder “Up to 10 artists”, hint “That’s the most. Remove one to add another.”"),
 P("B17", "Songs you can play", "Different", "fieldset “Songs you can play”: song search, “Your picks” header and list, the artist link. Textarea and Load my songs removed (F25, F26 met). Still shown in the plan-again state (B44) and Time of day is not in this group (F27).", f"{F25} {F26} {F27}", "B-092", DEV_F26),
 P("B18", "Song search", "Present", "One InputGroup border with the search icon only, placeholder “Search songs, e.g. Riptide”; focus is one border plus one ring. Label is a visually hidden “Search songs on Spotify” (the board's repeated legend isn't built).", F13),
 P("B19", "Song search: results", "Different", "Listbox “Song results”, group “SPOTIFY”: muted music hex, title, “artist · album”, length in mono, “BY YOUR ARTIST” badge now on its own line under the title (B-042 fixed: titles 177px wide at 390). After a pick the list closes, the query clears and the field keeps focus (B-036 fixed). The badge has no users icon (board).", F13, "B-036, B-042 fixed at 8207373; B-144", DEV_527),
 P("B20", "Song not on Spotify: type it in (F25)", "Different", "No match (answered empty): “No songs on Spotify match “Laneway Light - The Larkspur Two”. Add it as typed below.”, then group “NOT ON SPOTIFY?” with one row “Add “Laneway Light - The Larkspur Two” as typed” and “Write it as “Title - Artist”. Add (own) for your own song.” Board (decided 17 Oct): “+ Add “Laneway Light” by The Larkspur Two as typed” (split), no-match line without the extra sentence, helper “It's saved without a length, tagged Typed. Edit the title or artist any time.” The row is also shown under Spotify results, while searching and on error, not only on no match. Picking it adds the song tagged Typed (B24).", F25, "B-143", DEV_F25),
 P("B21", "Song search status lines", "Different", "“Type 3 or more letters…” and “Searching Spotify…” (no spinner) as specified; error still “Search isn't working right now. Type it in instead.”; the no-match line stays above the typed row (B20).", F25, "B-082, B-143", deck=False,
   spec="“Type 3 or more letters to search Spotify.”; “Searching Spotify…” with spinner; error “Search isn't working right now. Try again in a moment.” (role alert). The no-match line is replaced by the typed fallback (B20)."),
 P("B22", "Your picks", "Present", "Mono muted header “YOUR PICKS · 7 SONGS · AT LEAST 21:50” (“at least” when a typed song has no length), then ul “Songs you picked” in a 2px rule box. One line, not label left and total right as drawn.", defect="B-037 fixed at 8207373", dev=DEV_527),
 P("B23", "Picked song row (Spotify)", "Present", "Muted hex with music icon, title, “artist · album”, length in mono, ghost x “Remove <title>”."),
 P("B24", "Picked song row (your own / typed)", "Different", "A typed song is saved with no length, tagged “TYPED” (F25 met); typed with “(own)” it shows both “YOUR SONG” and “TYPED”. The solid “YOUR SONG” badge still has no music icon. At 390 the badges squeeze the title to “Lan…” and the artist to “The …” (390 crop).", F25, "B-097, B-142", DEV_F26),
 P("B25", "No songs picked", "Present", "With no picks: “Search for songs above.” (points to the search only, as F25 asks).", "F25: the line must point to the search only (copy to confirm).", "B-083 fixed at 8207373", DEV_F26, deck=False,
   spec="PickedSongs empty line: “Search for songs above, or type them below.” Overridden by F25: point to the search only (copy to confirm)."),
 P("B26", "Your Spotify artist link", "Present", "Visible label “Your Spotify artist link (optional)”, music icon, placeholder “open.spotify.com/artist/…”, hint “Optional: adds your own songs. Press Enter to load them.”; no button; Enter loads, and blur loads when the field isn't empty (F26 met).", F26, "B-040 fixed at 8207373", DEV_F26),
 P("B27", "“Load my songs” button", "Present", "Removed, as F26 asks: no “Load my songs” button at 1440 or 390.", F26, dev=DEV_F26, b1440=False, b390=False),
 P("B28", "Artist link: songs loaded / bad link", "Present", "Enter loads (offline: synthetic “Your song” rows and “Offline test mode: these songs are made up, not from Spotify.”; the live line in source is the board's “Added N of your songs from Spotify. Remove any you don't play.”). A bad link on blur: field error with warning icon “That isn't a Spotify artist link. It starts with open.spotify.com/artist/.”, aria-invalid and aria-describedby (390 crop). Busy: aria-busy plus a spinner line “Loading your songs…”.", F26, "B-084 fixed at 8207373", DEV_F26),
 P("B29", "“Songs Spotify doesn't have” textarea", "Present", "Removed, as F25 asks: no textarea on the page; typing a song in is the row inside the song search (B20).", F25, dev=DEV_F25, b1440=False, b390=False),
 P("B30", "Time of day with the song inputs (F27)", "Different", "Toggle group “Time of day”: Morning 9 am–12 pm · Lunch 12 pm–3 pm · Afternoon 3 pm–6 pm · Evening 6 pm–9 pm, 4 across at 1440, 2×2 at 390. Still in When and where above Date, not with the song inputs. No “Any time” (correctly held); “Lunch” kept.", F27),
 P("B31", "When and where", "Present", "fieldset “When and where”: City, Time of day (B30), Date · From · To, permit. No sideways scroll at 390/768/1440."),
 P("B32", "City picker", "Present", "Legend “City”, hex radio “Melbourne”, “Taste, foot traffic, busking rules, events and weather”, “LIVE DATA” badge.", "F20: the city name is fine here (the data is Melbourne's)."),
 P("B33", "Cities and their data level", "Different", "Unchanged: performer-form.tsx passes one literal city to CityPicker and the request hard-codes city “melbourne”.", F20, "B-085", deck=False, b1440=False, b390=False,
   spec="The city list, each city's note and its level (live → “Live data”, otherwise “Less data”) come from the app's city coverage. While null: no default city text (F20); the first city is selected."),
 P("B34", "Date", "Different", "Field-style button “SAT 17 OCT 2026”: uppercase, no comma, the calendar icon on the right (board: “Sun, 18 Oct 2026”, icon on the left).", defect="B-086"),
 P("B35", "Calendar open", "Different", "Unchanged: weeks start on Sunday (SU…SA; spec Mo–Su) and the dialog has no name (spec “Choose a date”). Past days disabled, selected day a filled hex.", defect="B-087", deck=False,
   spec="Dialog “Choose a date”: month and year, Previous/Next month buttons, Mo–Su, day buttons (selected filled, today marked, past disabled). Picking a day closes it."),
 P("B36", "From", "Different", "Select “From”, default 6 pm (plan again: 5 pm). Still offers all 24 hours 12 am … 11 pm (spec 6 am … 12 am).", "F14: one focus ring.", "B-088"),
 P("B37", "To", "Different", "Select “To”, default 9 pm, hint “Up to 6 hours” now under it (B-039 fixed). Still offers 1 am … 12 am.", "F14: one focus ring.", "B-039 fixed at 8207373; B-088", DEV_527),
 P("B38", "Your busking permit", "Different", "Legend, three choice cards and hint as drawn; descriptions still differ from the board (“Pitches open to every permit. Keep the council's clearances…” etc.). Keyboard focus on the selected card: a 3px dark outline 4px off the radio, clearly visible (B-041 fixed). Not hidden in plan again (B-092).", defect="B-089; B-041 fixed at 8207373; B-092", dev=DEV_RADIO),
 P("B39", "Plan buttons", "Different", "Top border, primary lg “PLAN MY BUSK →”, outline lg “PLAN MY WEEK FROM THIS DATE” with calendar icon; full-width rows at 390. By day the primary's focus is a dark 2px ring. At night the ring is the same orange as the button (rgb 255,106,43 on 255,106,43), so focus shows only as the button growing 2px (inv/v3/B39night-1440.jpg).", "F14: one focus ring each (see B50).", "B-134", DEV_NIGHT),
 P("B40", "Form error: artists", "Present", "Empty submit: one role=alert Alert above the buttons, title “ARTISTS YOU SOUND LIKE”, “Add at least one artist you sound like.” The board's Spotify-id case can't be reached offline; the source's sentence matches the board. Icon is a circle, not the board's triangle."),
 P("B41", "Form error: songs", "Different", "Reached with a 200-character typed title. Body still “check “<title>” (Too big: expected string to have <=120 characters).”: lower-case start and the validator's raw text (board: “Check “Laneway Light” (the title is empty or too long).”). At 390 the unbroken test title runs past the alert's border.", defect="B-090"),
 P("B42", "Form error: date and times", "Different", "Body still repeats the field: “Check the date and times: the slot must end after it starts and last at most 6 hours.” From and To get aria-invalid.", defect="B-091"),
 P("B43", "Form error: act name", "Different", "Not reachable (maxLength 80); form-errors.ts would show the validator's raw text, not “Use 80 characters or fewer.”", defect="B-090", b1440=False, b390=False),
 P("B44", "Plan again: banner", "Different", "Unchanged: “Planning again for Soul and funk sax player. Your act, artists, songs and permit come from your earlier busk: pick a new date and time.” (no busk date); title “Plan your busk” and the new-act intro (board: “Plan your next busk”, “Same act, same songs…”). Examples hidden; date Mon 19 Oct, 5–8 pm. Act, artists, songs and permit groups not hidden.", defect="B-092"),
 P("B45", "Plan again: your act", "Missing", "No “Your act · from your last busk” summary; the prefilled form shows in its place (crop).", defect="B-092"),
 P("B46", "Last busk (plan again)", "Different", "?again=<id> prefills name, 4 artists (typed), 6 songs, permit and hours from the stored plan; with no plan the new-act form shows. Nothing is hidden and the last busk's date isn't shown.", defect="B-092", deck=False, b1440=False, b390=False,
   spec="Act name, sound-alike artists, song count, permit, last hours and last busk date come from the performer's last busk. While null: the new-act form shows instead."),
 P("B47", "Artists rank the song search", "Present", "The picked artists' songs sort first with “BY YOUR ARTIST” (B19: Gillian Welch and Zzyzx Nobody first for “Fast Car”). The list stays closed until something is typed.", deck=False, b1440=False, b390=False,
   spec="The picked artists' names feed the song search, so their songs sort first with “By your artist”. Spotify results are live; while null the list is closed."),
 P("B48", "Picks total and artist count", "Present", "“N songs · m:ss” in the picks header and “N of 10” in the artists hint, both update on add and remove (checked 0 → 2 artists, 0 → 7 songs).", defect="B-037, B-038 fixed at 8207373", dev=DEV_527, deck=False, b1440=False, b390=False,
   spec="“N songs · m:ss” sums the known lengths of Your picks; “N of 10” counts the artist chips. Both update on every add and remove."),
 P("B49", "Log your takings line", "Different", "Unchanged: adds “they stay in this browser,”; the link is foreground (rgb 20,28,33), bold, underlined (board: signal-coloured).", defect="B-093"),
 P("B50", "Field focus (F13, F14)", "Different", "Field strip at 8207373: 68 of 68 /busks states pass (17 fields × day/night × 1440/390): one border and one 2px ring, no paper gap, no nested borders. Radios: a 3px outline at 4px offset on the radio, not a ring round the whole choice (declared deviation; crop). The default button's ring at night is invisible (B39).", F1314, "B-134", DEV_RADIO + "; " + DEV_NIGHT, deck=False, b390=False,
   spec="Every input, select, search and button: one focus ring, shadcn's pattern (border turns --ring plus --focus-ring), no white gap, no nested borders. Radio choices ring the whole choice (focus-within)."),
 P("B51", "Field-level errors", "Different", "Each error shows under its field with a warning icon. Name and slot fields get aria-invalid/aria-describedby; the artists combobox still gets neither. The field line is the whole sentence (songs: “Songs you can play: check …”), not the alert title's words.", defect="B-094", deck=False,
   spec="Each field shows its own error under it (aria-invalid, aria-describedby) in the same words as the alert title's field."),
 P("B52", "Searching spinner", "Missing", "“Searching Spotify…” still shows with no Loader (only the field's search icon). The artist link's “Loading your songs…” does have one.", defect="B-095", deck=False,
   spec="The Loader beside “Searching Spotify…” spins (0.9 s linear). Reduced motion: still."),
 P("B53", "Reduced motion", "Different", "With prefers-reduced-motion: reduce, #name, the submit button and the date button keep transition-duration 0.15s.", defect="B-096", deck=False, b1440=False, b390=False,
   spec="No other motion on this page; with prefers-reduced-motion every transition (focus, hover, calendar) is instant."),
 P("B54", "Night theme", "Present", "Night background, cards and fields on the dark tokens, orange accent; axe clean at 390 and 1440 (form, error, plan again)."),
 P("B55", "Phone header (≤720px)", "Present", "Below 721px the nav hides and only the lockup stays (hex mark + new lettering, 36px), as F12 asks.", F12, dev=DEV_F12, b1440=False),
 P("B56", "Phone layout (≤720px)", "Present", "Single column: cards stack, Time of day 2×2, Date/From/To stack, buttons full rows; no sideways scroll at 390 (crop: first 1800px of the filled page). In the picks list the “Your song” badges cut titles to “Synthet…” (B-142, B24).", defect="B-142", b1440=False),
 P("B57", "Bottom nav (≤720px)", "Present", "Sticky bottom nav Busks · Week · Brain · Tips with icons, Busks current. The board's “Setlist” is stale.", b1440=False),
]

NEW = [
 ("B-134", "Medium", "B39, B50", "At night the focused default (orange) button's 2px ring is the same orange as the button (rgb 255,106,43 on 255,106,43): focus shows only as 2px of growth, no 3:1 indicator against the button (WCAG 2.4.7 / 1.4.11). The field strip counts a ring and passes it."),
 ("B-142", "Low", "B24, B56", "At 390 the “Your song” and “Typed” badges plus the length squeeze picked-song titles to 3-7 letters (“Lan…”, “Synthet…”), as B-042 did in the results."),
 ("B-143", "Low", "B20, B21", "Typed-song row: “Add “<query>” as typed” + “Write it as “Title - Artist”…” instead of BRAND's “+ Add “<title>” by <artist> as typed” + “It's saved without a length, tagged Typed…”; the no-match line adds “Add it as typed below.”; the row shows under results, while searching and on error, not only on no match. b39fd5f (after 8207373) claims the copy."),
 ("B-144", "Low", "B19", "The “By your artist” badge in song results has no users icon (board draws one)."),
]

SECTIONS = [
 ("new-defects", "New defects at 8207373 (placeholders for MANAGER to number)",
  "<table><tr><th>Id</th><th>Severity</th><th>Rows</th><th>What differs</th></tr>"
  + "".join(f"<tr><td>{i}</td><td>{s}</td><td>{r}</td><td>{t}</td></tr>" for i, s, r, t in NEW) + "</table>"),
 ("field-strip", "Field strip (F13, F14): every field on /busks, unfocused | focused",
  '<p>Columns: day 1440, night 1440, day 390, night 390; each pair unfocused then focused. Rule: one border and one focus ring per field. '
  'Result at 8207373 (fields8): <b>68 of 68 states pass</b> (17 fields × 4). It was 0 of 19 at 7b1521e. The strip counts rings, so it passes the night '
  '“Plan my busk” ring that is the same colour as the button (B-134). Rows: B11, B18, B50.</p>'
  '<a href="../screens/honeycomb/busks/inv/v3/field-strip.jpg"><img src="../screens/honeycomb/busks/inv/v3/field-strip.jpg" alt="Busks field strip at 8207373"></a>'),
 ("critique", "Impeccable critique (design review)",
  "<ol>"
  "<li><b>P1 · Plan again still doesn't feel like planning again.</b> The banner says the act comes from the last busk, but the whole prefilled new-act form is there, the title is still “Plan your busk”, no busk date and no act summary (B44, B45, B46; B-092).</li>"
  "<li><b>P2 · Focus vanishes on the main button at night.</b> Every field now has one border and one ring, but the orange “Plan my busk” gets an orange ring (B39, B50; B-134).</li>"
  "<li><b>P2 · Adding a song is one flow now, with rough edges.</b> Textarea and Load my songs are gone and the typed row lives in the search, but its copy isn't BRAND's and it shows under every result list (B20, B21; B-143). On a phone the badges eat the titles in Your picks (B24, B56; B-142).</li>"
  "<li><b>P2 · Errors still speak code.</b> The songs error is the validator's raw text in lower case; the slot error repeats its title; search errors say “Type it in instead.” (B41, B42, B15, B21).</li>"
  "<li><b>P3 · Time sits apart from the songs.</b> Time of day is still in When and where, not with the song inputs as F27 asks, and From/To offer all 24 hours (B30, B36, B37).</li>"
  "</ol>"),
 ("audit", "Impeccable audit (technical)",
  "<table><tr><th>Check</th><th>Result</th></tr>"
  "<tr><td>axe (WCAG 2.0/2.1/2.2 A+AA tags) at 390 and 1440, day and night: empty form, error state, plan again</td><td>Clean (12 runs)</td></tr>"
  "<tr><td>Sideways scroll at 390, 768, 1440 (same three states, day and night)</td><td>None (18 runs)</td></tr>"
  "<tr><td>Heading outline</td><td>h1 Plan your busk › h2 Or try a made-up act; plan again: h1 only. The form uses fieldset/legend.</td></tr>"
  "<tr><td>Focus visible (2.4.7, 1.4.11)</td><td>Fields: one 2px border plus one 2px ring, 68/68 strip states pass. Radios: 3px outline at 4px offset, clear on the selected card (B-041 fixed). Default button at night: ring same colour as the button (B-134)</td></tr>"
  "<tr><td>Error association (3.3.1)</td><td>Name, slot and artist-link fields: aria-invalid + aria-describedby. Artists combobox: neither (B51, B-094)</td></tr>"
  "<tr><td>Live regions</td><td>One role=alert per error (no nested alert); search status lines role=status; artist link note aria-live=polite, busy via aria-busy</td></tr>"
  "<tr><td>Reduced motion</td><td>No movement; 0.15s colour transitions remain (B53)</td></tr>"
  "<tr><td>Calendar</td><td>Dialog has no accessible name; weeks start Sunday (B35)</td></tr>"
  "<tr><td>Logo (F12 as corrected)</td><td>Header (1440 and 390) and footer: lockup image, new lettering (M level with the other letters), dark/light file by theme: pass (B01, B55)</td></tr>"
  "</table>"),
 ("brand-issues", "BRAND's build issues for /busks",
  "<table><tr><th>Issue</th><th>Result</th><th>Evidence</th></tr>"
  "<tr><td>The Spotify link field doesn't grow (placeholder cut off)</td><td>Not reproduced</td><td>The field fills the row at 390, 768 and 1440 with a visible label and the music icon (B26 crops).</td></tr>"
  "<tr><td>The song-search label repeats the legend</td><td>Not reproduced</td><td>The search label is a visually hidden “Search songs on Spotify”; on screen only the legend shows (B18).</td></tr>"
  "<tr><td>The error alert sits inside a second role=\"alert\"</td><td>Not reproduced</td><td>After an empty submit there is one role=alert (the form Alert), no alert or live-region ancestor, none inside it.</td></tr>"
  "<tr><td>The nav says “Setlist”</td><td>Not reproduced</td><td>Header and bottom nav read Busks · Week · Brain · Tips (B01, B57).</td></tr>"
  "</table>"),
 ("v1", "Older images (kept)",
  '<p>v2 crops (7b1521e) stay under <code>qa/screens/honeycomb/busks/inv/build/</code>; v1 crops under <code>qa/screens/honeycomb/busks/</code>. Mapping of the v1 defects to BRAND ids: '
  'B-036 → B19 · B-037 → B17, B22, B48 · B-038 → B11, B16, B48 · B-039 → B37 · B-040 → B26 · B-041 → B38, B50 · B-042 → B19. All seven are fixed at 8207373.</p>'),
]
