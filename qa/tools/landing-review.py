"""The living landing report: qa/reports/landing.html on design/honeycomb. Update in place each recheck; bump VERSION.
Run from the worktree root: python3 -I qa/tools/landing-review.py qa/reports/landing.html qa/tools/landing-parts.py
To update: re-capture build crops into qa/screens/honeycomb/recheck/<version>/ (v6 now; BUILD below), edit P in landing-parts.py (status, finding), USER / DEV / DEFECTS here, then bump VERSION, COMMIT, DATE, CHANGES and add a HISTORY line."""
import html, re, sys, importlib.util
spec = importlib.util.spec_from_file_location("rc", sys.argv[2]); rc = importlib.util.module_from_spec(spec)
# Reuse the 29 parts from the QA-03 generator without running it.
src = open(sys.argv[2]).read(); P = eval(src[src.index("P = [") + 4: src.index("]\nCOL") + 1])

VERSION = "v6"
READY = ("Not ready", "DS parity and the glyph rule now apply: L17 (funnel: glyph connectors, wrong numerals vs DS ResearchFunnel), L13 (act cards vs DS ExampleActCard), L18 (PitchRow, PitchPin, legend, other pitches vs the DS), L20 (SetlistPanel), L22 and L23 (StatStrip, text arrows) visibly differ from their DS specimens; L13 and L18's legend need the user to choose between the DS and their earlier calls. Also open: B-136, B-140, B-171; L05 held; L21b not built (F23 held).")  # "Ready" | "Ready with notes" | "Not ready"
COMMIT = "f83f1a1"
DATE = "17 Oct 2026"
CHANGES = "The one full pass at DEV's closing commit f83f1a1; every row re-judged; DS parity and glyph rule applied. Fixed since v5: L08 and L24 poster CTAs 76 and 64 px (B-139); L18 legend one line at 390 (B-137) and the map fills its column (B-141); L01/L26 nav at 721 (B-129); L01 lockup P whole (B-135); L11 play triangle (F22). Changed: L05 full-bleed with pins 1, 2, 3 (F19; zone, event, river and low-taste cells held by DEV); L23 counts 72 · 3 · 21 from /brand; Tips gone. DS parity: L13 (ExampleActCard), L17 (ResearchFunnel), L18 (PitchRow, PitchPin, TasteMapLegend, PlanMap), L20 (SetlistPanel), L22 and L23 (StatStrip) differ from their DS specimens (B-163..B-170); glyph icons on L17, L22, L23 (B-162). Still open: B-136, B-140; B-171 phone hero order. L21b not built (F23 held). 21 Present, 7 Different, 1 Held."
HISTORY = [
  ("v6", COMMIT, DATE, CHANGES),
  ("v5", "8207373", "17 Oct 2026", "Recheck at 8207373 (DEV closed F01–F15). L01 Present (F12 lockup); L14, L16 badges gone (F01); L18 Different (B-136, B-137, B-141); F06 order fixed; L24 credit line gone (F04); L08/L24 poster CTAs 44 px (B-139); L23 lost its app icon (B-140); L26 Different (B-129). 21 Present, 7 Different, 1 Held."),
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
  "L11": "Add the video slot. (done in v4) F22 (round 2): the icon is a play triangle, not an arrow. (done at f83f1a1)",
  "L13": "Keep as built (B-032 accepted).",
  "L17": "Fix to the deck. (done in v4)",
  "L18": "Fix to the deck. Then F02: add “Full details →” per pitch row; keep the zoom buttons; remove “test data” from the legend. F03: the legend becomes one line at the bottom of the map, with tooltips for the details. F05: only the orange honeycomb cells, no dark cells; zoom out a little so the map itself shows. (done; one line at 390 since f83f1a1)",
  "L20": "Fix to the deck. (done in v4)",
  "L23": "Add the brand teaser. (done in v4) F06: order is Beyond buskers → Brain → Brand. (done at 8207373)",
  "L05": "F05: if the hero uses the same map, only the orange cells, no dark cells. Round 2 F16/F19: hatched zone cells, full-bleed map; pitches as pins 1, 2, 3. (full-bleed and pins done at f83f1a1; zone, event, river and low-taste cells held by DEV)",
  "L08": "F13–F15: the hero CTA uses the Button poster variant (inventory intro). (done; 76 px since f83f1a1)",
  "L14": "F01: Remove the “Example data” badge. (done at 8207373)",
  "L16": "F01: Remove the “Example data” badge. (done at 8207373)",
  "L24": "F04: Remove the “Data: Qloo · …” credit line. (done at 8207373)",
  "L21": "F06: Beyond buskers comes first, then the Brain teaser, then the Brand teaser (replaces v67). (done at 8207373)",
  "L22": "F06: the Brain teaser moves after Beyond buskers, before the Brand teaser. F09: Qloo logo links out. (done at 8207373)",
  "L09": "F09: every Qloo logo links to qloo.com in a new tab. (done at 8207373)",
  "L26": "Tips removed by the user (17 Oct): Busks · Week · Brain. (done)",
  "L01": "Tips removed by the user (17 Oct). F12 (corrected 17 Oct): the ONE logo is [hex mark][new wordmark] in the header, footer and every asset; wordmark-only or mark-only in a header fails; the mark alone only at icon size. (done at 8207373)",
  "L25": "F07–F11 and F12: see the Site-wide rows (GitHub cell, Built by + mark, Qloo logo links, /terms, three-part layout, lockup). (done at 8207373)",
}
CHANGES = CHANGES + " The impeccable critique and audit were run for real this round (skill v4.4.0, dual-agent, at f83f1a1, 390/768/1440; provenance at the top of both sections), replacing v3's hand-written sections. New from impeccable, verified by QA: B-218 (High: day-scheme focus ring invisible in the dark bands), B-226 (ticker can't be paused), B-231 (targets under 44 px)."
READY = (READY[0], READY[1] + ' Impeccable adds B-218 (High) and B-226.')

DEFECTS = {
  "L01": "B-129 fixed · B-135 fixed", "L03": "B-021 glow fixed", "L04": "B-025 fixed", "L05": "B-021 (zone, event, river) held by DEV",
  "L08": "B-018 fixed · B-139 fixed", "L11": "— (F22 done)", "L13": "B-022 fixed · B-032 accepted (user) · B-163 (DS ExampleActCard)", "L17": "B-020 fixed · B-033 fixed · B-162 (▸ connectors) · B-164 (DS ResearchFunnel)",
  "L18": "B-136 open · B-137, B-141 fixed · B-165 PitchRow · B-166 PitchPin · B-167 TasteMapLegend · B-168 PlanMap", "L20": "B-020 fixed · B-034 fixed · B-169 (DS SetlistPanel)", "L22": "B-024 fixed · B-162 (→) · B-170 (DS StatStrip)",
  "L23": "B-019 fixed · B-140 open (app icon gone) · B-162 (→) · B-170 (DS StatStrip)", "L24": "B-139 fixed", "L25": "B-023 fixed", "L26": "B-129 fixed", "L27": "B-171 (phone hero order)",
}
DEV = {  # DEV's status at f83f1a1 (closing commit), from the commit log
  "L01": "done: lockup files (B-135), nav at 721 (B-129), no Tips", "L26": "done: 721 px switch (B-129), no Tips",
  "L03": "changed: small texts removed (user call)", "L05": "F19 full-bleed and pins 1–3 done; zone, event, river and orange-only held",
  "L07": "changed: all captions removed (user call)", "L08": "done: poster-lg 76 px (B-139)",
  "L09": "done: Qloo logo links out (F09)", "L22": "done: after Beyond (F06); Qloo logo links out (F09)",
  "L11": "done: play triangle (F22)", "L13": "built as before (user call); BRAND's one-ring sentence",
  "L14": "done: badge removed (F01)", "L16": "done: badge removed (F01)", "L17": "changed to match the deck",
  "L18": "done: F02, F03, F05; legend one line, map fills column", "L20": "changed: Copy, rows 01–04, mono set length, bordered Learn these",
  "L21": "done: first of the three (F06)", "L23": "done: last of the three (F06); counts from /brand's lists", "L24": "done: credit line removed (F04); poster 64 px (B-139)",
  "L25": "done: F07–F11 footer, agreed F08", "L28": "built; global 0 ms transitions under reduced motion",
}
DEVBASE = {"built": "built", "deviation": "built", "held": "built"}
COL = {"Present": "ok", "Different": "warn", "Missing": "bad", "Broken": "bad", "Held": "held"}
BOARD = "../screens/honeycomb/recheck/board/"; BUILD = "../screens/honeycomb/recheck/v6/"

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
  ("F07", "Footer: a GitHub icon with a link, in a honeycomb cell, instead of the “OPEN SOURCE github.com/…” text.", "02-footer-github.png", "Present", "GitHub icon in a 40×46 hex cell, link “Busk Map on GitHub” to github.com/T04435/busk-map; no repo text (site-checks 27/0 at f83f1a1, every route).", "done"),
  ("F08", "Footer: “Built by T04435” plus the pixel mark (the Claude Code critter recreated as an SVG, not the Claude logo), each linked. Replaces the “@…” text.", "03-built-by-mark.png", "Present", "The agreed footer (B-160): “Built by” plain text; “T04435” links to github.com/T04435; the critter (BRAND's path, 865999d) links to claude.com/claude-code in a new tab, rel noopener noreferrer, named “Built with Claude Code (opens in a new tab)”; no “@…” text.", "done"),
  ("F09", "Every Qloo logo links to qloo.com in a new tab (rel=\"noopener noreferrer\").", None, "Present", "Landing: 3 Qloo wordmarks (hero, Brain teaser, footer), all https://qloo.com, target _blank, rel noopener noreferrer, named “Qloo (opens qloo.com in a new tab)”. site-checks: every route passes.", "done"),
  ("F10", "The legal line moves out of the footer into a Terms page (/terms), linked from the footer.", "07-legal-line.png", "Present", "/terms returns 200 and holds “never confirms a pitch is legal”; the footer links Terms and no longer shows the line (every route).", "done"),
  ("F11", "Footer layout: left the wordmark and the Qloo logo; centre Privacy · Brain · Brand; right GitHub and Built by.", None, "Present", "1440: left lockup “with” Qloo, centre Privacy · Terms · Brain · Brand (Terms added for F10), right GitHub and Built by. 768 and 390: stacked rows, nothing clipped, no sideways scroll.", "done"),
  ("F12", "Corrected 17 Oct: the ONE logo is [hex mark][new wordmark] (the lockup) in the header, footer and every asset. F12 retired only the OLD wordmark lettering (the larger M). Wordmark-only or mark-only in a header fails; the mark alone only at icon size.", "04-wordmark-only-one.png", "Present", "Header 36 px and footer 34 px use /brand/busk-map-lockup-dark.svg (BRAND's new files, d3ec211); at 4× the letters are the new stencil face and the P's orange offset is whole (B-135 fixed). site-checks: 16 placements, all lockup. The brand teaser's app icon is still missing (L23, B-140).", "done"),
  ("F13", "Search inputs (Artists you sound like, song search): a normal input with only the search icon, shadcn InputGroup, one border, one focus ring.", "05-search-input-cooked.png", "Present", "Not on the landing (the form is on /busks). Field strip fields9 at f83f1a1: /busks 68 states, 0 fail, both searches included, day and night, 390 and 1440.", "done"),
  ("F14", "Every input's focus: one ring, shadcn's own pattern (no white gap plus orange over the border).", "06-input-focus.png", "Present", "Field strip fields9: 542 states, 4 fail, none on the landing (the exempt DISABLED specimen on /brand and the plan's “≈612 people an hour est.” button inside a closed fold). Landing: 68 states (17 controls), 0 fail. Cards and plain links use BRAND's one-ring sentence (f83f1a1): on the act cards (L13) it reads as a thicker border.", "done"),
  ("F15", "Use shadcn/ui primitives styled through tokens and variants; no hand-built replacements; no global CSS overriding their states.", None, "Present", "Landing CTAs are Button poster variant via asChild with their own sizes (poster-lg 76 px, poster 64 px; d66c770), so the default size no longer overrides them (B-139 fixed). The only global focus rule is the zero-specificity :where() fallback that never matches inputs (f4e4f3c).", "done"),
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
  ("B-171", "Low", "L27 (L05)", "At 390 and 768 the hero stacks the full-bleed taste map first, then the headline and the CTA; the board (L27) stacks headline, map, CTA. At 390 the headline starts about 375 px down, below the map."),
  ("B-163", "Medium", "L13", "DS ExampleActCard: the DS card is one compact row (orange hex initials, name, blurb, mono “Sounds like”, arrow right); the build card adds day · hours, a Plays line and a ruled “Watch Busk Map plan this act” row. Conflicts with the user's keep call (B-032): the user must choose."),
  ("B-164", "Medium", "L17", "DS ResearchFunnel: the counts are Big Shoulders numerals, larger than the DS's small sans numerals in 30 px cells (the connectors are B-162)."),
  ("B-165", "Medium", "L18", "DS PitchRow: the DS puts [rank] [NAME @ time] [score] on one line and badges plus mono caps “FULL DETAILS” under it, with no inner rule; the build sets “@ 12–3 pm” on its own line, rules the row in two, and uses sans “Full details”."),
  ("B-166", "Low", "L18 (L05)", "DS PitchPin: the DS pin is a dark hex with an orange ring around a paper dot and a number tab; the build's map pins are dark hexes with a white hex centre (the hero's pins are plain numbered hexes, held with L05)."),
  ("B-167", "Low", "L18", "DS TasteMapLegend: the DS legend is a boxed panel (“TASTE MATCH”, a 1–5 ramp with LOW/HIGH, then the symbols); the build has the user's F03 one-line bar. The user must choose."),
  ("B-168", "Low", "L18", "DS PlanMap: the DS says how many other pitches were scored in a line under the list; the build puts a “Browse other pitches (2)” button on the map instead."),
  ("B-169", "Low", "L20", "DS SetlistPanel: the subtitle is a method paragraph (DS: pitch · day time · best fit first); “LEARN THESE” is mono caps (DS: Big Shoulders); the Copy label is mono (DS: bold sans)."),
  ("B-170", "Medium", "L22, L23", "DS StatStrip: the teasers' numbers are inline (number beside a mono label); the DS strip is a framed row of ruled cells with the number above its label (purple in the qloo tone)."),
  ("B-162", "shared", "L17, L22, L23", "Glyph icons: the funnel's “▸” connectors, “Open the brain →” and “See the brand →” are text glyphs, not icons."),
  ("B-136", "Low", "L18", "Still open at f83f1a1: the map's attribution “i” control tiles 2×2 and clips bottom right, at 390, 768 and 1440."),
  ("B-140", "Low", "L23", "Still open at f83f1a1: the brand teaser's specimen card starts at hex cell 1; no app icon."),
  ("B-139 · B-137 · B-141 · B-129 · B-135", "fixed", "L08, L24 · L18 · L18 · L01, L26 · L01", "Fixed at f83f1a1: poster CTAs 76 and 64 px; legend one line (42 px) at 390; map frame 667 px in a 699 px column at 1440; nav switch at 721; lockup P offset whole."),
]
AUDIT = [
  ("axe (WCAG 2.0–2.2 A/AA tags), reduced motion, after scrolling the page", "390 day 0 · 390 night 0 · 1440 day 0 · 1440 night 0 violations"),
  ("Sideways scroll", "0 px at 390, 768 and 1440, day and night"),
  ("Running animations with reduced motion", "0 at 390, 768 and 1440; without: 104 glow cells, ticker, 780 cell fill-ins and 3 pin drops, done by 5 s"),
  ("Heading outline", "H1, then H2 Try an act · Busking is guesswork · What you get back (H3 Your busk · And what to play there · Setlist for this pitch) · Beyond buskers · The brain of Busk Map · Honeycomb · Your crowd is out there"),
  ("Section order (F06)", "hero · ticker · video · try · guesswork · what you get · Beyond · Brain · Brand · CTA (390, 768, 1440)"),
  ("Nav switch (B-129)", "390, 720: bottom bar, no header nav · 721, 767, 768, 1440: header nav, no bottom bar"),
  ("Keyboard focus walk, 1440", "Skip link, lockup, nav, CTA, Qloo, act cards, Week links, pitch rows, Full details, legend tooltips, Copy, Learn it, teasers, closing CTA, footer: every stop shows a ring; the act cards' ring sits on their dark border (L13)"),
  ("Tips retired", "No Tips nav item (header or bottom bar), no /tips link, no tip copy on /; no-tips-checks 0 fail of 58 at f83f1a1"),
  ("F20 city names", "No “Melbourne” in any landing eyebrow, tagline or default text; only the basemap's own labels in the L18 map and the City of Melbourne source names in the funnel tooltips (real data)"),
  ("/brand links (QA spec L23)", "2: the teaser's “See the brand →” and the footer's Brand"),
  ("Field strip, route / (fields9)", "68 states (17 controls), 0 fail"),
  ("site-checks at f83f1a1", "27 pass, 0 fail"),
  ("DS parity (v62/v63 specimens, qa/screens/honeycomb/ds/)", "Match: AppHeader, Logo, QlooWordmark, MobileNav. Differ: ExampleActCard (L13), ResearchFunnel (L17), PitchRow, PitchPin, TasteMapLegend, PlanMap (L18), SetlistPanel (L20), StatStrip (L22, L23). Not comparable: Button poster (no poster specimen), SiteFooter (specimen predates F07–F11), BrandHoneycomb (a brand board, not a landing part), TasteMap (hero held, L05)"),
  ("Glyph rule (text glyphs used as icons)", "3 on /: “▸” in the funnel (L17), “→” in Open the brain (L22) and See the brand (L23), all B-162; every other arrow is an SVG icon"),
]
CHECKS = f'''<section class="box" id="new-defects"><h2>New defects at {COMMIT}</h2><ul>{"".join(f"<li><b>{i}</b> · {sev} · {rows}: {html.escape(t)}</li>" for i, sev, rows, t in NEWDEF)}</ul></section>
<section class="box" id="checks"><h2>Checks at {COMMIT}</h2><ul>{"".join(f"<li><b>{html.escape(k)}</b>: {html.escape(v)}</li>" for k, v in AUDIT)}</ul>
<figure><figcaption>Field strip, route / (each control unfocused and focused, 390 and 1440, day and night)</figcaption>{img("../screens/honeycomb/recheck/v6/field-strip.jpg", "Landing field strip at f83f1a1")}</figure>
<p class="chg">BRAND's 30th part, L21b “Thanks to” (round 2, F23–F24: Qloo as sponsor, then “Built with” logos, just before the Brain teaser): not built at {COMMIT}. No “Thanks to” or “Built with” section on the page; Beyond buskers goes straight to the Brain teaser. F23 is held by DEV, so it is not logged as a defect.</p></section>'''
import os as _os
sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from impeccable_sections import impeccable as _imp
from impeccable_synthesis import SYN as _SYN
IMPECCABLE = "".join(f'<section class="box" id="{i}"><h2>{html.escape(t)}</h2>{h}</section>' for i, t, h in _imp("landing", _SYN["landing"]))
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
.box{{background:var(--card);border:1px solid var(--line);padding:12px 16px;margin-top:20px;overflow-x:auto}} table{{border-collapse:collapse}} th,td{{border:1px solid var(--line);padding:4px 8px;text-align:left;vertical-align:top}} .prov{{border-left:4px solid var(--accent);padding:6px 10px;background:var(--bg);font-size:13px}} .synth{{border:2px solid var(--fg);padding:8px 12px;margin:10px 0}} .synth h3{{margin:0 0 4px;font-size:14px}} .box details{{margin-top:10px}} .box summary{{font-weight:800;cursor:pointer;min-height:32px}} .box h3,.box h4,.box h5,.box h6{{font-size:14px;margin:12px 0 4px}} .box table{{margin:6px 0}} .box code{{font-size:12px}} .box h2{{font-size:16px;margin:0 0 6px}}
@media (max-width:1100px){{.row{{grid-template-columns:1fr 1fr}} .id{{grid-column:1/-1}} dl{{grid-column:1/-1}}}}
@media (max-width:1100px){{.row.site{{grid-template-columns:1fr 1fr}}}}
@media (max-width:600px){{.row,.row.site{{grid-template-columns:1fr}}}}
</style></head>
<body><div class="wrap">
<h1>Landing · review</h1>
<p class="ver">{VERSION} · design/honeycomb ＠ {COMMIT} · {DATE}</p>
<p class="chg">{html.escape(CHANGES)}</p>
{f'<section class="ready" aria-label="Ready for design-approve" style="border:2px solid var(--line);background:var(--card);padding:12px 16px;margin:8px 0 14px"><b>Ready for the user\'s design-approve? {html.escape(READY[0])}.</b> {html.escape(READY[1])}</section>' if READY else ""}
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
{IMPECCABLE}
<section class="box"><h2>Versions</h2><ul>{hist}</ul></section>
</div>
<script>
const f=document.getElementById('flt');f.addEventListener('click',()=>{{const on=!document.body.classList.contains('action');document.body.classList.toggle('action',on);f.setAttribute('aria-pressed',String(on));}});
</script></body></html>'''
open(sys.argv[1], "w").write(page)
print(VERSION, counts)
