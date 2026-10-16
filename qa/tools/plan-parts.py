# Plan · review: data for qa/tools/page-review.py. Provisional ids P01-P26 from the deck's Plan boards (ready + 10 states)
# until BRAND's inventory/plan lands; then re-key to BRAND's ids.
TITLE = "Plan · review"
ROUTE = "/p/<id> (from /plan?…)"
VERSION = "v1"
COMMIT = "7b1521e"
DATE = "17 Oct 2026"
IMG = "honeycomb/plan/"
CHANGES = "First version: 26 provisional parts from the deck's 11 Plan boards (ready, running, engine, replay, Qloo down, no match, no pitch, source down, slot passed, limit, not found), field strip, impeccable critique and audit; B-043..B-051."
HISTORY = [(VERSION, COMMIT, DATE, CHANGES)]
SOURCE_NOTE = "Deck: the Plan boards at 1440 (ready crops, state tops). Build: QA's own export, offline (mock Qloo, test model), so “Qloo test data” banners and synthetic place names appear that a live plan won't show; they are not judged."
def P(id, name, qa, note, user="", defect="—", deck=None, b1440=None, b390=None, dev="—"):
    return {"id": id, "name": name, "qa": qa, "note": note, "user": user, "defect": defect, "dev": dev, "deck": deck, "b1440": b1440, "b390": b390}
def R(id, name, qa, note, user="", defect="—"):  # a ready-plan section
    return P(id, name, qa, note, user, defect, f"deck/{id}.jpg", f"build/{id}-1440.jpg", f"build/{id}-390.jpg")
def S(id, name, qa, note, user="", defect="—", build=True):  # a state (whole page)
    return P(id, name, qa, note, user, defect, f"deck/{id}.jpg", f"build/{id}-1440.jpg" if build else None, f"build/{id}-390.jpg" if build else None)
PARTS = [
 R("P01", "Plan header: eyebrow, act, Copy link", "Different", "No act line under the title (board: “Folk duo, fiddle and guitar”); the eyebrow date is ISO (“SUNDAY 2026-10-18”, board “SUN 19 OCT”); extra buttons (Plan my week instead, Tip log) and status chips stack before the plan.", "F20: the city name stays only where the data is that city's."),
 R("P02", "Research funnel", "Different", "The plan page keeps the boxed funnel: labels under the hexes, dashes between stages, a paragraph under it (the landing's fixed variant isn't used here).", "", "B-051"),
 R("P03", "Agent vs engine", "Different", "Pitches as full-width rows (board: three compact chips in one line) and no “Kept after checking …” line.", "", "B-051"),
 R("P04", "Your busk: summary + pitch rows", "Different", "Rows with Full details as the board; adds a bulleted mock summary, a “Top pitches” label, the tip-history note and the legal line under the list.", ""),
 R("P05", "Plan map", "Different", "Live map with zoom, Browse other pitches and a legend reading “test data”; no hatched no-busking cells, event diamond or river; dark cells over street tiles.", "F16: no-busking areas as hatched honeycomb cells. Open question: do F02/F03/F05 (landing map) apply here too?"),
 R("P06", "Weather strip", "Different", "Only the slot's hours (3 cells); no hours either side, no “Your slot” bracket, no “Open-Meteo forecast, updated …” line.", "", "B-047"),
 R("P07", "Busk Map vs a plain AI", "Present", "Verdict, Only Busk Map, Only plain AI with badges, the plain AI's setlist; “Both agree” shows when the data has one."),
 R("P08", "How we found your pitches: header", "Present", "Checks · time, Finished tag and the Show raw data switch."),
 R("P09", "Research feed cards", "Present", "Newest first, plain words, one card per check (ready, setlist, compare, best so far, rules, foot traffic, crowd, map). The card set follows the run."),
 R("P10", "Data used", "Different", "A two-column grid of attribution links with licences and a status badge each (board: a list with a Live square per source). More informative than the board.", ""),
 P("P11", "Full details sheet", "Present", "Opens from Full details, traps focus, closes with Escape; score breakdown and why-this-crowd (no board; DEV e2e covers focus).", b1440="build/P11-1440.jpg", b390="build/P11-390.jpg"),
 P("P12", "Other pitch popover (map dots)", "Present", "Browse other pitches steps through the 25 dots with ‹ › and closes with Escape (no board).", b1440="build/P12-1440.jpg", b390="build/P12-390.jpg"),
 P("P13", "Raw data on", "Present", "Tool names and inputs show only behind the switch (DEV e2e).", b1440="build/P13-1440.jpg", b390="build/P13-390.jpg"),
 S("P14", "Running (live)", "Different", "Live tag, newest-first feed and the dashed choosing cell as the board; a skeleton column sits beside the feed and the header stack pushes the feed down."),
 S("P15", "From the data (engine fallback)", "Different", "Not reachable offline (no switch); judged from the source: the build says “The agent ran out of time, so this is the engine's plan…” (board: “Claude ran out of time, so these spots come straight from Busk Map's scores”).", "", "B-049", build=False),
 S("P16", "Replay", "Present", "“Replay of an earlier run (no new model call)” and the Replay tag; checks folded under “Every check, from earlier”."),
 S("P17", "Qloo down", "Different", "Only an alert (“Qloo is unavailable … try again in a few minutes”). The board's “No plan without taste data” panel, the source status and both Try again buttons are missing.", "Open question: Try again (board) vs HQ default 8 (no re-run button).", "B-043"),
 S("P18", "No artist matched", "Different", "Three stacked alerts; no “Pick your artists from Spotify” action; the fallback note says “agent” and “engine”.", "", "B-045, B-049"),
 S("P19", "No legal pitch", "Different", "An alert with a council link only; the board's panel with “Plan with a general permit” and “Try another day” is missing.", "", "B-044"),
 S("P20", "A source down (foot traffic)", "Different", "Only a “Foot traffic: unavailable” chip; no alert saying what it means (board: “The city's pedestrian sensors didn't answer … marked est.”).", "", "B-046"),
 S("P21", "Slot passed", "Present", "Dashed panel, struck date, “This slot has passed”, Plan again for a new date. No stored research here, so nothing renders under it."),
 S("P22", "Plan limit reached", "Present", "“Plan limit reached … 5 plans this hour … earlier plans” with a way home."),
 S("P23", "Plan not found", "Present", "“We can't find this busk” with Go to Busk Map home."),
 P("P24", "Phone layout (390)", "Different", "Stacks with no sideways scroll, but “Your busk” starts 871 px down: the header stack, test chips and funnel come first (impeccable P1).", "", "B-050", deck="deck/full-390-day.jpg", b390="build/full-390.jpg"),
 P("P25", "Night theme", "Present", "Night tokens throughout; axe clean.", deck="deck/full-1440-night.jpg", b1440="build/night-1440.jpg", b390="build/night-390.jpg"),
 P("P26", "Field focus and borders", "Broken", "13 of 18 fields fail (two ring layers when focused). See the strip below and the site-wide report.", "F13, F14, F15"),
]
SECTIONS = [
 ("field-strip", "Field strip (F13, F14): plan page", '<p>13 of 18 fields fail at 7b1521e (cause: the global :focus-visible double shadow, see Site-wide S09).</p><a href="../screens/honeycomb/plan/field-strip.jpg"><img src="../screens/honeycomb/plan/field-strip.jpg" alt="Plan field strip"></a>'),
 ("critique", "Impeccable critique (design review)", "<ol><li><b>P1 · The payoff is below the fold.</b> “Your busk” starts at 871 px on a phone and 987 px at 1440: eyebrow, title, chips, two buttons, status line, funnel and Agent vs engine come first (B-050). The board puts title, one data line and the map up top.</li><li><b>P1 · Dead ends.</b> Qloo down (P17) and no legal pitch (P19) leave no next step; the board gives Try again, a general-permit plan or another day (B-043, B-044).</li><li><b>P2 · Alert stacks.</b> No match (P18) shows three alerts in a row; the user can't tell which matters.</li><li><b>P2 · Jargon.</b> “agent”, “engine”, “test model” in user copy where the board says Claude and Busk Map's scores (B-049).</li><li><b>P2 · Weather is a sliver</b> (P06): three cells give no sense of before/after the slot (B-047).</li><li><b>P3 · Two map languages</b> on one page (P05's live map vs the feed's hex map), and the map's tiles fight the cells.</li></ol>"),
 ("audit", "Impeccable audit (technical)", "<table><tr><th>Check</th><th>Result</th></tr><tr><td>axe (WCAG 2.2 AA): ready plan at 390 and 1440, day and night; Qloo down, no match, no pitch, source down, slot passed, limit, not found at 390 and 1440</td><td>Clean</td></tr><tr><td>Sideways scroll at 390, 768, 1440</td><td>None</td></tr><tr><td>Heading outline</td><td>At 1440 the outline goes h1 → h3 (the h2 is hidden when wide; B-048); 390 is h1 → h2 → h3</td></tr><tr><td>Focus</td><td>Sheet traps focus and returns it; popover by keyboard; rings doubled (F14)</td></tr><tr><td>Reduced motion</td><td>Captures taken with motion reduced; no movement</td></tr></table>"),
 ("deck-boards", "Deck boards", '<a href="../screens/honeycomb/plan/deck/full-1440-day.jpg">ready 1440 day</a> · <a href="../screens/honeycomb/plan/deck/full-768-day.jpg">768</a> · <a href="../screens/honeycomb/plan/deck/full-390-day.jpg">390</a> · <a href="../screens/honeycomb/plan/deck/full-1440-night.jpg">1440 night</a> · build: <a href="../screens/honeycomb/plan/build/full-1440.jpg">1440</a> · <a href="../screens/honeycomb/plan/build/full-768.jpg">768</a> · <a href="../screens/honeycomb/plan/build/full-390.jpg">390</a>'),
]
