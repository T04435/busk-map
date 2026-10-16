# Plan · review: data for qa/tools/page-review.py. v4 is the one full QA pass at DEV's closing commit f83f1a1 (images in inv/v4/); v3 re-judged at 8207373 (inv/v3/);
# v2 re-keyed v1's 26 provisional parts (P01-P26) to BRAND's inventory/plan (106 parts: B body, R researching, Y replay, S slot passed, E engine fallback,
# N no legal pitch, M no match, Q Qloo down, D source down, L run limit, X not found). Run from the worktree root.
import os
TITLE = "Plan · review"
ROUTE = "/p/<id> (from /plan?…)"
VERSION = "v4"
COMMIT = "f83f1a1"
DATE = "17 Oct 2026"
IMG = "honeycomb/plan/inv/"
CHANGES = ("Fixed since v3: Qloo down is the “No plan without taste data” panel with Qloo's linked logo, Unavailable and Try again beside the stopped feed (B-043, Q01-Q03); "
           "no legal pitch is a panel with Pick another day (B-044, N02); no match has one alert and Pick your artists from Spotify, no taste legend (B-045, B-112, M01-M04); "
           "source down is the board's warnings (B-046, D01); weather 10:00-16:00 with one Your slot frame (B-047, B21/B22); headings h1 > h2 > h3 (B-048); brand words in the fallback (B-049); "
           "Your busk at 635 px (1440) and 500 px (390), was 987/871 (B-050); funnel and compact Agent vs engine (B-051); eyebrow “Sun 18 Oct · 12–3 pm · General permit”, "
           "Shared busk prefix, act line, busk title line (B-098..B-100); white selected card, numbered pins with caption (B-101, B-102); crowd-gathers mini map (B-103); "
           "the sheet is the board's: 720 px, phone bottom sheet with handle, chips, foot-traffic sparkline, setlist Copy, crowd with Qloo logo, scaled lean bars (B-104..B-106, partly B-105); "
           "researching line and Data used so far (B-108, B-109); X01 centred, no box (B-111); night focus on orange buttons is a 2 px outline outside the button (B-134); "
           "map draws orange cells only and zooms out (B-146), hatched no-busking cells (B-148), Qloo logo where Qloo is a source (B-147), no “test data” in the legend tooltip (B-145); Tips gone from the page. "
           "Still open: B-107 (sheet animates under reduced motion, B71), B-136 (attribution “i” tiled), B-137 (legend 2 lines at 390), B-105 partly (no council-rules link row, B58). "
           "New: B-183 night taste cells half dark burnt orange (B69), B-184 no-pitch page says “these spots come straight from Busk Map's scores” (N01), B-185 Data used so far says Live for test data (R09). "
           "Held by DEV: feed and compare cards B24-B48, events B64/B-113, the 13-check no-pitch feed N03/B-110, Repertoire nav B-130. DS parity and glyph rule applied (user, 17 Oct): every component compared with its DS specimen; 22 rows moved to Different (B02, B05, B07, B12, B14, B18, B21, B49, B54, B55, B57, B59, B61, B62, B63, B66, R01, R02, Y03, Q03, S01, S02) with B-186..B-195; the research funnel's “▸” connectors and “See the research ↓” cite B-162; held cards B24-B48 name the DS component each should become.")
READY = ("Not ready", "Against the design system the user would reject the core of the busk on sight: the research funnel joins its cells with “▸” glyphs, not DS ResearchFunnel's half-cell connectors (B07, R02; B-162), "
         "the pitch rows and pins are not DS PitchRow / PitchPin (B12, B14), and the sheet's lean bars and score breakdown are not DS LeanBar / ScoreBreakdown (B62, B54). Board states and the user's F-calls are otherwise met.")
HISTORY = [
    (VERSION, COMMIT, DATE, CHANGES),
    ("v3", "8207373", DATE, "B01 Present (F12 lockup); B70 one ring but default orange button at night had no visible focus (B-134); B19 one-line legend at 768/1440 but Taste tooltip said “(test data)” (B-145) and two lines at 390 (B-137); B10/B13/B69 broke F05 (B-146); B15 no hatched cells (B-148); B49/B61 no Qloo logo (B-147); attribution “i” tiled (B-136); X01 centred but boxed (B-111); Qloo down still an alert (B-043); B-043..B-051, B-098..B-113 re-verified open."),
    ("v2", "7b1521e", DATE, ("Re-keyed to BRAND's 106-part plan inventory (was 26 provisional parts); every part judged at 1440 and 390 (768 checked) against its crop or spec "
           "and the user's calls (F02, F03, F05 on every map; F09/F18, F12 as corrected, F13-F15, F16, F20; Qloo down = “No plan without taste data” + Try again, not counted). "
           "Known B-043..B-051 cited on their rows; B-098..B-113 ; BRAND's six build issues checked.")),
    ("v1", "7b1521e", DATE, "First version: 26 provisional parts from the deck's 11 Plan boards (ready, running, engine, replay, Qloo down, no match, no pitch, source down, slot passed, limit, not found), field strip, impeccable critique and audit; B-043..B-051."),
]
SOURCE_NOTE = ("v4 build images are in inv/v4/ (v3 in inv/v3/, v2 in inv/build/). Deck: BRAND's inventory crops (1440 boards; click-only parts cropped after the click). Build: QA's own export of the commit above, offline "
               "(mock Qloo, test model, BUSKMAP_FAKE_NOW Wed 14 Oct 12:00), so “Qloo test data” chips, “test model” labels and synthetic place names appear that a live plan won't show; they are not judged. "
               "States that can't be reached offline (Claude ran out of time, a run that changes the engine's pick) are judged from the source and say so. "
               "Running state held with an init script that stops the /api/plan stream after the last “tool-start” line (as holdAgentRunning). State rows show the top of the viewport.")
_D = "qa/screens/" + IMG
def _f(p): return p if os.path.exists(_D + p) else None
def P(id, name, qa, note, user="", defect="—", dev="—", spec=None):
    d = {"id": id, "name": name, "qa": qa, "note": note, "user": user, "defect": defect, "dev": dev,
         "deck": _f(f"deck/{id}.jpg"), "b1440": _f(f"v4/{id}-1440.jpg"), "b390": _f(f"v4/{id}-390.jpg")}
    if spec: d["spec"] = spec; d["deck_empty"] = "Spec only (no crop)"
    return d
F05 = "F05: on every plan map only the orange taste cells draw (no pale or dark cells, ground shows through), zoomed out a little; both themes."
F0203 = "F02/F03 (every map, the plan's too): keep “Full details →” per pitch row and the zoom buttons; the legend is one line along the bottom of the map with tooltips, never “test data”."
F20 = "F20: no city in the eyebrow or framing copy (“Sun 19 Oct · 12–3 pm · General permit”); a city only where the data is that city's."
F0918 = "F09/F18: wherever Qloo is named as a source, show Qloo's logo linked to qloo.com (new tab, rel=noopener noreferrer)."
F12 = "F12 (corrected 17 Oct): the one logo is the lockup [hex mark][new wordmark] in header and footer; F12 retired only the old wordmark lettering. Wordmark-only or mark-only fails."
F1315 = "F13-F15: one focus ring, shadcn's pattern, on every focusable part; no white gap plus dark ring."
F16 = "F16: no-busking zones are hatched honeycomb cells, never a rectangle, on every map."
QCALL = "User: when Qloo is down the plan shows “No plan without taste data” with Try again, and that run doesn't count against the limit."
HELD = "held by DEV: the plan feed and compare cards (B24-B48) are not re-skinned this round."
PARTS = [
 # ---- B: plan body (Done)
 P("B01", "App header", "Present", "Lockup [hex mark][new wordmark] left; nav Busks · Week · Brain with Busks active (aria-current); no Tips item and no /tips link on the page. No Repertoire item (held by DEV, B-130). Below 721 px the nav is the bottom bar.", F12, "B-130 (held by DEV)"),
 P("B02", "Page header", "Different", "Eyebrow, H1, act line and Copy link as the board. Differs from DS PageHeader: the DS puts a “Busk Map home” link above the eyebrow and shows the run status as outlined mono badges with icons (“✓ LIVE QLOO DATA”, “FOOT TRAFFIC: CITY SENSORS”, “EXPLANATIONS: CLAUDE”, “REPLAY OF AN EARLIER RUN…”) with “Plan my week instead” under them; the build has no home link and shows the status as a dot plus bold sans text line (“● Foot traffic: city sensors”), with Plan my week moved into the busk panel.", "", "B-186"),
 P("B03", "Eyebrow", "Present", "“SUN 18 OCT · 12–3 PM · GENERAL PERMIT”: no city, no ISO date (B-098 fixed).", F20),
 P("B04", "Act name and line", "Present", "H1 “FOLK DUO” in the display face; the act line under it reads “Sounds like Angus & Julia Stone, The Paper Kites, Simon & Garfunkel” (the example act has no own line) (B-099 fixed)."),
 P("B05", "Copy link", "Different", "Outline “COPY LINK”, right of the H1 at 1440, under it at 390; not shown while running. Differs from DS CopyLinkButton (and the board): the build uses a link (chain) icon, the DS a copy icon (two squares). Copied and clipboard-refused states otherwise as the DS.", "", "B-187"),
 P("B06", "Copy link: copied", "Present", "After the click: check icon and “LINK COPIED”. Clipboard-blocked fallback not forced."),
 P("B07", "Research funnel", "Different", "Unboxed line of 30 px hex count cells with muted labels: “680 taste cells mapped ▸ 1 crowd read ▸ … ▸ 768 data points ▸ 3 pitches”, data points bold, “3 pitches” orange (B-051 fixed). Differs from DS ResearchFunnel (its README: “linked by half a honeycomb cell turned on its side… Never use a > or arrow glyph”): the build joins the cells with a “▸” text glyph (research-funnel.tsx, layout landing), smaller and lighter than the DS half-cell connector.", "", "B-162"),
 P("B08", "Agent vs engine: kept", "Present", "Check cell, “AGENT VS ENGINE”, “THE TEST MODEL CHECKED BUSK MAP'S TOP 3 AND KEPT THEM”, “Kept after checking the crowd, foot traffic, events nearby and the rules.”, then three inline tiles with rank, name, score ring and check (long synthetic names wrap the third tile) (B-051 fixed)."),
 P("B09", "Agent vs engine: changed", "Present", "Not reachable offline (the test model keeps the engine's picks). Source (agent-vs-engine.tsx) renders “added by <model>” over the struck “Busk Map's no. N” per change."),
 P("B10", "Your busk (PlanMap)", "Present", "One bordered panel: pitch list left, map right at 1440; map above the list at 390 and 768. Under the rows: others note, the never-confirms line and “Plan my week instead”; no tip lines.", F0203 + " " + F05),
 P("B11", "Busk title and summary", "Present", "“YOUR BUSK”, “Sun 18 Oct · 12–3 pm · General permit” in mono, then the summary (offline: the mock line and two bullets) (B-100 fixed)."),
 P("B12", "Pitch rows", "Different", "Three ranked rows with rank tile, name, time, score cell, badges and “Full details →”; the selected row is the white card with the orange offset (B-101 fixed). Differs from DS PitchRow: the DS row is compact (name in caps on one line with “@ 12–3 pm” beside it, badges under, “FULL DETAILS →” in mono caps, underlined, right of the badges, no rule); the build row is about twice as tall: name about 22 px over two lines, the time on its own line, a full-width rule splitting the head from a footer, and “Full details →” in sans. The Usual pitch badge also differs from DS DiscoveryBadge (a dot icon where the DS has a ringed-target icon).", F0203, "B-165, B-188"),
 P("B13", "Taste map", "Present", "By day only the two orange steps draw (taste-3 #f28644, taste-4 #dd6322; no pale, no dark #7f2d0c), 354 cells, streets showing between them; default frame maxZoom 14.2 with 90 px padding (zoomed out a little); river and place names read under the field. No event diamonds (held, B-113). Night: see B69.", F05),
 P("B14", "Pitch pins", "Different", "Top-3 pins are buttons (aria-pressed) with rank badges; pitch 1 larger; the selected pin carries its caption (B-102 fixed). Differs from DS PitchPin: the DS top pin is a dark hex with an orange ring and an orange target dot, its rank in a small orange hex badge; the build pin is a black hex with a white hex inside and a square orange rank badge. The DS also has a yellow-diamond Hidden gem pin and a hatched No busking pin; the build draws hidden gems with the same pin as the others.", "", "B-166"),
 P("B15", "No-busking zone", "Present", "Hatched pink honeycomb cells drawn from the plan's zone cells (zones layer, fill-pattern hatch), with “No busking” in the legend. With the offline data there are only two cells, at Docklands, just outside the default frame: they show one zoom step out (1440 image) and in the 390 frame (B-148 fixed).", F16),
 P("B16", "Other pitches note", "Present", "Pin icon and “25 more pitches scored. They're the small markers on the map: pick one for its summary. The top 3 are kept 250 m apart.”"),
 P("B17", "Full details link", "Present", "“Full details →” on every row (accessible name “Full details for <pitch>”); opens the sheet.", F0203),
 P("B18", "Row and pin selected", "Different", "Picking row 2 moves the white card, orange offset and filled score cell to pitch 2; its pin gets aria-pressed and the caption; the summary stays. The rows and pins themselves differ from DS PitchRow and DS PitchPin (B12, B14).", "", "B-165, B-166"),
 P("B19", "Map legend", "Different", "One line along the bottom inside the map at 768 and 1440 (42 px): “Taste match” (two orange cells) · Top pitch · No busking · Other pitch, each a focusable key whose tooltip opens on hover and focus; no “test data” anywhere, tooltip included (B-145 fixed). At 390 it still wraps to two lines (74 px, “Other pitch” alone on line 2).", F0203, "B-137"),
 P("B20", "Zoom buttons", "Present", "+ / − (Zoom in, Zoom out, 44 px) top-right at 1440, 768 and 390. Separate fault, still open: the attribution button is 44 px inside a 24 px compact control, so its “i” icon tiles 2x2 at the bottom-right corner.", F0203, "B-136", spec="Not drawn on the plan boards; F02 keeps the map's zoom buttons (+ / −) on the plan map."),
 P("B21", "Weather strip", "Different", "“WEATHER”, “DRY THROUGH YOUR SLOT”, key, hours 10:00-16:00 with icon, big temperature, rain and wind; source “Open-Meteo forecast (CC BY 4.0)” (B-047 fixed). Differs from DS WeatherStrip: at 390 the DS keeps the hour columns side by side in a horizontally scrolling strip with the slot frame; the build stacks the hours as seven vertical rows. The DS source line also carries “updated <time>”.", "", "B-189"),
 P("B22", "Your slot frame", "Present", "One bordered, tinted frame around 12:00-14:00 with the orange “YOUR SLOT 12–15” tag, at 1440 and 390 (B-047 fixed)."),
 P("B23", "No forecast", "Present", "faults=weather: dashed cell, “No forecast for this slot”, “Weather is left out of the score.”", spec="When Open-Meteo has no forecast: dashed cloud cell, “No forecast for this slot”, “Weather is left out of the score.”"),
 P("B24", "Busk Map vs a plain AI", "Held", HELD + " Should become DS ComparePanel. Seen: title and the control line (“…sent to the test model (offline) with no tools and no data…never changes a score.”)."),
 P("B25", "Compare verdict", "Held", HELD + " Should become DS ComparePanel. Seen: “2 of Busk Map's 3 picks are one the plain AI didn't name; 1 is in both answers. The plain AI named 3 of Melbourne's usual busking pitches…”: the city is allowed here (the verdict is about that city's data).", F20),
 P("B26", "Both agree", "Held", HELD + " Should become DS ComparePanel with BothAgreeBadge. Seen (acoustic run): “BOTH AGREE (1)”, Federation Square 74, Both agree badge, “the plain AI named “Federation Square””."),
 P("B27", "Only Busk Map", "Held", HELD + " Should become DS ComparePanel with DiscoveryBadge. Seen: score cell, name, Hidden gem badge and evidence lines per pick."),
 P("B28", "Only plain AI", "Held", HELD + " Should become DS ComparePanel. Seen: “ONLY PLAIN AI (UNVERIFIED, NO DATA)” with Not a legal pitch / Scored by Busk Map / Usual pitch badges."),
 P("B29", "Plain AI setlist", "Held", HELD + " Should become DS ComparePanel. Seen: “Plain AI setlist: Wonderwall, Hallelujah, Riptide, Shallow”."),
 P("B30", "Compare loading and unavailable", "Held", HELD + " Should become DS ComparePanel (loading, unavailable). Source (compare-panel.tsx) has the skeletons and the unavailable line; not forced offline.", spec="Loading “Asking a plain AI the same question…” with skeletons; unavailable “The plain-AI baseline is unavailable right now. Busk Map's plan doesn't depend on it.”"),
 P("B31", "How we found your pitches", "Held", HELD + " Should become DS AgentStepStream. Seen: title, “8 CHECKS · 0 S”, Finished, Show raw data, cards newest first, Data used at the foot."),
 P("B32", "Feed meta", "Held", HELD + " Should become DS AgentStepStream header with Switch. Seen: mono checks · time, outlined Finished tag, Raw data switch."),
 P("B33", "Card: Your busk is ready", "Held", HELD + " Should become DS AgentStepStream card. Seen: check cell, title and “Three pitches, a setlist for each and the reasons, above.”"),
 P("B34", "Card: Songs worth learning", "Held", HELD + " Should become DS AgentStepStream card with LearnItMenu. Not called by the offline test model; its Learn it menu is checked in B35."),
 P("B35", "Learn it menu open", "Held", HELD + " Should become DS LearnItMenu. Seen from the sheet's Learn these: song and artist, Karaoke (YouTube), Chords (Ultimate Guitar), Lyrics (Genius) each “(opens in a new tab)” (target _blank, noopener noreferrer), and “Busk Map never shows lyrics or chords.”"),
 P("B36", "Card: compare two crowds", "Held", HELD + " Should become DS AgentStepStream card. Seen: “<pitch> or <pitch>?” with both pitches' genre cells (a missing one dashed)."),
 P("B37", "Card: setlist", "Held", HELD + " Should become DS AgentStepStream card (SetlistPanel rows). Seen: “Your setlist at …” with songs, years, affinity cells and fit scores."),
 P("B38", "Card: new pitches scored", "Held", HELD + " Should become DS AgentStepStream card with PitchRow. Not called offline."),
 P("B39", "Card: sent back", "Held", HELD + " Should become DS AgentStepStream card. Seen on the no-pitch run: “Sent back to check more”."),
 P("B40", "Card: the rules", "Held", HELD + " Should become DS AgentStepStream card. Seen: “The rules at Federation Square”, “Not ruled out for your permit”."),
 P("B41", "Card: busy places", "Held", HELD + " Should become DS AgentStepStream card. Not called offline."),
 P("B42", "Card: foot traffic", "Held", HELD + " Should become DS AgentStepStream card with EstimateLabel. Seen: “Foot traffic at Lincoln Square”, “≈144 people an hour est.”"),
 P("B43", "Card: events", "Held", HELD + " Should become DS AgentStepStream card. Not called offline (no events in the mock)."),
 P("B44", "Card: the crowd", "Held", HELD + " Should become DS AgentStepStream card (CrowdPanel parts). Seen: Artists this crowd likes, Sounds of this crowd and Evidence."),
 P("B45", "Card: where your crowd gathers", "Held", HELD + " Should become DS AgentStepStream card with TasteMap. Now has a framed mini taste map with numbered pins (B-103 fixed). Seen but not logged (held): offline the mini map has no streets, and its caption (the plan's pitch 1 name) is cut off at both sides at 1440 and 390 while the list's no. 1 is Lincoln Square.", F05),
 P("B46", "Card: best pitches so far", "Held", HELD + " Should become DS AgentStepStream card with PitchRow. Seen: the engine's first top 3 as pitch rows and the Evidence line."),
 P("B47", "Claude's line on a card", "Held", HELD + " Should become DS AgentStepStream note line. Seen: mono model tag (“TEST MODEL” offline) then its words."),
 P("B48", "Evidence tag", "Held", HELD + " Should become DS EvidenceLine. Seen: outlined “EVIDENCE” tag then the source in plain words."),
 P("B49", "Data used", "Different", "“DATA USED · Where every number on this page comes from.” with Qloo's logo linked to qloo.com (B-147 fixed); “City of Melbourne” only in source names (F20 allows). Differs from DS SourceAttribution and DS DataStatusBadge: the DS is one list, each source link and its line on the left and a boxed DataStatusBadge (dot, label, reason) on the right; the build is a two-column grid of tiles with the status as an inline dot and bold label under the source.", F0918 + " " + F20, "B-194"),
 P("B50", "Raw data on", "Present", "Switch on: Table / JSON toggle and a Raw block under each card."),
 P("B51", "Scores and rings", "Present", "Hex cells with rings filled to the score; missing values dashed with “–”."),
 P("B52", "Live plan data and nulls", "Present", "Nulls seen: no taste cells and no Taste key on no match; weather box on a weather outage; no zones key when none are drawn (source).", spec="Summary, pitches, others, heat, events, zones, weather, crowd, ageLean, event.tasteMatch, learn [] and compare verdict each read from the plan, with the stated null states."),
 P("B53", "Copy link URL", "Present", "The clipboard gets the short link http://…/p/<9-char id>."),
 P("B54", "Pitch details sheet", "Different", "720 px from the right at 1440; a bottom sheet with a grab handle at 390 (B-104 fixed); matches DS Sheet. But its folded score breakdown differs from DS ScoreBreakdown: the DS is a bordered card “How this score adds up” with the total ring, one row per factor with an icon, a sub-line and “× weight”, then bonus rows; the build is an unboxed “SCORE BREAKDOWN” list of hex rings with coloured squares and long factor names, no total, no icons, no sub-lines (see the score-breakdown images in the DS parity section).", "", "B-190"),
 P("B55", "Sheet: pitch head", "Different", "Rank tile, “PITCH 01”, Usual pitch badge, name, area line in mono caps (“FOOTPATH, GENERAL PERMIT”), 60 ring, as DS PitchCard; but the Usual pitch badge has a dot icon where DS DiscoveryBadge has a ringed target.", "", "B-188"),
 P("B56", "Sheet: why this crowd", "Present", "“WHY THIS CROWD”, “Explained by the test model (offline)”, chips (“Taste match 0.84 (Qloo)”, “5 busy places nearby”), then the origin lines."),
 P("B57", "Sheet: foot traffic by hour", "Different", "“FOOT TRAFFIC BY HOUR”, “930 /h est. in your slot”, 24-hour curve with the slot shaded, 00-23 axis and the sensor line. Differs from DS FootfallSparkline: the DS line is a 3 px ochre-brown line (dashed brown when estimated) over a tan fill; the build draws a thin black dotted line.", "", "B-191"),
 P("B58", "Sheet: facts", "Different", "Facts rows with icons: busy places open in your slot (with Qloo lines and distances), “20°, dry through your slot”, General permit pitch with the clearance warning and the never-confirms line; no event row offline. Missing: the council busking-rules link row (board “City of Melbourne busking rules ↗”).", "", "B-105 (partly fixed)"),
 P("B59", "Sheet: setlist", "Different", "“SETLIST FOR THIS PITCH”, pitch · best fit first, the Qloo age line, Copy, six songs with fit rings and the length line. Differs from DS SetlistPanel: the build adds a “How the order is worked out” fold under the subtitle, and at 390 moves Copy below that fold (the DS keeps Copy top-right beside the title at every width).", "", "B-169"),
 P("B60", "Sheet: learn these", "Present", "Orange-topped “LEARN THESE” with the ranking line, three songs and Learn it menus."),
 P("B61", "Sheet: crowd panel", "Different", "“WHO THIS CROWD LIKES” with Qloo's logo linked to qloo.com (new tab, noopener noreferrer) and its status (“Test data” offline in place of Live; an inline dot, not the boxed DS DataStatusBadge), What Qloo matched on, Artists this crowd likes, Your fans vs the usual crowd, Genres (B-147 fixed). Otherwise as DS CrowdPanel.", F0918, "B-194"),
 P("B62", "Sheet: who your fans are", "Different", "Eight full-width diverging lean bars with values (B-106 as filed is fixed). Differs from DS LeanBar: the DS LeanBar (and the board crop) is one inline line, “18–24 | −18 25–34 | +41 35–44 | +22 55+ | −30”, a short tick and the value per group; the build draws a bar chart, one row per group. (BRAND's earlier build issue called the ticks a fault; the DS now shows them: needs the user's call.)", "", "B-192"),
 P("B63", "Other pitch popover", "Different", "Browse other pitches opens “Piazza Italia 58 Hidden gem”, “Too close to … within 250 m …”, ‹ › stepping (1 of 25) and close, as the board. But DS OtherPitches (a folding list “Other scored pitches (N)” with rank cell, name, line, score and badges) is not used anywhere on the plan: the others are reachable only through the map dots and this popover.", "", "B-168"),
 P("B64", "Event popover", "Held", "held by DEV: no event diamonds on the plan map yet, so no event popover.", "", "B-113 (held by DEV)"),
 P("B65", "Sheet slides in", "Present", "Slides in from the right (from the bottom on phones) with a fade, 200 ms. Under reduced motion it still animates: see B71.", "", "B-107"),
 P("B66", "Tablet 768: busk first, research folded", "Different", "At 768: “Found from 768 data points · See the research ↓”, the busk first (map above the list), the research below. The “↓” in “See the research ↓” is a text glyph used as an icon (glyph rule).", "", "B-162"),
 P("B67", "Phone ≤720: layout", "Present", "Bottom nav fixed (Busks active), H1 40 px, map above the rows; “Your busk” starts at 500 px (was 871) (B-050 fixed)."),
 P("B68", "Phone: The research", "Present", "“The research” h2, funnel, Agent vs engine, then the feed with “Every check (8)” folded."),
 P("B69", "Night theme", "Different", "Night tokens throughout, axe clean, orange-only cells over the street tiles. But the night ramp's step 3 is #a8460f (renders #b15d2f at 0.85), a dark burnt orange: about half the cells read as the dark brown cells F05 removed, beside the bright step 4 (#ff7a2e).", F05, "B-183"),
 P("B70", "Focus ring", "Present", "One ring: pitch rows a 2 px box-shadow ring; buttons a 2 px outline 2 px outside (dark by day; at night orange against the dark ground, so default orange buttons like “Go to Busk Map home” and “Try again” now show focus) (B-134 fixed). Legend keys, Full details, Copy link, Raw data switch and Learn it all show it.", F1315, spec="Every interactive part shows the focus ring on :focus-visible; one ring, shadcn's pattern."),
 P("B71", "Reduced motion", "Different", "Global reduce rule zeroes transitions (new), but the sheet and its overlay still run tw-animate “enter” for 200 ms under prefers-reduced-motion: the motion-reduce:animate-none class is on them but loses to data-open:animate-in (measured: getAnimations() = enter 200 ms with matchMedia reduce true).", "", "B-107", spec="prefers-reduced-motion: every animation and transition at 0 ms."),
 # ---- R: researching
 P("R01", "Researching line", "Different", "“The test model is researching with Qloo and the other sources. Your busk replaces the research here in about half a minute.”; no Copy link while running (B-108 fixed). Differs from DS AgentStatusLine: the DS line is mono with a leading hex state cell (orange filled while running); the build line is muted sans with a small orange hex, not the DS cell.", "", "B-193"),
 P("R02", "Funnel while live", "Different", "Counts fill in; dashed “choosing pitches” cell last; cells joined by the “▸” glyph, not DS ResearchFunnel's half-cell connector.", "", "B-162"),
 P("R03", "Finding your best pitches", "Present", "“FINDING YOUR BEST PITCHES”, “8 CHECKS”, orange LIVE tag, no Raw data switch."),
 P("R04", "Running card", "Present", "Running card on top, dashed, ring loader, model line and skeleton lines (“Putting your busk together…”)."),
 P("R05", "Loaders", "Present", "Ring loader (motion-safe), skeletons; still under reduced motion."),
 P("R06", "Thinking card", "Present", "In source (agent-steps.tsx): dashed cell, breathing loader, “Thinking about what to check next” / “Reading your act, day and permit”; not held offline.", spec="Between tools: dashed cell, breathing loader, “Thinking about what to check next…”; before the first tool “Reading your act, day and permit”."),
 P("R07", "Leave note", "Present", "“You can leave this page: the research keeps going and your busk will be here when you're back.” under the cards."),
 P("R08", "Cards as they land", "Present", "Finished cards stack under the running one, newest first; the crowd-gathers card now has its mini map (card skin held with B24-B48)."),
 P("R09", "Data used so far", "Different", "“DATA USED SO FAR · Where every number on this page comes from.” with the sources (B-109 fixed). But every source, Qloo included, is marked “Live” while this run uses the local mock; the finished plan marks the same sources “Qloo test data (local mock)” / “Test data”.", "", "B-185"),
 P("R10", "Phone researching", "Present", "Bottom nav (Busks active), eyebrow wraps, researching line, funnel, then the feed; no chips stack above it."),
 # ---- Y: replay
 P("Y01", "Shared busk eyebrow", "Present", "“SHARED BUSK · SUN 18 OCT · 12–3 PM · GENERAL PERMIT”: no city (B-098 fixed).", F20),
 P("Y02", "Replay tags", "Present", "Chips plus “REPLAY OF AN EARLIER RUN (NO NEW MODEL CALL)”."),
 P("Y03", "Replay line", "Different", "“Researched at 4:01 am today. Opening it again shows that research: nothing new was asked.” (B-108 fixed; the time is the real clock, the export fakes noon). Differs from DS AgentStatusLine: the DS replay line is mono with a leading outline hex cell; the build is plain muted sans with no cell.", "", "B-193"),
 P("Y04", "Replay feed", "Present", "“Showing the research from earlier. Nothing new was asked.”, cards folded in “Every check, from earlier (8)”."),
 # ---- S: slot passed
 P("S01", "Slot passed notice", "Different", "Dashed clock cell, struck “SAT 3 OCT · 12–3 PM”, “THIS SLOT HAS PASSED”, Plan again for a new date; header “SHARED BUSK · SAT 3 OCT · 12–3 PM · PREMIUM PERMIT”. Differs from DS SlotPassed: the DS alone variant is a solid 2 px bordered card with a large display title (about 40 px at 390); the build is a thin dashed box with a small title.", "", "B-195"),
 P("S02", "Slot passed, nothing stored", "Different", "“There's no stored research for this busk. Plan again with the same act for a new date.”; no busk, no feed; no ISO date. Box and title differ from DS SlotPassed as in S01.", "", "B-195"),
 # ---- E: engine fallback (source)
 P("E01", "Ran out of time banner", "Present", "Not reachable offline. Source (plan-view.tsx): “<Claude> ran out of time, so these spots come straight from Busk Map's scores. The reasons are standard ones.” (B-049 fixed; the server log note in agent.ts still says “agent”, not shown)."),
 P("E02", "Engine summary", "Present", "From source: the engine's template summary; pitches badged “From the data”, “Found by <model>” only when the model added the spot."),
 P("E03", "Stopped cards and fallback note", "Present", "“Stopped before it finished.” (agent-steps.tsx) and the ran-out note above in brand words."),
 # ---- N: no legal pitch
 P("N01", "No-pitch header", "Different", "Eyebrow “FRI 16 OCT · 5–8 PM · GENERAL PERMIT”, H1, act line (F20 met). But a fallback alert above the panel says “The test model couldn't finish, so these spots come straight from Busk Map's scores. The reasons are standard ones.” on a page that has no spots.", F20, "B-184"),
 P("N02", "No legal pitch", "Present", "Panel: no-entry hex, “NO LEGAL PITCH FOR A GENERAL PERMIT ON FRIDAY NIGHT”, “The council's busking rules left no pitch for this slot…”, rules link (new tab) and “PICK ANOTHER DAY” (→ /busks). The general-permit button only shows for other permits (B-044 fixed)."),
 P("N03", "No-pitch feed", "Held", "held by DEV: 13 checks, eight “Sent back to check more” in a row (board: 2 checks).", "", "B-110 (held by DEV)"),
 # ---- M: no match
 P("M01", "No-match header", "Present", "Eyebrow without city; “Sounds like Zzyzx Nobody, Qqq Unknown”; orange “PICK YOUR ARTISTS FROM SPOTIFY” (B-045 fixed).", F20),
 P("M02", "Claude didn't research", "Present", "One alert: “Claude didn't research this busk: with no taste to go on there's nothing for it to check. Your spots come straight from the city's data.” (B-045, B-049 fixed)."),
 P("M03", "Qloo couldn't match", "Present", "“QLOO COULDN'T MATCH ANY OF YOUR ARTISTS · Taste is left out of this plan…”."),
 P("M04", "Busk without taste", "Present", "No taste cells (data-taste-cells 0) and the legend drops the Taste key: “Top pitch · No busking · Other pitch”; rows badged “From the data” (B-112 fixed).", F0203),
 # ---- Q: Qloo down
 P("Q01", "Qloo down layout", "Present", "Header, funnel (0 data points, choosing pitches), the stopped feed left and the panel right at 1440; stacked at 390 (B-043 fixed).", QCALL),
 P("Q02", "Feed stopped", "Present", "“HOW WE FOUND YOUR PITCHES · 0 CHECKS · STOPPED” with the error card “QLOO ISN'T ANSWERING · Without taste data there's nothing to plan from. Try again in a minute.” and TRY AGAIN.", QCALL),
 P("Q03", "No plan without taste data", "Different", "Panel: error hex, “NO PLAN WITHOUT TASTE DATA”, the reason, Qloo's logo linked to qloo.com, orange TRY AGAIN (not pressed) (B-043 fixed). Differs from DS DataStatusBadge: the status shows as an inline “■ Unavailable · not responding”; the DS badge is a small bordered box with dot, source, status and reason.", QCALL, "B-194"),
 # ---- D: source down
 P("D01", "Sensors didn't answer", "Present", "Warning alerts above the busk: “THE CITY'S PEDESTRIAN SENSORS DIDN'T ANSWER · Foot traffic at each pitch is estimated from busy places and events, and marked “est.”…”, plus Ticketmaster and weather, each with its Unavailable status (B-046 fixed)."),
 P("D02", "Failed check card", "Present", "Offline the foot-traffic tool absorbs the outage (“No sensor count near here · estimated…”); the error card is in source."),
 P("D03", "Source unavailable", "Present", "Data used: Pedestrian counts, Ticketmaster and Open-Meteo read “Unavailable: simulated outage (test)”."),
 # ---- L: run limit
 P("L01", "Run limit header", "Present", "Eyebrow “FRI 16 OCT · 5–8 PM · GENERAL PERMIT”, H1; no city.", F20),
 P("L02", "Plan limit reached", "Present", "Alert “PLAN LIMIT REACHED · You've started 5 plans this hour. Try again in about 45 minutes.”, “No new plan was started.” and “Back to Busk Map home” in signal text, 760 px column."),
 # ---- X: not found
 P("X01", "We can't find this busk", "Present", "Centred, no card (border 0, transparent): dashed pin hex, “WE CAN'T FIND THIS BUSK”, the muted line and an orange “GO TO BUSK MAP HOME →”; focus visible day and night (B-111, B-134 fixed). DEV's declared limit: /p/<unknown> answers HTTP 200 (Next's PPR shell commits before the page code runs); the page carries meta robots “noindex” (checked; it appears twice).", "", "— (HTTP 200: DEV's declared limit)"),
]
_ok = '<span class="chip ok">Fixed</span>'
SECTIONS = [
 ("new-defects", "New defects at f83f1a1", "<table><tr><th>Id</th><th>Sev</th><th>Rows</th><th>What differs</th></tr>"
  "<tr><td>B-183</td><td>Low</td><td>B69</td><td>Night map: the night ramp's step 3 (#a8460f, renders #b15d2f) is a dark burnt orange, so about half the plan map's cells read as the dark cells F05 removed; by day both steps are clearly orange. Needs the user's eye (F05: “orange cells only, both themes”).</td></tr>"
  "<tr><td>B-184</td><td>Low</td><td>N01</td><td>No legal pitch: the fallback alert “The test model couldn't finish, so these spots come straight from Busk Map's scores. The reasons are standard ones.” shows above “No legal pitch…”, where there are no spots.</td></tr>"
  "<tr><td>B-185</td><td>Low</td><td>R09</td><td>Data used so far (while running) marks every source “Live”, Qloo included, during an offline run on the mock; the finished plan marks the same sources “Qloo test data (local mock)” / “Test data”.</td></tr><tr><td>B-186</td><td>Low</td><td>B02</td><td>DS PageHeader: no “Busk Map home” link above the eyebrow; run status is a dot + bold sans line, not the DS outlined mono badges with icons.</td></tr><tr><td>B-187</td><td>Low</td><td>B05</td><td>DS CopyLinkButton: link (chain) icon where the DS (and board) use the copy icon.</td></tr><tr><td>B-165</td><td>Medium</td><td>B12, B18</td><td>DS PitchRow: build rows about twice as tall (22 px name over two lines, time on its own line, a full-width rule, sans “Full details →”); the DS row is one compact line with badges and mono caps underlined “FULL DETAILS →”.</td></tr><tr><td>B-188</td><td>Low</td><td>B12, B55</td><td>DS DiscoveryBadge: Usual pitch uses a dot icon; the DS uses a ringed-target icon.</td></tr><tr><td>B-166</td><td>Medium</td><td>B14</td><td>DS PitchPin: black hex with a white hex inside and a square rank badge; DS is a dark hex with orange ring and target dot and a hex rank badge; no Hidden gem (yellow diamond) pin variant.</td></tr><tr><td>B-189</td><td>Low</td><td>B21</td><td>DS WeatherStrip: at 390 the build stacks hours as vertical rows; the DS keeps columns in a horizontally scrolling strip; no “updated <time>” on the source line.</td></tr><tr><td>B-190</td><td>Medium</td><td>B54</td><td>DS ScoreBreakdown: build is an unboxed list with coloured squares and long factor names; DS is a bordered “How this score adds up” card with total ring, icons, sub-lines, × weights and bonus rows.</td></tr><tr><td>B-191</td><td>Low</td><td>B57</td><td>DS FootfallSparkline: thin black dotted line; DS is a 3 px ochre-brown line (dashed brown when estimated) on a tan fill.</td></tr><tr><td>B-169</td><td>Low</td><td>B59</td><td>DS SetlistPanel: extra “How the order is worked out” fold; at 390 Copy drops below it instead of sitting top-right.</td></tr><tr><td>B-192</td><td>Medium</td><td>B62</td><td>DS LeanBar: build draws eight full-width diverging bars; DS (and board) is one inline line of “group | tick value”. Conflicts with BRAND's earlier “bare ticks” issue: user's call.</td></tr><tr><td>B-168</td><td>Low</td><td>B63</td><td>DS OtherPitches (folding list of the other scored pitches) not used; others reachable only via map dots and the popover.</td></tr><tr><td>B-193</td><td>Low</td><td>R01, Y03</td><td>DS AgentStatusLine: build line is muted sans without the DS's leading hex state cell in mono.</td></tr><tr><td>B-194</td><td>Low</td><td>B49, Q03, B61</td><td>DS SourceAttribution / DataStatusBadge: build is a two-column tile grid with inline dot status; DS is one list with a boxed badge (dot, label, reason) on the right.</td></tr><tr><td>B-195</td><td>Low</td><td>S01, S02</td><td>DS SlotPassed: build is a thin dashed box with a small title; DS alone variant is a solid 2 px card with a large display title.</td></tr></table>"
  "<p>Glyph rule: the research funnel's “▸” connectors (B07, R02) and “See the research ↓” (B66) cite the shared B-162.</p><p>Still open at f83f1a1: B-107 (B71, B65), B-136 (B20), B-137 (B19), B-105 partly (B58). Held by DEV: B-110 (N03), B-113 (B64), B-130 (B01), feed and compare cards B24-B48.</p>"),
 ("cited", "Cited defects re-verified at f83f1a1", "<table><tr><th>Defect</th><th>Rows</th><th>Result</th></tr>"
  + "".join(f"<tr><td>{d}</td><td>{r}</td><td>{x}</td></tr>" for d, r, x in [
   ("B-043", "Q01-Q03", _ok + " “No plan without taste data” panel, Qloo logo, Unavailable, Try again, stopped feed beside it"),
   ("B-044", "N02", _ok + " no-pitch panel with Pick another day"), ("B-045", "M01, M02", _ok + " one alert, Pick your artists from Spotify"),
   ("B-046", "D01", _ok + " the board's warnings with their effect"), ("B-047", "B21, B22", _ok + " 10:00-16:00 with one Your slot frame (“updated” time not shown: trivial)"),
   ("B-048", "outline", _ok + " page outline h1 > h2 > h3 at every width; h4 subheads inside the held feed cards follow an h2"),
   ("B-049", "E01, E03, M02", _ok + " Claude / Busk Map's scores in the UI (source; fallback not reachable offline)"),
   ("B-050", "B02, B67, R10", _ok + " Your busk at 635 px (1440), 500 px (390), 362 px (768)"), ("B-051", "B07, B08", _ok + " unboxed funnel, compact tiles"),
   ("B-098", "B03, Y01, N01, L01, S01", _ok + " no city, no ISO date"), ("B-099", "B04", _ok), ("B-100", "B11", _ok),
   ("B-101", "B12, B18", _ok), ("B-102", "B14", _ok), ("B-103", "B45", _ok + " mini map (card itself held)"), ("B-104", "B54", _ok),
   ("B-105", "B55-B59", "Partly fixed: all sections as the board except the council-rules link row (B58)"), ("B-106", "B62", _ok),
   ("B-107", "B71, B65", "Open: sheet and overlay animate 200 ms under reduced motion"), ("B-108", "R01, Y03", _ok), ("B-109", "R09", _ok + " (status wording: B-185)"),
   ("B-110", "N03", "Held by DEV"), ("B-111", "X01", _ok), ("B-112", "M04", _ok), ("B-113", "B64", "Held by DEV"),
   ("B-134", "B70, X01, Q03", _ok + " 2 px outline 2 px outside; orange on the night ground"), ("B-136", "B20", "Open: “i” tiled 2x2"),
   ("B-137", "B19", "Open: 2 lines (74 px) at 390"), ("B-145", "B19", _ok + " tooltip has no “test data”"), ("B-146", "B10, B13", _ok + " by day; night step 3: B-183"),
   ("B-147", "B49, B61, Q03", _ok + " linked Qloo logo"), ("B-148", "B15", _ok + " hatched honeycomb cells")]) + "</table>"),
 ("ds-parity", "DS parity: plan components against BRAND's DS specimens (v62/v63)", "<table><tr><th>DS component</th><th>Rows</th><th>Result</th></tr>"
  + "".join(f"<tr><td>{a}</td><td>{b}</td><td>{c}</td></tr>" for a, b, c in [
   ("ResearchFunnel", "B07, R02", "Different: “▸” glyph connectors, not the half cell on its side (B-162)"), ("AgentVsEngine (README)", "B08", "Matches: check cell, label, title, line, compact tiles with rank, name, ring, check"),
   ("PageHeader", "B02", "Different (B-186)"), ("PlanMap", "B10", "Matches the layout (list beside map, stacked below 1024); map treatment per F05"),
   ("PitchRow", "B12, B18", "Different (B-165)"), ("PitchPin", "B14", "Different (B-166)"),
   ("TasteMapLegend", "B19", "The DS specimen is still the boxed 1-5 key; F03 overrides it (one line, tooltips). BRAND to update the specimen; not a build defect"),
   ("WeatherStrip", "B21, B22", "Different at 390 (B-189)"), ("ComparePanel", "B24-B30", "Held by DEV; differs today (section heads, name type, score cell placement)"),
   ("SetlistPanel", "B59", "Different (B-169)"), ("Sheet", "B54", "Matches (720 px right, bottom sheet with handle, orange top rule)"),
   ("PitchCard", "B55-B58", "Matches except the council-rules link row (B58, B-105)"), ("ScoreBreakdown", "B54", "Different (B-190)"),
   ("ScoreRing", "B51", "The plan uses the hex ring of DS PitchRow / PitchCard everywhere; the round DS ScoreRing is not used on this page"),
   ("LeanBar", "B62", "Different (B-192)"), ("FootfallSparkline", "B57", "Different (B-191)"), ("CrowdPanel", "B61", "Matches (head with Qloo logo and status, sections, evidence)"),
   ("OtherPitches", "B63", "Not used (B-168)"), ("AgentStepStream", "B31-B48, R03-R08", "Held by DEV (cards not re-skinned)"),
   ("AgentStatusLine", "R01, Y03", "Different (B-193)"), ("StepData", "B50", "Matches (key/value and table blocks, JSON toggle)"),
   ("PlanAlert", "D01, M02, N01, L02", "Matches"), ("UnmatchedAlert", "M03", "Matches"), ("SlotPassed", "S01, S02", "Different (B-195)"),
   ("PlanNotFound", "X01", "Matches"), ("CopyLinkButton", "B05, B06", "Different icon (B-187)"), ("DiscoveryBadge", "B12, B55", "Usual pitch icon differs (B-188)"),
   ("BothAgreeBadge", "B26", "Held with the compare panel; badge itself matches"), ("DataStatusBadge", "B49, Q03, B61", "Different (B-194)"), ("SourceAttribution", "B49", "Different (B-194)")]) + "</table>"
  '<p>Score breakdown, build at 1440 (left) and 390; compare DS ScoreBreakdown:</p><a href="../screens/honeycomb/plan/inv/v4/score-breakdown-1440.jpg"><img src="../screens/honeycomb/plan/inv/v4/score-breakdown-1440.jpg" alt="Score breakdown build 1440"></a>'
  '<p>DS ScoreBreakdown specimen:</p><a href="../screens/honeycomb/ds/ScoreBreakdown-light-390.jpg"><img src="../screens/honeycomb/ds/ScoreBreakdown-light-390.jpg" alt="DS ScoreBreakdown specimen"></a>'
  '<p>DS ResearchFunnel specimen (half-cell connectors):</p><a href="../screens/honeycomb/ds/ResearchFunnel-light-1440.jpg"><img src="../screens/honeycomb/ds/ResearchFunnel-light-1440.jpg" alt="DS ResearchFunnel specimen"></a>'),
 ("field-strip", "Field strip (F13, F14): plan page", '<p>/plan?example=acoustic at f83f1a1 (fields9): 19 fields, 18 pass; 74 states, 72 pass. The two fails are “≈612 people an hour est.” at 390, day and night: at 390 it sits in the folded “Every check” list (a hidden ancestor), so the strip could not focus it; with the fold open it shows one ring (v3 confirmed). Focus is visible.</p>'
  '<a href="../screens/honeycomb/plan/inv/v4/field-strip.jpg"><img src="../screens/honeycomb/plan/inv/v4/field-strip.jpg" alt="Plan field strip at f83f1a1"></a>'
  '<p>Default orange buttons focused at 390: “Go to Busk Map home” night, day; “Try again” night, day:</p><a href="../screens/honeycomb/plan/inv/v4/focus-default-btn.jpg"><img src="../screens/honeycomb/plan/inv/v4/focus-default-btn.jpg" alt="Default buttons focused, night and day"></a>'),
 ("map-calls", "Map against F02 / F03 / F05 / F16", "<table><tr><th>Call</th><th>Result</th><th>Evidence</th></tr>"
  "<tr><td>F02 Full details per pitch row</td><td>Met</td><td>“Full details →” on all three rows, 1440 and 390 (B12, B17).</td></tr>"
  "<tr><td>F02 keep zoom</td><td>Met</td><td>+ / − 44 px top-right (B20).</td></tr>"
  "<tr><td>F02 never “test data” in the legend</td><td>Met</td><td>Visible text and all four tooltips clean (B-145 fixed).</td></tr>"
  "<tr><td>F03 one-line legend along the bottom, tooltips</td><td>Met at 768/1440, not at 390</td><td>Inside the frame, 42 px, tooltips on hover and focus; 390 wraps to two lines (B-137).</td></tr>"
  "<tr><td>F05 orange cells only, zoomed out</td><td>Met by day; night for the user's eye</td><td>Two orange steps only, 354 cells, maxZoom 14.2 frame with padding 90. Night step 3 is dark burnt orange (B-183).</td></tr>"
  "<tr><td>F16 hatched no-busking cells</td><td>Met</td><td>Pink-hatched honeycomb cells from the plan's zone cells; offline only two, at Docklands, one zoom step out (B15).</td></tr></table>"
  '<p>Legend tooltip at 1440:</p><a href="../screens/honeycomb/plan/inv/v4/legend-tip-1440.jpg"><img src="../screens/honeycomb/plan/inv/v4/legend-tip-1440.jpg" alt="Legend tooltip at 1440"></a>'
  '<p>Night map at 1440:</p><a href="../screens/honeycomb/plan/inv/v4/map-night-1440.jpg"><img src="../screens/honeycomb/plan/inv/v4/map-night-1440.jpg" alt="Night plan map"></a>'
  '<p>Attribution corner (day 1440, 390, night 1440):</p><a href="../screens/honeycomb/plan/inv/v4/attrib.jpg"><img src="../screens/honeycomb/plan/inv/v4/attrib.jpg" alt="Map attribution icon tiled"></a>'),
 ("f20", "F20: city names on the plan page", "<table><tr><th>Where</th><th>Result</th></tr>"
  "<tr><td>Eyebrow (ready, shared, no pitch, no match, limit, slot passed)</td><td>No city (B03, Y01, N01, M01, L01, S01)</td></tr>"
  "<tr><td>Compare verdict “…3 of Melbourne's usual busking pitches…”</td><td>Allowed: that city's data (B25)</td></tr>"
  "<tr><td>Data used: “Pedestrian counts: City of Melbourne Open Data”, “Busking locations and zones: City of Melbourne”</td><td>Allowed: source names (B49)</td></tr>"
  "<tr><td>Example pitch names</td><td>Offline names are synthetic (“Footpath near Synthetic sensor: Queen Vic Market”, Centre Place): real places, no framing copy</td></tr>"
  "<tr><td>Any other “Melbourne” in visible text</td><td>None (text walk at 390 and 1440; the map's base tiles label the city)</td></tr></table>"),
 ("critique", "Impeccable critique (design review)", "<ol>"
  "<li><b>P1 · The busk doesn\'t use the design system\'s parts.</b> The funnel\'s “▸” glyphs, tall two-line pitch rows, a black-and-white pin, bar-chart lean bars and an unboxed score list are all off the DS specimens the user approved (B07, B12, B14, B62, B54; B-162, B-165, B-166, B-192, B-190).</li><li><b>P2 · The night map is two different colours of cell.</b> By day the field is calm orange; at night half the cells are a dark burnt orange beside bright orange, which reads as the old dark ramp (B69; B-183).</li>"
  "<li><b>P2 · The 390 legend still takes two lines.</b> On the phone the key wraps “Other pitch” onto its own line inside a 398 px map (B19; B-137).</li>"
  "<li><b>P2 · Motion ignores the reduce setting on the sheet.</b> Everything else is guarded, but the sheet still slides and fades (B71; B-107).</li>"
  "<li><b>P3 · Status words disagree.</b> While running, Data used so far says Live for test data; the no-pitch page talks about “these spots” (R09, N01; B-185, B-184).</li>"
  "<li><b>P3 · Small finish.</b> Tiled attribution “i” (B20; B-136); the council-rules link row missing in the sheet (B58; B-105); held feed cards still the old skin (B24-B48).</li></ol>"),
 ("audit", "Impeccable audit (technical)", "<table><tr><th>Check</th><th>Result</th></tr>"
  "<tr><td>axe (WCAG 2.2 AA tags): ready, Qloo down, no match, no pitch, not found, slot passed at 390 and 1440, day and night (24 runs)</td><td>0 violations</td></tr>"
  "<tr><td>Sideways scroll: ready, Qloo down, no match, no pitch, not found at 390 / 768 / 1440</td><td>None (scrollWidth = viewport)</td></tr>"
  "<tr><td>Heading outline</td><td>1440: h1 → h2 Agent vs engine → h2 Your busk → h3 Top pitches → h2 weather → h2 compare → h2 How we found → h4 (inside held feed cards) → h3 Data used. 390/768: h1 → h2 Your busk … h2 The research → h3 …</td></tr>"
  "<tr><td>Focus</td><td>Rows: 2 px box-shadow ring; buttons: 2 px outline at 2 px offset (dark by day, orange at night, visible on orange buttons). Sheet traps focus, Escape closes.</td></tr>"
  "<tr><td>Legend keys</td><td>Buttons; tooltips open on hover and keyboard focus; no “test data”.</td></tr>"
  "<tr><td>Bottom nav at 390</td><td>Fixed, Busks active; header nav from 721 px.</td></tr>"
  "<tr><td>Reduced motion</td><td>Global rule zeroes transitions; skeleton, fold and loaders guarded; sheet and overlay still run “enter” 200 ms (B-107).</td></tr>"
  "<tr><td>Not found</td><td>HTTP 200 (DEV's declared limit: PPR shell); meta robots noindex present (twice).</td></tr>"
  "<tr><td>Tips retired</td><td>No Tips nav item, no /tips link, no tip copy, no “Your tips” badge, no Tip log button on the plan (text and link walk at 390 and 1440).</td></tr>"
  "<tr><td>External links</td><td>Qloo logos (Data used, sheet crowd panel, Qloo down) and Learn it links: target _blank, rel noopener noreferrer.</td></tr></table>"),
 ("brand-issues", "BRAND's build issues (rechecked at f83f1a1)", "<table><tr><th>Issue</th><th>Result</th><th>Evidence</th></tr>"
  "<tr><td>The phone view never shows the bottom nav</td><td>Not reproduced</td><td>At 390 the bottom nav is fixed, visible, Busks active (B67, R10).</td></tr>"
  "<tr><td>NoMatch still draws a taste field and a “Taste match” legend</td><td>Not reproduced (fixed)</td><td>0 taste cells; legend “Top pitch · No busking · Other pitch” (M04).</td></tr>"
  "<tr><td>Fallback says “Found by Claude” when Claude ran out of time</td><td>Not reproduced (source)</td><td>Fallback rows read “From the data”; “Found by” only when the model added the spot (E02).</td></tr>"
  "<tr><td>Phone weather strip and pitch names cut off</td><td>Not reproduced</td><td>At 390 the hours stack as rows; names wrap; no sideways scroll (B21, B12).</td></tr>"
  "<tr><td>The sheet's lean bars render as bare ticks</td><td>Not reproduced (fixed)</td><td>Bars scaled to the biggest lean (B62).</td></tr>"
  "<tr><td>The nav says Setlist</td><td>Not reproduced</td><td>Nav is Busks · Week · Brain (B01; Repertoire held, B-130).</td></tr></table>"),
 ("v1-map", "v1 → v2 ids", "<p>P01→B02-B05 · P02→B07 · P03→B08/B09 · P04→B10-B12, B16-B18 · P05→B13-B15, B19, B20 · P06→B21-B23 · P07→B24-B30 · P08→B31-B32 · P09→B33-B48 · P10→B49 · P11→B54-B62 · P12→B63 · P13→B50 · P14→R01-R10 · P15→E01-E03 · P16→Y01-Y04 · P17→Q01-Q03 · P18→M01-M04 · P19→N01-N03 · P20→D01-D03 · P21→S01-S02 · P22→L01-L02 · P23→X01 · P24→B67 · P25→B69 · P26→B70.</p>"),
]

# Impeccable critique and audit: generated from the skill's own outputs in qa/impeccable/ (see impeccable_sections.py).
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from impeccable_sections import impeccable as _imp
from impeccable_synthesis import SYN as _SYN
_i = next(i for i, s in enumerate(SECTIONS) if s[0] == "critique")
SECTIONS = [s for s in SECTIONS if s[0] not in ("critique", "audit")]
SECTIONS[_i:_i] = _imp("plan", _SYN["plan"])

CHANGES = CHANGES + " The impeccable critique and audit were run for real this round (skill v4.4.0, dual-agent, at f83f1a1, 390/768/1440; provenance at the top of both sections), replacing v3's hand-written sections. New from impeccable, verified by QA: B-219 (High: 1,848 px of blank scroll after the footer at 390), B-227 (the map takes vertical swipes on a phone), B-231."
READY = (READY[0], READY[1] + ' Impeccable adds B-219 (High) and B-227.')
