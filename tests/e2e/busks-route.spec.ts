import { expect, test } from "./fixtures";

test.describe("/busks", () => {
  test("/#own forwards to /busks (the hash never reaches the server)", async ({ page }) => {
    await page.goto("/#own");
    await expect(page).toHaveURL(/\/busks$/);
    await expect(page.getByRole("form", { name: "Plan for your own act" })).toBeVisible();
  });

  test("an old /?again=<id>#own link keeps its pre-fill target", async ({ page }) => {
    await page.goto("/?again=abc123XYZ#own");
    await expect(page).toHaveURL(/\/busks\?again=abc123XYZ$/);
  });

  test("the Busks nav item is current on /busks, and the landing links there", async ({ page }) => {
    await page.goto("/busks");
    await expect(page.getByRole("heading", { level: 1, name: "Plan your busk" })).toBeVisible();
    const current = page.locator('nav[aria-label="Main"] a[aria-current="page"]:visible');
    await expect(current).toHaveText("Busks");
    await page.goto("/");
    await page.getByRole("link", { name: "Plan a busk" }).first().click();
    await expect(page).toHaveURL(/\/busks$/);
  });

  test("the picked permit and quick slot set the plan's request", async ({ page }) => {
    await page.goto("/busks");
    const form = page.getByRole("form", { name: "Plan for your own act" });
    await form.getByRole("radio", { name: "Premium permit" }).check();
    await form.getByRole("radio", { name: /Lunch/ }).click();
    await expect(form.getByRole("combobox", { name: "From" })).toContainText("12 pm");
    await expect(form.getByRole("combobox", { name: "To" })).toContainText("3 pm");
  });

  test("phones get the compact header with the logo, and the bottom nav", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/busks");
    // Streaming leaves the Suspense fallback header beside the real one for a moment: wait for one.
    await expect(page.locator('[data-slot="app-header"]')).toHaveCount(1);
    await expect(page.locator('[data-slot="app-header"]')).toBeVisible();
    await expect(page.locator('[data-slot="app-header"] nav')).toBeHidden();
    await expect(page.locator("[data-mobile-nav]")).toBeVisible();
  });
});
