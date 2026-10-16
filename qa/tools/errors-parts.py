# Errors · review: data for qa/tools/page-review.py. Provisional ids E01-E07 from the deck's NotFound, Error and GlobalError
# boards until BRAND's inventory lands. The plan's own not-found state is Plan · review P23.
TITLE = "Errors · review"
ROUTE = "404 (any unknown URL), error.tsx (a render error), global-error.tsx"
VERSION = "v1"
COMMIT = "7b1521e"
DATE = "17 Oct 2026"
IMG = "honeycomb/errors/"
CHANGES = "First version: 404, error and global error against the deck at 3 widths, day and night; field strip; B-053, B-054."
HISTORY = [(VERSION, COMMIT, DATE, CHANGES)]
SOURCE_NOTE = "Deck: the NotFound, Error and GlobalError boards (top of each). Build: QA's own export; the render error comes from faults=render (test only); global error can't be triggered offline and is judged from its source."
def P(id, name, qa, note, user="", defect="—", deck=None, b1440=None, b390=None):
    return {"id": id, "name": name, "qa": qa, "note": note, "user": user, "defect": defect, "dev": "—", "deck": deck, "b1440": b1440, "b390": b390}
PARTS = [
 P("E01", "404: not-found card", "Different", "Status 404, “No pitch here”, Go to Busk Map home (to /) and Try an example plan. Unlike the board: no large orange “404” above the card, the card's content is left-aligned and it has no poster shadow.", "", "B-053", "deck/E01-1440-day.jpg", "build/E01-1440-day.jpg", "build/E01-390-day.jpg"),
 P("E02", "Error card (error.tsx)", "Different", "“Something went wrong”, Try again, Go home, a reference and no stack. Unlike the board: an “!” icon (board: warning triangle), left-aligned, the reference above the buttons (board: under a rule at the foot), no poster shadow, no icon on Try again.", "", "B-054", "deck/E02-1440-day.jpg", "build/E02-1440-day.jpg", "build/E02-390-day.jpg"),
 P("E03", "Global error (global-error.tsx)", "Present", "Judged from the source: its own document, the same error card with plain links, the system font stack because the brand fonts come from the layout it replaces; matches the board's headerless, centred card (the card itself carries E02's differences).", "", "—", "deck/E03-1440-day.jpg"),
 P("E04", "Plan not found (/p/<unknown>)", "Present", "See Plan · review P23: “We can't find this busk”, Go to Busk Map home."),
 P("E05", "Phone layout (390)", "Present", "Cards fill the width, buttons stack; no sideways scroll; axe clean.", "", "—", "deck/E01-390-day.jpg", None, "build/E02-390-day.jpg"),
 P("E06", "Night theme", "Present", "Both pages switch to night tokens; axe clean.", "", "—", "deck/E01-1440-night.jpg", "build/E01-1440-night.jpg", "build/E02-390-night.jpg"),
 P("E07", "Field focus", "Broken", "Both buttons on the 404 fail: two ring layers when focused (Site-wide S09).", "F14"),
]
SECTIONS = [
 ("field-strip", "Field strip (F14): 404", '<a href="../screens/honeycomb/errors/field-strip.jpg"><img src="../screens/honeycomb/errors/field-strip.jpg" alt="404 field strip"></a>'),
 ("critique", "Impeccable critique", "<ol><li><b>P3 · Recognisability.</b> The board's big “404” told people at a glance where they were; the build leans on the title alone (B-053).</li><li><b>P3 · The reference competes with the actions</b> on the error card (B-054): the board keeps it as a footnote under a rule.</li><li>Both pages always offer a way home and no stack trace: good.</li></ol>"),
 ("audit", "Impeccable audit", "<table><tr><th>Check</th><th>Result</th></tr><tr><td>axe at 390 and 1440, day and night (404 and error)</td><td>Clean</td></tr><tr><td>HTTP status</td><td>404 for an unknown URL; the render error page is served with 200 (an error boundary after streaming starts), worth knowing for monitoring</td></tr><tr><td>Sideways scroll</td><td>None</td></tr><tr><td>Home links</td><td>Both go to /</td></tr></table>"),
]
