import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

/** On phones the long blocks fold under closed disclosures after hydration: open them all. */
async function openAll(page: Page) {
  await page.waitForLoadState("networkidle");
  for (const fold of await page.locator("[data-slot='disclosure'] > button[aria-expanded='false']").all()) await fold.click();
}

// /brand against the deck (B-070..B-079, B-152, B-154).
test.describe("brand page", () => {
  test("eyebrow, nav and the eight numbered sections (B-070, B-071)", async ({ page }) => {
    await page.goto("/brand");
    await expect(page.getByText("Busk Map design deck · design system v66")).toBeVisible();
    const nav = page.getByRole("navigation", { name: "On this page" });
    for (const l of ["Brand book", "Words", "Foundations", "Tokens to shadcn", "Components", "Screens", "Assets", "Handoff"]) await expect(nav.getByRole("link", { name: l })).toBeVisible();
    for (const id of ["book", "words", "foundations", "tokens", "components", "screens", "assets", "handoff"]) await expect(page.locator(`#${id}`)).toBeVisible();
  });

  test("components: eight groups, one count, no double comma, no Tips (B-074)", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/brand");
    const section = page.locator("#components");
    for (const h of ["Controls", "Feedback and honesty", "Plan your busk", "Map", "The busk", "Research", "States and app shell"]) await expect(section.getByRole("heading", { level: 3, name: h, exact: true })).toBeVisible();
    await expect(section).toContainText(/\d+ reusable components in the design system, grouped/);
    expect(await page.locator("main").innerText()).not.toContain(",,");
    expect(await page.locator("main").innerText()).not.toMatch(/\bTips?\b|Melbourne/);
  });

  test("screens table has /terms and /privacy, and no Tips (B-071)", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/brand");
    const table = page.getByRole("region", { name: "Screens" });
    await expect(table.getByRole("link", { name: "/terms" })).toBeVisible();
    await expect(table.getByRole("link", { name: "/privacy" })).toBeVisible();
    await expect(table.getByText("/tips")).toHaveCount(0);
  });

  test("Logos group shows only the lockup, dark and light (B-152)", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/brand");
    const logos = page.locator("#assets h3", { hasText: /^Logos/ }).locator("xpath=..");
    await expect(logos.locator("img")).toHaveCount(2);
    await expect(logos.getByText("busk-map-lockup-light.svg")).toBeVisible();
    await expect(logos.getByText("busk-map-lockup-dark.svg")).toBeVisible();
    await expect(logos.getByText(/mark|wordmark/)).toHaveCount(0);
  });

  test("assets download, and Qloo's logo links to qloo.com (B-077, F18)", async ({ page }) => {
    await page.goto("/brand");
    await openAll(page);
    const dl = page.getByRole("link", { name: "Download og-image-1200x630.png" });
    await expect(dl).toHaveAttribute("download", "og-image-1200x630.png");
    const q = page.getByRole("link", { name: /Qloo \(opens qloo.com/ });
    expect(await q.count()).toBeGreaterThanOrEqual(3);
    for (const l of await q.all()) {
      await expect(l).toHaveAttribute("href", "https://qloo.com");
      await expect(l).toHaveAttribute("target", "_blank");
      await expect(l).toHaveAttribute("rel", /noopener/);
    }
  });

  test("the stat strip fills its rows and token cells don't overflow (B-075, BD21)", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto("/brand");
    await openAll(page);
    const strip = page.getByRole("list", { name: "Qloo in numbers" });
    await strip.scrollIntoViewIfNeeded();
    const boxes = await strip.getByRole("listitem").evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, w: r.width }; }));
    expect(boxes).toHaveLength(3);
    expect(boxes[2].w).toBeGreaterThan(boxes[0].w * 1.5);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });
});
