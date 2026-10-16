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
// F12 (user, corrected 17 Oct): the ONE logo is [hex mark][new wordmark] (the lockup) in the header, the footer and every
// asset. Wordmark-only or mark-only in a header or footer fails; the mark alone is fine only at icon size (favicon, app icon).
// The build's Logo variants by viewBox: lockup "2 0 256 48", wordmark-only "0 0 322 52", mark/ring "0 0 48 48". Anything else
// is reported as UNKNOWN for a visual check against the user's reference (new stencil lettering, not the old larger-M face).
const kindOf = (k) => (k === "svg:2 0 256 48" || /lockup/i.test(k) ? "lockup" : k === "svg:0 0 322 52" || /wordmark/i.test(k) ? "wordmark-only" : k === "svg:0 0 48 48" || /mark|icon/i.test(k) ? "mark-only" : "UNKNOWN");
const chrome = [...logoKinds.entries()].flatMap(([k, rs]) => rs.filter((r) => r !== "/brand").map((r) => [k, r]));
const placed = await (async () => { const out = []; const p2 = await b.newPage({ viewport: { width: 1440, height: 900 } });
  for (const r of ROUTES.filter((x) => x !== "/brand")) { await p2.goto(B + r); await p2.waitForTimeout(800);
    out.push(...(await p2.evaluate(() => [...document.querySelectorAll('header svg[aria-label="Busk Map"], footer svg[aria-label="Busk Map"], header img[alt*="Busk Map" i], footer img[alt*="Busk Map" i]')].filter((e) => e.getBoundingClientRect().width > 0).map((e) => `${e.closest("footer") ? "footer" : "header"}:${e.tagName === "IMG" ? "img:" + e.getAttribute("src") : "svg:" + e.getAttribute("viewBox")}`))).map((x) => `${r} ${x}`)); }
  await p2.close(); return out; })();
const bad = placed.filter((x) => kindOf(x.split(":").slice(1).join(":")) !== "lockup");
ok("F12 header and footer use the lockup ([hex mark][wordmark]) on every route; no wordmark-only or mark-only", placed.length > 0 && bad.length === 0, bad.length ? bad.slice(0, 6).join(" | ") : `${placed.length} placements, all lockup`);
ok("F12 one logo design in the app chrome (outside /brand's specimens)", new Set(chrome.map(([k]) => k)).size === 1, [...new Set(chrome.map(([k]) => `${k} (${kindOf(k)})`))].join(" | "));
out.push("INFO  F12 lettering: compare a header crop with design-handoff/user-feedback-2026-10-17/04-wordmark-only-one.png (new stencil BUSK MAP); the old face with the larger M fails.");
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
