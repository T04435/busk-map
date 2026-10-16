import { EXPLANATIONS_LABEL, expect, LOCAL, openDetails, test, waitForPlan } from "./fixtures";

test.describe("week planner", () => {
  test("an example's week: top sessions, the grid and the calendar export", async ({ page, request }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Week: Soul and funk sax player" }).click();
    await expect(page).toHaveURL(/\/week\?example=sax/);
    await expect(page.getByRole("heading", { level: 1, name: /Plan my week/ })).toBeVisible();
    // Same rule as the plan page: the mock Qloo label shows only with synthetic data (local offline server);
    // a deploy with the key says Live, never "test data".
    if (LOCAL) await expect(page.getByText("Qloo test data (local mock)").first()).toBeVisible();
    else {
      await expect(page.getByText("Live Qloo data").first()).toBeVisible();
      await expect(page.getByText(/Qloo test data/)).toHaveCount(0);
    }
    const sessions = page.getByRole("list", { name: "Top sessions" }).getByRole("listitem");
    await expect(sessions.first()).toBeVisible();
    expect(await sessions.count()).toBeLessThanOrEqual(5);
    // At most 2 sessions at one pitch in a week.
    const pitches = (await sessions.allInnerTexts()).map((t) => t.split("\n")[0].split(" · ").at(-1)!.trim());
    for (const name of new Set(pitches)) expect(pitches.filter((p) => p === name).length).toBeLessThanOrEqual(2);
    await expect(page.getByRole("table")).toBeVisible();
    await expect(page.getByRole("table").getByRole("row")).toHaveCount(5); // header + 4 slots

    const href = await page.getByRole("link", { name: "Download .ics" }).getAttribute("href");
    const ics = await request.get(href!);
    expect(ics.headers()["content-type"]).toContain("text/calendar");
    const body = await ics.text();
    expect(body).toContain("BEGIN:VCALENDAR");
    expect(body.match(/BEGIN:VEVENT/g)?.length).toBe(await sessions.count());
  });

  test("marking a chosen slot unavailable re-plans around it", async ({ page }) => {
    await page.goto("/week?example=acoustic&max=1");
    const sessions = page.getByRole("list", { name: "Top sessions" }).getByRole("listitem");
    await expect(sessions).toHaveCount(1);
    const firstLabel = await sessions.first().innerText();
    const chosen = page.getByRole("button", { name: /Chosen.*\. Toggle availability\./ });
    await expect(chosen).toHaveCount(1);
    await chosen.click();
    await expect(page).toHaveURL(/off=/);
    await expect(page.getByRole("button", { name: /Unavailable.*\. Toggle availability\./ })).toHaveCount(1);
    await expect(sessions.first()).not.toHaveText(firstLabel);
  });

  test("a session links to its full plan and setlist", async ({ page }) => {
    await page.goto("/week?example=folk-duo");
    await page.getByRole("link", { name: "Open this session's plan and setlist" }).first().click();
    // Example sessions open the example's own plan.
    // /plan?example=folk-duo&date=… redirects to the session's short link.
    await expect(page).toHaveURL(/\/p\/[0-9A-Za-z]{9}$/);
    // The setlist is in the pitch's details sheet.
    await waitForPlan(page);
    const sheet = await openDetails(page);
    await expect(sheet.getByRole("heading", { name: /^Setlist for / })).toBeVisible();
  });

  test.describe("live parts (local only)", () => {
    test.skip(!LOCAL, "Model calls and fault injection only on the local offline server");

    test("explains the week with the model", async ({ page }) => {
      await page.goto("/week?example=acoustic");
      await page.getByRole("button", { name: "Explain my week (live)" }).click();
      await expect(page.getByText(EXPLANATIONS_LABEL)).toBeVisible();
      await expect(page.getByText(/^Mock explanation for /).first()).toBeVisible();
    });

    test("Qloo down: a clear error", async ({ page }) => {
      await page.goto("/week?example=acoustic&faults=qloo");
      await expect(page.getByText("Qloo is unavailable")).toBeVisible();
    });

    test("sensors and weather down: still plans, labelled", async ({ page }) => {
      await page.goto("/week?example=sax&faults=footfall,weather");
      await expect(page.getByText("Foot traffic: unavailable")).toBeVisible();
      await expect(page.getByText("no forecast").first()).toBeVisible();
    });
  });
});
