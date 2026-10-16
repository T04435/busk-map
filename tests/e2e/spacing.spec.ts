import { expect, LOCAL, test, waitForPlan } from "./fixtures";

/** B-002: the plan says why a higher-scored spot isn't in the top 3 (the 250 m spacing rule). Offline fixtures. */
test.describe("top-3 spacing", () => {
  test.skip(!LOCAL, "The scores depend on the offline fixtures");

  test("explains the 250 m rule and marks the higher-scored spots it left out", async ({ page }) => {
    await page.goto("/plan?example=acoustic");
    await waitForPlan(page);
    await expect(page.getByTestId("spacing-rule")).toContainText("at least 250 m apart");

    const picks = await page.getByRole("region", { name: "Pitches", exact: true }).locator("button[data-pitch-name]").evaluateAll((els) =>
      els.map((el) => el.getAttribute("data-pitch-name") ?? ""),
    );
    await page.getByRole("button", { name: /^Other scored pitches/ }).click();
    const others = page.getByRole("button", { name: /^Other scored pitches/ }).locator("xpath=..").getByRole("listitem");
    const fedSquare = others.filter({ hasText: /^Federation Square/ });
    await expect(fedSquare).toContainText(/ · too close to /);
    const pick = (await fedSquare.innerText()).match(/too close to ([^\n]+?)\s*(?:\n|$)/)?.[1]?.trim();
    expect(picks).toContain(pick);

    // The plain-AI panel no longer says the plan contradicts its own scores for these spots.
    const onlyPlain = page.getByRole("region", { name: "Only plain AI" });
    await expect(onlyPlain.getByText(/Scored higher, but within 250 m of /).first()).toBeVisible();
    await expect(page.getByTestId("compare-verdict")).toContainText("kept 250 m apart");
  });
});
