import { expect, test } from "./fixtures";

// Week planner removed from the UI (user, 17 Oct). The server logic and /api/week stay, unlinked.
test.describe("week planner removed", () => {
  test("/week is a real 404", async ({ request }) => {
    for (const path of ["/week", "/week?example=sax"]) expect((await request.get(path)).status()).toBe(404);
  });

  test("no link or button on the landing, a plan or /busks points to the week", async ({ page }) => {
    for (const path of ["/", "/plan?example=sax", "/repertoire", "/brain"]) {
      await page.goto(path);
      await expect(page.locator('a[href*="/week"]')).toHaveCount(0);
      await expect(page.getByText(/plan my week|plan a whole week/i)).toHaveCount(0);
    }
  });
});
