// Tips was removed by the user (17 Oct). Checks that nothing of it remains: no /tips route, nav item, link, tip copy or tip
// factor, in the rendered pages and in the source. Usage: node no-tips-checks.mjs <repo export> <port>
import { createRequire } from "node:module";
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
const repo = process.argv[2];
const require = createRequire(repo + "/package.json");
const { chromium } = require("@playwright/test");
const B = `http://localhost:${process.argv[3]}`;
const out = [];
const ok = (n, pass, d = "") => out.push(`${pass ? "PASS" : "FAIL"}  ${n}${d ? "  :: " + d : ""}`);
const COPY = /\btip log\b|\btip-log\b|log (your )?takings|your tips\b|tip history|\btakings\b|tips? bonus|from your tips/i;
const ROUTES = ["/", "/busks", "/repertoire", "/brain", "/brand", "/privacy", "/terms", "/plan?example=folk-duo", "/no-such-page"];

// 1. Rendered pages
const b = await chromium.launch();
for (const w of [390, 1440]) {
  const p = await b.newPage({ viewport: { width: w, height: 900 } });
  const r = await p.goto(B + "/tips");
  ok(`/tips is gone (404) @${w}`, r.status() === 404, `status ${r.status()}`);
  for (const route of ROUTES) {
    await p.goto(B + route); await p.waitForTimeout(route.startsWith("/plan") ? 4000 : 1200);
    const found = await p.evaluate((src) => {
      const re = new RegExp(src, "i");
      const nav = [...document.querySelectorAll("nav a")].filter((a) => a.getBoundingClientRect().width).map((a) => a.innerText.trim()).filter(Boolean);
      const links = [...document.querySelectorAll('a[href^="/tips"], a[href*="/tips?"]')].map((a) => a.getAttribute("href"));
      const text = document.body.innerText; const m = text.match(re);
      return { nav, links, copy: m ? text.slice(Math.max(0, m.index - 40), m.index + 60).replace(/\s+/g, " ") : null };
    }, COPY.source);
    ok(`${route} @${w}: no Tips nav item`, !found.nav.some((t) => /^tips$/i.test(t)), found.nav.join(" · "));
    ok(`${route} @${w}: no link to /tips`, found.links.length === 0, found.links.join(" "));
    ok(`${route} @${w}: no tip copy`, !found.copy, found.copy ?? "");
  }
  await p.close();
}
await b.close();

// 2. Source (the export of the commit under test)
const files = [];
const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); const s = statSync(p); if (s.isDirectory()) walk(p); else if (/\.(tsx?|mts|css|json)$/.test(f)) files.push(p); } };
walk(join(repo, "src"));
const paths = ["src/app/tips", "src/components/tips", "src/server/scoring/tips.ts", "src/lib/example-tips.ts"].filter((p) => existsSync(join(repo, p)));
ok("source: no tips route, components, scoring or example data", paths.length === 0, paths.join(" "));
const SRC = /\b(tipHistory|tipBonus|tipFactor|tipCookie|TIP_COOKIE|tip-log|TipLog|useTipSync|exampleTips|readTips|tipsFor)\b|["'`]\/tips\b/;
const hits = files.filter((f) => SRC.test(readFileSync(f, "utf8"))).map((f) => f.slice(repo.length + 1));
ok("source: no tip symbols, cookie or /tips links left", hits.length === 0, hits.slice(0, 12).join(" ") + (hits.length > 12 ? ` (+${hits.length - 12})` : ""));
console.log(out.join("\n"));
console.log(`${out.filter((l) => l.startsWith("FAIL")).length} fail of ${out.length}`);
