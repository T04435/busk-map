// The Week planner was removed by the user (17 Oct; it becomes its own stream later). Checks that nothing of it remains:
// /week is 404; no nav, bottom-nav or footer link to /week; no “Plan my week instead”; no week copy on / or /busks.
// Usage: node no-week-checks.mjs <repo export> <port>
import { createRequire } from "node:module";
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
const repo = process.argv[2];
const require = createRequire(repo + "/package.json");
const { chromium } = require("@playwright/test");
const B = `http://localhost:${process.argv[3]}`;
const out = [];
const ok = (n, pass, d = "") => out.push(`${pass ? "PASS" : "FAIL"}  ${n}${d ? "  :: " + d : ""}`);
const COPY = /plan (my|your) week|week planner|your week\b|this week's|top sessions|plan a week|\bweek from\b/i;
const ROUTES = ["/", "/busks", "/brain", "/brand", "/privacy", "/terms", "/plan?example=folk-duo", "/no-such-page"];
const COPY_ROUTES = new Set(["/", "/busks", "/plan?example=folk-duo"]);

// 1. Rendered pages
const b = await chromium.launch();
for (const w of [390, 1440]) {
  const p = await b.newPage({ viewport: { width: w, height: 900 } });
  const r = await p.goto(B + "/week?example=acoustic");
  ok(`/week is gone (404) @${w}`, r.status() === 404, `status ${r.status()}`);
  for (const route of ROUTES) {
    await p.goto(B + route); await p.waitForTimeout(route.startsWith("/plan") ? 4000 : 1200);
    const found = await p.evaluate((src) => {
      const re = new RegExp(src, "i");
      const nav = [...document.querySelectorAll("nav a")].filter((a) => a.getBoundingClientRect().width).map((a) => a.innerText.trim()).filter(Boolean);
      const links = [...document.querySelectorAll('a[href^="/week"], a[href*="/week?"]')].map((a) => a.getAttribute("href"));
      const text = document.body.innerText; const m = text.match(re);
      return { nav, links, copy: m ? text.slice(Math.max(0, m.index - 40), m.index + 60).replace(/\s+/g, " ") : null };
    }, COPY.source);
    ok(`${route} @${w}: no Week nav item`, !found.nav.some((t) => /^week$/i.test(t)), found.nav.join(" · "));
    const weekBtn = await p.getByRole("button", { name: /plan my week/i }).or(p.getByRole("link", { name: /plan my week/i })).count();
    ok(`${route} @${w}: no “Plan my week instead”`, weekBtn === 0, `${weekBtn}`);
    ok(`${route} @${w}: no link to /week`, found.links.length === 0, found.links.join(" "));
    if (COPY_ROUTES.has(route)) ok(`${route} @${w}: no week copy`, !found.copy, found.copy ?? "");
  }
  await p.close();
}
await b.close();

// 2. Source (the export of the commit under test)
const files = [];
const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); const s = statSync(p); if (s.isDirectory()) walk(p); else if (/\.(tsx?|mts|css|json)$/.test(f)) files.push(p); } };
walk(join(repo, "src"));
const paths = ["src/app/week", "src/components/week", "src/app/api/week"].filter((p) => existsSync(join(repo, p)));
ok("source: no week route, components or API", paths.length === 0, paths.join(" "));
const SRC = /\b(WeekView|weekSearchParams|buildWeekPlan|weekSchema)\b|["'`]\/week\b/;
const hits = files.filter((f) => SRC.test(readFileSync(f, "utf8"))).map((f) => f.slice(repo.length + 1));
ok("source: no week symbols or /week links left", hits.length === 0, hits.slice(0, 12).join(" ") + (hits.length > 12 ? ` (+${hits.length - 12})` : ""));
console.log(out.join("\n"));
console.log(`${out.filter((l) => l.startsWith("FAIL")).length} fail of ${out.length}`);
