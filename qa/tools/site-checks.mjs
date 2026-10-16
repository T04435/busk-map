// v5 site checks: footer (F07-F11), logos (F12), Qloo links (F09), /terms (F10). Usage: node site-checks.mjs <repo> <port>
import { createRequire } from "node:module";
const require = createRequire(process.argv[2] + "/package.json");
const { chromium } = require("@playwright/test");
const B = `http://localhost:${process.argv[3]}`; const out = [];
const ok = (n, pass, d = "") => out.push(`${pass ? "PASS" : "FAIL"}  ${n}${d ? "  :: " + d : ""}`);
const ROUTES = ["/", "/busks", "/week?example=acoustic", "/brain", "/tips", "/brand", "/terms", "/plan?example=acoustic", "/no-such-page"];
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const logoKinds = new Map();
for (const r of ROUTES) {
  const res = await p.goto(B + r); await p.waitForTimeout(r.startsWith("/plan") ? 3000 : 1200);
  if (r === "/terms") {
    ok("F10 /terms exists (200)", res.status() === 200, `status ${res.status()}`);
    ok("F10 /terms holds the legal line", /never confirms a pitch is legal/i.test(await p.locator("main").innerText().catch(() => "")));
  }
  const info = await p.evaluate(() => {
    const logos = [...document.querySelectorAll('svg[aria-label="Busk Map"], img[alt*="Busk Map" i]')].filter((e) => e.getBoundingClientRect().width > 0).map((e) => `${e.tagName === "IMG" ? "img:" + e.getAttribute("src") : "svg:" + e.getAttribute("viewBox")}${e.closest("footer") ? "@footer" : e.closest("header") ? "@header" : e.closest("main") ? "@main" : ""}`);
    const qloo = [...document.querySelectorAll('svg[aria-label="Qloo"], img[alt="Qloo" i]')].filter((e) => e.getBoundingClientRect().width > 0).map((e) => { const a = e.closest("a"); return a ? `${a.getAttribute("href")}|${a.getAttribute("target")}|${a.getAttribute("rel")}` : "NO LINK"; });
    const f = document.querySelector("footer");
    const ft = f?.innerText ?? "";
    const links = f ? [...f.querySelectorAll("a")].map((a) => `${a.innerText.trim().replace(/\s+/g, " ") || a.getAttribute("aria-label") || "(icon)"}->${a.getAttribute("href")}`) : [];
    return { logos, qloo, legalInFooter: /never confirms a pitch is legal/i.test(ft), terms: links.some((l) => /->\/terms$/.test(l)), links, footerText: ft.replace(/\s+/g, " ").slice(0, 300) };
  });
  info.logos.forEach((l) => logoKinds.set(l.split("@")[0], [...(logoKinds.get(l.split("@")[0]) ?? []), r]));
  ok(`F09 ${r}: every Qloo logo links to qloo.com, new tab, noopener`, info.qloo.every((q) => /^https:\/\/(www\.)?qloo\.com\/?/.test(q) && q.includes("|_blank|") && /noopener/.test(q)), info.qloo.join(" ; ") || "(no Qloo logo)");
  if (r !== "/no-such-page") {
    ok(`F10 ${r}: footer links to /terms and no longer shows the legal line`, info.terms && !info.legalInFooter, `terms link ${info.terms}, legal line in footer ${info.legalInFooter}`);
  }
  if (r === "/") out.push(`INFO  footer links: ${info.links.join(" · ")}\nINFO  footer text: ${info.footerText}`);
}
const kinds = [...logoKinds.keys()];
ok("F12 one Busk Map logo design across the app (outside /brand's specimens)", [...logoKinds.entries()].filter(([, rs]) => rs.some((r) => r !== "/brand")).length === 1, [...logoKinds.entries()].map(([k, rs]) => `${k} on ${[...new Set(rs)].join(",")}`).join(" | "));
// F07, F08, F11 at 1440 on /
await p.goto(B + "/"); await p.waitForTimeout(1200);
const f = await p.evaluate(() => {
  const ft = document.querySelector("footer"); if (!ft) return null;
  const a = [...ft.querySelectorAll("a")].map((e) => ({ t: (e.innerText.trim() || e.getAttribute("aria-label") || "").replace(/\s+/g, " "), h: e.getAttribute("href"), x: e.getBoundingClientRect().left, svg: !!e.querySelector("svg") }));
  return { a, w: ft.getBoundingClientRect().width, repoText: /github\.com\//i.test(ft.innerText), at: /@T04435|@t04435/.test(ft.innerText) };
});
const gh = f?.a.find((l) => /github\.com/.test(l.h ?? ""));
ok("F07 GitHub is an icon link (no “github.com/…” text)", gh && gh.svg && !f.repoText, JSON.stringify(gh));
const built = f?.a.filter((l) => /T04435|built by/i.test(l.t) || (l.svg && !/github\.com\/T04435\/busk-map|qloo/.test(l.h ?? "")));
ok("F08 “Built by T04435” is a link and the pixel mark (an SVG) is a link; no “@…” text", built?.some((l) => /built by t04435/i.test(l.t)) && built?.some((l) => l.svg && !/T04435\/busk-map/.test(l.h ?? "")) && !f.at, JSON.stringify(built));
const third = (x) => (x < f.w / 3 ? "L" : x < (2 * f.w) / 3 ? "C" : "R");
const pos = Object.fromEntries((f?.a ?? []).map((l) => [l.t || l.h, third(l.x)]));
ok("F11 layout: Privacy · Brain · Brand in the centre; GitHub and Built by on the right", ["Privacy", "Brain", "Brand"].every((k) => Object.entries(pos).some(([t, s]) => t.startsWith(k) && s === "C")) && gh && third(gh.x) === "R", JSON.stringify(pos));
await b.close(); console.log(out.join("\n"));
