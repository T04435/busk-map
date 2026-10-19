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
    await form.getByLabel("Artists you sound like").fill("Paul Kelly");
    await form.getByRole("radio", { name: "Premium permit" }).check();
    await form.getByRole("radio", { name: /Lunch/ }).click();
    await expect(form.getByRole("radio", { name: /Lunch/ })).toBeChecked();
    await expect(form.getByRole("radio", { name: /Any time/ })).not.toBeChecked();
    // No From and To any more: the named slot sends its fixed hours.
    await expect(form.getByRole("combobox", { name: "From" })).toHaveCount(0);
    const posted = page.waitForRequest((r) => r.url().endsWith("/api/plans") && r.method() === "POST");
    await form.getByRole("button", { name: "Plan my busk" }).click();
    const body = (await posted).postDataJSON();
    expect(body.permit).toBe("premium");
    expect(body.slot).toMatchObject({ startHour: 12, endHour: 15 });
  });

  test("phones get the compact header and the bottom bar with Repertoire and Busks (two items)", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/busks");
    // Streaming leaves the Suspense fallback header beside the real one for a moment: wait for one.
    await expect(page.locator('[data-slot="app-header"]')).toHaveCount(1);
    await expect(page.locator('[data-slot="app-header"]')).toBeVisible();
    // The Suspense fallback chrome streams in first: wait for the one bar.
    await expect(page.locator("[data-mobile-nav]")).toHaveCount(1);
    const bar = page.locator("[data-mobile-nav]");
    await expect(bar).toBeVisible();
    await expect(bar.getByRole("link", { name: "Busks" })).toHaveAttribute("aria-current", "page");
    await expect(bar.getByRole("link", { name: "Repertoire" })).toBeVisible();
    // The page leaves room for the bar.
    expect(await page.evaluate(() => getComputedStyle(document.body).paddingBottom)).not.toBe("0px");
    await bar.getByRole("link", { name: "Repertoire" }).click();
    await expect(page).toHaveURL(/\/repertoire$/);
    await expect(bar.getByRole("link", { name: "Repertoire" })).toHaveAttribute("aria-current", "page");
  });
});
