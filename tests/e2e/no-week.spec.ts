import { expect, test } from "@playwright/test";

// Week planner removed from the UI (user, 17 Oct): a real 404, and no link anywhere points to it.
test.describe("week planner removed", () => {
  test("/week is a real 404", async ({ request }) => {
    for (const path of ["/week", "/week?example=sax"]) expect((await request.get(path)).status()).toBe(404);
  });

  test("no link on the main pages points to /week", async ({ page }) => {
    for (const path of ["/", "/busks", "/plan?example=acoustic", "/brain", "/brand"]) {
      await page.goto(path);
      await expect(page.locator("main").first()).toBeVisible();
      expect(await page.locator('a[href*="/week"]').count(), path).toBe(0);
    }
  });

  test("the main nav holds Busks and Repertoire; Brain is in the footer and not current on /brain", async ({ page }) => {
    await page.goto("/brain");
    const nav = page.locator('nav[aria-label="Main"]:visible');
    await expect(nav.getByRole("link")).toHaveText(["Repertoire", "Busks"]);
    await expect(nav.locator("[aria-current]")).toHaveCount(0);
    await expect(page.locator("footer").getByRole("link", { name: "Brain" })).toBeVisible();
  });
});
