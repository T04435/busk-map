"""The living landing report: qa/reports/landing.html on design/honeycomb. Update in place each recheck; bump VERSION.
Run from the worktree root: python3 -I qa/tools/landing-review.py qa/reports/landing.html qa/tools/landing-parts.py
To update: re-capture build crops into qa/screens/honeycomb/recheck/<version>/ (v5 now; BUILD below), edit P in landing-parts.py (status, finding), USER / DEV / DEFECTS here, then bump VERSION, COMMIT, DATE, CHANGES and add a HISTORY line."""
import html, re, sys, importlib.util
spec = importlib.util.spec_from_file_location("rc", sys.argv[2]); rc = importlib.util.module_from_spec(spec)
# Reuse the 29 parts from the QA-03 generator without running it.
src = open(sys.argv[2]).read(); P = eval(src[src.index("P = [") + 4: src.index("]\nCOL") + 1])

VERSION = "v5"
COMMIT = "8207373"
DATE = "17 Oct 2026"
CHANGES = "Recheck at 8207373 (DEV closed F01–F15). L01 now Present (F12 lockup with the new lettering); L14, L16 badges gone (F01); L18 F02/F03/F05 done but Different (legend wraps at 390, tiled attribution icon, short map: B-137..5); L21→L22→L23 order fixed (F06); L24 credit line gone (F04). New: L08/L24 poster CTAs render 44 px tall (B-139); L23 specimen lost its app icon (B-140); L11 still an arrow (F22, round 2); L26 Different (B-129). Site-wide F07–F15 all Present. 21 Present, 7 Different, 1 Held."
HISTORY = [
  ("v5", COMMIT, DATE, CHANGES),
  ("v4.2", "7b1521e", "17 Oct 2026", "F12 corrected by the user: L01 Different (old lettering, the M rises above the other letters); no other recheck."),
  ("v4.1", "7b1521e", "17 Oct 2026", "Added the user's calls F01–F15 on L rows and a Site-wide section (F07–F15); no recheck."),
  ("v4", "7b1521e", "16 Oct 2026", "L03, L07, L11, L17, L20, L23 match (user calls; B-019, B-033, B-034 fixed); L04, L25 match; L18 live map and L24 credit line Different (declared); L13 kept (B-032 accepted); B-035 fixed. 25 Present, 3 Different, 1 Held."),
  ("v3", "91b220e", "16 Oct 2026", "Folded QA-01 and QA-03 into this page; added the user's calls (L03, L07, L11, L13, L17, L18, L20, L23)."),
  ("v2", "91b220e", "16 Oct 2026", "QA-03 recheck against BRAND's 29 parts: 20 Present, 6 Different, 1 Missing, 2 Held; B-032..B-034. (honeycomb-landing-recheck.html)"),
  ("v1", "69a6cad", "17 Oct 2026", "QA-01 first audit, 21 items mapped to parts by the inventory README; B-018..B-026. (honeycomb-landing-audit.html)"),
]
USER = {
  "L03": "Remove the small texts on both sides. (done in v4)",
  "L07": "Remove all the small texts. (done in v4)",
  "L11": "Add the video slot. (done in v4) F22 (round 2): the icon is a play triangle, not an arrow. (not built yet)",
  "L13": "Keep as built (B-032 accepted).",
  "L17": "Fix to the deck. (done in v4)",
  "L18": "Fix to the deck. Then F02: add “Full details →” per pitch row; keep the zoom buttons; remove “test data” from the legend. F03: the legend becomes one line at the bottom of the map, with tooltips for the details. F05: only the orange honeycomb cells, no dark cells; zoom out a little so the map itself shows. (done at 8207373, see QA note)",
  "L20": "Fix to the deck. (done in v4)",
  "L23": "Add the brand teaser. (done in v4) F06: order is Beyond buskers → Brain → Brand. (done at 8207373)",
  "L05": "Held. F05: if the hero uses the same map, only the orange cells, no dark cells. (DEV asks: it's a separate SVG.) Round 2 F16/F19: hatched zone cells, full-bleed map. (not built yet)",
  "L08": "F13–F15: the hero CTA uses the Button poster variant (inventory intro).",
  "L14": "F01: Remove the “Example data” badge. (done at 8207373)",
  "L16": "F01: Remove the “Example data” badge. (done at 8207373)",
  "L24": "F04: Remove the “Data: Qloo · …” credit line. (done at 8207373)",
  "L21": "F06: Beyond buskers comes first, then the Brain teaser, then the Brand teaser (replaces v67). (done at 8207373)",
  "L22": "F06: the Brain teaser moves after Beyond buskers, before the Brand teaser. F09: Qloo logo links out. (done at 8207373)",
  "L09": "F09: every Qloo logo links to qloo.com in a new tab. (done at 8207373)",
  "L01": "F12 (corrected 17 Oct): the ONE logo is [hex mark][new wordmark] in the header, footer and every asset; wordmark-only or mark-only in a header fails; the mark alone only at icon size. (done at 8207373)",
  "L25": "F07–F11 and F12: see the Site-wide rows (GitHub cell, Built by + mark, Qloo logo links, /terms, three-part layout, lockup). (done at 8207373)",
}
DEFECTS = {
  "L03": "B-021 glow fixed", "L04": "B-025 fixed", "L05": "B-021 (zone, event, river) held", "L08": "B-018 fixed · B-139 (44 px tall)",
  "L13": "B-022 fixed · B-032 accepted (user)", "L17": "B-020 fixed · B-033 fixed", "L18": "B-020 fixed (declared deviation) · B-137, B-136, B-141",
  "L20": "B-020 fixed · B-034 fixed", "L22": "B-024 fixed", "L23": "B-019 fixed · B-140 (app icon gone)", "L24": "B-139 (44 px, capitals)", "L25": "B-023 fixed",
  "L26": "B-129 (nav switches at 768, not 721)", "L01": "B-129 (see L26)", "L11": "— (F22 play triangle: round 2, not built yet)",
}
DEV = {  # DEV's status at 8207373, relayed by MANAGER: F01–F06 and F07–F15 done
  "L01": "done: F12 lockup (images, 36 px); nav says Brain (HQ default)", "L26": "built; nav says Brain (HQ default)",
  "L03": "changed: small texts removed (user call)", "L05": "deviation: separate SVG, not orange-only yet (asking the user)",
  "L07": "changed: all captions removed (user call)", "L08": "changed: Button poster variant (F13–F15)",
  "L09": "done: Qloo logo links out (F09)", "L22": "done: after Beyond (F06); Qloo logo links out (F09)",
  "L11": "changed: placeholder slot, no controls, no autoplay", "L13": "built as before (user call); B-032 not applied",
  "L14": "done: badge removed (F01)", "L16": "done: badge removed (F01)", "L17": "changed to match the deck",
  "L18": "done: F02, F03, F05", "L20": "changed: Copy, rows 01–04, mono set length, bordered Learn these",
  "L21": "done: first of the three (F06)", "L23": "done: last of the three (F06)", "L24": "done: credit line removed (F04)",
  "L25": "done: F07–F11 footer", "L28": "built (covered by e2e)",
}
DEVBASE = {"built": "built", "deviation": "built", "held": "built"}
COL = {"Present": "ok", "Different": "warn", "Missing": "bad", "Broken": "bad", "Held": "held"}
BOARD = "../screens/honeycomb/recheck/board/"; BUILD = "../screens/honeycomb/recheck/v5/"

def img(path, alt):
    return f'<a href="{path}"><img loading="lazy" src="{path}" alt="{html.escape(alt)}"></a>'
rows = []
for pid, name, deck, build, status, dc, find, lost, defect in P:
    b1440 = img(f"{BUILD}{build.format(w='1440')}.jpg", f"{pid} build at 1440") if build else '<div class="ph">Not in the build</div>'
    if pid == "L26": b1440 = '<div class="ph soft">Phone only</div>'
    b390 = img(f"{BUILD}{build.format(w='390')}.jpg", f"{pid} build at 390") if build else '<div class="ph">Not in the build</div>'
    call = USER.get(pid, "")
    action = status in ("Different", "Missing", "Broken", "Held")
    rows.append(f'''<article class="row" id="{pid}" data-action="{str(action).lower()}">
<div class="id"><a href="#{pid}">{pid}</a><span>{html.escape(name)}</span></div>
<figure class="deck"><figcaption>Deck crop</figcaption>{img(BOARD + pid + ".jpg", pid + " deck crop")}</figure>
<figure><figcaption>Build · 1440</figcaption>{b1440}</figure>
<figure class="p390"><figcaption>Build · 390</figcaption>{b390}</figure>
<dl>
<div><dt>DEV status</dt><dd>{html.escape(DEV.get(pid, DEVBASE[dc]))}</dd></div>
<div><dt>QA status</dt><dd><span class="chip {COL[status]}">{status}</span> {html.escape(find)}</dd></div>
<div><dt>User's call</dt><dd class="call">{html.escape(call) or "—"}</dd></div>
<div><dt>Defect</dt><dd>{html.escape(DEFECTS.get(pid, "—"))}</dd></div>
<div><dt>Last checked</dt><dd><code>{COMMIT}</code></dd></div>
</dl></article>''')
SITE = [  # row id, user's call, user's screenshot (or None), QA status, what QA found at COMMIT, DEV status
  ("F07", "Footer: a GitHub icon with a link, in a honeycomb cell, instead of the “OPEN SOURCE github.com/…” text.", "02-footer-github.png", "Present", "GitHub icon in a 40×46 hex cell, link “Busk Map on GitHub” to github.com/T04435/busk-map; no repo text (site-checks pass, every route).", "done"),
  ("F08", "Footer: “Built by T04435” plus the pixel mark (the Claude Code critter recreated as an SVG, not the Claude logo), each linked. Replaces the “@…” text.", "03-built-by-mark.png", "Present", "“Built by T04435” and the inline-SVG mark (“T04435 on GitHub”) both link to github.com/T04435; no “@…” text. At 8207373 the mark is DEV's approximation; BRAND's exact path lands later (865999d).", "done"),
  ("F09", "Every Qloo logo links to qloo.com in a new tab (rel=\"noopener noreferrer\").", None, "Present", "Landing: 3 Qloo wordmarks (hero, Brain teaser, footer), all https://qloo.com, target _blank, rel noopener noreferrer, named “Qloo (opens qloo.com in a new tab)”. site-checks: every route passes.", "done"),
  ("F10", "The legal line moves out of the footer into a Terms page (/terms), linked from the footer.", "07-legal-line.png", "Present", "/terms returns 200 and holds “never confirms a pitch is legal”; the footer links Terms and no longer shows the line (every route).", "done"),
  ("F11", "Footer layout: left the wordmark and the Qloo logo; centre Privacy · Brain · Brand; right GitHub and Built by.", None, "Present", "1440: left lockup “with” Qloo, centre Privacy · Terms · Brain · Brand (Terms added for F10), right GitHub and Built by. 390: three stacked rows, nothing clipped, no sideways scroll.", "done"),
  ("F12", "Corrected 17 Oct: the ONE logo is [hex mark][new wordmark] (the lockup) in the header, footer and every asset. F12 retired only the OLD wordmark lettering (the larger M). Wordmark-only or mark-only in a header fails; the mark alone only at icon size.", "04-wordmark-only-one.png", "Present", "Header 36 px and footer 34 px use /brand/busk-map-lockup-dark.svg; at 4× the letters are the new stencil face, M the same height as the rest (matches the reference). site-checks: 16 placements, all lockup. Side effect: the brand teaser's app icon was removed (L23, B-140).", "done"),
  ("F13", "Search inputs (Artists you sound like, song search): a normal input with only the search icon, shadcn InputGroup, one border, one focus ring.", "05-search-input-cooked.png", "Present", "Not on the landing any more (the form is on /busks). Field strip at 8207373: /busks 68 states, 0 fail, including both searches, day and night, 390 and 1440. Visual check on the Busks review.", "done"),
  ("F14", "Every input's focus: one ring, shadcn's own pattern (no white gap plus orange over the border).", "06-input-focus.png", "Present", "Field strip: 586 states, 4 fail, none on the landing (3 are the exempt DISABLED specimen on /brand, 1 the plan's “≈612 people an hour” button). Landing: 72 states, 0 fail. Plain links and cards use DEV's one-ring fallback (asking BRAND): on the act cards (L13) it reads as a thicker border.", "done"),
  ("F15", "Use shadcn/ui primitives styled through tokens and variants; no hand-built replacements; no global CSS overriding their states.", None, "Present", "Landing CTAs are now Button (poster variant) via asChild; the only global focus rule is a :where() fallback in the base layer for plain links and bare buttons, which primitives' own utilities override (DEV's declared deviation, asking BRAND). The poster variant's height is lost to the default size (B-139).", "done"),
]
FEED = "../screens/honeycomb/feedback/"
site = "".join(f'''<article class="row site" id="{fid}" data-action="{str(qa != "Present").lower()}">
<div class="id"><a href="#{fid}">{fid}</a><span>Site-wide</span></div>
<figure class="deck"><figcaption>User's screenshot</figcaption>{img(FEED + shot, fid + " user screenshot") if shot else '<div class="ph soft">No screenshot</div>'}</figure>
<dl>
<div><dt>User's call</dt><dd class="call">{html.escape(call)}</dd></div>
<div><dt>DEV status</dt><dd>{dev}</dd></div>
<div><dt>QA status</dt><dd><span class="chip {COL[qa]}">{qa}</span> {html.escape(how)}</dd></div>
<div><dt>Defect</dt><dd>—</dd></div>
<div><dt>Last checked</dt><dd><code>{COMMIT}</code></dd></div>
</dl></article>''' for fid, call, shot, qa, how, dev in SITE)
counts = {s: sum(1 for p in P if p[4] == s) for s in COL}
NEWDEF = [
  ("B-139", "Medium", "L08, L24", "Both poster CTAs render 44 px tall at 390, 768 and 1440 (hero: board and v4 76 px; closing: 64 px). The Button's default size (h-control) wins over the poster variant's h-16 and the hero's h-19. The closing CTA also changed from sans “Plan a busk” to 24px Big Shoulders capitals."),
  ("B-140", "Low", "L23", "The brand teaser's specimen card no longer shows the app icon (hex mark); it starts at hex cell 1. The board and v4 had it. Likely a side effect of F12 (mark-only removed), but the mark alone is allowed at icon size."),
  ("B-137", "Low", "L18", "At 390 the map legend wraps to two lines (“Other” on its own line); F03 asks for one line."),
  ("B-136", "Low", "L18", "The map's attribution control shows its “i” icon tiled 2×2 and clipped at the bottom-right corner, at every width (also in v4's captures)."),
  ("B-141", "Low", "L18", "At 1440 the map frame is 544 px tall in a 699 px column: about 155 px of empty paper under the map (the board's map fills the column)."),
]
AUDIT = [
  ("axe (WCAG 2.0–2.2 A/AA tags), reduced motion, after scrolling the page", "390 day 0 · 390 night 0 · 1440 day 0 · 1440 night 0 violations"),
  ("Sideways scroll", "0 px at 390, 768 and 1440, day and night"),
  ("Running animations with reduced motion", "0 at 390, 768 and 1440"),
  ("Heading outline", "H1, then H2 Try an act · Busking is guesswork · What you get back (H3 Your busk · And what to play there · Setlist) · Beyond buskers · The brain of Busk Map · Honeycomb · Your crowd is out there"),
  ("Section order (F06)", "hero · ticker · video · try · guesswork · what you get · Beyond · Brain · Brand · CTA (390, 768, 1440)"),
  ("Keyboard focus walk, 1440", "Skip link, lockup, nav, CTA, Qloo, act cards, pitch rows, Full details, legend tooltips, Copy, Learn it, teasers, footer: all show a ring; act cards' ring is dark on a dark border (L13)"),
  ("/brand links (QA spec L23)", "2: the teaser's “See the brand →” and the footer's Brand"),
  ("Field strip, route / (fields8)", "72 states (18 controls), 0 fail"),
  ("site-checks at 8207373", "24 pass, 0 fail"),
]
CHECKS = f'''<section class="box" id="new-defects"><h2>New defects at {COMMIT}</h2><ul>{"".join(f"<li><b>{i}</b> · {sev} · {rows}: {html.escape(t)}</li>" for i, sev, rows, t in NEWDEF)}</ul></section>
<section class="box" id="audit"><h2>Checks at {COMMIT}</h2><ul>{"".join(f"<li><b>{html.escape(k)}</b>: {html.escape(v)}</li>" for k, v in AUDIT)}</ul>
<figure><figcaption>Field strip, route / (each control unfocused and focused, 390 and 1440, day and night)</figcaption>{img("../screens/honeycomb/recheck/v5/field-strip.jpg", "Landing field strip at 8207373")}</figure>
<p class="chg">Not a row yet: L21b “Thanks to” (round 2, F23–F24), added to BRAND's inventory after this review's 29 parts; not built at {COMMIT}.</p></section>'''
hist = "".join(f"<li><b>{v}</b> · design/honeycomb ＠ <code>{c}</code> · {d}: {html.escape(t)}</li>" for v, c, d, t in HISTORY)
page = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Landing · review</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;800&display=swap" rel="stylesheet">
<style>
:root{{--bg:#f4f1ea;--card:#fff;--fg:#17191c;--muted:#5d6168;--line:#d9d4c8;--ok:#1d7a3a;--okbg:#e2f3e7;--bad:#b3141b;--badbg:#fbe3e4;--warn:#8a5a00;--warnbg:#fdf0d3;--held:#4b4f86;--heldbg:#e7e7f6;--accent:#c2410c}}
@media (prefers-color-scheme: dark){{:root:not([data-theme="light"]){{--bg:#111416;--card:#1a1e21;--fg:#eceae4;--muted:#a3a8ad;--line:#2d3337;--ok:#6fd38f;--okbg:#14301e;--bad:#ff8c8f;--badbg:#3a1416;--warn:#f2c160;--warnbg:#33280f;--held:#b9b9f0;--heldbg:#25253d;--accent:#ff7a3d}}}}
:root[data-theme="dark"]{{--bg:#111416;--card:#1a1e21;--fg:#eceae4;--muted:#a3a8ad;--line:#2d3337;--ok:#6fd38f;--okbg:#14301e;--bad:#ff8c8f;--badbg:#3a1416;--warn:#f2c160;--warnbg:#33280f;--held:#b9b9f0;--heldbg:#25253d;--accent:#ff7a3d}}
*{{box-sizing:border-box}}
body{{margin:0;background:var(--bg);color:var(--fg);font:14px/1.5 "JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}}
.wrap{{max-width:1600px;margin:0 auto;padding:24px 16px 64px}}
h1{{font-size:24px;margin:0}} .ver{{font-weight:800;margin:6px 0 2px}} .chg{{color:var(--muted);margin:0 0 12px}}
.strip{{display:flex;flex-wrap:wrap;gap:8px;align-items:center;position:sticky;top:0;z-index:5;background:var(--bg);padding:10px 0;border-bottom:1px solid var(--line)}}
.stat{{padding:6px 12px;border:1px solid var(--line);background:var(--card);font-weight:800}}
.stat.ok{{color:var(--ok)}} .stat.bad{{color:var(--bad)}} .stat.warn{{color:var(--warn)}} .stat.held{{color:var(--held)}}
.filter{{font:inherit;padding:6px 12px;border:1px solid var(--line);background:var(--card);color:var(--fg);cursor:pointer;min-height:40px}} .filter[aria-pressed="true"]{{background:var(--fg);color:var(--bg)}}
.row{{display:grid;grid-template-columns:150px minmax(0,1.2fr) minmax(0,1.2fr) minmax(0,.55fr) minmax(0,1.3fr);gap:12px;background:var(--card);border:1px solid var(--line);margin:12px 0;padding:12px;scroll-margin-top:70px}}
.row:target{{outline:3px solid var(--accent)}}
.id a{{display:inline-block;font-size:22px;font-weight:800;color:var(--fg);text-decoration:none;border:2px solid var(--fg);padding:0 8px}} .id span{{display:block;margin-top:6px;font-weight:600}}
figure{{margin:0;min-width:0}} figcaption{{font-size:12px;color:var(--muted);margin-bottom:4px}}
img{{display:block;max-width:100%;height:auto;max-height:520px;object-fit:contain;object-position:top left;border:1px solid var(--line);background:#fff}}
dl{{margin:0;display:grid;gap:6px}} dt{{font-size:12px;color:var(--muted)}} dd{{margin:0}} .call{{font-weight:800;color:var(--accent)}}
.chip{{font-weight:800;padding:1px 8px}} .chip.ok{{background:var(--okbg);color:var(--ok)}} .chip.bad{{background:var(--badbg);color:var(--bad)}} .chip.warn{{background:var(--warnbg);color:var(--warn)}} .chip.held{{background:var(--heldbg);color:var(--held)}}
.ph{{border:2px dashed var(--bad);color:var(--bad);padding:24px 8px;text-align:center;font-weight:800}} .ph.soft{{border-color:var(--muted);color:var(--muted)}}
body.action .row[data-action="false"]{{display:none}}
.row.site{{grid-template-columns:150px minmax(0,1fr) minmax(0,2fr)}} .sect{{font-size:18px;margin:28px 0 4px}}
.box{{background:var(--card);border:1px solid var(--line);padding:12px 16px;margin-top:20px}} .box h2{{font-size:16px;margin:0 0 6px}}
@media (max-width:1100px){{.row{{grid-template-columns:1fr 1fr}} .id{{grid-column:1/-1}} dl{{grid-column:1/-1}}}}
@media (max-width:1100px){{.row.site{{grid-template-columns:1fr 1fr}}}}
@media (max-width:600px){{.row,.row.site{{grid-template-columns:1fr}}}}
</style></head>
<body><div class="wrap">
<h1>Landing · review</h1>
<p class="ver">{VERSION} · design/honeycomb ＠ {COMMIT} · {DATE}</p>
<p class="chg">{html.escape(CHANGES)}</p>
<div class="strip" role="group" aria-label="Summary">
<span class="stat ok">{counts["Present"]} Present</span><span class="stat warn">{counts["Different"]} Different</span><span class="stat bad">{counts["Missing"]} Missing</span><span class="stat bad">{counts["Broken"]} Broken</span><span class="stat held">{counts["Held"]} Held</span>
<button class="filter" type="button" aria-pressed="false" id="flt">Needs action only</button>
</div>
<p class="chg">One row per part of BRAND's inventory (L01–L29). The row id is the ticket: “L07 remove…” means row L07 here. Not a part: B-026, the “For judges” link (held for the user).</p>
{"".join(rows)}
<h2 class="sect" id="site-wide">Site-wide (F07–F15)</h2>
<p class="chg">The user's calls that aren't one landing part. Row id = ticket, e.g. “F13”.</p>
{site}
{CHECKS}
<section class="box"><h2>Versions</h2><ul>{hist}</ul></section>
</div>
<script>
const f=document.getElementById('flt');f.addEventListener('click',()=>{{const on=!document.body.classList.contains('action');document.body.classList.toggle('action',on);f.setAttribute('aria-pressed',String(on));}});
</script></body></html>'''
open(sys.argv[1], "w").write(page)
print(VERSION, counts)
