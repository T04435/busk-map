# Plan · review: data for qa/tools/page-review.py. v3 re-judges every row at 8207373 (images in inv/v3/). v2 re-keys v1's 26 provisional parts (P01-P26) to BRAND's inventory/plan
# (106 parts: B body, R researching, Y replay, S slot passed, E engine fallback, N no legal pitch, M no match, Q Qloo down,
# D source down, L run limit, X not found). Run from the worktree root.
import os
TITLE = "Plan · review"
ROUTE = "/p/<id> (from /plan?…)"
VERSION = "v3"
COMMIT = "8207373"
DATE = "17 Oct 2026"
IMG = "honeycomb/plan/inv/"
CHANGES = ("B01 now Present (F12 lockup fixed); B70 one ring now (F13-F15), but a default orange button at night shows no visible focus (B-134, B70/X01); B19 Different: one-line legend with tooltips at 768/1440 and no visible “test data”, but the Taste tooltip still says “(test data)” (B-145) and at 390 it wraps to two lines under the map (B-137); B10/B13/B69 still break F05 (full five-step field incl. dark cells, not zoomed out; B-146); B15 still no hatched no-busking cells (F16, B-148); B49/B61 no Qloo logo (F09/F18, B-147); map attribution “i” tiled 2x2 (B-136, B20); X01 now centred with a large title but still boxed (B-111); Qloo down still an alert with no “No plan without taste data” and no Try again (B-043). All other cited defects B-043..B-051 and B-098..B-113 re-verified open. “≈612 people an hour est.” field-strip fail is a capture artefact (folded at 390): focused it shows one ring, day and night.")
HISTORY = [
    (VERSION, COMMIT, DATE, CHANGES),
    ("v2", "7b1521e", DATE, ("Re-keyed to BRAND's 106-part plan inventory (was 26 provisional parts); every part judged at 1440 and 390 (768 checked) against its crop or spec "
           "and the user's calls (F02, F03, F05 on every map; F09/F18, F12 as corrected, F13-F15, F16, F20; Qloo down = “No plan without taste data” + Try again, not counted). "
           "Known B-043..B-051 cited on their rows; B-098..B-113 placeholders for QA to file; BRAND's six build issues checked.")),
    ("v1", "7b1521e", DATE, "First version: 26 provisional parts from the deck's 11 Plan boards (ready, running, engine, replay, Qloo down, no match, no pitch, source down, slot passed, limit, not found), field strip, impeccable critique and audit; B-043..B-051."),
]
SOURCE_NOTE = ("v3 build images are in inv/v3/ (older v2 images stay in inv/build/). Deck: BRAND's inventory crops (1440 boards; click-only parts cropped after the click). Build: QA's own export of the commit above, offline "
               "(mock Qloo, test model), so “Qloo test data” chips, “test model” labels and synthetic place names appear that a live plan won't show; they are not judged. "
               "States that can't be reached offline (Claude ran out of time, a run that changes the engine's pick, events on the map) are judged from the source and say so. "
               "State rows show the top of the viewport.")
_D = "qa/screens/" + IMG
def _f(p): return p if os.path.exists(_D + p) else None
def P(id, name, qa, note, user="", defect="—", dev="—", spec=None):
    d = {"id": id, "name": name, "qa": qa, "note": note, "user": user, "defect": defect, "dev": dev,
         "deck": _f(f"deck/{id}.jpg"), "b1440": _f(f"v3/{id}-1440.jpg"), "b390": _f(f"v3/{id}-390.jpg")}
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
 P("B01", "App header", "Present", "Lockup [hex mark][new stencil wordmark] as an image (36 px header, 34 px footer), letters even height as in the user's 04 reference (no tall M). Nav Busks · Week · Brain · Tips with Busks active; no Repertoire item (site-wide, B-130). At 390 the nav moves to the bottom bar.", F12, "B-130 (site)"),
 P("B02", "Page header", "Different", "Eyebrow, H1 and Copy link as the board, but three status chips (Qloo test data, Foot traffic, Explanations), “Plan my week instead” and “Tip log” stack under the H1, then the agent status line; no act line.", "", "B-050, B-099"),
 P("B03", "Eyebrow", "Different", "Unchanged: “MELBOURNE · SUNDAY 2026-10-18, 12 PM–3 PM · GENERAL PERMIT”: city still in (F20 not met), ISO date (board “Sun 19 Oct · 12–3 pm”).", F20, "B-098"),
 P("B04", "Act name and line", "Different", "H1 “Folk duo” in the display face; no act line under it (board: “Folk duo, fiddle and guitar”).", "", "B-099"),
 P("B05", "Copy link", "Present", "Outline small button “Copy link” (link icon, board copy icon), right of the H1 at 1440, under it at 390."),
 P("B06", "Copy link: copied", "Present", "After the click: check icon and “LINK COPIED”. The clipboard-blocked fallback was not forced."),
 P("B07", "Research funnel", "Different", "Boxed funnel with labels under the hexes, dashes between stages and a “How this plan was found…” paragraph; adds a “Qloo calls” stage. Board: one line of cells with arrows, “496 data points” bold and the orange “3 pitches”.", "", "B-051"),
 P("B08", "Agent vs engine: kept", "Different", "“The test model checked Busk Map's top 3 and kept them” with three full-width rows (board: three compact tiles in one line) and no “Kept after checking …” line.", "", "B-051"),
 P("B09", "Agent vs engine: changed", "Present", "Not reachable offline (the test model keeps the engine's picks). Source (agent-vs-engine.tsx) renders “added by <model>” over “Busk Map's no. N” per change.", ""),
 P("B10", "Your busk (PlanMap)", "Different", "Pitch list left beside the map at 1440, map above the list at 390, as the board. The map still breaks F05 (full five-step taste field, pale to dark brown, framed at the default zoom; the landing filters to affinity ≥ 0.48 and zooms out, the plan does not). Legend is now one line along the bottom at 768/1440 (see B19). The panel adds the legal line, tip-history note and Log your takings under the rows.", F0203 + " " + F05, "B-146"),
 P("B11", "Busk title and summary", "Different", "“Your busk” then the summary (offline: a mock line and two bullets); no “Sun 19 Oct · 12–3 pm · General permit” line under the title.", "", "B-100"),
 P("B12", "Pitch rows", "Different", "Three ranked rows with rank tile, name, “@ 12 pm–3 pm”, score ring, badges and “Full details →” on every row (F02 kept). The selected row is marked by a heavy border only: no white card with the orange offset shadow, no filled score cell.", F0203, "B-101"),
 P("B13", "Taste map", "Different", "MapLibre map draws every taste cell in all five ramp steps (#fbe3d2 … #7f2d0c), wall to wall over the street tiles, at the plan's default framing (maxZoom 15, no zoom-out frame); no river or place names readable under the field; no hatched cells, no event diamonds.", F05, "B-146"),
 P("B14", "Pitch pins", "Different", "Top-3 pins are buttons (aria-pressed, “Pitch 1: … score 60, usual pitch”) with rank badges; 25 grey hex dots for the others. No caption with the selected pitch's name, and pitch 2/3 are the same size as pitch 1.", "", "B-102"),
 P("B15", "No-busking zone", "Missing", "Still no hatched cells at 8207373: plan-map.tsx and map-legend.tsx say no no-busking zones are drawn (“the plan carries no coordinates for them”).", "F16: no-busking zones are hatched honeycomb cells, never a rectangle, on every map.", "B-148"),
 P("B16", "Other pitches note", "Present", "“25 more pitches scored. They're the small markers on the map: pick one for its summary. The top 3 are kept 250 m apart.” (no pin icon)."),
 P("B17", "Full details link", "Present", "“Full details →” on every row; opens the sheet.", F0203),
 P("B18", "Row and pin selected", "Different", "Picking row 2 moves the heavy border and aria-pressed to pitch 2's pin; no white card or orange shadow, no pin caption.", "", "B-101, B-102"),
 P("B19", "Map legend", "Different", "Now one line along the bottom of the map at 768 and 1440 (absolute, 12 px from the bottom, 44 px tall): Taste (five-cell ramp) · Top pitch · Hidden gem · Other, each a focusable key with a tooltip on hover and focus; no “test data” in the visible text. But the Taste tooltip reads “Taste map from Qloo's heatmap (test data): …” with the mock (B-145), and at 390 the legend sits under the map and wraps to two lines (“Other” alone on line 2, 76 px; B-137).", F0203, "B-145, B-137"),
 P("B20", "Zoom buttons", "Present", "+ / − (Zoom in, Zoom out, 44 px) top-right of the plan map at 1440 and 390. Separate fault at the bottom-right: the compact attribution button is enlarged to 44 px inside a 24 px control, so its “i” icon tiles 2x2 and is cut off (1440 and 390; also on the no-match map).", F0203, "B-136", spec="Not drawn on the plan boards; F02 keeps the map's zoom buttons (+ / −) on the plan map."),
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
 P("B49", "Data used", "Different", "“Data used · Where every number on this page comes from.”: two-column grid of linked sources with licences and a status each; “Taste data by Qloo” is a text link, no Qloo logo (the QlooWordmark link is used only in the header, footer, landing, brand and brain).", F0918, "B-147"),
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
 P("B61", "Sheet: crowd panel", "Different", "“Who this crowd likes” with What Qloo matched on, Artists this crowd likes, Your fans vs the usual crowd and Evidence lines; no “Qloo: Live” status and no Qloo logo.", F0918, "B-147"),
 P("B62", "Sheet: who your fans are", "Different", "Eight lean bars (24 and under … Female) with values; the bars are scaled so +11 draws a 3-6 px stub and each row reads as a bare tick.", "", "B-106"),
 P("B63", "Other pitch popover", "Present", "Browse other pitches opens “Piazza Italia 58 Hidden gem”, “Too close to … within 250 m …”, with ‹ › stepping (1 of 25) and close."),
 P("B64", "Event popover", "Missing", "No event diamonds on the plan map, so no event popover (plan-map.tsx draws no events).", "", "B-113"),
 P("B65", "Sheet slides in", "Present", "Slides in from the right with a fade (tw-animate, 200 ms). Phone rise and reduced motion: see B-104, B-107.", "", "B-104, B-107"),
 P("B66", "Tablet 768: busk first, research folded", "Present", "At 768: “Found from 768 data points · See the research ↓” under the header, the busk first with the map above the list, the research below. (The 1440 column shows 768.)"),
 P("B67", "Phone ≤720: layout", "Different", "Bottom nav visible and fixed (Busks active), H1 40 px, eyebrow wraps, map above the rows; but “Your busk” starts 871 px down under the chips, buttons and test-data notes.", "", "B-050"),
 P("B68", "Phone: The research", "Present", "“The research” h2, the funnel, Agent vs engine, then the feed with “Each check the model ran for the busk above, and what it found.” and “Every check (8)” folded."),
 P("B69", "Night theme", "Different", "Night tokens throughout, axe clean; the map still draws the full taste field (night ramp: low cells dark brown, high cells pale peach) over light street tiles, against F05.", F05, "B-146"),
 P("B70", "Focus ring", "Different", "One ring now: pitch rows, Copy link and the estimate buttons show a single 2 px box-shadow ring (dark by day, orange at night), no cream gap. But the default orange button at night (e.g. “Go to Busk Map home” on X01) gets a ring in its own orange (rgb 255,106,43 on the same fill): focused looks the same as unfocused except 2 px larger; ring vs button 1:1, vs card 5.8:1. By day the ring is dark on orange (5.5:1).", F1315, "B-134", spec="Every interactive part shows the focus ring on :focus-visible; one ring, shadcn's pattern."),
 P("B71", "Reduced motion", "Different", "Loaders use motion-safe and the skeleton/fold animations are guarded, but there is no global 0 ms rule: the sheet's slide and fade still run under reduce.", "", "B-107", spec="prefers-reduced-motion: every animation and transition at 0 ms."),
 # ---- R: researching
 P("R01", "Researching line", "Different", "Under the H1: “The agent is researching with Qloo and the other sources. The plan appears when it finishes.” (board: act line + “Your busk replaces the research here in about half a minute.”); Copy link already shows. New at 1440: a right column of skeleton rows, “The plan, map, crowd, setlist and comparison appear here when the agent finishes.”", "", "B-108"),
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
 P("Q01", "Qloo down layout", "Different", "Re-verified offline (/plan?example=acoustic&faults=qloo): only the header, chips, test-data notes and one alert; no funnel, no feed, no side-by-side error.", QCALL, "B-043"),
 P("Q02", "Feed stopped", "Different", "No stopped feed and no Try again: the alert reads “Qloo is unavailable · Busk Map needs Qloo's taste data to plan. Please try again in a few minutes.”", QCALL, "B-043"),
 P("Q03", "No plan without taste data", "Missing", "Re-verified: no “No plan without taste data” panel, no “Qloo: Unavailable” status, no Try again at 1440 or 390 (only data-testid qloo-down, the alert).", QCALL, "B-043"),
 # ---- D: source down
 P("D01", "Sensors didn't answer", "Different", "A dashed list with raw ids: “melbourne-pedestrian: Unavailable: simulated outage (test) · Foot traffic is estimated from busy places and events, and marked est.” plus ticketmaster and open-meteo; no warning alert titled “The city's pedestrian sensors didn't answer”.", "", "B-046"),
 P("D02", "Failed check card", "Present", "Offline the foot-traffic tool absorbs the outage (“No sensor count near here · estimated from busy places and events”); the error card “This check didn't come back…” is in source."),
 P("D03", "Source unavailable", "Present", "Data used: Pedestrian counts, Ticketmaster and Open-Meteo read “Unavailable: simulated outage (test)”."),
 # ---- L: run limit
 P("L01", "Run limit header", "Different", "Eyebrow with city and ISO date; H1 “Soul and funk sax player”.", F20, "B-098"),
 P("L02", "Plan limit reached", "Present", "Alert “Plan limit reached · You've started 5 plans this hour. Try again in about 45 minutes.” with Back to Busk Map home; “No new plan was started.” sits above it. (Copy no longer adds “or open one of your earlier plans”.)"),
 # ---- X: not found
 P("X01", "We can't find this busk", "Different", "Now centred with the dashed hex icon, a large title “We can't find this busk”, the copy and an orange “Go to Busk Map home” button; still drawn inside a bordered card (board: no box). Its home button has no visible focus at night (B-134).", "", "B-111 (partly fixed: centred and large title, still boxed); B-134"),
]
SECTIONS = [
 ("new-defects", "New defects at 8207373 (placeholders for QA to file)", "<table><tr><th>Id</th><th>Sev</th><th>Rows</th><th>What differs</th></tr>"
  "<tr><td>B-145</td><td>Low</td><td>B19</td><td>The legend's Taste tooltip still reads “Taste map from Qloo's heatmap (test data): …” whenever Qloo is the mock (F02: never “test data” in the legend).</td></tr>"
  "<tr><td>B-137</td><td>Low</td><td>B19</td><td>At 390 the legend sits under the map, not along its bottom, and wraps to two lines (“Other” alone on line 2, 76 px tall) (F03: one line).</td></tr>"
  "<tr><td>B-136</td><td>Low</td><td>B20, B13, M04</td><td>Map attribution button is 44 px inside a 24 px compact control (globals.css), so its “i” icon tiles 2x2 and is cut off at the map's bottom-right corner, 1440 and 390 (already in v2's images).</td></tr>"
  "<tr><td>B-146</td><td>Medium</td><td>B10, B13, B69</td><td>The plan map still breaks F05: every taste cell in all five ramp steps (incl. the dark #7f2d0c, and at night the pale high end), wall to wall, at the default framing; the landing filters to affinity ≥ 0.48 and zooms out (frame maxZoom 14.2), the plan map does neither.</td></tr>"
  "<tr><td>B-147</td><td>Low</td><td>B49, B61</td><td>Where the plan names Qloo as a source (Data used “Taste data by Qloo”, the crowd panel) there is no Qloo logo linked to qloo.com (F09/F18); QlooWordmark is used only in header, footer, landing, brand and brain.</td></tr>"
  "<tr><td>B-134</td><td>Medium</td><td>B70, X01</td><td>Default (orange) button at night: the focus ring is the button's own orange (255,106,43 on 255,106,43), so focus shows only as the button growing 2 px; ring vs button 1:1 (vs card 5.8:1). DEV's unverified night ring. By day it is dark on orange, 5.5:1.</td></tr>"
  "<tr><td>B-148</td><td>Medium</td><td>B15</td><td>No hatched no-busking cells on the plan map at 8207373 (F16, every map); the plan carries no zone coordinates.</td></tr></table>"
  "<p>Still open at 8207373 (re-verified): B-043 (Q01-Q03), B-044 (N02), B-045 (M01, M02), B-046 (D01), B-047 (B21, B22), B-048 (1440 outline h1 → h3), B-049 (E01, E03, M02), B-050 (B02, B67, R10: “Your busk” at 871 px at 390, 987 px at 1440), B-051 (B07, B08), "
  "B-098 to B-110, B-112, B-113. B-111 partly fixed (X01 centred with a large title, still boxed).</p>"),
 ("field-strip", "Field strip (F13, F14): plan page", '<p>/plan?example=acoustic at 8207373 (fields8): 22 fields, 21 pass; 76 states, 74 pass. The two fails are “≈612 people an hour est.” at 390, day and night, with no ring: at 390 that button sits in the folded “Every check (8)” list (a hidden ancestor), so the strip\'s focus() could not land. '
  'Checked by hand: with the fold open, Tab onto it gives :focus-visible and one 2 px ring (dark rgb 20,28,33 by day, orange rgb 255,106,43 at night) at 390 and 1440. Focus is visible; the fail is a capture artefact.</p>'
  '<p>Field strip:</p>' + '<a href="../screens/honeycomb/plan/inv/v3/field-strip.jpg"><img src="../screens/honeycomb/plan/inv/v3/field-strip.jpg" alt="Plan field strip at 8207373"></a>' + '<p>“≈612 people an hour est.” focused (day 390, night 390, day 1440, night 1440):</p>' + '<a href="../screens/honeycomb/plan/inv/v3/focus-612.jpg"><img src="../screens/honeycomb/plan/inv/v3/focus-612.jpg" alt="612 people button focused, day and night"></a>' + '<p>Default button focus at night (top) and by day (bottom), X01:</p>' + '<a href="../screens/honeycomb/plan/inv/v3/default-btn-focus-night-day.jpg"><img src="../screens/honeycomb/plan/inv/v3/default-btn-focus-night-day.jpg" alt="Go to Busk Map home focused, night and day"></a>'),
 ("map-calls", "Map against F02 / F03 / F05 / F16", "<table><tr><th>Call</th><th>Result</th><th>Evidence</th></tr>"
  "<tr><td>F02 Full details per pitch row</td><td>Met</td><td>“Full details →” on all three rows, 1440 and 390 (B12, B17).</td></tr>"
  "<tr><td>F02 keep zoom</td><td>Met</td><td>+ / − 44 px top-right (B20).</td></tr>"
  "<tr><td>F02 no “test data” in the legend</td><td>Partly</td><td>Visible text clean; the Taste tooltip says “(test data)” with the mock (B-145).</td></tr>"
  "<tr><td>F03 one-line legend at the bottom, tooltips</td><td>Met at 768/1440, not at 390</td><td>Absolute, 44 px, 12 px from the bottom; four keys with tooltips on hover and focus. At 390 it is below the map on two lines (B-137).</td></tr>"
  "<tr><td>F05 orange cells only, zoomed out</td><td>Not met</td><td>Five ramp steps incl. dark, wall to wall; no zoom-out frame (B-146).</td></tr>"
  "<tr><td>F16 hatched no-busking cells</td><td>Not met</td><td>None drawn (B-148).</td></tr></table>"
  '<p>Legend tooltip at 1440:</p>' + '<a href="../screens/honeycomb/plan/inv/v3/legend-tip-1440.jpg"><img src="../screens/honeycomb/plan/inv/v3/legend-tip-1440.jpg" alt="Legend Taste tooltip at 1440"></a>' + '<p>Attribution corner (3x):</p>' + '<a href="../screens/honeycomb/plan/inv/v3/attrib-1440.jpg"><img src="../screens/honeycomb/plan/inv/v3/attrib-1440.jpg" alt="Map attribution icon tiled"></a>'),
 ("critique", "Impeccable critique (design review)", "<ol>"
  "<li><b>P1 · The payoff is still below the fold.</b> “Your busk” starts 871 px down at 390 and 987 px at 1440 behind chips, two buttons, status line, test notes, funnel and Agent vs engine (B02, B67, R10; B-050).</li>"
  "<li><b>P1 · Qloo down is still a dead end.</b> One alert, no “No plan without taste data”, no Try again; no legal pitch still offers no way on (Q01-Q03, N02; B-043, B-044).</li>"
  "<li><b>P1 · The plan map ignores the map calls.</b> The legend got fixed at desktop, but the map is still a wall-to-wall five-step heat field with no zone hatching; the landing already shows the orange-only, zoomed-out version (B10, B13, B15, B69; B-146, B-148).</li>"
  "<li><b>P2 · The details sheet is a different design.</b> Narrow, prose-heavy, no sparkline, phone sheet from the top, tick-sized lean bars (B54-B59, B62; B-104, B-105, B-106).</li>"
  "<li><b>P2 · Focus vanishes on orange buttons at night.</b> One ring is in place everywhere else, but on a default button at night the ring matches the fill (B70, X01; B-134).</li>"
  "<li><b>P3 · Jargon and small finish.</b> “agent”, “engine”, model steps and tokens in user copy (R01, Y03, M02, E01; B-049, B-108); Qloo named without its logo (B-147); tiled attribution icon (B-136).</li></ol>"),
 ("audit", "Impeccable audit (technical)", "<table><tr><th>Check</th><th>Result</th></tr>"
  "<tr><td>axe (WCAG 2.2 AA tags): ready plan at 390 and 1440, day and night</td><td>0 violations</td></tr>"
  "<tr><td>axe: Qloo down, no match, no pitch, not found at 390 and 1440 (day)</td><td>0 violations</td></tr>"
  "<tr><td>Sideways scroll: ready plan and the states above at 390 / 768 / 1440</td><td>None (scrollWidth = viewport)</td></tr>"
  "<tr><td>Heading outline</td><td>1440: h1 → h3 (Agent vs engine) → h2 Your busk … (B-048, still open). 390/768: h1 → h2 → h3, with h2 “The research”.</td></tr>"
  "<tr><td>Focus</td><td>One 2 px ring (box-shadow) on rows, pins, Copy link, estimate buttons; sheet traps focus, Escape closes. Default orange button at night: ring same colour as the fill (B-134).</td></tr>"
  "<tr><td>Legend keys</td><td>Four buttons, tooltips open on hover and on keyboard focus.</td></tr>"
  "<tr><td>Bottom nav at 390</td><td>Fixed, grid, 64 px, top 780 at 844 tall; hit-test lands on the nav.</td></tr>"
  "<tr><td>Text clipping at 390</td><td>Weather cells and pitch names: scrollWidth = clientWidth; nothing cut off.</td></tr>"
  "<tr><td>Reduced motion</td><td>Skeleton, fold and loaders guarded; the sheet's slide/fade classes run with no reduce rule (B-107).</td></tr></table>"),
 ("brand-issues", "BRAND's build issues (rechecked at 8207373)", "<table><tr><th>Issue</th><th>Result</th><th>Evidence</th></tr>"
  "<tr><td>The phone view never shows the bottom nav</td><td>Not reproduced</td><td>At 390 the bottom nav is fixed, visible, Busks active (B67, R10).</td></tr>"
  "<tr><td>NoMatch still draws a taste field and a “Taste match” legend</td><td>Partly confirmed</td><td>No taste cells on no-match; the legend still shows the Taste ramp (M04, B-112).</td></tr>"
  "<tr><td>Fallback says “Found by Claude” when Claude ran out of time</td><td>Not reproduced (source)</td><td>No “Found by” string in src; fallback copy is “The agent ran out of time, so this is the engine's plan…” (E01-E03, B-049).</td></tr>"
  "<tr><td>Phone weather strip and pitch names cut off</td><td>Not reproduced</td><td>At 390 weather cells wrap 2+1, names wrap; scrollWidth = clientWidth (B21, B12).</td></tr>"
  "<tr><td>The sheet's lean bars render as bare ticks</td><td>Confirmed</td><td>±11 still draws a 3-6 px stub (B62, B-106).</td></tr>"
  "<tr><td>The nav says Setlist</td><td>Not reproduced</td><td>Nav is Busks · Week · Brain · Tips (B01).</td></tr></table>"),
 ("v1-map", "v1 → v2 ids", "<p>P01→B02-B05 · P02→B07 · P03→B08/B09 · P04→B10-B12, B16-B18 · P05→B13-B15, B19, B20 · P06→B21-B23 · P07→B24-B30 · P08→B31-B32 · P09→B33-B48 · P10→B49 · P11→B54-B62 · P12→B63 · P13→B50 · P14→R01-R10 · P15→E01-E03 · P16→Y01-Y04 · P17→Q01-Q03 · P18→M01-M04 · P19→N01-N03 · P20→D01-D03 · P21→S01-S02 · P22→L01-L02 · P23→X01 · P24→B67 · P25→B69 · P26→B70.</p>"),
]
