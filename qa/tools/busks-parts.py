# Busks · review: data for qa/tools/page-review.py. Ids follow BRAND's inventory (design-handoff/inventory/busks, B01-B57).
# v1 used 20 provisional ids (B01-B20) that do not match these; its images stay under qa/screens/honeycomb/busks/.
# v2 images: qa/screens/honeycomb/busks/inv/build/ (7b1521e). v3 images: inv/v3/ (8207373). v4 images: inv/v4/ (f83f1a1).
TITLE = "Busks · review"
ROUTE = "/busks"
VERSION = "v4"
COMMIT = "f83f1a1"
DATE = "17 Oct 2026"
IMG = "honeycomb/busks/inv/"
V2_CHANGES = ("Re-keyed to BRAND's inventory: 57 parts B01-B57 (15 spec-only) replace v1's 20 provisional ids. Every part checked at 1440 and 390 "
              "(768 for breakage) against BRAND's crop or spec and the user's calls (F12 as corrected: the lockup is the one logo; F13-F15, F20, F25-F27). "
              "Same commit as v1; v1 defects B-036..B-042 are cited on the matching rows; B-080..B-097 are new placeholders for MANAGER to number.")
V3_CHANGES = ("Recheck at 8207373, every row re-judged at 1440 and 390 (768 for breakage). Fixed and now Present: B01/B55 (F12 lockup, new lettering), "
              "B11/B18 (F13 one border, one ring; B-038 hint), B16 (limit hint), B22/B48 (B-037 picks header and total, “N of 10”), "
              "B25 (B-083 “Search for songs above.”), B26 (B-040 visible label, icon, hint), B27 and B29 removed (F26, F25), B28 (B-084 field error with aria-invalid). "
              "Fixed on rows still Different for other reasons: B-036 and B-042 (B19), B-039 (B37), B-041 (B38). "
              "Still Different: B20 (F25 single row, DEV's declared deviation, but not BRAND's copy: B-143), B24 (B-097; B-142 squeeze at 390), B30 (F27 not done), "
              "B44-B46 (B-092), B41 (B-090), B50 (radio ring on the radio, declared deviation). New: B-134 night focus on the default button (B39, B50), "
              "B-142 picked-song titles squeezed by badges at 390 (B24, B56), B-143 typed-song row copy and visibility (B20, B21), B-144 no users icon on “By your artist” (B19). "
              "Deck crops B01, B20, B44, B45, B54, B55, B57 re-copied from BRAND's updated inventory.")
CHANGES = ("The one full pass at DEV's closing commit f83f1a1: every row re-judged at 1440 and 390 (768 for breakage); new captures in inv/v4/. "
           "Fixed since v3 and now Present: B02 (F20: the eyebrow reads “Your act, your hours”, no Melbourne), B39 and B50 (B-134 fixed at f83f1a1: buttons focus with one 2px outline "
           "2px outside, so at night the orange ring sits on the dark ground with a gap, not on the orange fill; the choice card now carries the focus, a 3px outline at 4px, "
           "the radio draws none, BRAND's ruling), B53 (B-096 fixed at f83f1a1: every transition is 0s under reduced motion), B49 (retired with Tips: the takings line is gone, B-093 moot), "
           "B07/B08 (B-032 accepted by the user, judged against that call). B20: BRAND's copy landed (“+ Add “Laneway Light” by The Larkspur Two as typed” and the Typed helper; B-143 copy part fixed) "
           "but the row still shows under Spotify results, while searching and on error. Now Held: B30 (F27 held by DEV). "
           "Worse: B24/B56 (B-142): the new edit pencil leaves an “(own)” typed song with no visible title or artist at 390 (title 0px wide). "
           "Still open: B-080, B-081, B-082, B-085..B-092, B-094, B-095, B-097, B-144. New: B-172 (B11 artists hint sits above the field), B-173 (B14 artist typed row has no plus icon); both were already so at 8207373. "
           "Tips: nothing of it remains on /busks (no nav item, no /tips link, no tip or takings copy). "
           "DS parity and glyph rule applied (user rule, same commit): every component judged against BRAND's DS specimen. Now Different: B07/B08 (DS ExampleActCard, B-163), "
           "B12 (DS ArtistPicker chips, B-175), B22 (DS PickedSongs, B-176), B26 (DS Input/RepertoirePicker Spotify icon, B-174), B30 stays Held (F27, DEV) with a DS TimeSlotPicker note (B-177), "
           "B32 (DS CityPicker badge icon, B-181), B40 (DS Alert icon, B-179). DS notes added to rows already Different: B11, B14, B15 (ArtistPicker), B19 (SongSearch, B-182), "
           "B34/B35 (DatePicker), B38 (PermitPicker counts, B-178), B41/B42 (Alert), B44 (Banner, B-180), B52 (Loader). Glyph rule: no text glyph icons on /busks (arrows, plus, check and x are SVG icons), so no row cites B-162.")
HISTORY = [
    (VERSION, COMMIT, DATE, CHANGES),
    ("v3", "8207373", "17 Oct 2026", V3_CHANGES),
    ("v2", "7b1521e", "17 Oct 2026", V2_CHANGES),
    ("v1", "7b1521e", "17 Oct 2026", "First version: 20 provisional parts from the deck's Busks board (BRAND's inventory not yet in), the user's calls F13, F14, F20, F25, F26, F27, field strip, site checks, impeccable critique and audit."),
]
READY = ("Not ready",
         "Under the DS-parity rule several components visibly differ from their DS specimens: the example act cards are a different layout from DS ExampleActCard (B07, B08), "
         "Time of day selects in dark, not DS TimeSlotPicker's orange (B30), and the artist chips, picks header, permit counts and alert icon differ (B12, B22, B38, B40). "
         "Plan again is still the whole prefilled form (B44, B45, B46; B-092), and at 390 an “(own)” typed song shows no title (B24, B56; B-142).")
SOURCE_NOTE = ("Deck: BRAND's crops from inventory/busks (spec-only parts show the spec text; crops unchanged since v3). Build: QA's own clean export of f83f1a1, offline "
               "(synthetic Spotify results, so “Synthetic …” names and the “Offline test mode” notes appear; they are not judged). The no-match, "
               "loading and search-error states were reached by answering the page's own /api/repertoire calls in the browser; the error state by "
               "submitting the empty form; plan again with /busks?again=<id> (Q76ceKvWT) taken from /plan?example=sax&date=2026-10-12. Focus crops are keyboard focus (Tab).")

F25 = "F25: remove the textarea; typing a song in is the fallback inside the song search, prefilled from the query, shown when there's no match."
F26 = "F26: remove “Load my songs”; load on Enter, or on blur when the field isn't empty."
F27 = "F27: time of day is shown with the song inputs; “Any time · Busk Map picks” waits for the user's architecture approval. Keep “Lunch” (as built and in the user's screenshot), not the board's “Midday”. HELD BY DEV."
F13 = "F13: a normal input with the search icon only (shadcn InputGroup), one border, one focus ring."
F12 = ("F12 (corrected 17 Oct): the ONE logo is the lockup, hex mark + new wordmark, in header, footer and every asset; F12 only retired the old "
       "wordmark lettering. Wordmark-only or mark-only in a header fails. Supersedes the inventory's “wordmark only”.")
F20 = ("F20: no “Melbourne” in an eyebrow or default text; city names only where the data really is that city's (DEV: the city picker, time zone, "
       "example pitch names, City of Melbourne sources and compare verdict are real data).")
L13 = "Kept as built (the user's call on landing L13, B-032 accepted by the user): filled hexes, a blurb, a dark action row."
F1314 = "F13, F14, F15: one border and one focus ring per field, shadcn's own pattern, no global CSS overriding states. BRAND's ruling: radio choices show focus on the card (.bm-choice:focus-within, 3px at 4px)."
TIPS = "Tips removed by the user (17 Oct): nothing of it may remain on this page."
DEV_F12 = "8207373: the design system's lockup files as images (header 36px, footer 34px)"
DEV_527 = "Fix claimed in 527a502"
DEV_F25 = "b39fd5f: BRAND's typed-row copy (“+ Add “title” by artist as typed”), the Typed helper, edit in place"
DEV_F26 = "Fix claimed in 4e26406 / f9bff52"
DEV_CARD = "d24caef: the choice card shows the focus (focus-within 3px at 4px); the radio draws none"
DEV_BTN = "fcf44a4 / fd3252c: every button but poster focuses with one 2px outline at 2px offset (B-134)"
DEV_RM = "f83f1a1: a global reduced-motion transitions rule"
DEV_HELD = "Held by DEV (F27)"


def P(id, name, qa, note, user="", defect="—", dev="—", deck=True, b1440=True, b390=True, spec=None):
    p = {"id": id, "name": name, "qa": qa, "note": note, "user": user, "defect": defect, "dev": dev,
         "deck": f"deck/{id}.jpg" if deck else None,
         "b1440": f"v4/{id}-1440.jpg" if b1440 else None, "b390": f"v4/{id}-390.jpg" if b390 else None}
    if spec:
        p["spec"] = spec
        p["deck_empty"] = "Spec only (no crop)"
    return p


PARTS = [
 P("B01", "Header", "Present", "The lockup [hex mark][new wordmark] as an image (busk-map-lockup-dark.svg, 36px). Nav Busks · Week · Brain, Busks current, from 721px. No Tips item (Tips removed); Repertoire comes with the brandv1 merge, as the inventory says. The board's wordmark-only header and “Setlist” are superseded.", f"{F12} {TIPS}", dev=DEV_F12, b390=False),
 P("B02", "Eyebrow", "Present", "Now reads “YOUR ACT, YOUR HOURS” (mono, bold, uppercase, muted), as F20 asks. The only “Melbourne” left on the page is the city picker's choice (B32, real data).", F20, dev="f137b9a: no Melbourne eyebrow on /busks"),
 P("B03", "Page title", "Present", "h1 “PLAN YOUR BUSK”, Big Shoulders 800, uppercase. (Plan again keeps it: B44.)"),
 P("B04", "Intro line", "Different", "Copy matches. Still 16/24 with no max width: one 915px line at 1440 (board 18/27, max 760px).", defect="B-080"),
 P("B05", "Or try a made-up act", "Present", "Heading plus 3 cards in an auto-fit grid (min 260px, board 280px); 3 across at 1440, 2+1 at 768, stacked at 390; hidden in the plan-again state."),
 P("B06", "“Or try a made-up act” heading", "Present", "h2, Big Shoulders 800 26px, uppercase."),
 P("B07", "Example act cards ×3", "Present", "As the user kept them: filled orange hexes (AS, SA, FD), a blurb (“Guitar and voice, Australian songbook covers. Saturday evening.”) and “Sounds like …”; no “day · hours” line and no “Plays …” (board). Judged against the user's call.", L13, "B-032 (accepted by the user)"),
 P("B08", "“Watch Busk Map plan this act →”", "Present", "As the user kept it: the whole card is the link (/plan?example=acoustic|sax|folk-duo), its foot a dark action row with an arrow (board: signal-coloured underlined link).", L13, "B-032 (accepted by the user)"),
 P("B09", "Plan your own busk (form)", "Different", "form “Plan for your own act”, card background, 2px rule border, 28px padding (16px at 390), groups in order Your act, Songs you can play, When and where, buttons. Still no shadow (box-shadow none). Time of day sits in When and where (B30, held).", "F25, F26, F27", "B-081"),
 P("B10", "Act name", "Present", "Label “Act name”, placeholder “e.g. Jess on acoustic guitar”, maxLength 80, no hint. Focus: one 2px border plus one 2px ring, no paper gap."),
 P("B11", "Artists you sound like", "Different", "One InputGroup border with the search icon only, placeholder “Search Spotify, e.g. Paul Kelly”, live hint “2 of 10. Type a comma to add a name that isn’t on Spotify.” Chips sit above the field as drawn. The hint sits between the chips and the field (above the search), the board draws it under the field; already so at 8207373.", F13, "B-172", DEV_527),
 P("B12", "Artist chips", "Present", "ul “Artists you picked”: 26px hex with initials, name, “(TYPED)” tag for typed names, ghost x “Remove <name>”; wraps to one chip a row at 390."),
 P("B13", "Artist search: results", "Present", "Listbox “Artist results”, group “SPOTIFY”: 32px hex, name, “26 releases · 184k Last.fm listeners”. After a pick the list closes and the field keeps focus.", deck=False,
   spec="Listbox “Artist results”, group “Spotify”: 32px hex, name, “N releases · N Last.fm listeners”; a picked artist shows a check and “Added”. Arrow keys move, Enter picks, Esc clears."),
 P("B14", "Artist not on Spotify: add as typed", "Different", "Group “NOT ON SPOTIFY?” with “Add “Zzyzx Nobody” as typed”; a comma also adds the name. The item has no plus icon (spec draws one; the song search's typed row has it).", defect="B-173", deck=False,
   spec="While text is typed, a group “Not on Spotify?” offers “Add “<name>” as typed” (plus icon). A comma or new line also adds it. A later Spotify pick upgrades the typed chip."),
 P("B15", "Artist search status lines", "Different", "“Type 3 or more letters to search Spotify.”, “Searching Spotify…” (role status, no spinner), “No artists on Spotify match “…”.” as specified. Error still “Search isn't working right now. Type it in instead.” (spec: “… Try again in a moment.”), no warning icon.", defect="B-082", deck=False,
   spec="“Type 3 or more letters to search Spotify.”; “Searching Spotify…” with a spinner (role status); “No artists on Spotify match “<query>”.”; error (role alert): “Search isn't working right now. Try again in a moment.”"),
 P("B16", "Artist limit reached (10)", "Present", "At 10 chips the field is disabled, placeholder “Up to 10 artists”, hint “That’s the most. Remove one to add another.”", defect="B-038 fixed at 8207373", dev=DEV_527, deck=False,
   spec="At 10 artists the field is disabled, placeholder “Up to 10 artists”, hint “That’s the most. Remove one to add another.”"),
 P("B17", "Songs you can play", "Different", "fieldset “Songs you can play”: song search, “Your picks” header and list, the artist link; no textarea, no Load my songs (F25, F26 met). Still shown in the plan-again state (B44). Time of day is not in this group (F27, held by DEV).", f"{F25} {F26} {F27}", "B-092", DEV_F26),
 P("B18", "Song search", "Present", "One InputGroup border with the search icon only, placeholder “Search songs, e.g. Riptide”; focus is one border plus one ring. Label is a visually hidden “Search songs on Spotify” (the board's repeated legend isn't built).", F13),
 P("B19", "Song search: results", "Different", "Listbox “Song results”, group “SPOTIFY”: muted music hex, title, “artist · album”, length in mono, “BY YOUR ARTIST” badge on its own line under the title (titles 177px wide at 390). After a pick the list closes, the query clears and the field keeps focus. The badge still has no users icon (board).", F13, "B-144; B-036, B-042 fixed at 8207373", DEV_527),
 P("B20", "Song not on Spotify: type it in (F25)", "Different", "No match (answered empty): “No songs on Spotify match “Laneway Light - The Larkspur Two”.”, group “NOT ON SPOTIFY?”, one row “+ Add “Laneway Light” by The Larkspur Two as typed” (Title - Artist split) and “It's saved without a length, tagged Typed. Edit the title or artist any time.”: BRAND's copy, word for word. Still shown under Spotify results (“Fast Car”: groups Spotify, Not on Spotify?), while searching and on error, not only on no match as F25 says. Picking it adds the song tagged Typed, editable in place (Title, Artist, Done).", F25, "B-143 (copy fixed at f83f1a1; visibility open)", DEV_F25),
 P("B21", "Song search status lines", "Different", "“Type 3 or more letters…” and “Searching Spotify…” (no spinner) as specified; error still “Search isn't working right now. Type it in instead.” with the typed row under it; the no-match line stays above the typed row as B20 (decided) draws.", F25, "B-082, B-143", deck=False,
   spec="“Type 3 or more letters to search Spotify.”; “Searching Spotify…” with spinner; error “Search isn't working right now. Try again in a moment.” (role alert). The no-match line is replaced by the typed fallback (B20)."),
 P("B22", "Your picks", "Present", "Mono muted header “YOUR PICKS · 7 SONGS · AT LEAST 21:50” (“at least” when a typed song has no length), then ul “Songs you picked” in a 2px rule box. One line, not label left and total right as drawn.", defect="B-037 fixed at 8207373", dev=DEV_527),
 P("B23", "Picked song row (Spotify)", "Present", "Muted hex with music icon, title, “artist · album”, length in mono, ghost x “Remove <title>”."),
 P("B24", "Picked song row (your own / typed)", "Different", "A typed song is saved with no length, tagged “TYPED”, with an edit pencil “Edit <title>” (Title and Artist fields, Done) (F25 met). Typed with “(own)” it shows “YOUR SONG” and “TYPED”. The solid “YOUR SONG” badge still has no music icon. At 390 the badges plus the new pencil leave the “(own)” typed song's title 0px wide: no title or artist shows at all (390 crop, third row of B22); a plain typed song keeps 80px. Worse than v3's “Lan…”.", F25, "B-097, B-142 (worse)", DEV_F25),
 P("B25", "No songs picked", "Present", "With no picks: “Search for songs above.” (points to the search only, as F25 asks).", "F25: the line must point to the search only (copy to confirm).", "B-083 fixed at 8207373", DEV_F26, deck=False,
   spec="PickedSongs empty line: “Search for songs above, or type them below.” Overridden by F25: point to the search only (copy to confirm)."),
 P("B26", "Your Spotify artist link", "Present", "Visible label “Your Spotify artist link (optional)”, music icon, placeholder “open.spotify.com/artist/…”, hint “Optional: adds your own songs. Press Enter to load them.”; no button; Enter loads, blur loads when the field isn't empty (F26 met). Fills the row at 390, 768 and 1440.", F26, "B-040 fixed at 8207373", DEV_F26),
 P("B27", "“Load my songs” button", "Present", "Removed, as F26 asks: no “Load my songs” button at 1440 or 390.", F26, dev=DEV_F26, b1440=False, b390=False),
 P("B28", "Artist link: songs loaded / bad link", "Present", "Enter loads (offline: synthetic “Your song” rows and “Offline test mode: these songs are made up, not from Spotify.”). A bad link on blur: field error with warning icon “That isn't a Spotify artist link. It starts with open.spotify.com/artist/.”, aria-invalid=true (390 crop). Busy: aria-busy plus a spinner line “Loading your songs…”.", F26, "B-084 fixed at 8207373", DEV_F26),
 P("B29", "“Songs Spotify doesn't have” textarea", "Present", "Removed, as F25 asks: no textarea on the page; typing a song in is the row inside the song search (B20).", F25, dev=DEV_F25, b1440=False, b390=False),
 P("B30", "Time of day with the song inputs (F27)", "Held", "Held by DEV. As built: toggle group “Time of day”: Morning 9 am–12 pm · Lunch 12 pm–3 pm · Afternoon 3 pm–6 pm · Evening 6 pm–9 pm, 4 across at 1440 and 768, 2×2 at 390, still in When and where above Date. No “Any time” (correctly held); “Lunch” kept.", F27, dev=DEV_HELD),
 P("B31", "When and where", "Present", "fieldset “When and where”: City, Time of day (B30), Date · From · To, permit. No sideways scroll at 390/768/1440."),
 P("B32", "City picker", "Present", "Legend “City”, hex radio “Melbourne”, “Taste, foot traffic, busking rules, events and weather”, “LIVE DATA” badge. The city name is real data (allowed by F20).", F20),
 P("B33", "Cities and their data level", "Different", "Unchanged: performer-form.tsx passes one literal city to CityPicker and the request hard-codes city “melbourne”. The text shown is real data, so F20 itself is met.", F20, "B-085", deck=False, b1440=False, b390=False,
   spec="The city list, each city's note and its level (live → “Live data”, otherwise “Less data”) come from the app's city coverage. While null: no default city text (F20); the first city is selected."),
 P("B34", "Date", "Different", "Field-style button “SAT 17 OCT 2026”: uppercase, no comma, the calendar icon on the right (board: “Sun, 18 Oct 2026”, icon on the left).", defect="B-086"),
 P("B35", "Calendar open", "Different", "Unchanged: weeks start on Sunday (SU…SA; spec Mo–Su) and the dialog has no name (spec “Choose a date”). Past days disabled, selected day a filled hex.", defect="B-087", deck=False,
   spec="Dialog “Choose a date”: month and year, Previous/Next month buttons, Mo–Su, day buttons (selected filled, today marked, past disabled). Picking a day closes it."),
 P("B36", "From", "Different", "Select “From”, default 6 pm (plan again: 5 pm). Still offers all 24 hours 12 am … 11 pm (spec 6 am … 12 am).", "F14: one focus ring.", "B-088"),
 P("B37", "To", "Different", "Select “To”, default 9 pm, hint “Up to 6 hours” under it. Still offers 1 am … 12 am.", "F14: one focus ring.", "B-088; B-039 fixed at 8207373", DEV_527),
 P("B38", "Your busking permit", "Different", "Legend, three choice cards and hint as drawn; descriptions still differ from the board (“Pitches open to every permit. Keep the council's clearances from doors, crossings and seating.”, “Adds the premium-only pitches as well.”, “For a crowd that forms a circle. You take priority at circle-act pitches.”). Keyboard focus now rings the whole card (B50). Not hidden in plan again (B-092).", F1314, "B-089; B-092", DEV_CARD),
 P("B39", "Plan buttons", "Present", "Top border, primary lg “PLAN MY BUSK →”, outline lg “PLAN MY WEEK FROM THIS DATE” with calendar icon; full-width rows at 390. Focus: one 2px outline 2px outside each button: dark by day, orange at night with a ground-coloured gap, so it no longer merges with the orange fill (inv/v4/B39night-1440.jpg).", "F14: one focus ring each.", "B-134 fixed at f83f1a1", DEV_BTN),
 P("B40", "Form error: artists", "Present", "Empty submit: one role=alert Alert above the buttons, title “ARTISTS YOU SOUND LIKE”, “Add at least one artist you sound like.” The board's Spotify-id case can't be reached offline; the source's sentence matches the board. Icon is a circle, not the board's triangle."),
 P("B41", "Form error: songs", "Different", "Reached with a 200-character typed title. Body still “check “<title>” (Too big: expected string to have <=120 characters).”: lower-case start and the validator's raw text (board: “Check “Laneway Light” (the title is empty or too long).”). At 390 the unbroken test title runs past the alert's border.", defect="B-090"),
 P("B42", "Form error: date and times", "Different", "Body still repeats the field: “Check the date and times: the slot must end after it starts and last at most 6 hours.” From and To get aria-invalid.", defect="B-091"),
 P("B43", "Form error: act name", "Different", "Not reachable (maxLength 80); form-errors.ts would show the validator's raw text, not “Use 80 characters or fewer.”", defect="B-090", b1440=False, b390=False),
 P("B44", "Plan again: banner", "Different", "Unchanged: “Planning again for Soul and funk sax player. Your act, artists, songs and permit come from your earlier busk: pick a new date and time.” (no busk date); title “Plan your busk” and the new-act intro (board: “Plan your next busk”, “Same act, same songs…”). Examples hidden; date Mon 19 Oct, 5–8 pm. Act, artists, songs and permit groups not hidden.", defect="B-092"),
 P("B45", "Plan again: your act", "Missing", "No “Your act · from your last busk” summary; the prefilled form shows in its place (crop: act name and 4 typed artists).", defect="B-092"),
 P("B46", "Last busk (plan again)", "Different", "?again=<id> prefills name, 4 artists (typed), 6 songs, permit and hours from the stored plan; with no plan the new-act form shows. Nothing is hidden and the last busk's date isn't shown.", defect="B-092", deck=False, b1440=False, b390=False,
   spec="Act name, sound-alike artists, song count, permit, last hours and last busk date come from the performer's last busk. While null: the new-act form shows instead."),
 P("B47", "Artists rank the song search", "Present", "The picked artists' songs sort first with “BY YOUR ARTIST” (B19: Gillian Welch and Zzyzx Nobody first for “Fast Car”). The list stays closed until something is typed.", deck=False, b1440=False, b390=False,
   spec="The picked artists' names feed the song search, so their songs sort first with “By your artist”. Spotify results are live; while null the list is closed."),
 P("B48", "Picks total and artist count", "Present", "“N songs · m:ss” in the picks header and “N of 10” in the artists hint, both update on add and remove (checked 0 → 2 artists, 0 → 7 songs).", defect="B-037, B-038 fixed at 8207373", dev=DEV_527, deck=False, b1440=False, b390=False,
   spec="“N songs · m:ss” sums the known lengths of Your picks; “N of 10” counts the artist chips. Both update on every add and remove."),
 P("B49", "Log your takings line", "Present", "Retired with Tips, and gone: no “Played a busk already?” line, no “Log your takings” link, no /tips link anywhere on the page (1440 and 390).", TIPS, "B-093 moot (line removed)", "ef09b5c / f137b9a: Tips removed", b1440=False, b390=False),
 P("B50", "Field focus (F13, F14)", "Present", "Field strip at f83f1a1 (fields9): 68 of 68 /busks states pass (17 fields × day/night × 1440/390): one border and one 2px ring, no paper gap, no nested borders. Choice cards: keyboard focus is a 3px outline at 4px on the card (dark by day, orange at night), the radio draws none (crops: 1440 day, 390 night). Buttons: B39.", F1314, "B-134 fixed at f83f1a1; B-041 fixed at 8207373", DEV_CARD + "; " + DEV_BTN, deck=False,
   spec="Every input, select, search and button: one focus ring, shadcn's pattern (border turns --ring plus --focus-ring), no white gap, no nested borders. Radio choices ring the whole choice (focus-within)."),
 P("B51", "Field-level errors", "Different", "Each error shows under its field with a warning icon. Name and slot fields get aria-invalid/aria-describedby; the artists combobox still gets neither. The field line is the whole sentence (songs: “Songs you can play: check …”), not the alert title's words.", defect="B-094", deck=False,
   spec="Each field shows its own error under it (aria-invalid, aria-describedby) in the same words as the alert title's field."),
 P("B52", "Searching spinner", "Missing", "“Searching Spotify…” still shows with no Loader (only the field's search icon and the typed row's plus). The artist link's “Loading your songs…” does have one.", defect="B-095", deck=False,
   spec="The Loader beside “Searching Spotify…” spins (0.9 s linear). Reduced motion: still."),
 P("B53", "Reduced motion", "Present", "With prefers-reduced-motion: reduce, #name, the submit button and the date button now have transition-duration 0s (were 0.15s); choice cards are motion-reduce:transition-none. No movement on the page.", defect="B-096 fixed at f83f1a1", dev=DEV_RM, deck=False, b1440=False, b390=False,
   spec="No other motion on this page; with prefers-reduced-motion every transition (focus, hover, calendar) is instant."),
 P("B54", "Night theme", "Present", "Night background, cards and fields on the dark tokens, orange accent and selected-card offset; axe clean at 390 and 1440 (form, error, plan again)."),
 P("B55", "Phone header (≤720px)", "Present", "Below 721px the nav hides and only the lockup stays (hex mark + new lettering, 36px), as F12 asks.", F12, dev=DEV_F12, b1440=False),
 P("B56", "Phone layout (≤720px)", "Different", "Single column: cards stack, Time of day 2×2, Date/From/To stack, buttons full rows; no sideways scroll at 390 (crop: first 1800px of the filled page). In Your picks the “(own)” typed song shows only badges, pencil and x, no title (B24); the synthetic “Your song” rows cut titles to “Synthet…”.", defect="B-142 (worse)", b1440=False),
 P("B57", "Bottom nav (≤720px)", "Present", "Sticky bottom nav Busks · Week · Brain with icons, Busks current; no Tips. The board's “Setlist” is stale; Repertoire comes with the brandv1 merge.", TIPS, b1440=False),
]

# DS parity (user rule, same commit f83f1a1): each component judged against BRAND's DS specimen (qa/screens/honeycomb/ds/<Component>-*.jpg).
# id -> (new QA status or None to keep, text added to the note, text added to the defect)
DS = {
 "B02": (None, " DS PageHeader: matches (mono muted meta, display title, subtitle; no back link on this page).", ""),
 "B07": ("Different", " DS parity: differs from DS ExampleActCard: the DS card is a full-width row (orange hex initials on the left, name, blurb, “Sounds like …” in mono, an arrow at the right edge, cards stacked); the build is a tall card in a 3-column grid with a sans bold “Sounds like” label and a separate dark foot row. The user accepted the board difference (B-032); this is the DS mismatch, for the user to rule on.", "; B-163"),
 "B08": ("Different", " DS parity: DS ExampleActCard has no action text; the arrow sits at the right of the card row. The build adds a foot row “Watch Busk Map plan this act” with the arrow.", "; B-163"),
 "B11": (None, " DS ArtistPicker also puts the hint under the field.", " (DS ArtistPicker)"),
 "B12": ("Different", " DS parity: differs from DS ArtistPicker's chips: DS stacks one chip per row, the tag reads “TYPED” (no brackets) and a divider rule separates the name from the x; the build wraps chips side by side (2 a row at 1440), writes “(TYPED)” and has no divider.", "B-175"),
 "B13": (None, " DS ArtistPicker results: matches (hex image or initials, name, mono meta, active row tinted with an orange edge).", ""),
 "B14": (None, " DS ArtistPicker draws the typed row with a plus and the tinted active style.", " (DS ArtistPicker)"),
 "B15": (None, " DS ArtistPicker: “Searching Spotify…” with the hex Loader, and the error with a warning triangle: “Spotify search isn't answering. Type the name and press comma to add it anyway.”; the build has neither the Loader nor the icon.", "; DS ArtistPicker; B-095"),
 "B18": (None, " DS SongSearch field: matches.", ""),
 "B19": (None, " DS parity: DS SongSearch puts “By your artist” (users icon) inline at the right of the row before the length; the build puts it on its own line under the title, no icon.", "; B-182"),
 "B22": ("Different", " DS parity: differs from DS PickedSongs: the label sits on the left and the total “3 songs · 8:54” in mono on the right of one line; the build writes one mono run “YOUR PICKS · 7 SONGS · AT LEAST 21:50”.", "B-176"),
 "B23": (None, " DS PickedSongs Spotify row: matches.", ""),
 "B24": (None, " DS PickedSongs/Badge: the solid “Your song” badge carries a music icon (B-097).", ""),
 "B26": ("Different", " DS parity: differs from DS Input (Spotify link) and DS RepertoirePicker: both show the Spotify icon (circle with three arcs) at the left; the build shows a music note. DS RepertoirePicker is a whole block (link, “Add covers you can play”, a tick list, “Use these songs”); the build's repertoire-picker.tsx is only this link field, and the board's B17 doesn't use DS RepertoirePicker.", "B-174"),
 "B30": ("Held", " DS parity: differs from DS TimeSlotPicker: the selected slot is orange-filled in DS (dark by day, cream at night in the build); DS times are mono 24-hour ranges (“18–21”) and include Late 21–24 and a Day row; the build has 4 slots in 12-hour copy. Placement (F27) is still held by DEV.", "B-177"),
 "B32": ("Different", " DS parity: DS CityPicker's “Live data” badge has a bar-chart icon; the build's has a footprints icon. Card, hex radio and orange offset match.", "B-181"),
 "B34": (None, " DS DatePicker: “Sun, 18 Oct 2026”, calendar icon on the left.", " (DS DatePicker)"),
 "B35": (None, " DS DatePicker: Mo–Su, today boxed, selected a filled hex, uppercase display month title.", " (DS DatePicker)"),
 "B36": (None, " DS Select field: matches.", ""),
 "B38": (None, " DS parity: DS PermitPicker shows each permit's pitch count on the right (“24 pitches” in mono); the build shows none.", "; B-178"),
 "B39": (None, " DS Button primary/outline lg: matches (arrow and calendar are icons, not glyphs).", ""),
 "B40": ("Different", " DS parity: differs from DS Alert: the destructive alert uses a warning triangle; the build uses a circle icon.", "B-179"),
 "B41": (None, " Also the circle icon (DS Alert: triangle).", "; B-179"),
 "B42": (None, " Also the circle icon (DS Alert: triangle).", "; B-179"),
 "B44": (None, " DS parity: the build uses Banner tone “info” (a bordered peach box, plain sentence); DS Banner has no such tone: its banners are full-width strips with a bold lead phrase.", "; B-180"),
 "B51": (None, " DS FormMessage: matches (warning triangle, bold destructive text).", ""),
 "B52": (None, " DS Loader: the hex spinner beside the status line.", " (DS Loader)"),
}
for _p in PARTS:
    if _p["id"] in DS:
        _q, _n, _d = DS[_p["id"]]
        if _q:
            _p["qa"] = _q
        _p["note"] += _n
        if _d:
            _p["defect"] = _d if _p["defect"] in ("—", "") else (_p["defect"] + _d if _d.startswith((";", " ")) else _p["defect"] + "; " + _d)

NEW = [
 ("B-172", "Low", "B11", "The artists hint (“N of 10. Type a comma to add a name that isn’t on Spotify.”) sits between the label/chips and the search field; the board and DS ArtistPicker draw it under the field. Already so at 8207373 (missed in v3)."),
 ("B-173", "Low", "B14", "The artist search's “Add “<name>” as typed” item has no plus icon (spec and DS ArtistPicker: plus icon; the song search's typed row has one). Already so at 8207373."),
 ("B-163", "Medium", "B07, B08", "DS ExampleActCard: DS is a full-width row card (hex initials left, name, blurb, mono “Sounds like …”, arrow at the right edge, cards stacked); the build is a tall card in a 3-column grid with a sans “Sounds like” label and a dark foot row “Watch Busk Map plan this act →”. The user accepted the board difference (B-032); the DS mismatch needs the user's ruling."),
 ("B-174", "Low", "B26", "DS Input / RepertoirePicker: the Spotify artist link field shows the Spotify icon in DS; the build shows a music note."),
 ("B-175", "Low", "B12", "DS ArtistPicker chips: DS stacks one chip per row, tags “TYPED” without brackets and has a divider before the x; the build wraps chips side by side, writes “(TYPED)”, no divider."),
 ("B-176", "Low", "B22", "DS PickedSongs: label left and the mono total right on one line; the build runs “YOUR PICKS · N SONGS · m:ss” as one mono line."),
 ("B-177", "Medium", "B30", "DS TimeSlotPicker: the selected slot is orange in DS (dark by day, cream at night in the build); DS uses mono 24-hour ranges and a Late 21–24 slot plus a Day row; the build has 4 slots with 12-hour copy. Separate from F27's placement, which DEV holds."),
 ("B-178", "Low", "B38", "DS PermitPicker: each permit card shows its pitch count on the right (“24 pitches”); the build shows none."),
 ("B-179", "Low", "B40, B41, B42", "DS Alert: the destructive form alert uses a warning triangle; the build uses a circle icon."),
 ("B-180", "Low", "B44", "DS Banner: the plan-again banner uses a tone DS doesn't have (“info”: a bordered peach box, plain sentence); DS banners are full-width strips with a bold lead phrase."),
 ("B-181", "Low", "B32", "DS CityPicker: the “Live data” badge icon is a bar chart in DS, footprints in the build."),
 ("B-182", "Low", "B19", "DS SongSearch: “By your artist” sits inline at the right of the result row (with the users icon, B-144); the build puts it on its own line under the title."),
]

SECTIONS = [
 ("new-defects", "New defects at f83f1a1 (placeholders for MANAGER to number)",
  "<table><tr><th>Id</th><th>Severity</th><th>Rows</th><th>What differs</th></tr>"
  + "".join(f"<tr><td>{i}</td><td>{s}</td><td>{r}</td><td>{t}</td></tr>" for i, s, r, t in NEW) + "</table>"
  "<p>Also worse than v3: B-142 (B24, B56): with the edit pencil added in b39fd5f, an “(own)” typed song's title is 0px wide at 390, so the row shows no title or artist. Worth raising to Medium.</p>"),
 ("cited", "Cited defects at f83f1a1",
  "<table><tr><th>Defect</th><th>Rows</th><th>At f83f1a1</th></tr>"
  "<tr><td>B-080</td><td>B04</td><td>Open: intro 16/24, no max width</td></tr>"
  "<tr><td>B-081</td><td>B09</td><td>Open: form box-shadow none</td></tr>"
  "<tr><td>B-082</td><td>B15, B21</td><td>Open: “Type it in instead.” (repertoire-api.ts:22)</td></tr>"
  "<tr><td>B-085</td><td>B33</td><td>Open: one literal city in performer-form.tsx</td></tr>"
  "<tr><td>B-086</td><td>B34</td><td>Open: “SAT 17 OCT 2026”, icon right</td></tr>"
  "<tr><td>B-087</td><td>B35</td><td>Open: Sunday first, dialog unnamed</td></tr>"
  "<tr><td>B-088</td><td>B36, B37</td><td>Open: 24 hours offered</td></tr>"
  "<tr><td>B-089</td><td>B38</td><td>Open: permit descriptions</td></tr>"
  "<tr><td>B-090</td><td>B41, B43</td><td>Open: validator's raw text, lower case</td></tr>"
  "<tr><td>B-091</td><td>B42</td><td>Open: “Check the date and times: …”</td></tr>"
  "<tr><td>B-092</td><td>B17, B38, B44–B46</td><td>Open: plan again is the whole prefilled form</td></tr>"
  "<tr><td>B-093</td><td>B49</td><td>Moot: the line is removed with Tips</td></tr>"
  "<tr><td>B-094</td><td>B51</td><td>Open: artists combobox has no aria-invalid / aria-describedby</td></tr>"
  "<tr><td>B-095</td><td>B52</td><td>Open: no spinner</td></tr>"
  "<tr><td>B-096</td><td>B53</td><td>Fixed at f83f1a1: transitions 0s under reduced motion</td></tr>"
  "<tr><td>B-097</td><td>B24</td><td>Open: “Your song” badge has no music icon</td></tr>"
  "<tr><td>B-134</td><td>B39, B50</td><td>Fixed at f83f1a1: 2px outline 2px outside; at night orange on the dark ground with a gap</td></tr>"
  "<tr><td>B-142</td><td>B24, B56</td><td>Open and worse: “(own)” typed title 0px at 390</td></tr>"
  "<tr><td>B-143</td><td>B20, B21</td><td>Copy fixed at f83f1a1; still shown under results, while searching and on error</td></tr>"
  "<tr><td>B-144</td><td>B19</td><td>Open: no users icon on “By your artist”</td></tr>"
  "</table>"),
 ("ds-parity", "DS parity (user rule): components on /busks against BRAND's DS specimens",
  "<table><tr><th>DS component</th><th>Rows</th><th>Result</th></tr>"
  "<tr><td>PageHeader</td><td>B02–B04</td><td>Matches (meta, title, subtitle; B04 size is B-080)</td></tr>"
  "<tr><td>ExampleActCard</td><td>B07, B08</td><td>Different: row card with arrow in DS vs tall grid card with a foot action row (B-163)</td></tr>"
  "<tr><td>ArtistPicker</td><td>B11–B16</td><td>Different: hint above the field (B-172), chips wrap and “(TYPED)”, no divider (B-175), typed row no plus (B-173), error copy and icon, no Loader (B-082, B-095). Results match</td></tr>"
  "<tr><td>SongSearch</td><td>B18–B21</td><td>Field matches; “By your artist” under the title, no icon (B-182, B-144); error copy (B-082). The DS no-match line predates F25 (the B20 decision rules)</td></tr>"
  "<tr><td>PickedSongs</td><td>B22–B24</td><td>Different: header layout (B-176), “Your song” badge without icon (B-097), titles lost at 390 (B-142)</td></tr>"
  "<tr><td>RepertoirePicker</td><td>B26</td><td>Different: Spotify icon (B-174). DS RepertoirePicker's tick list and “Use these songs” are not on the busks board (B17 uses SongSearch + PickedSongs + the link)</td></tr>"
  "<tr><td>PerformerPicker</td><td>B10</td><td>Not on this page: the busks board uses an Act name Input for a new performer (B10); the build matches that. Nothing to compare</td></tr>"
  "<tr><td>CityPicker</td><td>B32</td><td>Different: Live data badge icon (B-181); card, hex radio, offset match</td></tr>"
  "<tr><td>DatePicker</td><td>B34, B35</td><td>Different: field text and icon side (B-086), Sunday first, no dialog name (B-087)</td></tr>"
  "<tr><td>Select</td><td>B36, B37</td><td>Field matches; hour range is B-088</td></tr>"
  "<tr><td>TimeSlotPicker</td><td>B30</td><td>Different: selected colour, time format, Late slot and Day row (B-177)</td></tr>"
  "<tr><td>PermitPicker</td><td>B38</td><td>Different: no pitch counts (B-178), descriptions (B-089)</td></tr>"
  "<tr><td>FormMessage</td><td>B28, B51</td><td>Matches (triangle, bold destructive)</td></tr>"
  "<tr><td>Alert</td><td>B40–B42</td><td>Different: circle icon, DS triangle (B-179)</td></tr>"
  "<tr><td>Banner</td><td>B44</td><td>Different: “info” tone not in DS (B-180)</td></tr>"
  "<tr><td>Button</td><td>B39</td><td>Matches (primary and outline lg, SVG icons, focus B-134 fixed)</td></tr>"
  "<tr><td>Input</td><td>B10, B11, B18, B26</td><td>Matches except the Spotify link icon (B-174)</td></tr>"
  "<tr><td>Chip</td><td>—</td><td>Not used on /busks (artist chips are ArtistPicker's own, above)</td></tr>"
  "<tr><td>Badge</td><td>B19, B24, B32</td><td>Different: “By your artist” and “Your song” lack their icons (B-144, B-097); Live data icon (B-181). “Typed” matches the neutral tone</td></tr>"
  "<tr><td>Loader</td><td>B52</td><td>Missing beside “Searching Spotify…” (B-095); present on “Loading your songs…”</td></tr>"
  "<tr><td>Glyph rule (B-162)</td><td>all</td><td>None on /busks: arrows, plus, check and x are SVG icons; “–” only in time ranges, “·” only in copy</td></tr>"
  "</table>"),
 ("field-strip", "Field strip (F13, F14): every field on /busks, unfocused | focused",
  '<p>Columns: day 1440, night 1440, day 390, night 390; each pair unfocused then focused. Rule: one border and one focus ring per field. '
  'Result at f83f1a1 (fields9): <b>68 of 68 /busks states pass</b> (17 fields × 4), the three choice-card radios measured on the card (BRAND\'s ruling: focus on '
  '.bm-choice:focus-within, 3px at 4px). Rows: B10, B11, B18, B39, B50.</p>'
  '<a href="../screens/honeycomb/busks/inv/v4/field-strip.jpg"><img src="../screens/honeycomb/busks/inv/v4/field-strip.jpg" alt="Busks field strip at f83f1a1"></a>'),
 ("critique", "Impeccable critique (design review)",
  "<ol>"
  "<li><b>P1 · Plan again still doesn't feel like planning again.</b> The banner says the act comes from the last busk, but the whole prefilled new-act form is there, the title is still “Plan your busk”, no busk date and no act summary (B44, B45, B46; B-092).</li>"
  "<li><b>P2 · On a phone, your own typed song loses its name.</b> The edit pencil plus “Your song” and “Typed” leave no room: the row shows two badges and two icons and nothing to say which song it is (B24, B56; B-142).</li>"
  "<li><b>P2 · The typed-song row shows up too often.</b> BRAND's words are in now, but “+ Add … as typed” still sits under real Spotify matches and while searching, when F25 wants it as the no-match fallback (B20, B21; B-143).</li>"
  "<li><b>P2 · Errors still speak code.</b> The songs error is the validator's raw text in lower case; the slot error repeats its title; search errors say “Type it in instead.” (B41, B42, B15, B21).</li>"
  "<li><b>P3 · Small finish.</b> The artists hint sits above the search instead of under it (B11), the artist typed item has no plus (B14), no spinner while searching (B52), no shadow on the form (B09).</li>"
  "</ol>"),
 ("audit", "Impeccable audit (technical)",
  "<table><tr><th>Check</th><th>Result</th></tr>"
  "<tr><td>axe (WCAG 2.0/2.1/2.2 A+AA tags) at 390 and 1440, day and night: empty form, error state, plan again</td><td>Clean (12 runs)</td></tr>"
  "<tr><td>Sideways scroll at 390, 768, 1440 (same three states, day and night)</td><td>None (18 runs)</td></tr>"
  "<tr><td>Heading outline</td><td>h1 Plan your busk › h2 Or try a made-up act; plan again: h1 only. The form uses fieldset/legend.</td></tr>"
  "<tr><td>Focus visible (2.4.7, 1.4.11)</td><td>Fields: one 2px border plus one 2px ring, 68/68 strip states pass. Choice cards: 3px outline at 4px on the card, day and night, 390 and 1440. Buttons: one 2px outline at 2px offset: day rgb(20,28,33), night rgb(255,106,43) on the rgb(24,32,37) form with a gap (B-134 fixed)</td></tr>"
  "<tr><td>Error association (3.3.1)</td><td>Name, slot and artist-link fields: aria-invalid + aria-describedby. Artists combobox: neither (B51, B-094)</td></tr>"
  "<tr><td>Live regions</td><td>One role=alert per error (no nested alert, no alert or live ancestor); search status lines role=status; artist link note aria-live=polite, busy via aria-busy</td></tr>"
  "<tr><td>Reduced motion</td><td>All measured transitions 0s; no movement (B53, B-096 fixed)</td></tr>"
  "<tr><td>Calendar</td><td>Dialog has no accessible name; weeks start Sunday (B35)</td></tr>"
  "<tr><td>Logo (F12 as corrected)</td><td>Header (1440 and 390) and footer: lockup image, new lettering, dark/light file by theme: pass (B01, B55)</td></tr>"
  "<tr><td>F20 city names</td><td>Main text has one “Melbourne”, the city picker's choice (real data). Eyebrow, intro, example cards, hints: none</td></tr>"
  "<tr><td>Tips retired</td><td>No Tips nav item (header, bottom nav, footer), no /tips link, no tip or takings copy on the form, error or plan-again page, day and night, 390/768/1440: pass</td></tr>"
  "</table>"),
 ("brand-issues", "BRAND's build issues for /busks",
  "<table><tr><th>Issue</th><th>Result</th><th>Evidence</th></tr>"
  "<tr><td>The Spotify link field doesn't grow (placeholder cut off)</td><td>Not reproduced</td><td>The field fills the row at 390, 768 and 1440 with a visible label and the music icon (B26 crops).</td></tr>"
  "<tr><td>The song-search label repeats the legend</td><td>Not reproduced</td><td>The search label is a visually hidden “Search songs on Spotify”; on screen only the legend shows (B18).</td></tr>"
  "<tr><td>The error alert sits inside a second role=\"alert\"</td><td>Not reproduced</td><td>After an empty submit there is one role=alert (the form Alert), no alert or live-region ancestor, none inside it.</td></tr>"
  "<tr><td>The nav says “Setlist”</td><td>Not reproduced</td><td>Header and bottom nav read Busks · Week · Brain (B01, B57).</td></tr>"
  "</table>"),
 ("v1", "Older images (kept)",
  '<p>v3 crops (8207373) stay under <code>qa/screens/honeycomb/busks/inv/v3/</code>, v2 crops (7b1521e) under <code>inv/build/</code>; v1 crops under <code>qa/screens/honeycomb/busks/</code>. Mapping of the v1 defects to BRAND ids: '
  'B-036 → B19 · B-037 → B17, B22, B48 · B-038 → B11, B16, B48 · B-039 → B37 · B-040 → B26 · B-041 → B38, B50 · B-042 → B19. All seven are fixed at 8207373.</p>'),
]

# Impeccable critique and audit: generated from the skill's own outputs in qa/impeccable/ (see impeccable_sections.py).
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from impeccable_sections import impeccable as _imp
from impeccable_synthesis import SYN as _SYN
_i = next(i for i, s in enumerate(SECTIONS) if s[0] == "critique")
SECTIONS = [s for s in SECTIONS if s[0] not in ("critique", "audit")]
SECTIONS[_i:_i] = _imp("busks", _SYN["busks"])

CHANGES = CHANGES + " The impeccable critique and audit were run for real this round (skill v4.4.0, dual-agent, at f83f1a1, 390/768/1440; provenance at the top of both sections), replacing v3's hand-written sections. New from impeccable, verified by QA: B-220 (form errors not tied to fields, focus left on submit), B-221 (no pending state), B-231."
READY = (READY[0], READY[1] + ' Impeccable adds B-220 and B-221.')
