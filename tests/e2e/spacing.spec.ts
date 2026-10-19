import { expect, LOCAL, test, waitForPlan } from "./fixtures";

/** B-002: the plan says why a higher-scored pitch isn't in the top 3 (the 250 m spacing rule). Offline fixtures. */
test.describe("top-3 spacing", () => {
  test.skip(!LOCAL, "The scores depend on the offline fixtures");

  test("explains the 250 m rule and marks the higher-scored pitches it left out on the map", async ({ page }) => {
    await page.goto("/plan?example=acoustic");
    await waitForPlan(page);
    await expect(page.getByTestId("others-note")).toContainText("kept 250 m apart");

    const picks = await page.getByRole("region", { name: "Pitches", exact: true }).locator("button[data-pitch-name]").evaluateAll((els) =>
      els.map((el) => el.getAttribute("data-pitch-name") ?? ""),
    );
    // The other scored pitches are quiet dots on the map; each opens a summary. A pitch within 250 m of a higher-scored pick is left out.
    await page.getByRole("region", { name: "Map of pitches and Qloo taste affinity" }).scrollIntoViewIfNeeded();
    const popover = page.getByTestId("other-pitch-popover");
    await page.getByTestId("browse-others").focus();
    await page.keyboard.press("Enter");
    await expect(popover).toBeVisible();
    // Step through the other pitches until one that was left out for being too close to a pick (Centre Place, near City Square, on the
    // Qloo-activity scores; the pick set follows the scores, so the test follows the note, not a fixed name).
    for (let i = 0; i < 40 && (await popover.getByTestId("too-close").count()) === 0; i++) await page.getByRole("button", { name: "Next pitch" }).click();
    await expect(popover.getByTestId("too-close")).toContainText(/^Too close to /);
    const pick = (await popover.getByTestId("too-close").innerText()).match(/^Too close to (.+?): scored higher/)?.[1]?.trim();
    expect(picks).toContain(pick);

    // The spacing rule is explained in each pitch's weights panel.
    await page.keyboard.press("Escape");
    await page.getByRole("region", { name: "Pitches", exact: true }).getByRole("button", { name: /^Full details/ }).first().click();
    await expect(page.getByTestId("spacing-rule")).toContainText("at least 250 m apart");
    await page.keyboard.press("Escape");

    // The mock plain AI names Federation Square, which the Qloo-activity scores now make a pick, so no plain-AI spot is left out for
    // spacing on any example: the "Scored higher, but within 250 m of ..." line is covered by tests/unit/scoring/baseline.test.ts.
    // The panel must not claim the plan contradicts its own scores.
    const onlyPlain = page.getByRole("region", { name: "Only plain AI" });
    await expect(onlyPlain.getByText(/contradict/i)).toHaveCount(0);
    await expect(page.getByTestId("compare-verdict")).toContainText("usual busking pitches");
  });
});
