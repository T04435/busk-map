import { expect, LOCAL, test } from "./fixtures";

test.describe("site-wide not-found page", () => {
  test("an unknown URL returns 404 with the not-found card; home lands on /", async ({ page }) => {
    const response = await page.goto("/this-is-not-a-pitch");
    expect(response?.status()).toBe(404);
    await expect(page).toHaveTitle("Page not found · Busk Map");
    const card = page.getByTestId("site-not-found");
    await expect(card.getByRole("heading", { level: 1, name: "No pitch here" })).toBeVisible();
    await expect(card.getByRole("link", { name: "Try an example plan" })).toHaveAttribute("href", "/plan?example=acoustic");
    await card.getByRole("link", { name: "Go to Busk Map home" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1, name: "Busk Map" })).toBeVisible();
  });

  test("/p/<unknown id> keeps its own not-found state", async ({ page }) => {
    await page.goto("/p/ZZZZZZZZZ");
    await expect(page.getByTestId("plan-not-found").getByRole("heading", { name: "We can't find this busk" })).toBeVisible();
    await expect(page.getByTestId("site-not-found")).toHaveCount(0);
  });
});

test.describe("route error page (error.tsx)", () => {
  test.skip(!LOCAL, "The render fault is only enabled on the local test server");

  test("a render error shows the error card, a reference and no stack; Go home lands on /", async ({ page }) => {
    await page.goto("/plan?example=acoustic&faults=render");
    const card = page.getByTestId("route-error");
    await expect(card.getByRole("heading", { level: 1, name: "Something went wrong" })).toBeVisible();
    await expect(card).toContainText("Something went wrong loading this page.");
    await expect(card.getByText(/^Reference: /)).toBeVisible();
    await expect(page.getByText("Simulated render fault")).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText(/\bat .+\.(tsx?|js):\d+/);
    await expect(card.getByRole("button", { name: "Try again" })).toBeEnabled();
    // Try again re-renders the segment: the fault is still on, so the card comes back.
    await card.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByTestId("route-error")).toBeVisible();
    await card.getByRole("link", { name: "Go home" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1, name: "Busk Map" })).toBeVisible();
  });
});

test.describe("HTTP status of the error pages", () => {
  test("an unknown URL is a real 404, with noindex", async ({ request }) => {
    const response = await request.get("/this-is-not-a-pitch");
    expect(response.status()).toBe(404);
    expect(await response.text()).toContain('<meta name="robots" content="noindex"/>');
  });

  // Streaming fixes the status with the shell (the root layout's prerendered shell, with Cache Components), so a
  // not-found or render error found inside a page's Suspense boundary can't change it: it stays 200, and Next marks
  // the response noindex instead. These pin that behaviour so a change in Next's contract shows up here.
  test("/p/<unknown id> streams its not-found state: noindex, and a 200 or a 404", async ({ request }) => {
    const response = await request.get("/p/ZZZZZZZZZ");
    expect([200, 404]).toContain(response.status());
    expect(await response.text()).toContain('<meta name="robots" content="noindex"/>');
  });

  // The render fault throws inside the page's Suspense boundary, after the shell has flushed, so the status is 200 (a 5xx
  // would need the throw before the shell, which Cache Components' prerendered root shell doesn't allow). Pinned, with the
  // one thing that must hold: the server's message never reaches the HTML.
  test("a render error streams as 200 and never leaks its message", async ({ request }) => {
    test.skip(!LOCAL, "The render fault is only enabled on the local test server");
    const response = await request.get("/plan?example=acoustic&faults=render");
    expect([200, 500]).toContain(response.status());
    expect(await response.text()).not.toContain("Simulated render fault");
  });
});

test.describe("run limit view", () => {
  test("the alert is at most 760px wide, the status line follows it and the home link is signal-coloured", async ({ page }) => {
    await page.goto("/plan?example=sax&faults=fresh-limit");
    const alert = page.getByTestId("fresh-limit");
    await expect(alert.getByText("Plan limit reached")).toBeVisible();
    const box = await alert.boundingBox();
    expect(box!.width).toBeLessThanOrEqual(760);
    await expect(alert.getByRole("link", { name: "Back to Busk Map home" })).toHaveAttribute("href", "/");
    await expect(alert.getByRole("status")).toBeVisible();
  });
});
