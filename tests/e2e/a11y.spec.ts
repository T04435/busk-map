import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, LOCAL, test } from "./fixtures";

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"];
const SEARCHES = ["Search Spotify, e.g. Paul Kelly", "Search songs, e.g. Riptide"];

test.describe("accessibility", () => {
  test("landing has no critical axe violations (B-004)", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Busk Map" })).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    const critical = violations.filter((v) => v.impact === "critical").map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
    expect(critical).toEqual([]);
  });

  for (const [name, path, ready] of [
    ["landing", "/", (p: Page) => expect(p.getByRole("heading", { level: 1, name: "Busk Map" })).toBeVisible()],
    ["/busks", "/busks", (p: Page) => expect(p.getByPlaceholder(SEARCHES[0])).toBeVisible()],
    ["/brand", "/brand", (p: Page) => expect(p.getByRole("heading", { level: 1, name: /Honeycomb/ })).toBeVisible()],
  ] as const) {
    for (const scheme of ["light", "dark"] as const) {
      test(`${name} has no axe violations at any impact (${scheme})`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await page.goto(path);
        await ready(page);
        const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
        expect(violations.map((v) => `${v.impact} ${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
      });
    }
  }

  test("the search comboboxes say whether their list is shown and point at it only while it is (B-004)", async ({ page }) => {
    test.skip(!LOCAL, "Searches the offline catalogue");
    await page.goto("/busks");
    for (const placeholder of SEARCHES) {
      const input = page.getByPlaceholder(placeholder);
      await expect(input).toHaveAttribute("role", "combobox");
      await expect(input).toHaveAttribute("aria-expanded", "false");
      await expect(input).not.toHaveAttribute("aria-controls", /./);

      // Typed before hydration, the query is lost: retry until the list opens.
      await expect(async () => {
        await input.fill("");
        await input.fill("Buena Vista");
        await expect(input).toHaveAttribute("aria-expanded", "true", { timeout: 1000 });
      }).toPass();
      const controls = await input.getAttribute("aria-controls");
      expect(controls).toBeTruthy();
      await expect(page.locator(`[id="${controls}"]`)).toHaveAttribute("role", "listbox");

      await input.fill("");
      await expect(input).toHaveAttribute("aria-expanded", "false");
      await expect(input).not.toHaveAttribute("aria-controls", /./);
    }
  });

  test("the poster buttons keep a visible focus ring next to their offset shadow (B-018)", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Busk Map" })).toBeVisible();
    // Both sit on a dark band, so the ring is the night one: a 2px ink gap, then a 4px signal-orange ring (#ff6a2b).
    for (const cta of [page.getByRole("link", { name: "Plan a busk" }).first(), page.getByRole("link", { name: "Plan a busk" }).last()]) {
      const shadow = () => cta.evaluate((el) => getComputedStyle(el).boxShadow);
      const before = await shadow();
      expect(before).toMatch(/6px 6px 0px/);
      expect(before).not.toMatch(/rgb\(255, 106, 43\) 0px 0px 0px 4px/);
      await expect(async () => {
        await cta.focus();
        await page.keyboard.press("Tab");
        await page.keyboard.press("Shift+Tab");
        await expect(cta).toBeFocused({ timeout: 500 });
      }).toPass();
      const after = await shadow();
      expect(after).toMatch(/rgb\(255, 106, 43\) 0px 0px 0px 4px/);
      expect(after).toMatch(/6px 6px 0px/); // the poster shadow stays
    }
  });

  test("the search inputs show a focus ring when tabbed to (B-005)", async ({ page }) => {
    await page.goto("/busks");
    for (const placeholder of SEARCHES) {
      const input = page.getByPlaceholder(placeholder);
      const group = input.locator("xpath=ancestor::*[@data-slot='input-group'][1]");
      const ring = () => group.evaluate((el) => getComputedStyle(el).boxShadow);
      expect(await ring()).not.toMatch(/ 4px/);
      // The server HTML already says aria-expanded="false" (B-011), so it no longer marks hydration: retry the
      // keyboard round trip until the hydrated input keeps focus.
      await expect(input).toHaveAttribute("aria-expanded", "false");
      await expect(async () => {
        await input.focus();
        await page.keyboard.press("Tab");
        await page.keyboard.press("Shift+Tab");
        await expect(input).toBeFocused({ timeout: 500 });
      }).toPass();
      // Honeycomb's full-strength focus ring (--focus-ring): a 2px paper gap, then a 4px ink (night: orange) ring.
      await expect.poll(ring).toMatch(/ 4px/);
    }
  });
});
