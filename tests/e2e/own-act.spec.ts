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
