/**
 * QA[busk-map] accessibility gate (qa/test-plan.md §8): every judge page, WCAG 2.0–2.2 A and AA,
 * all impacts, desktop and mobile projects. Offline server only.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, LOCAL, test } from "../fixtures";

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"];

type Page = import("@playwright/test").Page;
const PAGES: { name: string; path: string; ready: (page: Page) => Promise<void>; hydrated?: string }[] = [
  // The warm-up POST is sent from a client effect on / and /busks, so seeing it means React has hydrated the page
  // (aria-expanded="false" is in the server HTML too since B-011, so it can't be the signal).
  { name: "landing", path: "/", ready: (p) => expect(p.getByRole("heading", { level: 1 })).toBeVisible(), hydrated: "/api/warm" },
  { name: "busks form", path: "/busks", ready: (p) => expect(p.getByPlaceholder("Search Spotify, e.g. Paul Kelly")).toBeVisible(), hydrated: "/api/warm" },
  { name: "brand", path: "/brand", ready: (p) => expect(p.getByRole("heading", { level: 1 })).toBeVisible() },
  { name: "example plan (acoustic)", path: "/plan?example=acoustic", ready: (p) => expect(p.getByRole("region", { name: "Pitches", exact: true })).toBeVisible() },
  { name: "example plan (sax)", path: "/plan?example=sax", ready: (p) => expect(p.getByRole("region", { name: "Pitches", exact: true })).toBeVisible() },
  { name: "week (folk duo)", path: "/week?example=folk-duo", ready: (p) => expect(p.getByRole("list", { name: "Top sessions" })).toBeVisible() },
  { name: "brain", path: "/brain", ready: (p) => expect(p.getByRole("heading", { name: "The wiring" })).toBeVisible() },
  { name: "not found", path: "/qa-no-such-page", ready: (p) => expect(p.getByText("No pitch here")).toBeVisible() },
  { name: "plan not found", path: "/p/zzzzzzzzz", ready: (p) => expect(p.getByText("We can't find this busk")).toBeVisible() },
];

test.describe("QA accessibility: no WCAG A/AA violations", () => {
  test.skip(!LOCAL, "Uses offline fixtures");

  for (const { name, path, ready, hydrated } of PAGES) {
    test(name, async ({ page }) => {
      const hydration = hydrated ? page.waitForRequest((r) => r.url().endsWith(hydrated)) : null;
      await page.goto(path);
      await ready(page);
      await hydration;
      const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
      const found = violations.map((v) => `${v.impact} ${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
      expect(found).toEqual([]);
    });
  }
});
