import { expect, LOCAL, test, waitForPlan } from "./fixtures";

test.describe("own act", () => {
  test.skip(!LOCAL, "Starts the agent automatically; local offline server only");

  test("a typed performer and songs open a plan and start the agent", async ({ page }) => {
    await page.goto("/");
    const form = page.getByRole("form", { name: "Plan for your own act" });
    await form.getByLabel("Act name").fill("Jess on guitar");
    await form.getByLabel("Artists you sound like").fill("Paul Kelly, Missy Higgins");
    await form.getByLabel("Song list").fill("How to Make Gravy - Paul Kelly\nScar - Missy Higgins\nMy Laneway Song - Jess (own)");
    await form.getByRole("button", { name: "Plan my set" }).click();

    await expect(page).toHaveURL(/\/plan\?name=Jess/);
    await expect(page.getByRole("heading", { level: 1, name: "Jess on guitar" })).toBeVisible();
    await waitForPlan(page);
    await expect(page.getByText("Explanations: Claude")).toBeVisible();
    await expect(page.getByText("Your song").first()).toBeVisible();
  });

  test("asks for an artist before planning", async ({ page }) => {
    await page.goto("/");
    const form = page.getByRole("form", { name: "Plan for your own act" });
    await form.getByLabel("Act name").fill("No artists");
    await form.getByRole("button", { name: "Plan my set" }).click();
    await expect(form.getByRole("alert")).toHaveText("Add at least one artist you sound like.");
    await expect(page).toHaveURL(/\/$/);
  });

  test("a typed plan link (deep link) opens the same plan", async ({ page }) => {
    await page.goto("/plan?name=Deep%20Link%20Duo&artists=Angus%20%26%20Julia%20Stone&songs=Big%20Jet%20Plane~Angus%20%26%20Julia%20Stone&date=2026-10-25&from=12&to=15&permit=general");
    await expect(page.getByRole("heading", { level: 1, name: "Deep Link Duo" })).toBeVisible();
    await expect(page.getByText(/Sunday 2026-10-25, 12 pm–3 pm/)).toBeVisible();
    await waitForPlan(page);
  });

  test("a broken plan link explains what is wrong", async ({ page }) => {
    await page.goto("/plan?name=Nobody");
    await expect(page.getByText("We couldn't read this plan")).toBeVisible();
    await expect(page.getByRole("link", { name: "Start again" })).toBeVisible();
  });
});

test.describe("artists Qloo can't match", () => {
  test.skip(!LOCAL, "Relies on the mock's catalogue");

  test("plans with the matched artists and names the unmatched one", async ({ page }) => {
    await page.goto("/plan?name=Half%20Known&artists=Paul%20Kelly|Zzyzx%20Nobody&date=2026-10-24&from=18&to=21");
    await waitForPlan(page);
    const alert = page.getByTestId("unmatched-artists");
    await expect(alert).toContainText("Qloo couldn't match Zzyzx Nobody");
    await expect(alert).toContainText("This plan uses the artists Qloo did match: Paul Kelly.");
    await expect(page.getByRole("region", { name: "Pitches", exact: true }).getByRole("listitem")).toHaveCount(3);
  });

  test("explains when no artist matched, and still ranks pitches on the other data", async ({ page }) => {
    await page.goto("/plan?name=Nobody%20Knows&artists=Zzyzx%20Nobody|Qqq%20Unknown&date=2026-10-24&from=18&to=21");
    await waitForPlan(page);
    const alert = page.getByTestId("unmatched-artists");
    await expect(alert).toContainText("Qloo couldn't match Zzyzx Nobody and Qqq Unknown");
    await expect(alert).toContainText("taste is left out");
    await page.getByRole("button", { name: "Plan with the agent (live)" }).click();
    await expect(page.getByText("Qloo couldn't match any of your artists, so the agent wasn't run")).toBeVisible();
  });
});
