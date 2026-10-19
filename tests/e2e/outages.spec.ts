import { expect, LOCAL, openDetails, test, waitForPlan } from "./fixtures";

test.describe("API-down states", () => {
  test.skip(!LOCAL, "Fault injection is only enabled on the local test server");

  test("Qloo down: a clear error and no recommendations", async ({ page }) => {
    await page.goto("/plan?example=acoustic&faults=qloo");
    await expect(page.getByRole("heading", { name: "No plan without taste data" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Pitches", exact: true }).getByRole("listitem")).toHaveCount(0);
    // B-043: the panel has Try again, which plans again with the same act and (Qloo still down) lands on the panel again.
    const retry = page.getByTestId("qloo-down").getByRole("button", { name: "Try again" });
    await retry.click();
    await expect(page.getByRole("heading", { name: "No plan without taste data" })).toBeVisible();
    await expect(page.getByTestId("qloo-down")).toContainText(/Unavailable\s*·\s*not responding/);
    await expect(page.getByTestId("qloo-down").getByRole("link", { name: /^Qloo/ })).toHaveAttribute("href", "https://qloo.com");
  });

  test("Qloo down during an agent run: the stream ends with the Qloo error", async ({ page }) => {
    await page.goto("/plan?example=folk-duo&faults=qloo");
    // The agent starts on load; its stream ends with the Qloo error, and the feed has its own Try again.
    await expect(page.getByText("Qloo isn't answering")).toBeVisible();
    await expect(page.getByRole("heading", { name: "No plan without taste data" })).toBeVisible();
    await expect(page.getByTestId("agent-stream").getByRole("button", { name: "Try again" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Re-run/ })).toHaveCount(0);
  });

  test("events and weather down: still plans, with less data, labelled; the activity estimate (Qloo) is still there", async ({ page }) => {
    await page.goto("/plan?example=acoustic&faults=events,weather");
    await waitForPlan(page);
    await expect(page.getByText("Activity: est.")).toBeVisible();
    await expect(page.getByText("No forecast for this slot")).toBeVisible();
    await expect(page.getByText("Unavailable: simulated outage (test)").first()).toBeVisible();
    // The panels that need those sources say so, scoped: no page-level alert, and the busk still stands.
    await expect(page.getByTestId("source-down")).toContainText("Ticketmaster");
    await expect(page.getByTestId("weather-unavailable")).toBeVisible();
  });

  test("busking rules down: no recommendation, with a link to the council's rules", async ({ page }) => {
    await page.goto("/plan?example=sax&faults=pitches");
    await expect(page.getByRole("heading", { name: /^No pitch open for/i })).toBeVisible();
    await expect(page.getByRole("link", { name: "Read the council's busking rules" })).toBeVisible();
  });

  test("Last.fm down: setlists still order the songs, without play counts", async ({ page }) => {
    await page.goto("/plan?example=acoustic&faults=songs");
    await waitForPlan(page);
    const sheet = await openDetails(page);
    await expect(sheet.getByRole("heading", { name: /^Suggested set for / })).toBeVisible();
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
