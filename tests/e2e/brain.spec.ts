import { mkdirSync } from "node:fs";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./fixtures";

/**
 * /brain, "The brain of Busk Map": Qloo calls → data points → features, with tracing.
 *
 * Width tests set their own viewports (390, 768, 1440) and run in the desktop project only, like layout.spec.ts
 * (which also checks /brain for overflow and covered controls). Above 1023 px a trace dims the pieces off the path;
 * at 1023 px and below the columns stack and a trace hides them. Screenshots go to the hackathon folder
 * (screens/brain-<width>.png, full page, brain-<width>-traced.png, the viewport at the wiring, and brain-focus-<width>.png,
 * a piece focused by Tab just above the open trace panel), or LAYOUT_SCREENS_DIR.
 */
const WIDTHS = [
  { name: "390", viewport: { width: 390, height: 844 }, stacked: true },
  { name: "768", viewport: { width: 768, height: 1024 }, stacked: true },
  { name: "1440", viewport: { width: 1440, height: 900 }, stacked: false },
] as const;

const SCREENS = process.env.LAYOUT_SCREENS_DIR ?? path.resolve(__dirname, "../../../hackathon/hackathons/qloo-2026/screens");

const nodeOf = (page: Page, id: string) => page.locator(`[data-node-id="${id}"]`);

async function openBrain(page: Page) {
  await page.goto("/brain");
  await expect(page).toHaveTitle("The brain of Busk Map");
  await expect(page.getByRole("heading", { level: 1, name: /Qloo/ })).toBeVisible();
  await expect(nodeOf(page, "c3")).toBeVisible();
}

/** Visible, in view and not covered: the element at its centre is the control or inside it. */
async function expectOnTop(control: Locator, what: string) {
  await control.scrollIntoViewIfNeeded();
  await expect(control, what).toBeVisible();
  await expect
    .poll(() =>
      control.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return hit && (hit === el || el.contains(hit)) ? "on top" : `covered by ${hit?.outerHTML.slice(0, 120) ?? "nothing"}`;
      }),
    )
    .toBe("on top");
}

async function expectNoSidewaysScroll(page: Page) {
  const { scroll, inner } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
  expect(scroll, "horizontal page overflow").toBeLessThanOrEqual(inner + 1);
}

test.describe("the brain of Busk Map at three widths", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Sets its own viewports: runs once, in the desktop project");
  });
  test.beforeAll(() => mkdirSync(SCREENS, { recursive: true }));

  for (const width of WIDTHS) {
    test.describe(`${width.name} px`, () => {
      test.use({ viewport: width.viewport });

      test("renders, traces a call to its features, and clears", async ({ page }) => {
        await openBrain(page);
        await expect(page.getByText("kinds of Qloo call")).toBeVisible();
        await expect(page.getByTestId("quota-note")).toContainText("10,000 requests a month per key, at 5 a second");
        await expect(page.getByRole("heading", { name: "Next (not built yet)" })).toBeVisible();
        await expect(page.locator("[data-node-id]")).toHaveCount(14 + 2 + 17 + 10);
        await expectNoSidewaysScroll(page);
        await page.screenshot({ path: path.join(SCREENS, `brain-${width.name}.png`), fullPage: true });

        // Trace call 3, the taste heatmap: taste cells, then the taste map and four more features.
        const call = nodeOf(page, "c3");
        await call.click();
        await expect(call).toHaveAttribute("aria-pressed", "true");
        await expect(call).toHaveAttribute("data-trace", "selected");
        await expect(nodeOf(page, "d_cells")).toHaveAttribute("data-trace", "path");
        await expect(nodeOf(page, "f_map")).toHaveAttribute("data-trace", "path");
        await expect(nodeOf(page, "f_map")).toBeVisible();
        for (const off of ["f_fans", "c4", "d_trend", "spotify"]) {
          await expect(nodeOf(page, off)).toHaveAttribute("data-trace", "dim");
          if (width.stacked) await expect(nodeOf(page, off), `${off} is filtered out`).toBeHidden();
          else await expect(nodeOf(page, off), `${off} is dimmed, still shown`).toBeVisible();
        }
        await expect(page.getByRole("status")).toContainText("Tracing. Taste heatmap feeds 1 data point and 5 parts of your busk.");
        const clear = page.getByRole("button", { name: "Clear trace" });
        await expectOnTop(clear, "Clear trace");
        await expectNoSidewaysScroll(page);
        // The trace panel sticks to the bottom of the viewport, so the traced shot is the viewport from "The wiring" down.
        await page.getByRole("heading", { name: "The wiring" }).evaluate((el) => el.scrollIntoView({ block: "start" }));
        await page.screenshot({ path: path.join(SCREENS, `brain-${width.name}-traced.png`) });

        await clear.click();
        await expect(page.locator("[data-node-id][data-trace]:not([data-trace='none'])")).toHaveCount(0);
        await expect(page.locator("[aria-pressed='true']")).toHaveCount(0);
        await expect(nodeOf(page, "f_fans")).toBeVisible();
        await expect(call).toBeFocused();
        await expect(page.getByRole("status")).toHaveText("Trace cleared. Every piece is shown.");
      });

      test("with a trace open, every piece focused by Tab stays clear of the folded trace panel (WCAG 2.4.11, B-015)", async ({ page }) => {
        await openBrain(page);
        await nodeOf(page, "f_setlist").click();
        await expect(page.getByRole("button", { name: "Clear trace" })).toBeVisible();
        // Start from the first piece shown, then Tab through every piece to the panel's Clear button.
        await page.locator("[data-node-id]:visible").first().focus();
        const shown = await page.locator("[data-node-id]:visible").count();
        const seen: string[] = [];
        const hidden: string[] = [];
        const unfolded: string[] = [];
        let shot = false;
        for (let i = 0; i <= shown + 2; i++) {
          if (i > 0) await page.keyboard.press("Tab");
          const at = await page.evaluate(() => {
            const el = document.activeElement as HTMLElement | null;
            const panel = document.querySelector('[data-testid="trace-panel"]');
            if (!el || !panel) return { done: true } as const;
            if (panel.contains(el) || !el.hasAttribute("data-node-id")) return { done: true } as const;
            const a = el.getBoundingClientRect();
            const b = panel.getBoundingClientRect();
            const detail = panel.querySelector('[data-testid="trace-detail"]');
            return {
              done: false,
              id: el.getAttribute("data-node-id") ?? "?",
              top: a.top,
              bottom: a.bottom,
              panelTop: b.top,
              panelBottom: b.bottom,
              folded: detail ? getComputedStyle(detail).display === "none" : false,
              scrollY: window.scrollY,
            } as const;
          });
          if (at.done) break;
          seen.push(at.id);
          // In the viewport and not touching the panel at all: its box ends above the panel's top edge (or starts below it).
          const clear = at.bottom <= at.panelTop || at.top >= at.panelBottom;
          if (!(clear && at.bottom > 0)) hidden.push(`${at.id} (${Math.round(at.top)}–${Math.round(at.bottom)}, panel ${Math.round(at.panelTop)}–${Math.round(at.panelBottom)})`);
          // While a piece has keyboard focus the panel folds to a slim bar: the traced name and Clear trace only. (The
          // first stop is programmatic focus right after a mouse click, which isn't :focus-visible, so it stays full.)
          if (i > 0 && !at.folded) unfolded.push(at.id);
          // One screenshot of a focused piece the browser had to scroll to, with the panel open below it.
          if (!shot && i > 0 && at.scrollY > 0 && at.bottom > at.panelTop - 120) {
            await page.screenshot({ path: path.join(SCREENS, `brain-focus-${width.name}.png`) });
            shot = true;
          }
        }
        expect(seen.length, "Tab reached every piece shown").toBe(shown);
        expect(shot, "a scrolled-to piece was screenshotted above the panel").toBe(true);
        expect(hidden, "focused pieces overlapping the trace panel").toEqual([]);
        expect(unfolded, "panel still showing its details while a piece had keyboard focus").toEqual([]);

        // The slim bar stays usable: the traced name and Clear trace are readable, and the details return once focus
        // moves to Clear trace (out of the pieces).
        const panel = page.getByTestId("trace-panel");
        await expect(panel.getByText("Setlist and learn these", { exact: true })).toBeVisible();
        const clearButton = page.getByRole("button", { name: "Clear trace" });
        await expect(clearButton).toBeVisible();
        await clearButton.focus();
        await expect(page.getByTestId("trace-detail")).toBeVisible();
        await expect(page.getByRole("status")).toContainText("Tracing. Setlist and learn these comes from");

        // Clearing the trace drops the scroll padding again.
        await page.keyboard.press("Escape");
        await expect(nodeOf(page, "f_setlist")).toBeFocused();
        await expect.poll(() => page.evaluate(() => document.documentElement.style.scrollPaddingBottom)).toBe("");
      });
    });
  }
});

test.describe("the brain of Busk Map", () => {
  test("traces from the keyboard: Enter or Space picks, Enter again or Escape clears", async ({ page }) => {
    await openBrain(page);
    const feature = nodeOf(page, "f_fans");
    await expect(async () => {
      await feature.focus();
      await page.keyboard.press("Enter");
      await expect(feature).toHaveAttribute("aria-pressed", "true", { timeout: 500 });
    }).toPass();
    // Fans vs the usual crowd comes from 5b and 11 only.
    await expect(nodeOf(page, "c5b")).toHaveAttribute("data-trace", "path");
    await expect(nodeOf(page, "c11")).toHaveAttribute("data-trace", "path");
    await expect(nodeOf(page, "c3")).toHaveAttribute("data-trace", "dim");
    await expect(page.getByRole("status")).toContainText("Fans vs the usual crowd comes from 2 Qloo calls and 2 data points.");

    await page.keyboard.press("Enter");
    await expect(feature).toHaveAttribute("aria-pressed", "false");
    await expect(nodeOf(page, "c3")).toHaveAttribute("data-trace", "none");

    const point = nodeOf(page, "d_headliner");
    await point.focus();
    await page.keyboard.press("Space");
    await expect(point).toHaveAttribute("aria-pressed", "true");
    await expect(nodeOf(page, "ticketmaster")).toHaveAttribute("data-trace", "path");
    await page.keyboard.press("Escape");
    await expect(point).toHaveAttribute("aria-pressed", "false");
    await expect(point).toBeFocused();
  });

  test("has no axe violations at any impact, untraced and traced", async ({ page }) => {
    await openBrain(page);
    const untraced = await new AxeBuilder({ page }).analyze();
    expect(untraced.violations.map((v) => `${v.impact} ${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);

    await nodeOf(page, "c3").click();
    await expect(page.getByRole("button", { name: "Clear trace" })).toBeVisible();
    // Let the colour transition finish before contrast is measured.
    await page.waitForTimeout(300);
    const traced = await new AxeBuilder({ page }).analyze();
    expect(traced.violations.map((v) => `${v.impact} ${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
  });

  test("the landing teaser links to /brain", async ({ page }) => {
    await page.goto("/");
    const teaser = page.getByTestId("brain-teaser");
    await expect(teaser.getByRole("heading", { name: "The brain of Busk Map" })).toBeVisible();
    const link = teaser.getByRole("link", { name: "Open the brain" });
    await expect(link).toHaveAttribute("href", "/brain");
    await link.click();
    await expect(page).toHaveURL(/\/brain$/);
    await expect(page.getByRole("heading", { level: 1, name: /Qloo/ })).toBeVisible();
  });
});
