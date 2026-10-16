// User rule (17 Oct): no text glyph used as an icon, in rendered pages or in the source. Arrows, triangles, ticks, crosses,
// stars, bullets and the like (▸ ► ▶ → ← ✓ ✔ ✗ ✕ ★ …), and “—”/“–” used as a connector between elements, fail. The middle
// dot “·” inside copy is allowed; so are dashes inside running text. Icons must be SVG (the DS Icon set).
// Usage: node glyph-icons.mjs <repo export> <port>
import { createRequire } from "node:module";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
const repo = process.argv[2];
const require = createRequire(repo + "/package.json");
const { chromium } = require("@playwright/test");
const B = `http://localhost:${process.argv[3]}`;
const GLYPHS = "▸►▶▹▷▻◂◄◀◃◁→←↑↓↔↗↘↙↖⇒⇐⟶⟵➜➔➝➞➡⬅✓✔✗✘✕✖★☆✦✧✩◆◇▲▼△▽●○◦•›‹»«";
// “×” counts only when it stands alone (a close or remove icon); “1280 × 640” and “×3” are copy.
const GLYPH_RE = new RegExp(`[${GLYPHS}]`);
const ROUTES = ["/", "/busks", "/repertoire", "/brain", "/brand", "/privacy", "/terms", "/plan?example=folk-duo", "/this-is-not-a-pitch", "/p/ZZZZZZZZZ"];
const out = [];
const b = await chromium.launch();
for (const w of [1440, 390]) {
  const p = await b.newPage({ viewport: { width: w, height: 900 } });
  for (const r of ROUTES) {
    await p.goto(B + r); await p.waitForTimeout(r.startsWith("/plan") ? 4000 : 1200);
    const hits = await p.evaluate((src) => {
      const re = new RegExp(src); const found = [];
      const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
      while ((n = tw.nextNode())) {
        const t = n.textContent; const el = n.parentElement; if (!el || ["SCRIPT", "STYLE", "NOSCRIPT"].includes(el.tagName)) continue;
        const r = el.getBoundingClientRect(); if (!r.width && !r.height) continue;
        const trimmed = t.trim();
        // A lone dash is a connector only when it sits between elements, not between words (“9 am–12 pm” renders the dash
        // as its own text node between two text nodes: that is copy).
        const sib = (x) => x && x.nodeType === 3 && /[\p{L}\p{N}]/u.test(x.textContent);
        const loneDash = /^[—–-]$/.test(trimmed);
        const inCopy = loneDash && (sib(n.previousSibling) || sib(n.nextSibling) || /[\p{L}\p{N}]/u.test((el.textContent || "").replace(trimmed, "")) && el.childNodes.length > 1);
        const connector = loneDash && !inCopy;
        const lonelyTimes = trimmed === "×";
        if (!connector && !lonelyTimes && !re.test(t)) continue;
        {
          const ctx = (el.closest("li, a, button, p, span, div")?.innerText || trimmed).replace(/\s+/g, " ").slice(0, 70);
          found.push(`${connector ? "connector “" + trimmed + "”" : "glyph “" + (lonelyTimes ? "×" : (t.match(re) || [""])[0]) + "”"} in <${el.tagName.toLowerCase()}>: ${ctx}`);
        }
      }
      return [...new Set(found)];
    }, GLYPH_RE.source);
    for (const h of hits) out.push(`FAIL  ${r} @${w}: ${h}`);
    if (!hits.length) out.push(`PASS  ${r} @${w}: no glyph icons`);
  }
  await p.close();
}
await b.close();
// Source: JSX text and string literals in src (comments skipped).
const files = [];
const walk = (d) => { for (const f of readdirSync(d)) { const q = join(d, f); if (statSync(q).isDirectory()) walk(q); else if (/\.(tsx|ts)$/.test(f)) files.push(q); } };
walk(join(repo, "src"));
const src = [];
for (const f of files) {
  readFileSync(f, "utf8").split("\n").forEach((line, i) => {
    const code = line.replace(/\/\/.*$/, "").replace(/^\s*\*.*$/, "").replace(/\/\*.*?\*\//g, "");
    if (GLYPH_RE.test(code) || />\s*[—–]\s*</.test(code) || />\s*×\s*</.test(code)) src.push(`${f.slice(repo.length + 1)}:${i + 1}: ${code.trim().slice(0, 100)}`);
  });
}
for (const s of src) out.push(`FAIL  source ${s}`);
if (!src.length) out.push("PASS  source: no glyph icons in src");
console.log(out.join("\n"));
console.log(`${out.filter((l) => l.startsWith("FAIL")).length} fail of ${out.length}`);
