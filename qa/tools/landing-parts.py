"""Builds qa/reports/honeycomb-landing-recheck.html on design/honeycomb. Run: python3 -I hc-recheck.py <out.html>"""
import html, sys
BOARD = "../screens/honeycomb/recheck/board/"
BUILD = "../screens/honeycomb/recheck/build/"
DECK = "../screens/honeycomb/landing/"   # QA's own deck renders per width, from the 17 Oct audit (same v62 board)
# part, name, deck render id (per width) or None, build image key (per width; {w} filled), status, dev claim, finding, lost_at, defect
P = [
 ("L01","Header","header","L01-{w}","Present","built","Busks · Week · Brain · Tips, none active; Brain per HQ default 2.",None,None),
 ("L02","Hero band","hero-ground","L02-{w}","Present","built","Night band, dot grain, hex lattice and the 6px orange rule.",None,None),
 ("L03","Glowing honeycomb cells","hero-ground","L03-{w}","Present","built","Orange cells along the hero's lower band; under reduced motion they hold at opacity 0.5 (getComputedStyle). B-021 glow part fixed.",None,None),
 ("L04","Hero headline","headline","L04-{w}","Different","deviation","“What to play.” never wraps (4 lines at 1440 and 390, 3 at 768). B-025 fixed. Declared extra: HQ's one-line intro under the H1.","DEV deviation (declared)",None),
 ("L05","Hero taste map","hero-map","L05-{w}","Held","held","Pins 1 and 3 plus a hidden-gem diamond. Zone, event and river held for the user. Also unlike the board: a full rectangular grid (board: an irregular blob with gaps) and plain numbered pins (board: target rings with number badges).","held for the user",None),
 ("L06","Map fill-in and pin drop","hero-map","L05-{w}","Present","built","Cells fill in and pins drop (CSS); finished state under reduced motion, with no running animations.",None,None),
 ("L07","Map caption","hero-map","L07-{w}","Different","deviation","Board wording verbatim plus “An example, not a city's data.” (declared).","DEV deviation (declared)",None),
 ("L08","Hero CTA","hero-cta","L08-{w}-focus","Present","built","Poster block and shadow; the keyboard focus ring now shows beside the shadow (screenshot is the focused state). B-018 fixed.",None,None),
 ("L09","In partnership with Qloo","partner","L09-{w}","Present","built","Purple words, Qloo wordmark, centred.",None,None),
 ("L10","Ticker band","ticker","L10-{w}","Present","built","Six phrases, rolling; still under reduced motion.",None,None),
 ("L11","Demo video slot","video",None,"Missing","deviation","Not built until a video exists: DEV deviation 1, accepted earlier; flag for the user.","DEV deviation 1 (accepted)",None),
 ("L12","“Try an act” heading","try","L12-{w}","Present","built","Second sentence in signal text.",None,None),
 ("L13","Act cards ×3","try","L13-{w}","Different","deviation","B-022 fixed: day · hours and Plays lines. Declared: the action starts a plan run, not /busks pre-filled. Not declared: initials hex filled orange with “SA” (board: outline hex, “SX”); the action is a plain dark row with a right arrow (board: orange underlined link); Plays lists differ from the board (Gravy, Dumb Things, Depreston vs Gravy, Depreston, Riptide; Isn't She Lovely vs Nakamarra).","DEV self-check","B-032"),
 ("L14","“Busking is guesswork” heading","guesswork","L14-{w}","Present","built","“guesswork” in signal text; Example data badge (HQ correction).",None,None),
 ("L15","Problem cards ×4","guesswork","L15-{w}","Present","built","Copy as the board.",None,None),
 ("L16","“What you get back” heading","get-funnel","L16-{w}","Present","built","Plus an Example data badge.",None,None),
 ("L17","Research funnel","get-funnel","L17-{w}","Different","deviation","B-020: real totals 412 › … › 496 data points › 3 pitches. Declared: no Qloo calls cell. Not declared: labels sit under the hexes, stages are joined by dashes (board: labels beside each hex, ▸ chevrons) and the row is boxed in a bordered card (board: an open row).","DEV self-check","B-033"),
 ("L18","Your busk (PlanMap)","get-map","L18-{w}","Different","deviation","Summary, three PitchRows (Southbank selected) and a hex map with pins and legend. Declared: no river, no-busking zone, event diamond, small dots or Full details (a static example).","DEV deviation (declared)",None),
 ("L19","“And what to play there”","get-setlist","L19-{w}","Present","built","Heading and paragraph as the board.",None,None),
 ("L20","Setlist panel","get-setlist","L20-{w}","Different","built","Songs, scores, set length 13:05 and Learn these ×2 are there, but DEV marks it built while: Learn these is a tan filled panel with a sans title (board: a bordered box with an orange top rule and a mono caps “LEARN THESE”); the set-length line is sans in brackets (board: mono, “· 3 of 4 songs…”); rows are numbered 1–4 (board: 01–04); the heading names the pitch; no Copy button.","DEV self-check","B-034"),
 ("L21","Beyond buskers","beyond","L21-{w}","Present","built","“Busk Map already reads…” per HQ default 16.",None,None),
 ("L22","Brain teaser","brain","L22-{w}","Present","built","11 · 24–33 · 0 as a mono line, purple button, hex wiring sketch; 4th number gone. B-024 fixed. (dev/core's R4 makes it 12 kinds: update when merged.)",None,None),
 ("L23","Brand teaser","brand-teaser",None,"Held","held","Not built: B-019, held for the user.","held for the user",None),
 ("L24","Closing CTA","cta","L24-{w}","Present","built","Night band, orange rule, poster CTA with focus ring. Adds a data-sources line (build addition).",None,None),
 ("L25","Footer","footer","L25-{w}","Present","built","No Brand link; on the CTA's night band. B-023 fixed.",None,None),
 ("L26","Bottom nav (phone)","header","L26-{w}","Present","built","Below 721 px the bottom nav reads Busks · Week · Brain · Tips; header nav above.",None,None),
 ("L27","Phone layout","full","full-{w}","Present","built","Stacks at 390; no horizontal scroll at 390, 768 or 1440 (scrollWidth = viewport).",None,None),
 ("L28","Reduced motion","full","motion-{w}","Present","built","prefers-reduced-motion: no running animations (document.getAnimations), glow at 0.5, finished map.",None,None),
 ("L29","Night theme","night","night-{w}","Present","built","Paper sections take the night body; night bands unchanged.",None,None),
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
