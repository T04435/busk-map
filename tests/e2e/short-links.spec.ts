import { agentSteps, EXPLANATIONS_LABEL, expect, LOCAL, openDetails, SATURDAY, test, waitForPlan } from "./fixtures";

const SHORT = /\/p\/([0-9A-Za-z]{9})$/;
const idOf = (url: string) => SHORT.exec(new URL(url).pathname)?.[1] ?? null;

test.describe("short plan links", () => {
  test("an example card is inputs only: every click is a new short link and a fresh agent run", async ({ page, request }) => {
    test.skip(!LOCAL, "Starts agent runs; local offline server only");
    // UI: each click opens a new /p/<id> and runs the agent live (steps listed, no replay label).
    // Only the request the page sends is read here, never a response body from a page that has moved on (B-012).
    const click = async () => {
      await page.goto("/");
      const sent = page.waitForRequest((r) => r.url().endsWith("/api/plan") && r.method() === "POST");
      await page.getByRole("link", { name: /^Soul and funk sax player / }).click();
      await expect(page).toHaveURL(SHORT);
      const body = (await sent).postDataJSON() as Record<string, unknown>;
      await waitForPlan(page);
      await expect((await agentSteps(page)).getByText("Your best pitches so far").first()).toBeVisible();
      await expect(page.getByTestId("replay-label")).toHaveCount(0);
      return { id: idOf(page.url()), body };
    };
    const first = await click();
    const second = await click();
    expect(first.id).toBeTruthy();
    expect(second.id).not.toBe(first.id);
    expect(second.body).toEqual(first.body);

    // Stream: the preset's request, posted twice through the API client, read in full. Each is a new run.
    for (let i = 0; i < 2; i++) {
      const response = await request.post("/api/plan", { data: first.body });
      expect(response.status()).toBe(200);
      const events = (await response.text())
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as { type: string; replay?: boolean; message?: string });
      // "Planning started" with no replay or join, then the steps streamed, then the plan. No stored plan.
      expect(events[0]).toEqual({ type: "status", message: "Planning started" });
      expect(events.some((e) => e.type === "status" && (e.replay || /Replaying|Joining/.test(e.message ?? "")))).toBe(false);
      expect(events.filter((e) => e.type === "tool-start").length).toBeGreaterThan(2);
      expect(events.findIndex((e) => e.type === "tool-start")).toBeGreaterThan(0);
      expect(events.at(-1)?.type).toBe("plan");
    }
  });

  test("an unknown or malformed id shows a not-found state with a link home", async ({ page }) => {
    for (const path of ["/p/ZZZZZZZZZ", "/p/abc", "/p/not-a-plan-id"]) {
      await page.goto(path);
      const card = page.getByTestId("plan-not-found");
      await expect(card.getByRole("heading", { name: "We can't find this busk" })).toBeVisible();
      await expect(card.getByRole("link", { name: "Go to Busk Map home" })).toHaveAttribute("href", "/");
    }
    await page.getByRole("link", { name: "Go to Busk Map home" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Busk Map" })).toBeVisible();
  });
});

test.describe("short plan links with the agent (mock model offline)", () => {
  test.skip(!LOCAL, "Runs the agent; local offline server only");

  test("the custom act: form → /p/<id>; the old long URL redirects to the same id; a reload replays with no new run", async ({ page }, testInfo) => {
    const name = `Short Link Trio ${testInfo.project.name}`;
    await page.goto("/busks");
    const form = page.getByRole("form", { name: "Plan for your own act" });
    await form.getByLabel("Act name").fill(name);
    await form.getByLabel("Artists you sound like").fill("Paul Kelly");
    await form.getByLabel("Song list").fill("Dumb Things - Paul Kelly");
    await form.getByRole("button", { name: "Plan my busk" }).click();
    await expect(page).toHaveURL(SHORT);
    const id = idOf(page.url());
    await waitForPlan(page);
    await expect(page.getByText(EXPLANATIONS_LABEL)).toBeVisible();
    // No re-run for buskers.
    await expect(page.getByRole("button", { name: /Re-run|Plan with the agent/ })).toHaveCount(0);

    // The old long URL for the same act and slot (the form's default: next Saturday 6–9 pm) resolves to the same id.
    const date = (await page.getByText(/^Melbourne · \w+day \d{4}/).textContent())!.match(/\d{4}-\d{2}-\d{2}/)![0];
    await page.goto(`/plan?name=${encodeURIComponent(name)}&artists=Paul%20Kelly&songs=Dumb%20Things~Paul%20Kelly&date=${date}&from=18&to=21&permit=general&run=1`);
    await expect(page).toHaveURL(SHORT);
    expect(idOf(page.url())).toBe(id);

    // A reload shows the stored run at once: no request to the agent, the steps replayed and collapsed.
    const agentCalls: string[] = [];
    page.on("request", (r) => r.url().endsWith("/api/plan") && agentCalls.push(r.url()));
    await page.reload();
    await waitForPlan(page);
    await expect(page.getByText(/^Replaying the agent's run from .* \(cached, no new model call\)$/)).toBeVisible();
    await expect(page.getByTestId("agent-status")).toHaveText("The agent's plan, replayed.");
    await expect((await agentSteps(page)).getByText("Your best pitches so far").first()).toBeVisible();
    await expect(page.getByTestId("agent-usage")).toContainText("model steps");
    expect(agentCalls).toEqual([]);
    // Opening a pitch's details keeps the short link, and closing the sheet clears the pitch from it.
    await openDetails(page, 1);
    await expect(page).toHaveURL(new RegExp(`/p/${id}\\?pitch=`));
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(new RegExp(`/p/${id}$`));
  });

  test("Copy link copies the short URL", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto(`/plan?name=Copy%20Link%20Act&artists=Paul%20Kelly&date=${SATURDAY}&from=18&to=21`);
    await expect(page).toHaveURL(SHORT);
    const id = idOf(page.url())!;
    const button = page.getByRole("button", { name: "Copy link" });
    await button.click();
    await expect(page.getByRole("button", { name: "Link copied" })).toBeVisible();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toBe(new URL(`/p/${id}`, page.url()).toString());
  });

  test("Copy link falls back to a selectable box when the clipboard is refused", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", { value: { writeText: () => Promise.reject(new Error("denied")) }, configurable: true });
      document.execCommand = () => false;
    });
    await page.goto(`/plan?name=Copy%20Link%20Act&artists=Paul%20Kelly&date=${SATURDAY}&from=18&to=21`);
    await expect(page).toHaveURL(SHORT);
    await page.getByRole("button", { name: "Copy link" }).click();
    await expect(page.getByRole("textbox", { name: "Plan link" })).toHaveValue(new RegExp(`/p/${idOf(page.url())}$`));
  });

  test("a plan whose slot has passed: a note and a pre-filled form link, no new run", async ({ page }) => {
    const agentCalls: string[] = [];
    page.on("request", (r) => r.url().endsWith("/api/plan") && agentCalls.push(r.url()));
    await page.goto("/plan?name=Past%20Slot%20Duo&artists=Paul%20Kelly&songs=Dumb%20Things~Paul%20Kelly&date=2026-10-03&from=12&to=15&permit=premium");
    await expect(page).toHaveURL(SHORT);
    const note = page.getByTestId("slot-passed");
    await expect(note).toContainText("This slot has passed");
    await expect(note).toContainText("Saturday 2026-10-03, 12 pm–3 pm");
    expect(agentCalls).toEqual([]);
    await note.getByRole("link", { name: "Plan again for a new date" }).click();
    await expect(page).toHaveURL(/\/busks\?again=[0-9A-Za-z]{9}$/);
    const form = page.getByRole("form", { name: "Plan for your own act" });
    await expect(form.getByLabel("Act name")).toHaveValue("Past Slot Duo");
    await expect(form.getByRole("list", { name: "Artists you picked" })).toContainText("Paul Kelly");
    await expect(form.getByRole("list", { name: "Songs you picked" })).toContainText("Dumb Things");
    // A new date: the next Saturday from today, not the old one.
    await expect(form.getByLabel("Date")).not.toHaveAttribute("data-date", "2026-10-03");
  });

  test("fresh runs are refused in production builds (the e2e server)", async ({ page, request }) => {
    await page.goto(`/plan?name=Fresh%20Check&artists=Paul%20Kelly&date=${SATURDAY}&from=18&to=21&fresh=1`);
    await expect(page).toHaveURL(/\/p\/[0-9A-Za-z]{9}\?fresh=1$/);
    await waitForPlan(page);
    const body = { city: "melbourne", slot: { date: SATURDAY, startHour: 18, endHour: 21 }, performer: { name: "Fresh Check", artists: ["Paul Kelly"] } };
    const response = await request.post("/api/plan", { data: body, headers: { "x-buskmap-fresh": "1" } });
    expect(response.status()).toBe(403);
  });

  test("the plan payload carries research totals (mock mode)", async ({ request }) => {
    const body = { city: "melbourne", slot: { date: SATURDAY, startHour: 18, endHour: 21 }, performer: { name: "Totals Check", artists: ["Paul Kelly"] } };
    const response = await request.post("/api/plan", { data: body });
    expect(response.status()).toBe(200);
    const events = (await response.text())
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as { type: string; plan?: { researchTotals?: Record<string, number> } });
    const totals = events.find((e) => e.type === "plan")?.plan?.researchTotals;
    expect(Object.keys(totals ?? {}).sort()).toEqual(["crowds", "events", "places", "qlooCacheHits", "qlooCalls", "rules", "scored", "sensors", "songs", "taste"]);
    for (const value of Object.values(totals!)) expect(Number.isInteger(value) && value >= 0).toBe(true);
    expect(totals!.scored).toBeGreaterThan(0);
    // Qloo usage for this busk: requests sent plus lookups served from the data cache (other specs may have warmed it).
    expect(totals!.qlooCalls + totals!.qlooCacheHits).toBeGreaterThan(0);

    // Live: a totals event after every tool-end, never decreasing, and the last one (right before the plan) is the plan's.
    const types = events.map((e) => e.type);
    types.forEach((t, i) => t === "tool-end" && expect(types[i + 1]).toBe("totals"));
    const running = events.filter((e): e is { type: "totals"; totals: Record<string, number> } => e.type === "totals").map((e) => e.totals);
    expect(running.length).toBeGreaterThan(1);
    for (let i = 1; i < running.length; i++) for (const k of Object.keys(totals!)) expect(running[i][k]).toBeGreaterThanOrEqual(running[i - 1][k]);
    expect(types.at(-2)).toBe("totals");
    expect(running.at(-1)).toEqual(totals);

    // A replay of the same request re-emits the totals and ends on the same numbers.
    const again = (await (await request.post("/api/plan", { data: body })).text())
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as { type: string; replay?: boolean; totals?: Record<string, number>; plan?: { researchTotals?: Record<string, number> } });
    expect(again.some((e) => e.type === "status" && e.replay)).toBe(true);
    expect(again.filter((e) => e.type === "totals").map((e) => e.totals)).toEqual(running);
    expect(again.find((e) => e.type === "plan")?.plan?.researchTotals).toEqual(totals);
  });

  test("an engine-only plan emits one totals event before the plan (mock mode)", async ({ request }) => {
    // Qloo matches no artist: the agent isn't run, the engine's plan is served.
    const body = { city: "melbourne", slot: { date: SATURDAY, startHour: 18, endHour: 21 }, performer: { name: "Engine Only", artists: ["Zzqx Nobody Matches"] } };
    const events = (await (await request.post("/api/plan", { data: body })).text())
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as { type: string; totals?: Record<string, number>; plan?: { researchTotals?: Record<string, number> } });
    const totals = events.filter((e) => e.type === "totals");
    expect(events.some((e) => e.type === "tool-end")).toBe(false);
    expect(totals).toHaveLength(1);
    expect(events.map((e) => e.type).at(-2)).toBe("totals");
    expect(totals[0].totals).toEqual(events.find((e) => e.type === "plan")?.plan?.researchTotals);
  });
});
