"""Builds qa/reports/honeycomb-landing-recheck.html on design/honeycomb. Run: python3 -I hc-recheck.py <out.html>"""
import html, sys
BOARD = "../screens/honeycomb/recheck/board/"
BUILD = "../screens/honeycomb/recheck/v6/"
DECK = "../screens/honeycomb/landing/"   # QA's own deck renders per width, from the 17 Oct audit (same v62 board)
# part, name, deck render id (per width) or None, build image key (per width; {w} filled), status, dev claim, finding, lost_at, defect
P = [
 ('L01', 'Header', 'header', 'L01-{w}', 'Present', 'built', "The lockup [hex mark][new stencil wordmark] as an image, 36 px tall; the P's orange offset is no longer clipped (B-135 fixed at f83f1a1, BRAND's new files). Nav Busks · Week · Brain, none active; no Tips item. The header nav now starts at 721 px (B-129 fixed). DS AppHeader and Logo: matches (night bar, orange rule, lockup, mono nav with icons); the DS's mark-only Logo on phones is overruled by the user's F12.", None, None),
 ('L02', 'Hero band', 'hero-ground', 'L02-{w}', 'Present', 'built', 'Night band, dot grain, hex lattice and the 6px orange rule. The taste map now fills the right half edge to edge (F19).', None, None),
 ('L03', 'Glowing honeycomb cells', 'hero-ground', 'L03-{w}', 'Present', 'built', '104 glowing cells (lp-glow running on 104 elements), top-right corner and bottom band; the small texts beside them stay gone (user call).', None, None),
 ('L04', 'Hero headline', 'headline', 'L04-{w}', 'Present', 'deviation', 'Three-line headline; “What to play.” in signal orange, never wraps at 1440.', None, None),
 ('L05', 'Hero taste map', 'hero-map', 'L05-{w}', 'Held', 'held', "Held by DEV (zone, event, river and the low-taste cells). Built at f83f1a1: the map fills the hero's right half edge to edge (F19, no framed rectangle) and all three pitches are numbered pins 1, 2, 3 (no unnumbered gem). Held: no hatched zone, event diamond or river; dark low-taste cells still drawn (568 of 783 cells are the darkest fill). At 390 and 768 the map now sits above the headline (see L27). DS TasteMap: the hero pins are plain dark hexes with a large numeral, not DS PitchPin ring pins with a number tab, and there is no legend; held with the rest of L05 (no new defect).", 'held by DEV', None),
 ('L06', 'Map fill-in and pin drop', 'hero-map', 'L05-{w}', 'Present', 'built', '780 cells fill in (hc-cell-in), then the 3 pins drop (hc-pin-in), all done by 5 s; under reduced motion the finished map shows with 0 running animations.', None, None),
 ('L07', 'Map caption', 'hero-map', 'L05-{w}', 'Present', 'deviation', "No caption, by the user's call. Nothing else under the map.", None, None),
 ('L08', 'Hero CTA', 'hero-cta', 'L08-{w}-focus', 'Present', 'built', 'Button poster variant, size poster-lg: 76 px tall at 390, 768 and 1440 (B-139 fixed), orange, 2px cream edge, 6px cream shadow, 34px Big Shoulders; focused: 3px orange outline 10px out, visible beside the shadow (screenshot is focused). DS Button: the DS specimen shows no poster variant to compare; the arrow is an icon, not a glyph.', None, None),
 ('L09', 'In partnership with Qloo', 'partner', 'L09-{w}', 'Present', 'built', "Purple words and the Qloo wordmark, centred across the hero; the wordmark links to qloo.com in a new tab (F09). At 1440 the wordmark now sits over the full-bleed map's dark cells, still legible. DS QlooWordmark: matches (paper letters, purple bar).", None, None),
 ('L10', 'Ticker band', 'ticker', 'L10-{w}', 'Present', 'built', 'Six phrases, rolling (hc-roll); still under reduced motion.', None, None),
 ('L11', 'Demo video slot', 'video', 'L11-{w}', 'Present', 'deviation', 'Placeholder slot: orange hex with a play triangle (F22 done), “[Demo video · 60–90 s]” and the line, no media, no controls.', None, None),
 ('L12', '“Try an act” heading', 'try', 'L12-{w}', 'Present', 'built', 'Second sentence in signal text.', None, None),
 ('L13', 'Act cards ×3', 'try', 'L13-{w}', 'Different', 'deviation', "Kept as built by the user's call: filled “SA” hex, dark action row, the app's Plays lists (B-032 accepted). Keyboard focus is BRAND's one 2px ring with no gap (f83f1a1 ring sentence), so on the card's 2px dark border it reads as a thicker border. DS parity: differs from DS ExampleActCard, a compact one-row card (orange hex initials, name, one-line blurb, mono “Sounds like”, arrow at the right; no day · hours, no Plays line, no ruled action row). This conflicts with the user's earlier keep call, so the user must choose.", 'user call: keep', 'B-032 · B-163'),
 ('L14', '“Busking is guesswork” heading', 'guesswork', 'L14-{w}', 'Present', 'built', '“guesswork” in signal text; no Example data badge (F01).', None, None),
 ('L15', 'Problem cards ×4', 'guesswork', 'L15-{w}', 'Present', 'built', 'Copy as the board.', None, None),
 ('L16', '“What you get back” heading', 'get-funnel', 'L16-{w}', 'Present', 'built', 'Heading only; no Example data badge (F01).', None, None),
 ('L17', 'Research funnel', 'get-funnel', 'L17-{w}', 'Different', 'deviation', "Funnel as the board: 412 taste cells › 1 crowd › 4 places › 1 event › 2 sensors › 37 rules › 36 scored › 3 songs › 496 data points › 3 pitches; one row at 1440. DS parity: differs from DS ResearchFunnel: the cells are joined by “▸” text glyphs, not half a honeycomb cell turned on its side (B-162); the counts are set in Big Shoulders, larger than the DS's small sans numerals in 30 px cells.", None, 'B-162 · B-164'),
 ('L18', 'Your busk (PlanMap)', 'get-map', 'L18-{w}', 'Different', 'deviation', "F02, F03, F05 hold: “Full details” per pitch row, zoom kept, no “test data”, orange cells only, zoomed out. Fixed at f83f1a1: the legend is one line at 390 too (Taste match · 1 Top pitch · Other pitch, 42 px at every width; B-137 fixed); the map now fills its column (1440: 667 px frame in a 699 px column; B-141 fixed); every pitch a numbered pin. Left: the attribution “i” still tiles 2×2 and clips bottom right at every width (B-136). No zone, river or event (held, L05). DS parity: differs from DS PitchRow (DS: [rank] [NAME @ time] [score] on one line, badges and mono caps “FULL DETAILS” under it; build: name and “@ 12–3 pm” on two lines, a rule, then badges and sans “Full details”) (B-165); from DS PitchPin (DS: hex with an orange ring around a paper dot plus a number tab; build: dark hex with a white hex centre) (B-166); from DS TasteMapLegend (DS: boxed legend, “TASTE MATCH” eyebrow, 1–5 ramp with LOW/HIGH, then symbols; build: one-line bar, the user's F03 call) (B-167, user to choose); from DS PlanMap (DS: “N more pitches scored…” line under the list; build: a “Browse other pitches (2)” button on the map) (B-168).", 'DEV deviation (declared)', 'B-136 · B-165 · B-166 · B-167 · B-168'),
 ('L19', '“And what to play there”', 'get-setlist', 'L19-{w}', 'Present', 'built', 'Heading and paragraph as the board.', None, None),
 ('L20', 'Setlist panel', 'get-setlist', 'L20-{w}', 'Different', 'built', '“Setlist for this pitch”, Copy, rows 01–04, mono set length, bordered Learn these with the orange rule. DS parity: differs from DS SetlistPanel: the subtitle is a method paragraph (DS: “Southbank Promenade · Sun 12–3 pm · best fit first”); “LEARN THESE” is mono caps (DS: Big Shoulders title); the Copy button label is mono (DS: bold sans).', None, 'B-169'),
 ('L21', 'Beyond buskers', 'beyond', 'L21-{w}', 'Present', 'built', 'Directly after What you get back, before the Brain teaser (F06) at 390, 768 and 1440.', None, None),
 ('L22', 'Brain teaser', 'brain', 'L22-{w}', 'Different', 'built', 'After Beyond buskers, before Brand (F06). 11 · 24–33 · 0, purple button, wiring sketch; the “Powered by” Qloo wordmark links to qloo.com (F09). DS parity: the numbers differ from DS StatStrip (DS tone qloo: a framed, ruled strip of cells, purple number above its label; build: inline number beside a mono label, no cells); “Open the brain →” uses a text arrow (B-162).', None, 'B-162 · B-170'),
 ('L23', 'Brand teaser', 'brand-teaser', 'L23-{w}', 'Different', 'held', "Last of the three (F06). “Honeycomb”, line, “See the brand →” (one of the page's 2 /brand links). The numbers now read 72 components · 3 typefaces · 21 assets, counted from /brand's own lists (f83f1a1; the board's 90 and 9 were hard-coded). The specimen card still has no app icon: it starts at hex cell 1, then 91 (board: app icon, 1, 91). DS parity: the numbers differ from DS StatStrip (DS: framed, ruled cells, number above label; build: inline) (B-170); “See the brand →” uses a text arrow (B-162).", None, 'B-140 · B-162 · B-170'),
 ('L24', 'Closing CTA', 'cta', 'L24-{w}', 'Present', 'built', "No credit line (F04). The button is the poster variant at size poster: 64 px tall at 390, 768 and 1440 (B-139 fixed), “PLAN A BUSK” in 24px Big Shoulders capitals with the cream poster shadow (the board's sans “Plan a busk” predates the poster variant, F13–F15). DS Button: no poster variant in the DS specimen to compare; arrow-free label.", None, None),
 ('L25', 'Footer', 'footer', 'L25-{w}', 'Present', 'built', "F07–F11 layout: left lockup “with” Qloo; centre Privacy · Terms · Brain · Brand; right GitHub in a hex cell, “Built by” (plain text) T04435 (link) and the critter (to claude.com/claude-code, new tab). No legal line (on /terms). Stacks cleanly at 390. DS SiteFooter: the DS specimen is the pre-F07–F11 footer (legal line, “Open source” text); the user's F07–F11 calls win, so no DS defect.", None, None),
 ('L26', 'Bottom nav (phone)', 'header', 'L26-{w}', 'Present', 'built', "Bottom nav Busks · Week · Brain at 390 (no Tips). Shown up to 720 px; from 721 the header nav shows and the bar hides (checked at 720, 721, 767, 768; B-129 fixed). DS MobileNav: matches (icons over mono caps labels, card bar); items follow the user's Tips removal.", None, None),
 ('L27', 'Phone layout', 'full', 'full-{w}', 'Different', 'built', 'No sideways scroll at 390, 768 or 1440, day and night; cards one per row; What you get back rows stack. But the hero now stacks map, headline, CTA at 390 and 768 (the full-bleed map moved above the headline); the board stacks headline, map, CTA.', None, 'B-171'),
 ('L28', 'Reduced motion', 'full', 'motion-{w}', 'Present', 'built', 'Reduced motion: glow and ticker still, finished map; 0 running animations at 390, 768 and 1440; transitions 0 ms (f83f1a1 global rule).', None, None),
 ('L29', 'Night theme', 'night', 'night-{w}', 'Present', 'built', 'Night theme: paper sections switch; night bands unchanged; axe clean at 390 and 1440.', None, None),
]
COL = {"Present":"ok","Different":"warn","Missing":"bad","Broken":"bad","Held":"held"}
ORDER = ["Present","Different","Missing","Broken","Held"]
counts = {s: sum(1 for p in P if p[4]==s) for s in ORDER}
claim = {"built":"DEV: built","deviation":"DEV: deviation","held":"DEV: held"}
rows=[]
for pid,name,deck,build,status,dc,find,lost,defect in P:
    prob = status in ("Different","Missing","Broken")
    cells=[]
    for w in ["390","768","1440"]:
        left = f'<a href="{BOARD}{pid}.jpg"><img loading="lazy" src="{BOARD}{pid}.jpg" alt="Board crop {pid}"></a>'
        if deck: left += f'<a href="{DECK}{deck}-{w}-deck.jpg"><img loading="lazy" src="{DECK}{deck}-{w}-deck.jpg" alt="Deck render {pid} at {w}px"></a>'
        if build and not (pid=="L26" and w!="390"):
            f = build.format(w=w)
            right = f'<a href="{BUILD}{f}.jpg"><img loading="lazy" src="{BUILD}{f}.jpg" alt="Build {pid} at {w}px"></a>'
        elif pid=="L26":
            right = '<div class="ph soft">Above 720 px the header nav shows instead (see L01).</div>'
        else:
            right = '<div class="ph">Not in the build</div>'
        gap = f'<span class="gaplbl">gap: {html.escape(find)}</span>' if prob else ""
        cells.append(f'<div class="w w{w}"><figure><figcaption>Design · BRAND crop + deck at {w}</figcaption>{left}</figure>'
                     f'<figure class="{"gap" if prob else ""}"><figcaption>Build 91b220e · {w}</figcaption>{gap}{right}</figure></div>')
    tags = f'<span class="chip {COL[status]}">{status}</span><span class="claim">{claim[dc]}</span><span class="qa">☑ QA</span>'
    if lost: tags += f'<span class="lost">lost at: {html.escape(lost)}</span>'
    if defect: tags += f'<span class="def">{defect}</span>'
    rows.append(f'<article class="row" data-status="{status}"><header><span class="n">{pid}</span><h2>{html.escape(name)}</h2>{tags}</header><p class="cap">{html.escape(find)}</p>{"".join(cells)}</article>')
FIXES = [
 "DEV: a part is “built” only when its crop matches at 390, 768 and 1440 side by side; any visible difference (L13, L17, L20) is a declared deviation, not a note.",
 "DEV: when a real component replaces a drawn one (ResearchFunnel, SetlistPanel), either restyle it to the board or list each visual difference in the fix report.",
 "BRAND: the board's act-card copy (SX, Plays lists) should come from src/lib/examples.ts, so board and build can't drift.",
 "QA: the checklist README lives in the hackathon folder, which QA must not edit; MANAGER or BRAND copies the ☑ QA column from this report.",
 "All: port dev/core fixes that change shared behaviour (the evening slot, e220abd) to design/honeycomb in the same round, so a recheck doesn't trip on a known bug.",
]
STYLE = open(sys.argv[2]).read()
page = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>QA-03 · Landing recheck</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;800&display=swap" rel="stylesheet">
<style>{STYLE}</style></head>
<body data-w="1440"><div class="wrap">
<h1>QA-03 · Landing / recheck · 29 parts · board vs build</h1>
<p class="sub"><b>QA-03</b> · branch design/honeycomb · commit tested 91b220e. Cite a finding as “QA-03 L13”. design/honeycomb at 91b220e (DEV's fixes d169cb4..91b220e), clean export, offline on QA's port. Left: BRAND's crop of the v62 Main board, then QA's render of the same board at that width. Right: the build. DEV's claim beside each verdict; red boxes mark undeclared or open gaps. QA[busk-map], 16 Oct 2026.</p>
<div class="strip" role="group" aria-label="Summary and view">
<span class="stat ok">{counts["Present"]} Present</span><span class="stat warn">{counts["Different"]} Different</span><span class="stat bad">{counts["Missing"]} Missing</span><span class="stat bad">{counts["Broken"]} Broken</span><span class="stat held">{counts["Held"]} Held</span>
<button class="filter" type="button" aria-pressed="false" id="flt">Problems only</button>
<span class="tabs" role="group" aria-label="Width"><button type="button" data-w="390" aria-pressed="false">390</button><button type="button" data-w="768" aria-pressed="false">768</button><button type="button" data-w="1440" aria-pressed="true">1440</button></span>
</div>
<section class="note"><h2>Also checked</h2><ul>
<li>B-018, B-021 (glow), B-022, B-023, B-024 and B-025: fixed and verified. B-020: fixed with the deviations in L17, L18 and L20.</li>
<li>The sax example (Friday 5–8 pm) opened at 20:53 shows “This slot has passed”: the known evening-slot bug, fixed on dev/core in e220abd and being ported. Not a new defect.</li>
<li>DEV's claim of 21 built, 6 deviations and 2 held: QA finds 20 Present, 6 Different, 1 Missing (L11, the accepted video deviation) and 2 Held. L20, which DEV marks built, differs from its crop; L13 and L17 differ beyond what DEV declared.</li>
</ul></section>
{"".join(rows)}
<section class="fixes"><h2>Process fixes</h2><ul>{"".join(f"<li>{html.escape(f)}</li>" for f in FIXES)}</ul></section>
</div>
<script>
const b=document.body;
document.querySelectorAll('.tabs button').forEach(t=>t.addEventListener('click',()=>{{b.dataset.w=t.dataset.w;document.querySelectorAll('.tabs button').forEach(x=>x.setAttribute('aria-pressed',String(x===t)));}}));
const f=document.getElementById('flt');f.addEventListener('click',()=>{{const on=!b.classList.contains('problems');b.classList.toggle('problems',on);f.setAttribute('aria-pressed',String(on));}});
</script></body></html>'''
open(sys.argv[1],"w").write(page)
print(counts)
