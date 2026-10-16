# Plan · review: data for qa/tools/page-review.py. v2 re-keys v1's 26 provisional parts (P01-P26) to BRAND's inventory/plan
# (106 parts: B body, R researching, Y replay, S slot passed, E engine fallback, N no legal pitch, M no match, Q Qloo down,
# D source down, L run limit, X not found). Run from the worktree root.
import os
TITLE = "Plan · review"
ROUTE = "/p/<id> (from /plan?…)"
VERSION = "v2"
COMMIT = "7b1521e"
DATE = "17 Oct 2026"
IMG = "honeycomb/plan/inv/"
CHANGES = ("Re-keyed to BRAND's 106-part plan inventory (was 26 provisional parts); every part judged at 1440 and 390 (768 checked) against its crop or spec "
           "and the user's calls (F02, F03, F05 on every map; F09/F18, F12 as corrected, F13-F15, F16, F20; Qloo down = “No plan without taste data” + Try again, not counted). "
           "Known B-043..B-051 cited on their rows; B-098..B-113 placeholders for QA to file; BRAND's six build issues checked.")
HISTORY = [
    (VERSION, COMMIT, DATE, CHANGES),
    ("v1", COMMIT, DATE, "First version: 26 provisional parts from the deck's 11 Plan boards (ready, running, engine, replay, Qloo down, no match, no pitch, source down, slot passed, limit, not found), field strip, impeccable critique and audit; B-043..B-051."),
]
SOURCE_NOTE = ("Deck: BRAND's inventory crops (1440 boards; click-only parts cropped after the click). Build: QA's own export of the commit above, offline "
               "(mock Qloo, test model), so “Qloo test data” chips, “test model” labels and synthetic place names appear that a live plan won't show; they are not judged. "
               "States that can't be reached offline (Claude ran out of time, a run that changes the engine's pick, events on the map) are judged from the source and say so. "
               "State rows show the top of the viewport.")
_D = "qa/screens/" + IMG
def _f(p): return p if os.path.exists(_D + p) else None
def P(id, name, qa, note, user="", defect="—", dev="—", spec=None):
    d = {"id": id, "name": name, "qa": qa, "note": note, "user": user, "defect": defect, "dev": dev,
         "deck": _f(f"deck/{id}.jpg"), "b1440": _f(f"build/{id}-1440.jpg"), "b390": _f(f"build/{id}-390.jpg")}
    if spec: d["spec"] = spec; d["deck_empty"] = "Spec only (no crop)"
    return d
F05 = "F05: on every plan map only the orange taste cells draw (no pale or dark cells, ground shows through), zoomed out a little; both themes."
F0203 = "F02/F03 (every map, the plan's too): keep “Full details →” per pitch row and the zoom buttons; the legend is one line along the bottom of the map with tooltips, never “test data”."
F20 = "F20: no city in the eyebrow or framing copy (“Sun 19 Oct · 12–3 pm · General permit”)."
F0918 = "F09/F18: wherever Qloo is named as a source, show Qloo's logo linked to qloo.com (new tab, rel=noopener noreferrer)."
F12 = "F12 (corrected 17 Oct): the one logo is the lockup [hex mark][new wordmark] in header and footer; F12 retired only the old wordmark lettering. Wordmark-only or mark-only fails."
F1315 = "F13-F15: one focus ring, shadcn's pattern, on every focusable part; no white gap plus dark ring."
QCALL = "User: when Qloo is down the plan shows “No plan without taste data” with Try again, and that run doesn't count against the limit."
PARTS = [
 # ---- B: plan body (Done)
 P("B01", "App header", "Different", "Lockup shape is right (hex mark + wordmark) but the word is the old lettering (the M rises above the other letters). Nav Busks · Week · Brain · Tips with Busks active (aria-current); no Repertoire item (no such route in this build). At 390 the nav moves to the bottom bar.", F12, dev="a68440d switched to wordmark-only, which also fails F12 (not rechecked here)"),
 P("B02", "Page header", "Different", "Eyebrow, H1 and Copy link as the board, but three status chips (Qloo test data, Foot traffic, Explanations), “Plan my week instead” and “Tip log” stack under the H1, then the agent status line; no act line.", "", "B-050, B-099"),
 P("B03", "Eyebrow", "Different", "Reads “MELBOURNE · SUNDAY 2026-10-18, 12 PM–3 PM · GENERAL PERMIT”: city still in, ISO date (board “Sun 19 Oct · 12–3 pm”).", F20, "B-098"),
 P("B04", "Act name and line", "Different", "H1 “Folk duo” in the display face; no act line under it (board: “Folk duo, fiddle and guitar”).", "", "B-099"),
 P("B05", "Copy link", "Present", "Outline small button “Copy link” (link icon, board copy icon), right of the H1 at 1440, under it at 390."),
 P("B06", "Copy link: copied", "Present", "After the click: check icon and “LINK COPIED”. The clipboard-blocked fallback was not forced."),
 P("B07", "Research funnel", "Different", "Boxed funnel with labels under the hexes, dashes between stages and a “How this plan was found…” paragraph; adds a “Qloo calls” stage. Board: one line of cells with arrows, “496 data points” bold and the orange “3 pitches”.", "", "B-051"),
 P("B08", "Agent vs engine: kept", "Different", "“The test model checked Busk Map's top 3 and kept them” with three full-width rows (board: three compact tiles in one line) and no “Kept after checking …” line.", "", "B-051"),
 P("B09", "Agent vs engine: changed", "Present", "Not reachable offline (the test model keeps the engine's picks). Source (agent-vs-engine.tsx) renders “added by <model>” over “Busk Map's no. N” per change.", ""),
 P("B10", "Your busk (PlanMap)", "Different", "Pitch list left (440 px) beside the map at 1440, map above the list at 390, as the board; the map itself breaks F05 (full taste field) and the panel adds the legal line, tip-history note and Log your takings under the rows.", F0203 + " " + F05),
 P("B11", "Busk title and summary", "Different", "“Your busk” then the summary (offline: a mock line and two bullets); no “Sun 19 Oct · 12–3 pm · General permit” line under the title.", "", "B-100"),
 P("B12", "Pitch rows", "Different", "Three ranked rows with rank tile, name, “@ 12 pm–3 pm”, score ring, badges and “Full details →” on every row (F02 kept). The selected row is marked by a heavy border only: no white card with the orange offset shadow, no filled score cell.", F0203, "B-101"),
 P("B13", "Taste map", "Different", "Live MapLibre map with every taste cell drawn, pale to dark brown, over street tiles; no river, no hatched cells, no event diamonds.", F05),
 P("B14", "Pitch pins", "Different", "Top-3 pins are buttons (aria-pressed, “Pitch 1: … score 60, usual pitch”) with rank badges; 25 grey hex dots for the others. No caption with the selected pitch's name, and pitch 2/3 are the same size as pitch 1.", "", "B-102"),
 P("B15", "No-busking zone", "Missing", "No hatched cells: plan-map.tsx says “No events or no-busking zones are drawn: the plan carries no coordinates for them.”", "F16: no-busking zones are hatched honeycomb cells, never a rectangle."),
 P("B16", "Other pitches note", "Present", "“25 more pitches scored. They're the small markers on the map: pick one for its summary. The top 3 are kept 250 m apart.” (no pin icon)."),
 P("B17", "Full details link", "Present", "“Full details →” on every row; opens the sheet.", F0203),
 P("B18", "Row and pin selected", "Different", "Picking row 2 moves the heavy border and aria-pressed to pitch 2's pin; no white card or orange shadow, no pin caption.", "", "B-101, B-102"),
 P("B19", "Map legend", "Different", "Floating boxed key bottom-left: “Taste map (Qloo heatmap, test data)”, low-high ramp, Top pitch · Hidden gem · Other scored pitch.", F0203),
 P("B20", "Zoom buttons", "Present", "+ / − (Zoom in, Zoom out) top-right of the plan map at 1440 and 390.", F0203, spec="Not drawn on the plan boards; F02 keeps the map's zoom buttons (+ / −) on the plan map."),
 P("B21", "Weather strip", "Different", "“Dry through your slot” and the key; only the slot's 3 hours (board 10:00-16:00), no “Weather” caption, no Open-Meteo updated line. At 390 the cells wrap 2+1 and nothing is cut off.", "", "B-047"),
 P("B22", "Your slot frame", "Different", "Each cell carries its own orange “Your slot” tag; no single frame around the slot with “Your slot 12-15”. Aria-labels say “, in your slot”.", "", "B-047"),
 P("B23", "No forecast", "Present", "Dashed box: “No forecast for this slot, so weather was ignored.” “Weather is left out of the score.” (faults=weather).", spec="When Open-Meteo has no forecast: dashed cloud cell, “No forecast for this slot”, “Weather is left out of the score.”"),
 P("B24", "Busk Map vs a plain AI", "Present", "Title and the control line (“…sent to the test model (offline) with no tools and no data…never changes a score.”)."),
 P("B25", "Compare verdict", "Present", "Bold verdict naming Melbourne's usual pitches (city allowed here: it is that city's data)."),
 P("B26", "Both agree", "Present", "“Both agree (1)”: Federation Square 74 with the Both agree badge and “the plain AI named …” (acoustic run)."),
 P("B27", "Only Busk Map", "Present", "Score cell, name, Hidden gem badge and orange-bullet evidence lines per pick."),
 P("B28", "Only plain AI", "Present", "“Only plain AI (unverified, no data)”: Not a legal pitch / Scored by Busk Map and Usual pitch badges with the reason lines."),
 P("B29", "Plain AI setlist", "Present", "“Plain AI setlist: Wonderwall, Hallelujah, Riptide, Shallow”."),
 P("B30", "Compare loading and unavailable", "Present", "In source (compare-panel.tsx): skeletons while loading and “The plain-AI baseline is unavailable…” when it fails; not forced offline.", spec="Loading “Asking a plain AI the same question…” with skeletons; unavailable “The plain-AI baseline is unavailable right now. Busk Map's plan doesn't depend on it.”"),
 P("B31", "How we found your pitches", "Present", "Title, “8 checks · 0 s”, Finished, Show raw data, cards newest first, Data used at the foot."),
 P("B32", "Feed meta", "Present", "Mono checks · time, outlined Finished tag, Raw data switch."),
 P("B33", "Card: Your busk is ready", "Present", "Check cell, title and “Three pitches, a setlist for each and the reasons, above.”"),
 P("B34", "Card: Songs worth learning", "Present", "Not called by the offline test model; the card exists in source (tool-results.tsx “Songs worth learning”). Its Learn it menu is checked in B35."),
 P("B35", "Learn it menu open", "Present", "From the sheet's Learn these: song and artist, Karaoke (YouTube), Chords (Ultimate Guitar), Lyrics (Genius) each “(opens in a new tab)”, and “Busk Map never shows lyrics or chords.”"),
 P("B36", "Card: compare two crowds", "Present", "“<pitch> or <pitch>?” with the model's line and both pitches' genre affinity cells (a missing one dashed)."),
 P("B37", "Card: setlist", "Present", "“Your setlist at …” with songs, years, affinity cells and fit scores."),
 P("B38", "Card: new pitches scored", "Present", "Not called offline (the model adds no pitches); source titles the card “New pitches scored” when it adds some."),
 P("B39", "Card: sent back", "Present", "“Sent back to check more”, “Busk Map asked the model to look closer before answering. It keeps going.” (no-pitch run)."),
 P("B40", "Card: the rules", "Present", "“The rules at Federation Square”, “Not ruled out for your permit”, the clearance line and the never-confirms line."),
 P("B41", "Card: busy places", "Present", "Not called by the offline test model; source has “Busy places near …”."),
 P("B42", "Card: foot traffic", "Present", "“Foot traffic at Lincoln Square”, “≈144 people an hour est.”, nearest sensor line."),
 P("B43", "Card: events", "Present", "Not called offline (no events in the mock); source has “Events near …”."),
 P("B44", "Card: the crowd", "Present", "“The crowd at …” with the model's line, Artists this crowd likes, Sounds of this crowd and Evidence."),
 P("B45", "Card: where your crowd gathers", "Different", "Model's line, a list of three places with scores and the Evidence line; no framed mini taste map.", F05, "B-103"),
 P("B46", "Card: best pitches so far", "Present", "The engine's first top 3 as pitch rows and the Evidence line."),
 P("B47", "Claude's line on a card", "Present", "Mono model tag (“TEST MODEL” offline) then its words under the title."),
 P("B48", "Evidence tag", "Present", "Outlined “EVIDENCE” tag then the source in plain words."),
 P("B49", "Data used", "Different", "“Data used · Where every number on this page comes from.”: a two-column grid of linked sources with licences and a status each; Qloo is a text link, no logo.", F0918),
 P("B50", "Raw data on", "Present", "Switch on: Table / JSON toggle and a Raw block (tool, inputs, output table) under each card."),
 P("B51", "Scores and rings", "Present", "Hex cells with rings filled to the score (“Score 60 out of 100”); missing values dashed with “–” (“no data”)."),
 P("B52", "Live plan data and nulls", "Present", "Nulls seen: no crowd panel and no taste cells on no-match; weather box on a weather outage; others note hidden at 0 in source.", spec="Summary, pitches, others, heat, events, zones, weather, crowd, ageLean, event.tasteMatch, learn [] and compare verdict each read from the plan, with the stated null states."),
 P("B53", "Copy link URL", "Present", "The clipboard gets the short link http://…/p/<9-char id> of the stored busk."),
 P("B54", "Pitch details sheet", "Different", "Sheet from the right, 512 px wide (board 720) over a dimmed page; title, “Pitch 1 · Sunday 2026-10-18, 12 pm–3 pm”, Close. At 390 it fills the screen from the top: no bottom rise, no grab handle.", "", "B-104"),
 P("B55", "Sheet: pitch head", "Different", "Rank tile, “Pitch 1”, name, badges and the 60 ring; no area line in mono caps; badges add “Footpath, general permit” and “Explained by …”.", "", "B-105"),
 P("B56", "Sheet: why this crowd", "Different", "Prose (“Mock explanation…”, “Found from the data…”, “Usual pitch…”) instead of the chips and the origin note.", "", "B-105"),
 P("B57", "Sheet: foot traffic by hour", "Missing", "No 24-hour sparkline; a Score breakdown (six weighted factors) sits in its place.", "", "B-105"),
 P("B58", "Sheet: facts", "Different", "Evidence (people an hour, Estimate, busy places with Qloo lines) and Rules to check as plain lists; no event, weather or council-rules link rows.", "", "B-105"),
 P("B59", "Sheet: setlist", "Different", "“Setlist for …”, a long method paragraph, six songs with fit rings and the set-length line; no Copy button, no age-lean line on its own.", "", "B-105"),
 P("B60", "Sheet: learn these", "Present", "Orange-topped “Learn these” with the ranking line, three songs and Learn it."),
 P("B61", "Sheet: crowd panel", "Different", "“Who this crowd likes” with What Qloo matched on, Artists this crowd likes, Your fans vs the usual crowd and Evidence lines; no “Qloo: Live” status and no Qloo logo.", F0918),
 P("B62", "Sheet: who your fans are", "Different", "Eight lean bars (24 and under … Female) with values; the bars are scaled so +11 draws a 3-6 px stub and each row reads as a bare tick.", "", "B-106"),
 P("B63", "Other pitch popover", "Present", "Browse other pitches opens “Piazza Italia 58 Hidden gem”, “Too close to … within 250 m …”, with ‹ › stepping (1 of 25) and close."),
 P("B64", "Event popover", "Missing", "No event diamonds on the plan map, so no event popover (plan-map.tsx draws no events).", "", "B-113"),
 P("B65", "Sheet slides in", "Present", "Slides in from the right with a fade (tw-animate, 200 ms). Phone rise and reduced motion: see B-104, B-107.", "", "B-104, B-107"),
 P("B66", "Tablet 768: busk first, research folded", "Present", "At 768: “Found from 768 data points · See the research ↓” under the header, the busk first with the map above the list, the research below. (The 1440 column shows 768.)"),
 P("B67", "Phone ≤720: layout", "Different", "Bottom nav visible and fixed (Busks active), H1 40 px, eyebrow wraps, map above the rows; but “Your busk” starts 871 px down under the chips, buttons and test-data notes.", "", "B-050"),
 P("B68", "Phone: The research", "Present", "“The research” h2, the funnel, Agent vs engine, then the feed with “Each check the model ran for the busk above, and what it found.” and “Every check (8)” folded."),
 P("B69", "Night theme", "Different", "Night tokens throughout, axe clean; the map still draws the full taste field over dark tiles.", F05),
 P("B70", "Focus ring", "Different", "Pitch row and Copy link show two rings (2 px cream gap + 4 px dark, box-shadow).", F1315, spec="Every interactive part shows the focus ring on :focus-visible; one ring, shadcn's pattern."),
 P("B71", "Reduced motion", "Different", "Loaders use motion-safe and the skeleton/fold animations are guarded, but there is no global 0 ms rule: the sheet's slide and fade still run under reduce.", "", "B-107", spec="prefers-reduced-motion: every animation and transition at 0 ms."),
 # ---- R: researching
 P("R01", "Researching line", "Different", "Under the H1: “The agent is researching with Qloo and the other sources. The plan appears when it finishes.” (board: act line + “Your busk replaces the research here in about half a minute.”); Copy link already shows.", "", "B-108"),
 P("R02", "Funnel while live", "Present", "Counts fill in; dashed “choosing pitches” cell last."),
 P("R03", "Finding your best pitches", "Present", "“Finding your best pitches”, “8 checks”, orange Live tag, no Raw data switch."),
 P("R04", "Running card", "Present", "Running card on top, dashed, ring loader, model line and two skeleton lines (“Putting your busk together…”)."),
 P("R05", "Loaders", "Present", "Ring loader (motion-safe:animate-spin), skeletons; still under reduced motion."),
 P("R06", "Thinking card", "Present", "In source (agent-steps.tsx): dashed cell, breathing loader, “Thinking about what to check next” / “Reading your act, day and permit”; not held offline.", spec="Between tools: dashed cell, breathing loader, “Thinking about what to check next…”; before the first tool “Reading your act, day and permit”."),
 P("R07", "Leave note", "Present", "“You can leave this page: the research keeps going and your busk will be here when you're back.” under the cards."),
 P("R08", "Cards as they land", "Different", "Finished cards stack under the running one, newest first; the crowd-gathers card has no map.", F05, "B-103"),
 P("R09", "Data used so far", "Missing", "No Data used section while the run is live (agent-stream only).", "", "B-109"),
 P("R10", "Phone researching", "Different", "Bottom nav shows (Busks active), eyebrow wraps; the feed starts below the chips, buttons and test-data notes.", "", "B-050"),
 # ---- Y: replay
 P("Y01", "Shared busk eyebrow", "Different", "Same eyebrow as a fresh plan (“MELBOURNE · SUNDAY 2026-10-18…”): no “Shared busk” prefix, city still in.", F20, "B-098"),
 P("Y02", "Replay tags", "Present", "Chips “Explanations: test model (offline)” and “Replay of an earlier run (no new model call)”."),
 P("Y03", "Replay line", "Different", "“The agent's plan, replayed. 7 model steps · 700 input and 350 output tokens” (board: “Researched at 1:12 pm today. Opening it again shows that research: nothing new was asked.”).", "", "B-108"),
 P("Y04", "Replay feed", "Present", "Replay tag, “Replaying the agent's run from … (cached, no new model call)”, cards folded in “Every check, from earlier (8)”."),
 # ---- S: slot passed
 P("S01", "Slot passed notice", "Present", "Only the nothing-stored case is reachable offline; its notice (dashed clock cell, struck slot, “This slot has passed”, Plan again for a new date) is the same component."),
 P("S02", "Slot passed, nothing stored", "Present", "Notice alone: “There's no stored research for this busk. Plan again with the same act for a new date.”; no busk, no feed (struck date in ISO form, B-098)."),
 # ---- E: engine fallback (source)
 P("E01", "Ran out of time banner", "Different", "Not reachable offline. Source (agent.ts): “The agent ran out of time, so this is the engine's plan with reasons generated from the data.” (board: “Claude ran out of time, so these spots come straight from Busk Map's scores…”).", "", "B-049"),
 P("E02", "Engine summary", "Present", "From source: the engine's template summary and no Agent vs engine. No “Found by Claude” badge exists anywhere in src, so it can't show on the fallback."),
 P("E03", "Stopped cards and fallback note", "Different", "“Stopped before it finished.” exists (agent-steps.tsx); the closing note uses the agent/engine copy above.", "", "B-049"),
 # ---- N: no legal pitch
 P("N01", "No-pitch header", "Different", "Eyebrow with city and ISO date; H1 “Soul and funk sax player”; funnel ends in a dashed “choosing pitches”.", F20, "B-098"),
 P("N02", "No legal pitch", "Different", "Alert “No pitch to recommend … Read the council's busking rules.”; no empty-state card, no “Plan with a general permit” or “Try another day”.", "", "B-044"),
 P("N03", "No-pitch feed", "Different", "13 checks: eight “Sent back to check more” cards in a row, then best so far, rules, foot traffic, crowd, map (board: 2 checks).", "", "B-110"),
 # ---- M: no match
 P("M01", "No-match header", "Different", "Eyebrow with city; no “Sounds like … (typed)” line; no “Pick your artists from Spotify” action.", F20, "B-045"),
 P("M02", "Claude didn't research", "Different", "“Shown: the engine's plan · The agent couldn't add the test model's explanations…” stacked with two other alerts.", "", "B-045, B-049"),
 P("M03", "Qloo couldn't match", "Present", "“Qloo couldn't match Zzyzx Nobody and Qqq Unknown … taste is left out …”."),
 P("M04", "Busk without taste", "Different", "No taste cells drawn (pins, dots and tiles only), as the spec asks; but the legend still shows the “Taste map (Qloo heatmap, test data)” low-high ramp.", F0203, "B-112"),
 # ---- Q: Qloo down
 P("Q01", "Qloo down layout", "Different", "Only the header, chips, test-data notes and one alert; no funnel, no feed, no side-by-side error.", QCALL, "B-043"),
 P("Q02", "Feed stopped", "Different", "No stopped feed and no Try again: the alert reads “Qloo is unavailable · Busk Map needs Qloo's taste data to plan. Please try again in a few minutes.”", QCALL, "B-043"),
 P("Q03", "No plan without taste data", "Missing", "No “No plan without taste data” panel, no “Qloo: Unavailable” status, no Try again.", QCALL, "B-043"),
 # ---- D: source down
 P("D01", "Sensors didn't answer", "Different", "A dashed list with raw ids: “melbourne-pedestrian: Unavailable: simulated outage (test) · Foot traffic is estimated from busy places and events, and marked est.” plus ticketmaster and open-meteo; no warning alert titled “The city's pedestrian sensors didn't answer”.", "", "B-046"),
 P("D02", "Failed check card", "Present", "Offline the foot-traffic tool absorbs the outage (“No sensor count near here · estimated from busy places and events”); the error card “This check didn't come back…” is in source."),
 P("D03", "Source unavailable", "Present", "Data used: Pedestrian counts, Ticketmaster and Open-Meteo read “Unavailable: simulated outage (test)”."),
 # ---- L: run limit
 P("L01", "Run limit header", "Different", "Eyebrow with city and ISO date; H1 “Soul and funk sax player”.", F20, "B-098"),
 P("L02", "Plan limit reached", "Present", "Alert “Plan limit reached · You've started 5 plans this hour. Try again in about 45 minutes, or open one of your earlier plans.” with Back to Busk Map home; “No new plan was started.” sits above it."),
 # ---- X: not found
 P("X01", "We can't find this busk", "Different", "Copy and button match; drawn as a small left-aligned boxed card with a small title (board: centred, large title, no box). Same pattern as the 404 card (B-053).", "", "B-111"),
]
SECTIONS = [
 ("new-defects", "New defects (placeholders for QA to file)", "<table><tr><th>Id</th><th>Sev</th><th>Rows</th><th>What differs</th></tr>"
  "<tr><td>B-098</td><td>Low</td><td>B03, Y01, N01, L01, S02</td><td>Eyebrow date is ISO (“SUNDAY 2026-10-18, 12 PM–3 PM”, board “Sun 19 Oct · 12–3 pm”); the replay eyebrow has no “Shared busk” prefix.</td></tr>"
  "<tr><td>B-099</td><td>Low</td><td>B02, B04</td><td>No act line under the H1 (board: “Folk duo, fiddle and guitar”).</td></tr>"
  "<tr><td>B-100</td><td>Low</td><td>B11</td><td>No day · slot · permit line under “Your busk”.</td></tr>"
  "<tr><td>B-101</td><td>Low</td><td>B12, B18</td><td>Selected pitch row is a heavy border only: no white card, orange offset shadow or filled score cell.</td></tr>"
  "<tr><td>B-102</td><td>Low</td><td>B14, B18</td><td>Selected pin has no name caption; pins 2 and 3 are not smaller.</td></tr>"
  "<tr><td>B-103</td><td>Low</td><td>B45, R08</td><td>“Where your crowd gathers” card has no mini taste map, only a list of places.</td></tr>"
  "<tr><td>B-104</td><td>Low</td><td>B54, B65</td><td>Details sheet 512 px wide (board 720); at 390 it fills the screen from the top, no bottom rise or grab handle.</td></tr>"
  "<tr><td>B-105</td><td>Medium</td><td>B55-B59</td><td>Sheet body is the old pitch card: no area line, prose instead of chips, no foot-traffic-by-hour sparkline, plain Evidence/Rules lists, setlist without Copy.</td></tr>"
  "<tr><td>B-106</td><td>Low</td><td>B62</td><td>Lean bars scaled so ±11 draws a 3-6 px stub: reads as bare ticks.</td></tr>"
  "<tr><td>B-107</td><td>Low</td><td>B71, B65</td><td>No global reduced-motion rule; the sheet's slide and fade still run under reduce.</td></tr>"
  "<tr><td>B-108</td><td>Low</td><td>R01, Y03</td><td>Running and replay copy say “The agent…” / model steps and tokens (board: “Your busk replaces the research here…”, “Researched at 1:12 pm today…”); Copy link shows while running.</td></tr>"
  "<tr><td>B-109</td><td>Low</td><td>R09</td><td>No “Data used so far” while the run is live.</td></tr>"
  "<tr><td>B-110</td><td>Low</td><td>N03</td><td>No-pitch feed shows eight “Sent back to check more” cards (MAX_FINISH_REJECTIONS is 2); may be the offline mock only.</td></tr>"
  "<tr><td>B-111</td><td>Low</td><td>X01</td><td>Plan-not-found is a small left-aligned boxed card (board centred, large title); likely shares B-053's fix.</td></tr>"
  "<tr><td>B-112</td><td>Low</td><td>M04</td><td>No-match map draws no taste cells but the legend still shows the taste ramp.</td></tr>"
  "<tr><td>B-113</td><td>Low</td><td>B64</td><td>No event diamonds or event popover on the plan map (the plan carries no event coordinates).</td></tr></table>"),
 ("field-strip", "Field strip (F13, F14): plan page", '<p>/plan?example=acoustic at 7b1521e: 18 fields, 5 pass, 13 fail (two ring layers when focused; the global :focus-visible double shadow, see Site-wide S09).</p><a href="../screens/honeycomb/plan/inv/field-strip.jpg"><img src="../screens/honeycomb/plan/inv/field-strip.jpg" alt="Plan field strip"></a>'),
 ("critique", "Impeccable critique (design review)", "<ol>"
  "<li><b>P1 · The payoff is below the fold.</b> “Your busk” starts 871 px down at 390 and 987 px at 1440: chips, two buttons, status line, test notes, funnel and Agent vs engine come first (B02, B67, R10; B-050).</li>"
  "<li><b>P1 · Dead ends on the error states.</b> Qloo down has no panel and no Try again; no legal pitch offers no general-permit plan or other day (Q01-Q03, N02; B-043, B-044).</li>"
  "<li><b>P2 · The map says the opposite of the call.</b> Every plan map draws the whole pale-to-dark field with a boxed “test data” legend; F05 wants only orange cells and F03 a one-line legend; zones and events are absent (B13, B15, B19, B64, B69).</li>"
  "<li><b>P2 · The details sheet is a different design.</b> Narrow, prose-heavy, no sparkline, phone sheet from the top (B54-B59, B62; B-104, B-105, B-106).</li>"
  "<li><b>P2 · Jargon and noise.</b> “agent”, “engine”, model steps and tokens in user copy, and alert stacks on no match (R01, Y03, M02, E01; B-049, B-108).</li>"
  "<li><b>P3 · Selection is weak.</b> The picked row is a heavier border and the pin gets no caption, so row and pin don't read as one thing (B12, B14, B18; B-101, B-102).</li></ol>"),
 ("audit", "Impeccable audit (technical)", "<table><tr><th>Check</th><th>Result</th></tr>"
  "<tr><td>axe (WCAG 2.2 AA tags): ready plan at 390 and 1440, day and night</td><td>0 violations</td></tr>"
  "<tr><td>axe: Qloo down, no match, no pitch, not found at 390 and 1440 (day)</td><td>0 violations</td></tr>"
  "<tr><td>Sideways scroll, ready plan and the states above, at 390 / 768 / 1440</td><td>None (scrollWidth = viewport)</td></tr>"
  "<tr><td>Heading outline</td><td>1440: h1 → h3 (Agent vs engine) → h2 Your busk … (B-048). 390/768: h1 → h2 → h3, with h2 “The research”.</td></tr>"
  "<tr><td>Focus</td><td>Rows, pins, Full details, Copy link reachable by keyboard; ring is a 2 px cream gap + 4 px dark box-shadow (two rings, F13-F15). Sheet traps focus and closes on Escape.</td></tr>"
  "<tr><td>Bottom nav at 390</td><td>Fixed, display grid, 64 px, top 780 at 844 tall; hit-test at its centre lands on the nav.</td></tr>"
  "<tr><td>Text clipping at 390</td><td>Weather cells and pitch names: scrollWidth = clientWidth, names wrap; nothing cut off.</td></tr>"
  "<tr><td>Reduced motion</td><td>Loaders motion-safe; skeleton and fold guarded; sheet slide/fade not guarded (B-107).</td></tr></table>"),
 ("brand-issues", "BRAND's build issues", "<table><tr><th>Issue</th><th>Result</th><th>Evidence</th></tr>"
  "<tr><td>The phone view never shows the bottom nav</td><td>Not reproduced</td><td>At 390 the MobileNav is fixed at the bottom, visible, Busks active, on the ready plan, researching, states (B67, R10). BRAND's note is about the board's own CSS (R10 spec).</td></tr>"
  "<tr><td>NoMatch still draws a taste field and a “Taste match” legend</td><td>Partly confirmed</td><td>No taste cells draw on no-match; the legend still shows the taste ramp (M04, B-112).</td></tr>"
  "<tr><td>Fallback says “Found by Claude” when Claude ran out of time</td><td>Not reproduced (source)</td><td>No “Found by” string anywhere in src; the fallback copy is “The agent ran out of time, so this is the engine's plan…” (E01-E03, B-049).</td></tr>"
  "<tr><td>Phone weather strip and pitch names cut off</td><td>Not reproduced</td><td>At 390 weather cells wrap 2+1 and pitch names wrap; scrollWidth = clientWidth (B21, B12).</td></tr>"
  "<tr><td>The sheet's lean bars render as bare ticks</td><td>Confirmed</td><td>Bars scaled so +11 is a 3-6 px stub (B62, B-106).</td></tr>"
  "<tr><td>The nav says Setlist</td><td>Not reproduced</td><td>Nav is Busks · Week · Brain · Tips (B01).</td></tr></table>"),
 ("v1-map", "v1 → v2 ids", "<p>P01→B02-B05 · P02→B07 · P03→B08/B09 · P04→B10-B12, B16-B18 · P05→B13-B15, B19, B20 · P06→B21-B23 · P07→B24-B30 · P08→B31-B32 · P09→B33-B48 · P10→B49 · P11→B54-B62 · P12→B63 · P13→B50 · P14→R01-R10 · P15→E01-E03 · P16→Y01-Y04 · P17→Q01-Q03 · P18→M01-M04 · P19→N01-N03 · P20→D01-D03 · P21→S01-S02 · P22→L01-L02 · P23→X01 · P24→B67 · P25→B69 · P26→B70.</p>"),
]
