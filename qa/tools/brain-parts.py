# Brain · review: data for qa/tools/page-review.py. Provisional ids BR01-BR14 from the deck's Brain board (night; the page is
# night in both themes) until BRAND's inventory/brain lands.
TITLE = "Brain · review"
ROUTE = "/brain"
VERSION = "v1"
COMMIT = "7b1521e"
DATE = "17 Oct 2026"
IMG = "honeycomb/brain/"
CHANGES = "First version: 14 provisional parts from the deck's Brain board, trace state, field strip, impeccable critique and audit; B-052."
HISTORY = [(VERSION, COMMIT, DATE, CHANGES)]
SOURCE_NOTE = "Deck: the Brain board (night). Build: QA's own export. design/honeycomb predates dev/core's Repertoire R4 (12 kinds, 5 facts, Last.fm, “Suggested set”); those arrive with the merge and are checked on dev/core by brain.spec."
def P(id, name, qa, note, user="", defect="—", deck=True, b1440=True, b390=True):
    return {"id": id, "name": name, "qa": qa, "note": note, "user": user, "defect": defect, "dev": "—",
            "deck": f"deck/{id}.jpg" if deck is True else deck, "b1440": f"build/{id}-1440.jpg" if b1440 is True else b1440, "b390": f"build/{id}-390.jpg" if b390 is True else b390}
PARTS = [
 P("BR01", "Header: Powered by Qloo, title, intro", "Present", "As the board; the intro says “11 kinds” and “trace its path” (board: “eleven”, “light up”).", "F09: the Qloo logo links to qloo.com in a new tab."),
 P("BR02", "Facts strip", "Present", "11 · 24–33 · 0 · 9, as the board (dev/core R4 makes it five facts with 12 kinds and ≤ 25 per learn run)."),
 P("BR03", "Wiring: Qloo calls column", "Present", "11 kinds (with 5b) with endpoints; numbered hex cells."),
 P("BR04", "Wiring: data points column", "Present", "Same data points and sublines as the board."),
 P("BR05", "Wiring: your busk column", "Present", "Nine parts with sublines; spaced to line up with their wires as the board."),
 P("BR06", "Other sources (Spotify, Ticketmaster)", "Present", "Dashed wires, as the board."),
 P("BR07", "“The wiring” heading and legend", "Present", "Qloo · Spotify, Ticketmaster · the path you picked."),
 P("BR08", "Pick any piece panel", "Different", "One sentence with a single suggestion; the board's two “Try …” items with orange markers (Setlist and learn these; Taste heatmap) are gone.", "", "B-052"),
 P("BR09", "Three notes: numbers from data, the quota, next", "Present", "Same three cards; the quota copy is updated to the current pacing."),
 P("BR10", "Back to Busk Map", "Present", "Link as the board."),
 P("BR11", "Trace state (a piece picked)", "Present", "Picking “Setlist and learn these” lights its path and fills the panel (comes from 4 Qloo calls, 1 other source, 5 data points); the focused piece stays visible (B-015 fixed).", deck=False, b1440="build/BR11-1440.jpg", b390="build/BR11-390.jpg"),
 P("BR12", "Phone layout (390)", "Present", "Columns stack; no sideways scroll; axe clean.", deck="deck/full-390.jpg", b1440=False, b390="build/full-390-night.jpg"),
 P("BR13", "Both themes", "Present", "The page is night in day and night themes, as the board; axe clean in both.", deck="deck/full-1440.jpg", b1440="build/full-1440-day.jpg", b390="build/full-390-day.jpg"),
 P("BR14", "Field focus", "Broken", "All 38 pieces (buttons) fail at 390 and 1440, day and night: two ring layers when focused. See the strip below.", "F13, F14, F15", deck=False, b1440=False, b390=False),
]
SECTIONS = [
 ("field-strip", "Field strip (F14): /brain", '<p>Every piece is a button; each shows two ring layers when focused (cause: the global :focus-visible rule, Site-wide S09).</p><a href="../screens/honeycomb/brain/field-strip.jpg"><img src="../screens/honeycomb/brain/field-strip.jpg" alt="Brain field strip"></a>'),
 ("critique", "Impeccable critique", "<ol><li><b>P2 · The invitation got quieter.</b> The panel's two concrete “Try …” prompts became one run-on sentence (B-052); the page's best interaction is now easier to miss.</li><li><b>P3 · Tile borders are faint</b> (about 1.6:1 against the night ground, Assessment B): the 38 pieces read as one block until one is picked.</li><li>Otherwise the page is the board: strong hierarchy, one idea, a clear path from call to busk part.</li></ol>"),
 ("audit", "Impeccable audit", "<table><tr><th>Check</th><th>Result</th></tr><tr><td>axe at 390 and 1440, day and night</td><td>Clean</td></tr><tr><td>Sideways scroll</td><td>None</td></tr><tr><td>Heading outline</td><td>h1 › h2 › h3, no skips</td></tr><tr><td>Keyboard trace</td><td>Enter selects, Escape clears (QA brain.spec); the focused piece stays clear of the panel</td></tr><tr><td>Focus</td><td>Doubled ring on every piece (F14)</td></tr></table>"),
]
