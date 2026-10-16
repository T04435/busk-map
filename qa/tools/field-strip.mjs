// F13/F14: every input, select, picker and button, unfocused and focused, at 390 and 1440, day and night.
// Counts borders and focus rings per field (the element plus wrappers hugging it). Usage: node field-strip.mjs <repo> <port> <outDir>
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
const require = createRequire(process.argv[2] + "/package.json");
const { chromium } = require("@playwright/test");
const B = `http://localhost:${process.argv[3]}`, OUT = process.argv[4]; mkdirSync(OUT, { recursive: true });
const ROUTES = process.argv[5] ? process.argv[5].split(",") : ["/busks", "/tips", "/week?example=acoustic", "/"];
const SEL = 'main input:not([type=hidden]):not([type=checkbox]):not([type=radio]), main textarea, main select, main [role=combobox], main button, main [role=switch], main a[data-slot=button]';
// A radio inside a choice card draws its focus on the CARD (BRAND's ruling: .bm-choice:focus-within), so measure the card.
const CARD = "[data-slot=choice-card], .bm-choice";
const measure = `(el0) => {
  const el = el0.closest("${CARD}") || el0;
  const r0 = el.getBoundingClientRect(); const layers = []; let e = el;
  for (let i = 0; e && i < 3; i++, e = e.parentElement) {
    const r = e.getBoundingClientRect(); if (i && (Math.abs(r.left - r0.left) > 8 || Math.abs(r.right - r0.right) > 8 || Math.abs(r.top - r0.top) > 8 || Math.abs(r.bottom - r0.bottom) > 8)) break;
    const s = getComputedStyle(e); const vis = (c) => !/rgba\\(\\s*\\d+,\\s*\\d+,\\s*\\d+,\\s*0\\s*\\)|transparent/.test(c);
    const border = ["Top","Right","Bottom","Left"].some((k) => parseFloat(s["border"+k+"Width"]) > 0 && s["border"+k+"Style"] !== "none" && vis(s["border"+k+"Color"]));
    const outline = s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0 && vis(s.outlineColor);
    const rings = s.boxShadow === "none" ? 0 : s.boxShadow.split(/,(?![^(]*\\))/).filter((sh) => { const n = (sh.match(/-?[\\d.]+px/g) || []).map(parseFloat); return n.length >= 4 && n[0] === 0 && n[1] === 0 && n[3] > 0 && vis(sh); }).length;
    layers.push({ border, outline, rings });
  }
  return { borders: layers.filter((l) => l.border).length, rings: layers.reduce((n, l) => n + (l.outline ? 1 : 0) + l.rings, 0) };
}`;
const b = await chromium.launch(); const rows = []; const report = [];
for (const scheme of ["light", "dark"]) for (const w of [390, 1440]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 900 }, colorScheme: scheme, reducedMotion: "reduce" }); const p = await ctx.newPage();
  for (const r of ROUTES) {
    await p.goto(B + r); await p.waitForTimeout(1500);
    const n = Math.min(await p.locator(SEL).count(), 40);
    for (let i = 0; i < n; i++) {
      const el = p.locator(SEL).nth(i);
      if (!(await el.isVisible().catch(() => false))) continue;
      const name = ((await el.getAttribute("aria-label")) || (await el.getAttribute("placeholder")) || (await el.innerText().catch(() => "")) || (await el.getAttribute("id")) || "field").replace(/\s+/g, " ").trim().slice(0, 40);
      const kind = await el.evaluate((e) => e.tagName.toLowerCase() + (e.getAttribute("role") ? ":" + e.getAttribute("role") : "") + (e.type && e.tagName === "INPUT" ? ":" + e.type : ""));
      await el.scrollIntoViewIfNeeded(); await p.mouse.move(0, 0); await p.evaluate(() => document.activeElement?.blur());
      const card = el.locator(`xpath=ancestor-or-self::*[@data-slot="choice-card" or contains(concat(" ", normalize-space(@class), " "), " bm-choice ")][1]`);
      const box = (await card.count()) ? await card.first().boundingBox() : await el.boundingBox(); if (!box || box.width < 4) continue;
      const clip = { x: Math.max(0, box.x - 10), y: Math.max(0, box.y - 10), width: Math.min(w - Math.max(0, box.x - 10), box.width + 20), height: box.height + 20 };
      const id = `${scheme}-${w}-${r.replace(/[^a-z]/gi, "") || "home"}-${i}`;
      const un = await el.evaluate(new Function("return " + measure)());
      await p.screenshot({ path: `${OUT}/${id}-u.png`, clip });
      await el.evaluate((e) => e.focus({ focusVisible: true })); await p.waitForTimeout(150);
      const fo = await el.evaluate(new Function("return " + measure)());
      await p.screenshot({ path: `${OUT}/${id}-f.png`, clip });
      const pass = un.borders <= 1 && un.rings === 0 && fo.borders <= 1 && fo.rings === 1;
      rows.push({ id, scheme, w, route: r, kind, name, un, fo, pass });
      await p.evaluate(() => document.activeElement?.blur()); await p.keyboard.press("Escape").catch(() => {});
    }
  }
  await ctx.close();
}
await b.close();
writeFileSync(`${OUT}/fields.json`, JSON.stringify(rows, null, 1));
const fails = rows.filter((r) => !r.pass);
console.log(`${rows.length} field states measured, ${fails.length} fail`);
const by = {}; for (const r of fails) { const k = `${r.route} ${r.kind} “${r.name}” un b${r.un.borders}/r${r.un.rings} fo b${r.fo.borders}/r${r.fo.rings}`; (by[k] ??= []).push(`${r.scheme}@${r.w}`); }
for (const [k, v] of Object.entries(by).slice(0, 40)) console.log("FAIL", k, v.join(","));
