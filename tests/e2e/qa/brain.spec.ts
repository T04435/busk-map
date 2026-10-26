/**
 * QA: /brain (515321a..f9edb1a). Runs at 390, 768 and 1440 px through qa/playwright.config.ts; the breakpoint checks
 * set their own 1023 and 1024 px viewports.
 */
import { expect, test } from "../fixtures";

type Page = import("@playwright/test").Page;

const node = (page: Page, label: RegExp) => page.locator("[data-node-id]").filter({ hasText: label }).first();
const status = (page: Page) => page.getByRole("status").filter({ hasText: /Trac/ }).or(page.locator('[role="status"][aria-live="polite"]')).first();

async function open(page: Page) {
  await page.goto("/brain");
  await expect(page.getByRole("heading", { name: "The wiring" })).toBeVisible();
  // Hydrated: the client effect has measured the grid (wires exist at ≥1024, or none below).
  await page.waitForFunction(() => document.querySelector("[data-node-id]") !== null);
}

test.describe("QA /brain", () => {
  test("facts strip matches docs/qloo-data-map.md and qloo-map.ts (18 kinds, 28–37 per new busk, 0 on a rerun, 10 parts, ≤ 25 per learn run)", async ({ page }) => {
    await open(page);
    const facts = page.getByRole("region", { name: "Qloo calls per busk" }).getByRole("listitem");
    // 18 kinds (the local scene, then the profile and fans calls), 10 parts (the Repertoire research joined), the learn-run cap (R4).
    await expect(facts).toHaveText([/^18\s*kinds of Qloo call$/, /^28–37\s*Qloo calls for a new busk$/, /^0\s*on a rerun: answers cached for 24 h$/, /^10\s*parts of your busk it decides$/, /^≤ 25\s*Qloo calls per learn run$/]);
    await expect(page.getByTestId("quota-note")).toHaveText("Answers are cached for 24 hours, and Busk Map paces its own calls to 3 a second, so a rerun makes no new calls.");
  });

  test("keyboard trace: Enter traces and announces; Escape clears, announces, and returns focus to the node", async ({ page }) => {
    await open(page);
    // BRAND's batch renamed the setlist part "Set and songs to learn"; Last.fm is its second other source (Repertoire R4).
    const setlist = node(page, /^Set and songs to learn/);
    await setlist.focus();
    await page.keyboard.press("Enter");
    await expect(setlist).toHaveAttribute("aria-pressed", "true");
    await expect(status(page)).toHaveText("Tracing. Set and songs to learn comes from 6 Qloo calls, 2 other sources and 7 data points. Other pieces are dimmed.");
    // The panel's claim: six Qloo calls, Spotify and Last.fm meet here (the four below among them).
    const panel = page.getByTestId("trace-panel");
    await expect(panel).toContainText("Comes from:");
    for (const piece of ["Artists nearby, explained", "Affinity at a pitch", "Trending", "Demographics", "Spotify", "Last.fm"]) await expect(panel).toContainText(piece);

    // Move focus to the Clear button, then Escape: focus must land back on the traced node.
    await page.getByRole("button", { name: "Clear trace" }).focus();
    await page.keyboard.press("Escape");
    await expect(status(page)).toHaveText("Trace cleared. Every piece is shown.");
    await expect(setlist).toHaveAttribute("aria-pressed", "false");
    await expect(setlist).toBeFocused();
  });

  test("every piece traces by keyboard: Enter selects, announces, opens its panel; Escape clears and keeps focus", async ({ page }) => {
    await open(page);
    const ids = await page.locator("[data-node-id]").evaluateAll((els) => els.map((e) => e.getAttribute("data-node-id")!));
    expect(ids.length, "23 call shapes (18 kinds) + 3 sources (Spotify, Ticketmaster, Last.fm) + 27 data points + 10 parts = 65, per qloo-map.ts").toBe(65);
    for (const id of ids) {
      const piece = page.locator(`[data-node-id="${id}"]`);
      await piece.focus();
      await page.keyboard.press("Enter");
      await expect(piece, id).toHaveAttribute("aria-pressed", "true");
      await expect(status(page), id).toHaveText(/^Tracing\. .+ Other pieces are dimmed\.$/);
      await expect(page.getByRole("button", { name: "Clear trace" }), id).toBeVisible();
      expect(await page.locator('[data-trace="path"]').count(), `${id} lights a path`).toBeGreaterThan(0);
      await page.keyboard.press("Escape");
      await expect(piece, id).toHaveAttribute("aria-pressed", "false");
      await expect(piece, id).toBeFocused();
    }
  });

  test("Next items are labelled as not built", async ({ page }) => {
    await open(page);
    const next = page.getByRole("heading", { name: "Next · not built yet" });
    await expect(next).toBeVisible();
    await expect(next.locator("xpath=..").getByRole("listitem")).toHaveCount(3);
  });

  test("Clear trace button clears and returns focus to the node", async ({ page }) => {
    await open(page);
    const heatmap = page.locator("[data-node-id]").first();
    await heatmap.click();
    await expect(heatmap).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Clear trace" }).click();
    await expect(heatmap).toBeFocused();
    await expect(page.getByTestId("trace-panel")).toContainText("Pick any piece");
  });

  test("the sticky trace panel never covers the focused node while tabbing (WCAG 2.4.11)", async ({ page }) => {
    await open(page);
    await node(page, /^Set and songs to learn/).click();
    const covered: string[] = [];
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press("Tab");
      const hit = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        const panel = document.querySelector('[data-testid="trace-panel"]');
        if (!el || !panel || panel.contains(el) || !el.closest("[data-node-id]")) return null;
        const a = el.getBoundingClientRect();
        const b = panel.getBoundingClientRect();
        const overlap = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
        return overlap >= a.height ? (el.getAttribute("data-node-id") ?? "?") : null;
      });
      if (hit) covered.push(hit);
    }
    expect(covered, "nodes fully hidden behind the sticky trace panel when focused").toEqual([]);
  });

  test("breakpoint: 1023 px stacks and hides dimmed pieces; 1024 px shows three columns with wires and keeps every piece", async ({ page }) => {
    for (const [width, wide] of [[1023, false], [1024, true]] as const) {
      await page.setViewportSize({ width, height: 900 });
      await open(page);
      const columns = await page.getByTestId("brain-grid").evaluate((g) => getComputedStyle(g).gridTemplateColumns.split(" ").length);
      // Honeycomb: three columns with a 72 px wire gutter between each pair (5 tracks) at ≥1024, one stacked column below.
      expect(columns, `${width}px columns`).toBe(wide ? 5 : 1);
      // Wires: two aria-hidden gutters, shown only at ≥1024, each an SVG whose paths hold one "M…" segment per edge.
      // (A straight wire has zero height, so Playwright's toBeVisible can't be used on a path.)
      const gutters = page.locator("[data-testid=brain-grid] > div[aria-hidden=true]");
      await expect(gutters).toHaveCount(2);
      for (const d of await gutters.evaluateAll((els) => els.map((el) => getComputedStyle(el).display))) expect(d, `${width}px wires`).toBe(wide ? "block" : "none");
      if (wide) {
        const segments = await gutters.locator("path").evaluateAll((ps) => ps.reduce((n, p) => n + ((p.getAttribute("d") ?? "").match(/M/g)?.length ?? 0), 0));
        expect(segments, "wire segments").toBeGreaterThan(10);
      }
      await node(page, /^Set and songs to learn/).click();
      const dimmed = page.locator('[data-trace="dim"]');
      expect(await dimmed.count()).toBeGreaterThan(0);
      if (wide) await expect(dimmed.first()).toBeVisible();
      else await expect(dimmed.first()).toBeHidden();
      await page.keyboard.press("Escape");
    }
  });

  test("the landing teaser opens /brain", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /Open the brain/ }).click();
    await expect(page).toHaveURL(/\/brain$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Qloo");
  });
});
