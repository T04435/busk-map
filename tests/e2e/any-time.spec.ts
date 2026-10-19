import { EXAMPLES } from "../../src/lib/examples";
import { SERVER_TODAY } from "./clock";
import { agentSteps, expect, LOCAL, openDetails, SATURDAY, test, waitForPlan } from "./fixtures";

/**
 * Any time (plan-inputs-architecture.md 2, S2+S3): the engine picks each pitch's window, best_hours explains it, and the
 * plan page shows it. The server clock is frozen at Wednesday noon (tests/e2e/clock.ts).
 */
test.describe("any time (mock model offline)", () => {
  test.skip(!LOCAL, "Runs the agent; local offline server only");

  const performer = EXAMPLES[0].performer;
  const planFor = async (request: import("@playwright/test").APIRequestContext, date: string) => {
    const response = await request.post("/api/plans", { data: { city: "melbourne", slot: { date, any: true }, performer } });
    expect(response.status()).toBe(200);
    return (await response.json()) as { path: string };
  };

  test("an any-time plan shows each pitch's best hours and the best_hours step", async ({ page, request }) => {
    const { path } = await planFor(request, SATURDAY);
    await page.goto(path);
    await waitForPlan(page);
    await expect(page.getByText(/any time, Busk Map picks the hours/).first()).toBeVisible();
    const steps = await agentSteps(page);
    await expect(steps.getByText("The best hours at each pitch").first()).toBeVisible();
    // Each pitch row says its own best hours; the details sheet says why.
    await expect(page.getByTestId("pitch-row-window")).toHaveCount(3);
    const window = (await openDetails(page)).getByTestId("pitch-window");
    await expect(window).toBeVisible();
    await expect(window).toContainText(/^Best \d+ [ap]m–\d+ [ap]m/);
    // A reload replays the saved run, with the same windows.
    const before = await window.innerText();
    await page.goto(path);
    await waitForPlan(page);
    await expect((await openDetails(page)).getByTestId("pitch-window")).toHaveText(before);
  });

  test("an any-time link for a day that has passed offers Plan again on any time, on today's date", async ({ page, request }) => {
    const { path } = await planFor(request, "2026-10-13"); // the Tuesday before the frozen Wednesday noon
    await page.goto(path);
    await expect(page.getByTestId("slot-passed")).toBeVisible();
    await expect(page.getByTestId("slot-passed")).toContainText("any time");
    await page.getByRole("link", { name: "Plan again for a new date" }).click();
    await expect(page.getByRole("radio", { name: /Any time/ })).toBeChecked();
    await expect(page.getByTestId("any-time-note")).toContainText("Busk Map finds the best hours that day");
    await expect(page.locator("#date")).toHaveAttribute("data-date", SERVER_TODAY);
    // The hours are not asked for; the named slots are the other choices.
    await expect(page.getByRole("form", { name: "Plan for your own act" }).getByLabel("From", { exact: true })).toHaveCount(0);
    await page.getByRole("radio", { name: /Evening/ }).click();
    await expect(page.getByRole("radio", { name: /Evening/ })).toBeChecked();
  });
});
