import { expect, LOCAL, SATURDAY, test } from "./fixtures";

/**
 * The fresh-run limit page (B-013). Offline mode is exempt from the limit, so the test fault `faults=fresh-limit`
 * (honoured only with BUSKMAP_ALLOW_FAULTS=1, never in production) makes the gate refuse.
 */
const MESSAGE = /^You've started 30 plans this hour\. Try again in about \d+ minutes?\.$/;

test.describe("fresh-run limit (fault switch, local only)", () => {
  test.skip(!LOCAL, "Fault injection exists only on the local test server");

  test("the API refuses with 429, Retry-After, retryAt and retryAfterS, and a message with no clock time", async ({ request }) => {
    const body = { city: "melbourne", slot: { date: SATURDAY, startHour: 18, endHour: 21 }, performer: { name: "Limit Check", artists: ["Paul Kelly"] } };
    const before = Date.now();
    const response = await request.post("/api/plan", { data: body, headers: { "x-buskmap-faults": "fresh-limit" } });
    expect(response.status()).toBe(429);
    const { error } = (await response.json()) as { error: { code: string; message: string; retryAt: string; retryAfterS: number } };
    expect(error.code).toBe("rate_limited");
    expect(error.message).toMatch(MESSAGE);
    expect(error.message).not.toMatch(/\d:\d\d|\b(am|pm)\b/i);
    expect(error.retryAfterS).toBe(45 * 60);
    expect(response.headers()["retry-after"]).toBe(String(error.retryAfterS));
    expect(error.retryAt).toBe(new Date(error.retryAt).toISOString());
    const at = Date.parse(error.retryAt);
    expect(at).toBeGreaterThanOrEqual(before + error.retryAfterS * 1000 - 1000);
    expect(at).toBeLessThanOrEqual(Date.now() + error.retryAfterS * 1000 + 1000);
  });

  test("an example click at the limit: the message, no plan started, no fallback plan, a link home", async ({ page }) => {
    const calls: { url: string; status: number }[] = [];
    page.on("response", (r) => {
      if (/\/api\/(plan|compare)$/.test(new URL(r.url()).pathname)) calls.push({ url: new URL(r.url()).pathname, status: r.status() });
    });
    await page.goto("/plan?example=sax&faults=fresh-limit");
    const alert = page.getByTestId("fresh-limit");
    await expect(alert.getByText("Plan limit reached")).toBeVisible();
    await expect(alert.getByText(MESSAGE)).toBeVisible();
    await expect(page.getByTestId("agent-status")).toHaveText("No new plan was started.");
    // Nothing ran: no steps, no plan, no engine fallback (run=0) and no plain-AI comparison call.
    await expect(page.getByText("Scoring the pitch pool")).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Pitches", exact: true })).toHaveCount(0);
    await expect(page).not.toHaveURL(/run=0/);
    expect(calls).toEqual([{ url: "/api/plan", status: 429 }]);
    await alert.getByRole("link", { name: "Back to Busk Map home" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Busk Map" })).toBeVisible();
  });

  test("a short link at the limit shows the same page instead of starting a run", async ({ page }) => {
    await page.goto(`/plan?name=Limit%20Link%20Act&artists=Paul%20Kelly&date=${SATURDAY}&from=18&to=21`);
    await expect(page).toHaveURL(/\/p\/[0-9A-Za-z]{9}$/);
    const path = new URL(page.url()).pathname;
    await page.goto(`${path}?faults=fresh-limit`);
    await expect(page.getByTestId("fresh-limit").getByText(MESSAGE)).toBeVisible();
    await expect(page.getByTestId("agent-status")).toHaveText("No new plan was started.");
    await expect(page.getByTestId("replay-label")).toHaveCount(0);
  });
});
