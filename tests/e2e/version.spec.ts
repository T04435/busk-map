import { expect, test } from "./fixtures";

test("the footer and /api/version show the same version", async ({ page, request }) => {
  const response = await request.get("/api/version");
  expect(response.ok()).toBe(true);
  const api = await response.json();
  expect(api.version).toMatch(/^\d+\.\d+\.\d+$/);
  expect(api.shortSha).toBe(api.sha.slice(0, 7));

  await page.goto("/privacy");
  // The Suspense fallback footer can still be in the DOM while streaming; take the visible one.
  const footer = page.getByRole("contentinfo");
  const badge = footer.locator('[data-slot="version-badge"]');
  await expect(badge).toBeVisible();
  await expect(badge.getByRole("link", { name: `v${api.version}`, exact: true })).toHaveAttribute("href", api.releaseUrl);
  await expect(badge.getByRole("link", { name: api.shortSha, exact: true })).toHaveAttribute("href", api.commitUrl);
  await expect(badge).toContainText(`v${api.version} @ ${api.shortSha}`);
  await expect(badge).toHaveAttribute("data-variant", "default");
  // Its own centred line at the bottom of the footer.
  const [b, f] = [await badge.boundingBox(), await footer.boundingBox()];
  expect(Math.abs(b!.x + b!.width / 2 - (f!.x + f!.width / 2))).toBeLessThan(2);
  expect(f!.y + f!.height - (b!.y + b!.height)).toBeLessThan(40);
  const meta = await page.locator('meta[name="app-version"]').getAttribute("content");
  expect(meta).toContain(`v${api.version} @ ${api.shortSha}`);
});
