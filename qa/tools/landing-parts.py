"""Builds qa/reports/honeycomb-landing-recheck.html on design/honeycomb. Run: python3 -I hc-recheck.py <out.html>"""
import html, sys
BOARD = "../screens/honeycomb/recheck/board/"
BUILD = "../screens/honeycomb/recheck/v5/"
DECK = "../screens/honeycomb/landing/"   # QA's own deck renders per width, from the 17 Oct audit (same v62 board)
# part, name, deck render id (per width) or None, build image key (per width; {w} filled), status, dev claim, finding, lost_at, defect
P = [
 ('L01', 'Header', 'header', 'L01-{w}', 'Present', 'built', "The lockup [hex mark][new stencil wordmark] as an image, 36 px tall, letters all one height as in the user's reference (F12 corrected: fixed). Nav Busks · Week · Brain · Tips, none active. The header nav starts at 768 px, not 721 (B-129, tracked on L26).", None, None),
 ("L02","Hero band","hero-ground","L02-{w}","Present","built","Night band, dot grain, hex lattice and the 6px orange rule.",None,None),
 ('L03', 'Glowing honeycomb cells', 'hero-ground', 'L03-{w}', 'Present', 'built', 'Glowing cells as the board; the small texts beside them stay gone (user call).', None, None),
 ('L04', 'Hero headline', 'headline', 'L04-{w}', 'Present', 'deviation', 'Three-line headline; “What to play.” never wraps at 1440.', None, None),
 ("L05","Hero taste map","hero-map","L05-{w}","Held","held","Unchanged since v4: a separate SVG (HeroTasteMap), not the app's map. Still has the dark cells F05 removes (DEV's declared deviation: asking the user if F05 covers the hero). Pins 1 and 3 plus an unnumbered gem diamond; no hatched zone, event or river; a framed rectangle, not full-bleed (round 2 F16/F19 not built yet).","held for the user",None),
 ("L06","Map fill-in and pin drop","hero-map","L05-{w}","Present","built","Cells fill in and pins drop; under reduced motion the finished map shows with 0 running animations.",None,None),
 ('L07', 'Map caption', 'hero-map', 'L05-{w}', 'Present', 'deviation', "No caption, by the user's call. Nothing else under the map.", None, None),
 ("L08","Hero CTA","hero-cta","L08-{w}-focus","Different","built","Now the Button poster variant: orange, cream 2px edge, 6px cream shadow, 34px Big Shoulders, and a 3px orange focus outline 10px out (visible beside the shadow; screenshot is focused). But it renders 44 px tall at 390, 768 and 1440 (board and v4: 76 px): the default size's h-control wins over the h-19 class.",None,"B-139"),
 ("L09","In partnership with Qloo","partner","L09-{w}","Present","built","Purple words and the Qloo wordmark, centred; the wordmark now links to qloo.com in a new tab (F09).",None,None),
 ("L10","Ticker band","ticker","L10-{w}","Present","built","Six phrases, rolling; still under reduced motion.",None,None),
 ('L11', 'Demo video slot', 'video', 'L11-{w}', 'Different', 'deviation', 'Placeholder slot as before: orange hex, “[Demo video · 60–90 s]” and the line, no media, no controls. The hex still holds an arrow; round 2 F22 asks for a play triangle (not built yet).', None, None),
 ("L12","“Try an act” heading","try","L12-{w}","Present","built","Second sentence in signal text.",None,None),
 ('L13', 'Act cards ×3', 'try', 'L13-{w}', 'Different', 'deviation', "Kept as built by the user's call: filled “SA” hex, dark action row, the app's Plays lists (B-032 accepted). Keyboard focus is a 2px dark ring right against the 2px dark border, so it reads as a thicker border (DEV's one-ring fallback, asking BRAND).", 'user call: keep', 'B-032'),
 ("L14","“Busking is guesswork” heading","guesswork","L14-{w}","Present","built","“guesswork” in signal text; no Example data badge (F01 done).",None,None),
 ("L15","Problem cards ×4","guesswork","L15-{w}","Present","built","Copy as the board.",None,None),
 ("L16","“What you get back” heading","get-funnel","L16-{w}","Present","built","Heading only; no Example data badge (F01 done).",None,None),
 ('L17', 'Research funnel', 'get-funnel', 'L17-{w}', 'Present', 'deviation', 'Funnel as the board: labels beside each hex, ▸ chevrons, one row at 1440.', None, None),
 ('L18', 'Your busk (PlanMap)', 'get-map', 'L18-{w}', 'Different', 'deviation', 'F02, F03, F05 done: “Full details →” on each pitch row; zoom buttons kept; no “test data”; only orange taste cells, no dark cells; zoomed out so streets, river and labels show; legend is one line at the bottom (Taste · Top pitch · Hidden gem · Other) with a tooltip on each item. Left: at 390 the legend wraps to two lines; the attribution control shows a tiled, clipped “i” icon (4 copies) bottom right at every width; at 1440 the map is 544 px tall in a 699 px column, leaving empty paper below. No zone, river or event (held, L05).', 'DEV deviation (declared)', 'B-137, B-136, B-141'),
 ("L19","“And what to play there”","get-setlist","L19-{w}","Present","built","Heading and paragraph as the board.",None,None),
 ('L20', 'Setlist panel', 'get-setlist', 'L20-{w}', 'Present', 'built', '“Setlist for this pitch”, Copy, rows 01–04, mono set length, bordered Learn these with the orange rule.', None, None),
 ("L21","Beyond buskers","beyond","L21-{w}","Present","built","Now directly after What you get back, before the Brain teaser (F06 done at 390, 768 and 1440).",None,None),
 ("L22","Brain teaser","brain","L22-{w}","Present","built","After Beyond buskers, before Brand (F06). 11 · 24–33 · 0, purple button, wiring sketch; the “Powered by” Qloo wordmark links to qloo.com (F09).",None,None),
 ('L23', 'Brand teaser', 'brand-teaser', 'L23-{w}', 'Different', 'held', "Last of the three (F06). “Honeycomb”, line, 90 · 3 · 9, “See the brand →” (one of the page's 2 /brand links; the other is the footer, F11). The specimen card lost its app icon (the hex mark) at 8207373: it starts with hex cell 1 (board and v4: app icon, 1, 91).", None, 'B-140'),
 ('L24', 'Closing CTA', 'cta', 'L24-{w}', 'Different', 'built', "No credit line under the CTA (F04 done). The button is now the poster variant: “PLAN A BUSK” in 24px Big Shoulders capitals, 44 px tall (board and v4: sans “Plan a busk”, 64 px).", None, 'B-139'),
 ('L25', 'Footer', 'footer', 'L25-{w}', 'Present', 'built', 'Re-laid out by F07–F11: left lockup “with” Qloo; centre Privacy · Terms · Brain · Brand; right GitHub in a hex cell and “Built by T04435” with the pixel mark; no legal line (on /terms). Stacks cleanly at 390.', None, None),
 ('L26', 'Bottom nav (phone)', 'header', 'L26-{w}', 'Different', 'built', 'Bottom nav Busks · Week · Brain · Tips at 390. It switches to the header nav at 768 px, not 721: from 721 to 767 the bottom bar still shows.', None, 'B-129'),
 ('L27', 'Phone layout', 'full', 'full-{w}', 'Present', 'built', 'Stacks at 390; no sideways scroll at 390, 768 or 1440, day and night.', None, None),
 ('L28', 'Reduced motion', 'full', 'motion-{w}', 'Present', 'built', 'Reduced motion: glow and ticker still, finished map; 0 running animations at 390, 768 and 1440.', None, None),
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
