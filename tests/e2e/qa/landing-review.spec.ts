import { expect, test } from "@playwright/test";

/**
 * QA regression for Landing · review v4 (qa/reports/landing.html): the user's calls and the function checks MANAGER asked
 * for. Row ids in the test names are the report's rows.
 */
test.describe("QA Landing · review", () => {
  test("L07: the hero has no caption; L11: the video slot is a placeholder with no media, autoplay or controls", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("section[aria-labelledby=hero] figcaption")).toHaveCount(0);
    const slot = page.getByTestId("demo-video-slot");
    await expect(slot).toBeVisible();
    await expect(page.locator("video, audio, iframe, [autoplay]")).toHaveCount(0);
    await expect(slot.locator("a, button, input, [tabindex]")).toHaveCount(0);
  });

  test("L18: the live map loads only when it nears the screen, and pins and list select each other both ways", async ({ page }) => {
    await page.goto("/");
    const get = page.getByTestId("what-you-get");
    const pins = get.locator("button[data-pitch-id]");
    await expect(pins).toHaveCount(0);
    await get.locator('[data-slot="map-frame"]').scrollIntoViewIfNeeded();
    await expect(pins).toHaveCount(3, { timeout: 20_000 });
    // Each row holds the select button (aria-pressed) and, since F02, a Full details button: count the select buttons.
    const rows = get.locator('[data-slot="pitch-row"] button[aria-pressed], button[data-slot="pitch-row"]');
    await expect(rows).toHaveCount(3);
    await rows.nth(1).click();
    await expect(rows.nth(1)).toHaveAttribute("aria-pressed", "true");
    await expect(pins.filter({ hasNot: page.locator("xpath=self::*[@aria-pressed='false']") }).first()).toHaveAttribute("aria-label", /^Pitch 2:/);
    await pins.nth(2).click({ force: true });
    await expect(rows.nth(2)).toHaveAttribute("aria-pressed", "true");
    await expect(rows.nth(1)).toHaveAttribute("aria-pressed", "false");
  });

  test("L23: the brand teaser is there; /brand is linked from it and from the footer (F11)", async ({ page }) => {
    await page.goto("/");
    const teaser = page.locator("section[aria-labelledby=brand-h]");
    await expect(teaser.getByRole("heading", { name: "Honeycomb" })).toBeVisible();
    await expect(page.locator('a[href="/brand"]')).toHaveCount(2);
    await expect(page.locator('footer a[href="/brand"]')).toHaveCount(1);
    await expect(teaser.locator('a[href="/brand"]')).toHaveCount(1);
  });
});
