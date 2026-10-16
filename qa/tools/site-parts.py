# Site-wide · review: header, phone nav, footer and the cross-page calls (F07-F15). Data for qa/tools/page-review.py.
TITLE = "Site-wide · review"
ROUTE = "every page (/, /busks, /week, /brain, /tips, /brand, /p/…, 404)"
VERSION = "v1"
COMMIT = "7b1521e"
DATE = "17 Oct 2026"
IMG = "honeycomb/site/"
CHANGES = "First version: header, phone nav, footer, logos, Qloo links, /terms, field focus on 8 routes (534 field states), the user's calls F07-F15."
HISTORY = [(VERSION, COMMIT, DATE, CHANGES)]
SOURCE_NOTE = "Deck: BRAND's landing crops (L01 header, L26 phone nav, L25 footer); the user's calls override them. Build: QA's own export, 8 routes, day and night."
def P(id, name, qa, note, user="", defect="—", dev="building", deck=None, b1440=None, b390=None):
    return {"id": id, "name": name, "qa": qa, "note": note, "user": user, "defect": defect, "dev": dev, "deck": deck, "b1440": b1440, "b390": b390}
PARTS = [
 P("S01", "Header (from 721 px)", "Present", "Lockup, Busks · Week · Brain · Tips; the current page is marked (aria-current) on every route; skip link to #main on every page.", "F12: the wordmark is the only logo (no lockup).", deck="deck/S01.jpg", b1440="build/header-busks-1440-day.jpg", b390="build/header-busks-390-day.jpg", dev="built"),
 P("S02", "Bottom nav (up to 720 px)", "Present", "Same four items with the current one marked; only one “Main” nav is visible at each width.", deck="deck/S02.jpg", b390="build/mobilenav-busks-day.jpg", b1440="build/header-brain-1440-day.jpg", dev="built"),
 P("S03", "Footer", "Present", "As the board on every route (lockup, Taste data by Qloo · MIT, Open source repo text, Built by, the legal line).", "F11: left the wordmark and the Qloo logo; centre Privacy · Brain · Brand; right GitHub and Built by.", deck="deck/S03.jpg", b1440="build/footer-busks-1440-day.jpg", b390="build/footer-busks-390-day.jpg"),
 P("S04", "One logo (F12)", "Different", "Three Busk Map logo designs in use: the lockup in every header and footer, and the mark on / (by SVG viewBox).", "F12: the busk-map wordmark (dark and light) is the ONLY logo.", b1440="build/header-home-1440-day.jpg", b390="build/footer-home-390-day.jpg"),
 P("S05", "Qloo logo links (F09)", "Missing", "No Qloo logo on any of the 9 routes is a link.", "F09: every Qloo logo links to qloo.com in a new tab (rel=\"noopener noreferrer\").", b1440="build/footer-brain-1440-day.jpg"),
 P("S06", "/terms and the legal line (F10)", "Missing", "/terms is 404; the legal line is still in every footer.", "F10: the legal line moves to /terms, linked from the footer.", b1440="build/footer-tips-1440-day.jpg"),
 P("S07", "GitHub (F07)", "Missing", "Still the “OPEN SOURCE github.com/T04435/busk-map” text link.", "F07: a GitHub icon in a honeycomb cell, linked.", b1440="build/footer-week-1440-day.jpg"),
 P("S08", "Built by + mark (F08)", "Missing", "“Built by T04435 (solo), with Claude, …” text; no pixel mark.", "F08: “Built by T04435” plus the pixel mark (an SVG of the Claude Code critter, not the Claude logo), each linked.", b1440="build/footer-plan-1440-day.jpg"),
 P("S09", "Field focus and borders (F13, F14)", "Broken", "514 of 534 field states fail on 8 routes: every focused field shows two ring layers. Cause: globals.css:352-355 sets :focus-visible { box-shadow: var(--focus-ring) } for everything, and --focus-ring (globals.css:200-214) is two shadows, a 2 px paper gap plus a 4 px ring. The Spotify searches on /busks are also a box in a box.", "F13, F14: one border and one ring, shadcn's own pattern.", b1440="build/header-tips-1440-night.jpg"),
 P("S10", "shadcn primitives (F15)", "Different", "The global :focus-visible rule overrides every primitive's own focus state, and a separate --focus-ring/.bm-poster system replaces shadcn's ring utilities. That is the global-CSS-over-primitive-states pattern F15 rules out.", "F15: shadcn/ui primitives styled through tokens and variants; no global CSS overriding their states."),
 P("S11", "Night theme of header, nav and footer", "Present", "Header and nav unchanged (already night); footer switches to night where it sits on paper.", b1440="build/footer-busks-1440-night.jpg", b390="build/footer-busks-390-night.jpg", dev="built"),
]
import json, pathlib
counts = """<table><tr><th>Route</th><th>Field states</th><th>Fail</th><th>Two or more rings when focused</th><th>No ring on the element</th></tr>
<tr><td>/busks</td><td>76</td><td>76</td><td>56</td><td>20 (radio items; the card shows the focus, see Busks B-041)</td></tr>
<tr><td>/tips</td><td>40</td><td>40</td><td>40</td><td>0</td></tr><tr><td>/week</td><td>124</td><td>124</td><td>124</td><td>0</td></tr>
<tr><td>/</td><td>28</td><td>24</td><td>24</td><td>0</td></tr><tr><td>/brain</td><td>152</td><td>152</td><td>152</td><td>0</td></tr>
<tr><td>/p/… (plan)</td><td>60</td><td>44</td><td>37</td><td>7</td></tr><tr><td>/brand</td><td>46</td><td>46</td><td>38</td><td>8</td></tr>
<tr><td>404</td><td>8</td><td>8</td><td>8</td><td>0</td></tr><tr><th>Total</th><th>534</th><th>514</th><th></th><th></th></tr></table>
<p>States = each field × day/night × 390/1440. Tool: <code>qa/tools/field-strip.mjs</code> (per-page strips are in each page's report, e.g. Busks · review).</p>"""
SECTIONS = [
 ("fields", "Field focus on every page (F13, F14)", counts),
 ("checks", "Site checks (qa/tools/site-checks.mjs) at 7b1521e", "<ul><li>F09 Qloo links: fail on all 9 routes (no link).</li><li>F10: /terms 404; the legal line in every footer.</li><li>F12: lockup on every route, mark on /.</li><li>F07, F08, F11: footer unchanged.</li><li>Active nav item and skip link: pass on all 8 routes.</li></ul>"),
 ("audit", "Impeccable audit (site-wide)", "<ol><li><b>P1 · Focus is drawn twice everywhere</b> (S09): one global rule, so one fix. It also hides shadcn's ring utilities (S10, F15).</li><li><b>P2 · Three logos</b> (S04, F12).</li><li><b>P2 · The legal line is footer fine print on every page</b> (S06, F10): it belongs on /terms, linked.</li><li><b>P3 · Qloo's logo is a dead image</b> where the user expects a link (S05, F09).</li><li>Landmarks: one “Main” nav visible at each width; skip link everywhere; header nav marks the current page. No change needed.</li></ol>"),
]
