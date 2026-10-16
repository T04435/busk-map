/**
 * QA[busk-map] independent checks (qa/test-plan.md). Offline only: every spec here runs against the
 * local offline server Playwright starts (BUSKMAP_OFFLINE=1, mock model). Deploy runs skip them.
 *
 * Run: CI=1 PORT=<free port> pnpm exec playwright test tests/e2e/qa/
 */
import { expect, LOCAL, SATURDAY, test } from "../fixtures";

type StreamEvent = { type: string; tool?: string; replay?: boolean; plan?: Record<string, unknown> & { dataStatus?: { adapter: string; mode: string }[]; explanations?: string } };

async function planEvents(request: import("@playwright/test").APIRequestContext, body: unknown): Promise<StreamEvent[]> {
  const response = await request.post("/api/plan", { data: body });
  expect(response.status()).toBe(200);
  return (await response.text())
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as StreamEvent);
}

test.describe("QA money: offline server spends nothing", () => {
  test.skip(!LOCAL, "Offline checks need the local test server");

  test("M-2/M-3: /api/health is offline, comparisons stay in memory", async ({ request }) => {
    expect(await (await request.get("/api/health")).json()).toMatchObject({ ok: true, offline: true });
    const stats = await (await request.get("/api/baseline-stats")).json();
    expect(stats.store).toBe("memory");
  });

  test("M-1: every data source in a plan is synthetic or an injected fallback, never live", async ({ request }) => {
    const events = await planEvents(request, {
      city: "melbourne",
      slot: { date: SATURDAY, startHour: 18, endHour: 21 },
      performer: { name: "QA Money Check", artists: ["Paul Kelly", "Courtney Barnett"] },
    });
    const plan = events.find((e) => e.type === "plan")?.plan;
    expect(plan, "the stream ends with a plan").toBeTruthy();
    const modes = (plan!.dataStatus ?? []).map((s) => `${s.adapter}:${s.mode}`);
    expect(modes.length).toBeGreaterThan(0);
    expect(modes.filter((m) => m.endsWith(":live"))).toEqual([]);
  });
});

test.describe("QA decided rules", () => {
  test.skip(!LOCAL, "Mock model runs only on the local test server");

  test("R-1 agent-independence: score_pitches comes after at least 3 looks, and Agent vs engine is shown", async ({ page, request }) => {
    const events = await planEvents(request, {
      city: "melbourne",
      slot: { date: SATURDAY, startHour: 18, endHour: 21 },
      performer: { name: "QA Independence", artists: ["Stevie Wonder", "Amy Winehouse"] },
    });
    const tools = events.filter((e) => e.type === "tool-start").map((e) => e.tool!);
    const scoreAt = tools.indexOf("score_pitches");
    expect(scoreAt, `tool order: ${tools.join(", ")}`).toBeGreaterThanOrEqual(3);

    await page.goto("/plan?example=acoustic");
    await expect(page.getByText("Agent vs engine")).toBeVisible();
  });

  for (const example of ["acoustic", "sax", "folk-duo"]) {
    test(`R-3 week cap: at most 2 sessions per pitch (${example})`, async ({ page }) => {
      await page.goto(`/week?example=${example}`);
      const sessions = page.getByRole("list", { name: "Top sessions" }).getByRole("listitem");
      await expect(sessions.first()).toBeVisible();
      const pitches = (await sessions.allInnerTexts()).map((t) => t.split("\n")[0].split(" · ").at(-1)!.trim());
      for (const name of new Set(pitches)) expect(pitches.filter((p) => p === name).length, name).toBeLessThanOrEqual(2);
    });
  }
});

test.describe("QA judge paths", () => {
  test.skip(!LOCAL, "Uses offline fixtures");

  test("J-1: an example opens on a short link with 3 pitches, a plain-AI control and credited sources", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /Folk duo/ }).first().click();
    await expect(page).toHaveURL(/\/p\/[0-9A-Za-z]{9}$/);
    await expect(page.getByRole("region", { name: "Pitches", exact: true })).toBeVisible();
    await expect(page.getByText("Busk Map vs a plain AI")).toBeVisible();
    for (const credit of ["Taste data by Qloo", "© OpenStreetMap contributors", "Ticketmaster", "Open-Meteo", "Last.fm"]) {
      await expect(page.getByText(credit).first()).toBeVisible();
    }
    await expect(page.getByText("Busk Map never confirms a pitch is legal").first()).toBeVisible();
  });

  test("J-5: an unknown URL is a real 404 with a way home", async ({ page }) => {
    const response = await page.goto("/qa-no-such-page");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("link", { name: /home/i }).first()).toBeVisible();
  });

  test("no page needs a login: no sign-in control on the judge paths", async ({ page }) => {
    for (const path of ["/", "/plan?example=acoustic", "/week?example=sax", "/tips"]) {
      await page.goto(path);
      await expect(page.getByRole("button", { name: /sign in|log in/i })).toHaveCount(0);
      await expect(page.getByRole("link", { name: /sign in|log in/i })).toHaveCount(0);
    }
  });
});

test.describe("QA open defects (expected to fail until fixed)", () => {
  test.skip(!LOCAL, "Offline-only defect");

  test("B-003: an artist picked from offline search opens a plan", async ({ page }) => {
    test.fail(true, "B-003: synthetic search ids (syn-artist-1) fail the 22-char Spotify id rule");
    await page.goto("/");
    const form = page.getByRole("form", { name: "Plan for your own act" });
    await form.getByLabel("Act name").fill("QA Synthetic Pick");
    await form.getByPlaceholder("Search Spotify, e.g. Paul Kelly").fill("Qa Nobody Band");
    await page.getByRole("option", { name: /Qa Nobody Band \(synthetic\)/ }).click();
    await form.getByRole("button", { name: "Plan my set" }).click();
    await expect(page).toHaveURL(/\/p\/[0-9A-Za-z]{9}$/, { timeout: 10_000 });
  });
});
