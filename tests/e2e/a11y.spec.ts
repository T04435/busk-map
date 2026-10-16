import AxeBuilder from "@axe-core/playwright";
import { expect, LOCAL, test } from "./fixtures";

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"];
const SEARCHES = ["Search Spotify, e.g. Paul Kelly", "Search songs, e.g. Riptide"];

test.describe("accessibility", () => {
  test("landing has no critical axe violations (B-004)", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByPlaceholder(SEARCHES[0])).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    const critical = violations.filter((v) => v.impact === "critical").map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
    expect(critical).toEqual([]);
  });

  test("the search comboboxes say whether their list is shown and point at it only while it is (B-004)", async ({ page }) => {
    test.skip(!LOCAL, "Searches the offline catalogue");
    await page.goto("/");
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

  test("the search inputs show a focus ring when tabbed to (B-005)", async ({ page }) => {
    await page.goto("/");
    for (const placeholder of SEARCHES) {
      const input = page.getByPlaceholder(placeholder);
      const group = input.locator("xpath=ancestor::*[@data-slot='input-group'][1]");
      const ring = () => group.evaluate((el) => getComputedStyle(el).boxShadow);
      expect(await ring()).not.toMatch(/ 3px/);
      // The server HTML already says aria-expanded="false" (B-011), so it no longer marks hydration: retry the
      // keyboard round trip until the hydrated input keeps focus.
      await expect(input).toHaveAttribute("aria-expanded", "false");
      await expect(async () => {
        await input.focus();
        await page.keyboard.press("Tab");
        await page.keyboard.press("Shift+Tab");
        await expect(input).toBeFocused({ timeout: 500 });
      }).toPass();
      // The default shadcn Input ring (focus-visible:ring-3 ring-ring/50): a 3px box-shadow.
      await expect.poll(ring).toMatch(/ 3px/);
    }
  });
});
