import { expect, LOCAL, test, waitForPlan } from "./fixtures";

const ACT = "/plan?name=Tip%20Tester&artists=Paul%20Kelly&songs=Dumb%20Things~Paul%20Kelly&date=2026-10-24&from=18&to=21&permit=general";

test.describe("tip log", () => {
  test("example plans show their example tip log, clearly labelled, and the bonus it adds", async ({ page }) => {
    await page.goto("/plan?example=acoustic");
    await waitForPlan(page);
    const history = page.getByTestId("tip-history");
    await expect(history).toContainText("Example data");
    await expect(history).toContainText(/Federation Wharf \(\+\d\)/);
    if (!LOCAL) return; // Live data may rank Federation Wharf anywhere.
    await page.getByRole("region", { name: "Pitches", exact: true }).getByRole("button", { name: /Federation Wharf/ }).click();
    await expect(page.getByTestId("tip-bonus")).toContainText(/Your tip log: 3 sessions here/);
  });

  test("logs takings in this browser, adapts the plan and lists the history", async ({ page }) => {
    await page.goto(ACT);
    await waitForPlan(page);
    await expect(page.getByTestId("tip-history")).toHaveCount(0);
    const form = page.getByRole("form", { name: "Log your takings" });
    const pitches = page.getByRole("region", { name: "Pitches", exact: true }).getByRole("button");
    const first = (await pitches.nth(0).getAttribute("data-pitch-name"))!;
    const second = (await pitches.nth(1).getAttribute("data-pitch-name"))!;

    // Validation.
    await form.getByRole("button", { name: "Log session" }).click();
    await expect(form.getByRole("alert")).toHaveText("Enter what you earned, in dollars (0 or more).");

    // A good night at the top pitch, a quiet one at the second.
    await form.getByLabel("Takings (A$)").fill("120");
    await form.getByRole("button", { name: "Log session" }).click();
    await expect(form.getByRole("status")).toContainText(`Logged $120 at ${first}.`);
    await form.getByRole("combobox", { name: "Pitch" }).click();
    await page.getByRole("option", { name: second, exact: true }).click();
    await form.getByLabel("Takings (A$)").fill("30");
    await form.getByRole("button", { name: "Log session" }).click();
    await expect(form.getByRole("status")).toContainText(`Logged $30 at ${second}.`);

    // The plan now uses the log: $40/h at the top pitch against a $25/h average.
    await expect(page.getByTestId("tip-history")).toContainText("Your tip log (2 sessions, average $25/h)");
    await expect(page.getByTestId("tip-history")).not.toContainText("Example data");
    await pitches.filter({ hasText: first }).click();
    await expect(page.getByTestId("tip-bonus")).toContainText("1 session here at $40/h, against your $25/h average");

    // The log survives a reload (the server reads its summary from the cookie, not the URL).
    await page.reload();
    await expect(page.getByTestId("tip-history")).toContainText("2 sessions");
    expect(page.url()).not.toContain("tips");

    await page.goto("/tips");
    const yours = page.getByRole("region", { name: "Sessions for Tip Tester" });
    await expect(yours.getByRole("listitem")).toHaveCount(2);
    await expect(page.getByRole("region", { name: "Bonus per pitch for Tip Tester" })).toContainText(/\+\d points/);
    await yours.getByRole("button", { name: new RegExp(`Delete the 2026-10-24 session at ${second}`) }).click();
    await expect(yours.getByRole("listitem")).toHaveCount(1);
    await expect(page.getByRole("heading", { name: /Example sessions/ })).toContainText("Example data");
  });

  test("an empty log says how to start", async ({ page }) => {
    await page.goto("/tips");
    await expect(page.getByText("No sessions logged in this browser yet.")).toBeVisible();
    await expect(page.getByRole("region", { name: "Sessions for Soul and funk sax player" }).getByRole("listitem")).toHaveCount(7);
  });
});
