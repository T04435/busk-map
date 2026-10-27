import { readFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { expect, LOCAL, test, waitForPlan } from "./fixtures";

/**
 * Plan my week (1.3.0): the form, one run of the Hive over 7 days (offline: mock model, synthetic data), each day's own busk
 * plan, the calendar export, the replay at /w/<id>, any city, and axe at the three widths.
 */
type Page = import("@playwright/test").Page;
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"];
const form = (page: Page) => page.getByRole("form", { name: "Plan my week" });
const days = (page: Page) => page.getByTestId("week-day");

async function planWeek(page: Page) {
  await page.goto("/week");
  await form(page).getByLabel("Artists you sound like").fill("Paul Kelly");
  const posted = page.waitForRequest((r) => r.url().endsWith("/api/week") && r.method() === "POST");
  await form(page).getByRole("button", { name: "Plan my week" }).click();
  const body = (await posted).postDataJSON();
  await expect(page).toHaveURL(/\/w\/[0-9A-Za-z]{9}$/);
  await expect(page.getByTestId("week-view")).toHaveAttribute("data-status", "done", { timeout: 90_000 });
  return body;
}

test.describe("plan my week (offline)", () => {
  test.skip(!LOCAL, "Local offline server only");

  test("/week renders the form, and Week is in the main nav", async ({ page }) => {
    await page.goto("/week");
    await expect(page.getByRole("heading", { level: 1, name: "Plan my week" })).toBeVisible();
    await expect(form(page)).toBeVisible();
    await expect(form(page).getByTestId("week-day-choice")).toHaveCount(7);
    await expect(form(page).getByTestId("week-day-choice").first()).toHaveText(/Any time/);
    const nav = page.locator('nav[aria-label="Main"]:visible');
    await expect(nav.getByRole("link")).toHaveText(["Repertoire", "Busks", "Week"]);
    await expect(nav.getByRole("link", { name: "Week" })).toHaveAttribute("aria-current", "page");
  });

  test("a week run completes with 7 days; a day opens its own busk plan", async ({ page }) => {
    const body = await planWeek(page);
    expect(body.city).toBe("melbourne");
    expect(body.days).toHaveLength(7);
    await expect(days(page)).toHaveCount(7);
    const playing = days(page).filter({ has: page.getByTestId("week-day-status").filter({ hasText: "Playing" }) });
    expect(await playing.count()).toBeGreaterThan(0);
    await expect(playing.first().getByTestId("week-day-pitch")).not.toBeEmpty();
    await expect(playing.first().getByTestId("week-day-hours")).toHaveText(/\d (am|pm)–\d+ (am|pm)/);
    // The Hive's steps, each for a day.
    await expect(page.getByRole("list", { name: "Research, in the order it ran" }).getByTestId("agent-step").first()).toBeVisible();
    await expect(page.getByTestId("agent-step-day").first()).toBeVisible();
    // Credits: text only, no partner wording.
    await expect(page.getByTestId("data-used")).toContainText("Qloo");
    await expect(page.locator("main")).not.toContainText(/partner/i);

    // Each day opens its STORED plan: a replay, no new run (no POST /api/plan).
    let planPosts = 0;
    page.on("request", (r) => {
      if (r.url().endsWith("/api/plan") && r.method() === "POST") planPosts++;
    });
    await playing.first().getByTestId("week-day-plan").click();
    await expect(page).toHaveURL(/\/p\/[0-9A-Za-z]{9}/);
    await waitForPlan(page);
    await expect(page.getByTestId("replay-label")).toBeVisible();
    expect(planPosts).toBe(0);
  });

  test("the week's map pins every day you play, numbered by day, and each playing day has its forecast", async ({ page }) => {
    await planWeek(page);
    const playing = await page.getByTestId("week-day-plan").count();
    await expect(page.getByTestId("week-day-weather")).toHaveCount(playing);
    const map = page.getByTestId("week-map");
    await map.scrollIntoViewIfNeeded();
    const show = map.getByRole("button", { name: "Show the map" });
    // The map loads itself once in view; the button only if it hasn't yet.
    await show.click({ timeout: 2000 }).catch(() => undefined);
    const pins = map.getByRole("button", { name: /^Day \d, / });
    await expect(pins.first()).toBeVisible({ timeout: 20_000 });
    const labels = await pins.evaluateAll((els) => els.map((e) => e.getAttribute("aria-label") ?? ""));
    const days = labels.flatMap((l) => l.split(":")[0].split("; "));
    expect(days).toHaveLength(playing);
  });

  test("the calendar downloads as a valid VCALENDAR with one event per day you play", async ({ page }) => {
    await planWeek(page);
    const playing = await page.getByTestId("week-day-plan").count();
    const download = page.waitForEvent("download");
    await page.getByTestId("week-calendar").click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^busk-map-week-\d{4}-\d{2}-\d{2}\.ics$/);
    const ics = await readFile((await file.path())!, "utf8");
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(playing);
    expect(ics).toMatch(/DTSTART:\d{8}T\d{6}Z/);
    expect(ics.replace(/\r\n /g, "")).toMatch(/URL:http:\/\/localhost:\d+\/p\/[0-9A-Za-z]{9}/);
  });

  test("a reload mid-run follows the run on /w/<id> until its days are in", async ({ page }) => {
    await page.goto("/week");
    await form(page).getByLabel("Artists you sound like").fill("Paul Kelly");
    await form(page).getByRole("button", { name: "Plan my week" }).click();
    await expect(page).toHaveURL(/\/w\/[0-9A-Za-z]{9}$/);
    const url = page.url();
    await page.reload();
    expect(page.url()).toBe(url);
    await expect(page.getByTestId("week-view")).toHaveAttribute("data-status", /done|failed/, { timeout: 90_000 });
    await expect(days(page)).toHaveCount(7);
  });

  test("a reload replays the week from its record: no new run", async ({ page }) => {
    await planWeek(page);
    const statuses = await page.getByTestId("week-day-status").allTextContents();
    let posts = 0;
    page.on("request", (r) => {
      if (r.url().endsWith("/api/week") && r.method() === "POST") posts++;
    });
    await page.reload();
    await expect(page.getByTestId("week-view")).toHaveAttribute("data-status", "done");
    expect(await page.getByTestId("week-day-status").allTextContents()).toEqual(statuses);
    await expect(page.getByTestId("agent-tag")).toHaveText("Replay");
    expect(posts).toBe(0);
  });

  test("any city: a week in Tokyo, with no permit asked", async ({ page }) => {
    await page.goto("/week");
    const permit = form(page).getByRole("group", { name: "Your busking permit" });
    await expect(permit).toBeVisible();
    await form(page).getByRole("button", { name: /^City / }).click();
    await page.getByPlaceholder("Search a city, e.g. Tokyo").fill("Tok");
    await page.getByRole("option", { name: "Tokyo, Japan" }).click();
    await expect(permit).toHaveCount(0);
    await form(page).getByLabel("Artists you sound like").fill("Paul Kelly");
    const posted = page.waitForRequest((r) => r.url().endsWith("/api/week") && r.method() === "POST");
    await form(page).getByRole("button", { name: "Plan my week" }).click();
    expect((await posted).postDataJSON()).toMatchObject({ city: "tokyo-jp", permit: "general", place: { timeZone: "Asia/Tokyo" } });
    await expect(page.getByTestId("week-view")).toHaveAttribute("data-status", "done", { timeout: 90_000 });
    await expect(page.getByText(/^Tokyo · /)).toBeVisible();
    await expect(days(page)).toHaveCount(7);
    await expect(page.getByTestId("rules-not-checked")).toBeVisible();
  });

  test("with OpenStreetMap down, Tokyo's pitches are named by Qloo's places, never a taste spot or a compass hint", async ({ page }) => {
    await page.goto("/week?faults=osm");
    await form(page).getByRole("button", { name: /^City / }).click();
    await page.getByPlaceholder("Search a city, e.g. Tokyo").fill("Tok");
    await page.getByRole("option", { name: "Tokyo, Japan" }).click();
    await form(page).getByLabel("Artists you sound like").fill("Paul Kelly");
    await form(page).getByRole("button", { name: "Plan my week" }).click();
    await expect(page.getByTestId("week-view")).toHaveAttribute("data-status", "done", { timeout: 90_000 });
    const names = await page.getByTestId("week-day-pitch").allTextContents();
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) expect(name).not.toMatch(/taste spot|\b(north|south|east|west)\b|\d km|\d+\.\d{3,}/i);
  });

  for (const width of [390, 768, 1440]) {
    test(`no axe violations at ${width}px: the form and a finished week`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/week");
      await expect(form(page)).toBeVisible();
      expect((await new AxeBuilder({ page }).withTags(WCAG).analyze()).violations).toEqual([]);
      await planWeek(page);
      expect((await new AxeBuilder({ page }).withTags(WCAG).analyze()).violations).toEqual([]);
      // No horizontal scroll.
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });
  }
});
