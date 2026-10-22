import { expect, LOCAL, test } from "./fixtures";

/**
 * The daily Qloo budget page. Offline mode spends no Qloo calls, so the test fault `faults=qloo-budget` (honoured only
 * with BUSKMAP_ALLOW_FAULTS=1, never in production) ends the run as if today's budget were spent.
 */
test.describe("daily Qloo budget (fault switch, local only)", () => {
  test.skip(!LOCAL, "Fault injection exists only on the local test server");

  test("an example click with the budget spent: a clear message, the example plans, no error and no fallback plan", async ({ page }) => {
    await page.goto("/plan?example=sax&faults=qloo-budget");
    const alert = page.getByTestId("qloo-budget");
    await expect(alert.getByText("Taste data paused for today")).toBeVisible();
    await expect(alert.getByText(/used today's allowance of taste data from Qloo/)).toBeVisible();
    await expect(page.getByTestId("agent-error")).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Pitches", exact: true })).toHaveCount(0);
    const examples = page.getByTestId("budget-examples").getByRole("link");
    await expect(examples).not.toHaveCount(0);
    await expect(examples.first()).toHaveAttribute("href", /^\/plan\?example=/);
    await expect(alert.getByRole("link", { name: "Back to Busk Map home" })).toBeVisible();
  });
});
