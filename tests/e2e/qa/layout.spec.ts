/**
 * QA: every screen renders without breaking at 390, 768 and 1440 px (run through qa/playwright.config.ts, whose
 * projects are those widths). A screen fails on horizontal page scroll, on visible content cut off at the viewport's
 * right edge, or on a console error. A full-page screenshot of each is attached to the report.
 */
import { writeFileSync } from "node:fs";
import { expect, LOCAL, test } from "../fixtures";

type Page = import("@playwright/test").Page;

const SCREENS: { name: string; path: string; ready: (p: Page) => Promise<void> }[] = [
  { name: "landing", path: "/", ready: (p) => expect(p.getByRole("form", { name: "Plan for your own act" })).toBeVisible() },
  { name: "plan acoustic", path: "/plan?example=acoustic", ready: (p) => expect(p.getByRole("region", { name: "Pitches", exact: true })).toBeVisible() },
  { name: "plan sax", path: "/plan?example=sax", ready: (p) => expect(p.getByRole("region", { name: "Pitches", exact: true })).toBeVisible() },
  { name: "plan folk duo", path: "/plan?example=folk-duo", ready: (p) => expect(p.getByRole("region", { name: "Pitches", exact: true })).toBeVisible() },
  { name: "week sax", path: "/week?example=sax", ready: (p) => expect(p.getByRole("list", { name: "Top sessions" })).toBeVisible() },
  { name: "brain", path: "/brain", ready: (p) => expect(p.getByRole("heading", { name: "The wiring" })).toBeVisible() },
  { name: "tip log", path: "/tips", ready: (p) => expect(p.getByRole("heading", { level: 1 })).toBeVisible() },
  { name: "not found", path: "/qa-no-such-page", ready: (p) => expect(p.getByText("No pitch here")).toBeVisible() },
  { name: "plan not found", path: "/p/zzzzzzzzz", ready: (p) => expect(p.getByText("Plan not found")).toBeVisible() },
  { name: "plan limit reached", path: "/plan?example=sax&faults=fresh-limit", ready: (p) => expect(p.getByText("Plan limit reached")).toBeVisible() },
  { name: "error page", path: "/plan?example=acoustic&faults=render", ready: (p) => expect(p.getByText("Something went wrong").first()).toBeVisible() },
  { name: "Qloo down", path: "/plan?example=acoustic&faults=qloo", ready: (p) => expect(p.getByRole("alert").first()).toBeVisible() },
];

test.describe("QA layout at 390, 768 and 1440 px", () => {
  test.skip(!LOCAL, "Uses offline fixtures and fault switches");

  for (const { name, path, ready } of SCREENS) {
    test(name, async ({ page }, testInfo) => {
      const errors: string[] = [];
      page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(path);
      await ready(page);
      // Not "networkidle": the landing page's data warm-up keeps a request open for up to a minute.
      await page.waitForTimeout(750);

      const layout = await page.evaluate(() => {
        const width = document.documentElement.clientWidth;
        const cut = [...document.querySelectorAll<HTMLElement>("body *")]
          .filter((el) => {
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0 || r.right <= width + 1) return false;
            // Content inside a scroll container (tables, code) or a clipped box is fine: it doesn't move the page.
            for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
              const o = getComputedStyle(a).overflowX;
              if (o === "auto" || o === "scroll" || o === "hidden" || o === "clip") return false;
            }
            const s = getComputedStyle(el);
            return s.visibility !== "hidden" && s.position !== "fixed";
          })
          .slice(0, 5)
          .map((el) => `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""} "${(el.textContent ?? "").trim().slice(0, 40)}" right=${Math.round(el.getBoundingClientRect().right)}`);
        // An empty field whose placeholder is wider than the room for text: the hint is cut off (missed in the baseline walk).
        const ctx = document.createElement("canvas").getContext("2d")!;
        const clipped = [...document.querySelectorAll<HTMLInputElement>("input[placeholder]:not([type=hidden])")]
          .filter((el) => {
            const r = el.getBoundingClientRect();
            if (el.value || r.width === 0) return false;
            const s = getComputedStyle(el);
            ctx.font = `${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
            const room = el.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight);
            return ctx.measureText(el.placeholder).width > room + 1;
          })
          .map((el) => `input "${el.placeholder}"`);
        return { width, scrollWidth: document.documentElement.scrollWidth, cut, clipped };
      });

      const shot = await page.screenshot({ fullPage: true });
      await testInfo.attach(`${name}.png`, { body: shot, contentType: "image/png" });
      // QA_SHOTS=<dir outside the repo> keeps every screenshot, passed or not, for the visual walk.
      if (process.env.QA_SHOTS) writeFileSync(`${process.env.QA_SHOTS}/${testInfo.project.name}-${name.replace(/\W+/g, "-")}.png`, shot);
      expect(layout.scrollWidth, "horizontal page scroll").toBeLessThanOrEqual(layout.width);
      expect(layout.cut, "content cut off at the right edge").toEqual([]);
      expect(layout.clipped, "placeholder text cut off").toEqual([]);
      // Expected by design: the forced render fault's own error, a not-found page's 404 and the limit page's 429.
      const unexpected = path.includes("faults=render") ? [] : errors.filter((e) => !/status of (404|429|503)/.test(e));
      expect(unexpected, "console errors").toEqual([]);
    });
  }
});
