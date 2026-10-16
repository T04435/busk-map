import { expect, LOCAL, test } from "./fixtures";

test.describe("site-wide not-found page", () => {
  test("an unknown URL returns 404 with the not-found card; home lands on /", async ({ page }) => {
    const response = await page.goto("/this-is-not-a-pitch");
    expect(response?.status()).toBe(404);
    await expect(page).toHaveTitle("Page not found · Busk Map");
    const card = page.getByTestId("site-not-found");
    await expect(card.getByRole("heading", { level: 1, name: "No pitch here" })).toBeVisible();
    await expect(card.getByRole("link", { name: "Try an example plan" })).toHaveAttribute("href", "/plan?example=acoustic");
    await card.getByRole("link", { name: "Go to Busk Map home" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1, name: "Busk Map" })).toBeVisible();
  });

  test("/p/<unknown id> keeps its own not-found state", async ({ page }) => {
    await page.goto("/p/ZZZZZZZZZ");
    await expect(page.getByTestId("plan-not-found").getByRole("heading", { name: "Plan not found" })).toBeVisible();
    await expect(page.getByTestId("site-not-found")).toHaveCount(0);
  });
});

test.describe("route error page (error.tsx)", () => {
  test.skip(!LOCAL, "The render fault is only enabled on the local test server");

  test("a render error shows the error card, a reference and no stack; Go home lands on /", async ({ page }) => {
    await page.goto("/plan?example=acoustic&faults=render");
    const card = page.getByTestId("route-error");
    await expect(card.getByRole("heading", { level: 1, name: "Something went wrong" })).toBeVisible();
    await expect(card).toContainText("while setting up the pitch");
    await expect(card.getByText(/^Reference: /)).toBeVisible();
    await expect(page.getByText("Simulated render fault")).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText(/\bat .+\.(tsx?|js):\d+/);
    await expect(card.getByRole("button", { name: "Try again" })).toBeEnabled();
    // Try again re-renders the segment: the fault is still on, so the card comes back.
    await card.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByTestId("route-error")).toBeVisible();
    await card.getByRole("link", { name: "Go home" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1, name: "Busk Map" })).toBeVisible();
  });
});
