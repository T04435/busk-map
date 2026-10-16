import { expect, LOCAL, openDetails, test, waitForPlan } from "./fixtures";

/** Profile features 3 and 4: an example with an own artist shows "from your music" and the fans lean (offline Qloo mock). */
test.describe("profile signal: own artist", () => {
  test.skip(!LOCAL, "Needs the offline Qloo mock");

  test("the sax example shows 'from your music' and your fans against this crowd", async ({ page }) => {
    await page.goto("/plan?example=sax");
    await expect(page).toHaveURL(/\/p\/[0-9A-Za-z]{9}$/);
    await waitForPlan(page);
    const sheet = await openDetails(page);
    const crowd = sheet.getByRole("region", { name: "Who this crowd likes" });
    await crowd.scrollIntoViewIfNeeded();
    await expect(crowd.getByTestId("from-your-music")).toContainText("The Bamboos");
    await expect(crowd.getByTestId("from-your-music")).toContainText("from your music");
    const fans = crowd.getByTestId("fans-compare");
    await expect(fans).toHaveText(/^Your fans lean .+; this crowd leans .+\.$/);
    // The own fans' lean bars sit beside the crowd's.
    await expect(crowd.getByRole("list", { name: /^Lean by age band for fans of The Bamboos/ })).toBeVisible();
    await expect(crowd.getByRole("list", { name: "Lean by age band and gender, against the average audience" })).toBeVisible();
  });

  test("an example without an own artist shows neither line", async ({ page }) => {
    await page.goto("/plan?example=acoustic");
    await waitForPlan(page);
    const sheet = await openDetails(page);
    await expect(sheet.getByRole("region", { name: "Who this crowd likes" })).toBeVisible();
    await expect(sheet.getByTestId("from-your-music")).toHaveCount(0);
    await expect(sheet.getByTestId("fans-compare")).toHaveCount(0);
  });
});
