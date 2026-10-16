"""Living per-page review (Honeycomb UI work), same format as landing.html.
Run from the worktree root: python3 -I qa/tools/page-review.py qa/tools/<page>-parts.py qa/reports/<page>.html
The parts file defines TITLE, ROUTE, VERSION, COMMIT, DATE, CHANGES, HISTORY, SOURCE_NOTE, IMG (dir under qa/screens),
PARTS (list of dicts: id, name, deck, b1440, b390, dev, qa, note, user, defect), SECTIONS (list of (id, title, html))."""
import html, re, sys, runpy
D = runpy.run_path(sys.argv[1])
COL = {"Present": "ok", "Different": "warn", "Missing": "bad", "Broken": "bad", "Held": "held", "Not in deck": "held"}
IMG = "../screens/" + D["IMG"]
def img(path, alt):
    return f'<a href="{path}"><img loading="lazy" src="{path}" alt="{html.escape(alt)}"></a>'
def fig(cap, src, alt, empty):
    return f"<figure><figcaption>{cap}</figcaption>{img(IMG + src, alt) if src else f'<div class=ph>{empty}</div>'}</figure>"
rows = []
for p in D["PARTS"]:
    call = p.get("user", "")
    action = p["qa"] in ("Different", "Missing", "Broken") or bool(re.search(r"\bF\d\d", call)) or call.startswith("Open question")
    rows.append(f'''<article class="row" id="{p["id"]}" data-action="{str(action).lower()}">
<div class="id"><a href="#{p["id"]}">{p["id"]}</a><span>{html.escape(p["name"])}</span></div>
{fig("Deck", p.get("deck"), p["id"] + " deck", html.escape(p.get("deck_empty", "Not in the deck")))}
{fig("Build · 1440", p.get("b1440"), p["id"] + " build 1440", "Not in the build")}
{fig("Build · 390", p.get("b390"), p["id"] + " build 390", "Not in the build")}
<dl>
{f'<div><dt>Spec</dt><dd class="spec">{html.escape(p["spec"])}</dd></div>' if p.get("spec") else ""}
<div><dt>DEV status</dt><dd>{html.escape(p.get("dev", "—"))}</dd></div>
<div><dt>QA status</dt><dd><span class="chip {COL[p["qa"]]}">{p["qa"]}</span> {html.escape(p.get("note", ""))}</dd></div>
<div><dt>User's call</dt><dd class="call">{html.escape(call) or "—"}</dd></div>
<div><dt>Defect</dt><dd>{html.escape(p.get("defect", "—"))}</dd></div>
<div><dt>Last checked</dt><dd><code>{D["COMMIT"]}</code></dd></div>
</dl></article>''')
counts = {s: sum(1 for p in D["PARTS"] if p["qa"] == s) for s in COL}
stats = "".join(f'<span class="stat {COL[s]}">{n} {s}</span>' for s, n in counts.items() if n or s in ("Present", "Different", "Missing", "Broken"))
hist = "".join(f"<li><b>{v}</b> · design/honeycomb ＠ <code>{c}</code> · {d}: {html.escape(t)}</li>" for v, c, d, t in D["HISTORY"])
sections = "".join(f'<section class="box" id="{i}"><h2>{html.escape(t)}</h2>{h}</section>' for i, t, h in D.get("SECTIONS", []))
page = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(D["TITLE"])}</title>
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
.box img{{max-height:none}}
dl{{margin:0;display:grid;gap:6px}} dt{{font-size:12px;color:var(--muted)}} dd{{margin:0}} .call{{font-weight:800;color:var(--accent)}} .spec{{font-size:12px;color:var(--muted)}}
.chip{{font-weight:800;padding:1px 8px}} .chip.ok{{background:var(--okbg);color:var(--ok)}} .chip.bad{{background:var(--badbg);color:var(--bad)}} .chip.warn{{background:var(--warnbg);color:var(--warn)}} .chip.held{{background:var(--heldbg);color:var(--held)}}
.ph{{border:2px dashed var(--muted);color:var(--muted);padding:24px 8px;text-align:center;font-weight:800}}
body.action .row[data-action="false"]{{display:none}}
.ready{{border:2px solid var(--line);background:var(--card);padding:12px 16px;margin:8px 0 14px}} .ready.ready{{border-color:var(--ok)}} .ready.ready-with-notes{{border-color:var(--warn)}} .ready.not-ready{{border-color:var(--bad)}}
.box{{background:var(--card);border:1px solid var(--line);padding:12px 16px;margin-top:20px;overflow-x:auto}} .box h2{{font-size:16px;margin:0 0 6px}}
.prov{{border-left:4px solid var(--accent);padding:6px 10px;background:var(--bg);font-size:13px}} .synth{{border:2px solid var(--fg);padding:8px 12px;margin:10px 0}} .synth h3{{margin:0 0 4px;font-size:14px}} .box details{{margin-top:10px}} .box summary{{font-weight:800;cursor:pointer;min-height:32px}} .box h3,.box h4,.box h5,.box h6{{font-size:14px;margin:12px 0 4px}} .box table{{margin:6px 0}} .box code{{font-size:12px}}
table{{border-collapse:collapse}} th,td{{border:1px solid var(--line);padding:4px 8px;text-align:left;vertical-align:top}}
@media (max-width:1100px){{.row{{grid-template-columns:1fr 1fr}} .id{{grid-column:1/-1}} dl{{grid-column:1/-1}}}}
@media (max-width:600px){{.row{{grid-template-columns:1fr}}}}
</style></head>
<body><div class="wrap">
<h1>{html.escape(D["TITLE"])}</h1>
<p class="ver">{D["VERSION"]} · design/honeycomb ＠ {D["COMMIT"]} · {D["DATE"]} · route {html.escape(D["ROUTE"])}</p>
<p class="chg">{html.escape(D["CHANGES"])}</p>
{(lambda r: f'<section class="ready {r[0].lower().replace(" ", "-")}" aria-label="Ready for design-approve"><b>Ready for the user\'s design-approve? {html.escape(r[0])}.</b> {html.escape(r[1])}</section>')(D["READY"]) if D.get("READY") else ""}
<div class="strip" role="group" aria-label="Summary">{stats}<button class="filter" type="button" aria-pressed="false" id="flt">Needs action only</button></div>
<p class="chg">{html.escape(D["SOURCE_NOTE"])} The row id is the ticket.</p>
{"".join(rows)}
{sections}
<section class="box"><h2>Versions</h2><ul>{hist}</ul></section>
</div>
<script>
const f=document.getElementById('flt');f.addEventListener('click',()=>{{const on=!document.body.classList.contains('action');document.body.classList.toggle('action',on);f.setAttribute('aria-pressed',String(on));}});
</script></body></html>'''
open(sys.argv[2], "w").write(page)
print(D["VERSION"], counts)
