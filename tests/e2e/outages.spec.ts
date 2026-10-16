import { expect, LOCAL, openDetails, test, waitForPlan } from "./fixtures";

test.describe("API-down states", () => {
  test.skip(!LOCAL, "Fault injection is only enabled on the local test server");

  test("Qloo down: a clear error and no recommendations", async ({ page }) => {
    await page.goto("/plan?example=acoustic&faults=qloo");
    await expect(page.getByText("Qloo is unavailable")).toBeVisible();
    await expect(page.getByRole("region", { name: "Pitches", exact: true }).getByRole("listitem")).toHaveCount(0);
  });

  test("Qloo down during an agent run: the stream ends with the Qloo error", async ({ page }) => {
    await page.goto("/plan?example=folk-duo&faults=qloo");
    // The agent starts on load; its stream ends with the Qloo error (no re-run button: a reload tries again).
    await expect(page.getByText("Qloo is unavailable")).toBeVisible();
    await expect(page.getByRole("button", { name: /Re-run/ })).toHaveCount(0);
  });

  test("sensors, events and weather down: still plans, with less data, labelled", async ({ page }) => {
    await page.goto("/plan?example=acoustic&faults=footfall,events,weather");
    await waitForPlan(page);
    await expect(page.getByText("Foot traffic: unavailable")).toBeVisible();
    await expect(page.getByText("No forecast for this slot, so weather was ignored.")).toBeVisible();
    await expect(page.getByText("Unavailable: simulated outage (test)").first()).toBeVisible();
    // The panels that need those sources say so, scoped: no page-level alert, and the busk still stands.
    await expect(page.getByTestId("source-down")).toContainText("Foot traffic");
    await expect(page.getByTestId("weather-unavailable")).toBeVisible();
  });

  test("busking rules down: no recommendation, with a link to the council's rules", async ({ page }) => {
    await page.goto("/plan?example=sax&faults=pitches,footfall");
    await expect(page.getByRole("heading", { name: /^No legal pitch for/i })).toBeVisible();
    await expect(page.getByRole("link", { name: "Read the council's busking rules" })).toBeVisible();
  });

  test("Last.fm down: setlists still order the songs, without play counts", async ({ page }) => {
    await page.goto("/plan?example=acoustic&faults=songs");
    await waitForPlan(page);
    const sheet = await openDetails(page);
    await expect(sheet.getByRole("heading", { name: /^Setlist for / })).toBeVisible();
    await expect(page.getByText(/Last\.fm plays/)).toHaveCount(0);
  });
});

test.describe("API validation", () => {
  test("rejects an invalid plan request with field names", async ({ request }) => {
    const response = await request.post("/api/plan", { data: { city: "melbourne", slot: { date: "nope" } } });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("invalid_request");
    expect(body.error.message).toContain("slot.date");
  });

  test("rejects a non-JSON body", async ({ request }) => {
    const response = await request.post("/api/plan", { data: "not json", headers: { "content-type": "text/plain" } });
    expect(response.status()).toBe(400);
  });
});
