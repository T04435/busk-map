/**
 * QA[busk-map] accessibility gate (qa/test-plan.md §8): every judge page, WCAG 2.0–2.2 A and AA,
 * all impacts, desktop and mobile projects. Offline server only.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, LOCAL, test } from "../fixtures";

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"];

const PAGES: { name: string; path: string; ready: (page: import("@playwright/test").Page) => Promise<void> }[] = [
  { name: "landing", path: "/", ready: (p) => expect(p.getByPlaceholder("Search Spotify, e.g. Paul Kelly")).toHaveAttribute("aria-expanded", "false") },
  { name: "example plan (acoustic)", path: "/plan?example=acoustic", ready: (p) => expect(p.getByRole("region", { name: "Pitches", exact: true })).toBeVisible() },
  { name: "example plan (sax)", path: "/plan?example=sax", ready: (p) => expect(p.getByRole("region", { name: "Pitches", exact: true })).toBeVisible() },
  { name: "week (folk duo)", path: "/week?example=folk-duo", ready: (p) => expect(p.getByRole("list", { name: "Top sessions" })).toBeVisible() },
  { name: "tip log", path: "/tips", ready: (p) => expect(p.getByRole("heading", { level: 1 })).toBeVisible() },
  { name: "not found", path: "/qa-no-such-page", ready: (p) => expect(p.getByText("No pitch here")).toBeVisible() },
  { name: "plan not found", path: "/p/zzzzzzzzz", ready: (p) => expect(p.getByText("Plan not found")).toBeVisible() },
];

test.describe("QA accessibility: no WCAG A/AA violations", () => {
  test.skip(!LOCAL, "Uses offline fixtures");

  for (const { name, path, ready } of PAGES) {
    test(name, async ({ page }) => {
      await page.goto(path);
      await ready(page);
      const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
      const found = violations.map((v) => `${v.impact} ${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
      expect(found).toEqual([]);
    });
  }
});
