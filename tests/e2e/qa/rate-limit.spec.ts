/**
 * QA: the fresh-run limit's API and page (B-013, e83a94c), offline through the fresh-limit fault switch
 * (BUSKMAP_ALLOW_FAULTS=1 only). The switch always refuses, so nothing runs and nothing is spent.
 */
import { expect, LOCAL, SATURDAY, test } from "../fixtures";

test.describe("QA fresh-run limit (fault switch)", () => {
  test.skip(!LOCAL, "Fault switches exist only on the local test server");

  test("API: 429 with a zone-free message, retryAt, retryAfterS, Retry-After and no-store", async ({ request }) => {
    const before = Date.now();
    const response = await request.post("/api/plan", {
      data: { city: "melbourne", slot: { date: SATURDAY, startHour: 18, endHour: 21 }, performer: { name: "QA Limit", artists: ["Paul Kelly"] } },
      headers: { "x-buskmap-faults": "fresh-limit" },
    });
    expect(response.status()).toBe(429);
    expect(response.headers()["cache-control"]).toContain("no-store");
    const retryAfter = Number(response.headers()["retry-after"]);
    const { error } = await response.json();
    expect(error.code).toBe("rate_limited");
    expect(error.retryAfterS).toBe(retryAfter);
    expect(error.message).toMatch(/^You've started 5 plans this hour\. Try again in about \d+ minutes?\.$/);
    expect(error.message).not.toMatch(/\d:\d\d|\bam\b|\bpm\b/i);
    const at = Date.parse(error.retryAt);
    expect(at - before).toBeGreaterThan((retryAfter - 5) * 1000);
    expect(at - before).toBeLessThan((retryAfter + 60) * 1000);
  });

  test("page: an example click at the limit shows the alert and a way home, and runs nothing", async ({ page }) => {
    const calls: string[] = [];
    page.on("request", (r) => /\/api\/(compare|week)$/.test(r.url()) && calls.push(r.url()));
    await page.goto("/plan?example=sax&faults=fresh-limit");
    const alert = page.getByRole("alert").filter({ hasText: "Plan limit reached" });
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(/Try again in about \d+ minutes?/);
    await expect(page.getByRole("link", { name: /home/i }).first()).toBeVisible();
    await expect(page.getByRole("region", { name: "Pitches", exact: true })).toHaveCount(0);
    await expect(page.getByRole("list", { name: "Agent steps" })).toHaveCount(0);
    expect(calls).toEqual([]);
  });

  test("the switch is honoured only as a fault: without it the same example plans normally", async ({ page }) => {
    await page.goto("/plan?example=sax");
    await expect(page.getByRole("region", { name: "Pitches", exact: true })).toBeVisible();
    await expect(page.getByText("Plan limit reached")).toHaveCount(0);
  });
});
