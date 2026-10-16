# Busks · review: data for qa/tools/page-review.py. Parts are provisional (B01-B20) from the deck's Busks board until BRAND's
# inventory/busks lands; then the ids follow BRAND's list.
TITLE = "Busks · review"
ROUTE = "/busks"
VERSION = "v1"
COMMIT = "7b1521e"
DATE = "17 Oct 2026"
IMG = "honeycomb/busks/"
CHANGES = "First version: 20 provisional parts from the deck's Busks board (BRAND's inventory not yet in), the user's calls F13, F14, F20, F25, F26, F27, field strip, site checks, impeccable critique and audit."
HISTORY = [(VERSION, COMMIT, DATE, CHANGES)]
SOURCE_NOTE = "Deck: the Busks board (1440 crops; full 390/768 boards and night are under Deck boards below). Build: QA's own export of the commit above, offline, filled with an act, an artist and two songs."
def P(id, name, qa, note, user="", defect="—", dev="—", deck=True, b390=True, b1440=True):
    return {"id": id, "name": name, "qa": qa, "note": note, "user": user, "defect": defect, "dev": dev,
            "deck": f"deck/{id}.jpg" if deck else None, "b1440": f"build/{id}-1440.jpg" if b1440 else None, "b390": f"build/{id}-390.jpg" if b390 else None}
PARTS = [
 P("B01", "Header", "Present", "Lockup, Busks active; Brain, not Setlist (HQ default 2).", "F12: the wordmark is the only logo (no lockup)."),
 P("B02", "Page header: eyebrow, title, intro", "Different", "Intro set smaller and on one long line at 1440 (the board: larger, two lines, ~70 characters).", "F20: no “Melbourne” in the eyebrow unless the data is for that city."),
 P("B03", "“Or try a made-up act” + 3 cards", "Different", "Same component as landing L13 (the user kept it as built): filled “SA” hexes, a blurb instead of day · hours and Plays, a dark action row."),
 P("B04", "Form card", "Present", "Poster card with the offset shadow, as the board."),
 P("B05", "Act name", "Present", "Label, input, placeholder as the board.", "F14: one focus ring."),
 P("B06", "Artists you sound like", "Different", "Chips and Spotify search present. The search is a box inside a box (two borders), and the hint “N of 10. Type a comma to add a name that isn't on Spotify.” is missing.", "F13: a normal input with only the search icon (InputGroup), one border, one ring.", "B-038"),
 P("B07", "Songs you can play: search", "Different", "Box inside a box (two borders); after a song is picked the results list stays open under the field until the query is cleared, pushing the form down. At 390 the “By your artist” badge and the time squeeze the song title to one letter (“F”).", "F13; F25: typing a song in becomes the no-match fallback inside this search, prefilled from the query.", "B-036, B-042"),
 P("B08", "Your picks", "Different", "Rows with remove buttons, but no “Your picks · 2 songs · 4:56” header with the count and total time.", "", "B-037"),
 P("B09", "Your Spotify artist link + Load my songs", "Different", "No visible label (sr-only) and “(optional)” in the placeholder; no music icon or helper line.", "F26: remove the button; load on Enter, or on blur when the field isn't empty.", "B-040"),
 P("B10", "Songs Spotify doesn't have (textarea)", "Different", "Label reads “Song list: type songs Spotify doesn't have”; the instructions sit in the placeholder.", "F25: remove the textarea (the fallback moves into the song search)."),
 P("B11", "City", "Present", "Melbourne choice card with Live data, as the board.", "F20: the city name is fine here (the data is for Melbourne)."),
 P("B12", "Date · From · To", "Different", "No “Up to 6 hours” hint under To; the date reads “SAT 17 OCT 2026” with the icon on the right (board: “Sun, 18 Oct 2026”, icon left).", "F14: one focus ring.", "B-039"),
 P("B13", "Time of day (Morning · Lunch · Afternoon · Evening)", "Not in deck", "Build only. Sets the time a second way beside From/To (impeccable critique: cognitive load).", "F27: shown with the song inputs; “Any time · Busk Map picks” waits for the plan-inputs approval.", deck=False),
 P("B14", "Your busking permit", "Present", "Three choice cards and the note. Descriptions reworded from the board (the build's copy states the rules)."),
 P("B15", "Plan my busk · Plan my week", "Present", "Both actions as the board.", "F14: one focus ring."),
 P("B16", "Log your takings line", "Present", "Adds “they stay in this browser”."),
 P("B17", "Error state", "Present", "A field error and a summary alert above the actions, as the board's error board (the build's message differs because the error differs).", b1440=True),
 P("B18", "Phone layout (390)", "Present", "Stacks; no sideways scroll at 390, day or night; axe clean.", deck=False, b1440=False),
 P("B19", "Night theme", "Present", "Paper sections switch to night; axe clean at 390 and 1440.", deck=False, b1440=False),
 P("B20", "Field focus and borders", "Broken", "Field strip below: all 19 fields fail. Every focused field shows two ring layers (a gap plus orange) over its border; the two searches show two borders unfocused; the radio cards' focus is a dark outline on a dark border, barely visible on the selected card.", "F13, F14, F15", "B-041", deck=False, b390=False, b1440=False),
]
# Fix image names for whole-page parts.
for p in PARTS:
    if p["id"] == "B17": p["b390"] = "build/B17-390.jpg"; p["deck"] = "deck/B17.jpg"
    if p["id"] == "B18": p["b390"] = "build/full-390.jpg"
    if p["id"] == "B19": p["b390"] = "build/full-390-night.jpg"; p["b1440"] = "build/full-1440-night.jpg"; p["deck"] = "deck/full-1440-night.jpg"
    if p["id"] == "B18": p["deck"] = "deck/full-390-day.jpg"
    if p["id"] == "B04": p["b1440"] = "build/B04-1440.jpg"
    if p["id"] == "B20": p["b1440"] = "build/card-f.png"; p["deck"] = None
SECTIONS = [
 ("field-strip", "Field strip (F13, F14): every input, select, picker and button, unfocused | focused", '<p>Columns: day 1440, night 1440, day 390, night 390; each pair unfocused then focused. Rule: exactly one border and one focus ring per field, never nested rectangles. Result at 7b1521e: <b>0 of 19 fields pass</b> (every focused field has 2 ring layers; the two Spotify searches are a box in a box). Tool: <code>qa/tools/field-strip.mjs</code>.</p><a href="../screens/honeycomb/busks/field-strip.jpg"><img src="../screens/honeycomb/busks/field-strip.jpg" alt="Busks field strip"></a>'),
 ("site", "Site checks on /busks (full results in the site-wide report)", "<ul><li>F09: the Qloo logo in the footer is not a link. Fail.</li><li>F10: the legal line is still in the footer; no /terms link (/terms is 404). Fail.</li><li>F12: the header and footer use the lockup, not the wordmark. Fail.</li><li>F07, F08, F11: footer not yet changed. Fail.</li></ul>"),
 ("critique", "Impeccable critique (design review)", "<ol><li><b>P1 · The time is asked twice.</b> Time-of-day chips (B13) and From/To selects (B12) set the same thing; the user has to reconcile them. F27 settles where it goes.</li><li><b>P1 · The search fields look broken.</b> A box inside a box (B06, B07) and a doubled focus ring read as a rendering bug, on the page's most-used inputs (F13, F14).</li><li><b>P2 · Results don't get out of the way.</b> After a pick the song results stay open (B-036), pushing the rest of the form down; the act loses its place.</li><li><b>P2 · The set has no shape.</b> Picks show no count or total time (B-037), though set length is the point of the page's sister feature on the plan.</li><li><b>P2 · Labels that disappear.</b> The Spotify link's label lives in the placeholder (B-040) and the textarea's instructions too: both vanish on typing. F25 and F26 remove most of it.</li><li><b>P3 · Long intro line at 1440</b> (B02) and the “Melbourne” eyebrow (F20).</li></ol>"),
 ("audit", "Impeccable audit (technical)", "<table><tr><th>Check</th><th>Result</th></tr><tr><td>axe (WCAG 2.2 AA) at 390 and 1440, day and night</td><td>Clean</td></tr><tr><td>Sideways scroll at 390, 768, 1440</td><td>None</td></tr><tr><td>impeccable detector on the /busks sources (page, landing form, forms, ui inputs)</td><td>No findings</td></tr><tr><td>Heading outline</td><td>h1 Plan your busk › h2 Or try a made-up act; the form uses fieldset/legend (fine)</td></tr><tr><td>Focus visible (2.4.7)</td><td>Present but doubled on every field (F14); radio cards barely visible when selected (B-041)</td></tr><tr><td>Target size (2.5.8)</td><td>Fine: the 20 px search inputs sit in 44 px groups; “Log your takings” is inline text</td></tr></table>"),
 ("deck-boards", "Deck boards (whole page)", '<p>Day 1440 · 768 · 390, and night 1440.</p><a href="../screens/honeycomb/busks/deck/full-1440-day.jpg">1440 day</a> · <a href="../screens/honeycomb/busks/deck/full-768-day.jpg">768 day</a> · <a href="../screens/honeycomb/busks/deck/full-390-day.jpg">390 day</a> · <a href="../screens/honeycomb/busks/deck/full-1440-night.jpg">1440 night</a> · build: <a href="../screens/honeycomb/busks/build/full-1440.jpg">1440</a> · <a href="../screens/honeycomb/busks/build/full-768.jpg">768</a> · <a href="../screens/honeycomb/busks/build/full-390.jpg">390</a>'),
]
