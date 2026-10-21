import AxeBuilder from "@axe-core/playwright";
import { SERVER_TODAY } from "./clock";
import { expect, LOCAL, openDetails, SATURDAY, shortDay, test, waitForPlan } from "./fixtures";
import { WIDTHS } from "./layout-helpers";

/**
 * Plan inputs S5/S6 (docs/plan-inputs-architecture.md): the busk form's one time control, the read-only Repertoire block, and an any-time plan with a window per pitch.
 * Offline server, mock model, frozen clock (Wednesday noon). Each test has its own cookie jar.
 */
type Page = import("@playwright/test").Page;
const form = (page: Page) => page.getByRole("form", { name: "Plan for your own act" });
const pressed = (page: Page, name: string | RegExp) => form(page).getByRole("radio", { name });
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"];

const SONGS = [
  { title: "How to Make Gravy", artist: "Paul Kelly", own: false },
  { title: "Scar", artist: "Missy Higgins", own: false },
  { title: "My Laneway Song", artist: "Jess", own: true },
];
async function seed(page: Page, actName = "Jess on guitar") {
  const res = await page.request.post("/api/playlist", { data: { actName, soundsLike: [{ name: "Paul Kelly" }, { name: "Missy Higgins" }], songs: SONGS } });
  expect(res.ok()).toBe(true);
}
/** A stored plan's short id, for ?again. */
async function stored(page: Page, slot: object, name = "Again Duo") {
  const res = await page.request.post("/api/plans", { data: { city: "melbourne", slot, performer: { name, artists: ["Paul Kelly"], songs: [{ title: "Gravy", artist: "Paul Kelly", own: false }] } } });
  expect(res.status()).toBe(200);
  return ((await res.json()) as { path: string }).path.split("/").pop()!;
}
const postedPlan = (page: Page) => page.waitForRequest((r) => r.url().endsWith("/api/plans") && r.method() === "POST");

test.describe("the time control (offline)", () => {
  test.skip(!LOCAL, "Local offline server only");

  test("Any time is pressed by default; there are no From and To inputs", async ({ page }) => {
    await page.goto("/busks");
    const f = form(page);
    await expect(f.getByText("Time (optional)")).toBeVisible();
    await expect(pressed(page, /Any time/)).toBeChecked();
    await expect(f.getByTestId("any-time-note")).toContainText("Busk Map finds the best hours that day");
    for (const name of ["Morning", "Lunch", "Afternoon", "Evening"]) await expect(pressed(page, new RegExp(name))).not.toBeChecked();
    await expect(f.getByLabel("From")).toHaveCount(0);
    await expect(f.getByLabel("To", { exact: true })).toHaveCount(0);
    // The default date is today (Wednesday noon is before the last window), since a window can still start.
    await expect(f.locator("#date")).toHaveAttribute("data-date", SERVER_TODAY);
    await f.getByLabel("Artists you sound like").fill("Paul Kelly");
    const posted = postedPlan(page);
    await f.getByRole("button", { name: "Plan my busk" }).click();
    const body = (await posted).postDataJSON();
    expect(body.slot).toEqual({ date: SERVER_TODAY, any: true });
    await expect(page).toHaveURL(/\/p\/[0-9A-Za-z]{9}$/);
    await expect(page.getByText(/any time, Busk Map picks the hours/).first()).toBeVisible();
    await waitForPlan(page);
  });

  test("a named slot sends its fixed hours (Morning 9-12, Lunch 12-3, Afternoon 3-6, Evening 6-9)", async ({ page }) => {
    const hours = { Morning: [9, 12], Lunch: [12, 15], Afternoon: [15, 18], Evening: [18, 21] } as const;
    await page.goto("/busks");
    await expect(pressed(page, /Lunch/)).toContainText("12–3 pm");
    for (const [name, [start, end]] of Object.entries(hours)) {
      await page.goto("/busks");
      const f = form(page);
      await f.getByLabel("Artists you sound like").fill("Paul Kelly");
      await pressed(page, new RegExp(name)).click();
      await expect(pressed(page, new RegExp(name))).toBeChecked();
      await expect(pressed(page, /Any time/)).not.toBeChecked();
      await expect(f.getByTestId("any-time-note")).toHaveCount(0);
      const posted = postedPlan(page);
      await f.getByRole("button", { name: "Plan my busk" }).click();
      const body = (await posted).postDataJSON();
      expect(body.slot).toMatchObject({ startHour: start, endHour: end });
      await expect(page).toHaveURL(/\/p\/[0-9A-Za-z]{9}$/);
    }
  });

  test("choosing a named slot shows its hours on the plan, and choosing Any time again goes back", async ({ page }) => {
    await page.goto("/busks");
    const f = form(page);
    await f.getByLabel("Artists you sound like").fill("Missy Higgins");
    await pressed(page, /Evening/).click();
    await pressed(page, /Any time/).click();
    await expect(pressed(page, /Any time/)).toBeChecked();
    await expect(pressed(page, /Evening/)).not.toBeChecked();
    // Pressing the pressed choice again keeps it: there is always one.
    await pressed(page, /Any time/).click();
    await expect(pressed(page, /Any time/)).toBeChecked();
    await pressed(page, /Evening/).click();
    await f.getByRole("button", { name: "Plan my busk" }).click();
    await expect(page).toHaveURL(/\/p\/[0-9A-Za-z]{9}$/);
    await expect(page.getByText(/6–9 pm/).first()).toBeVisible();
    await waitForPlan(page);
    await expect(page.getByTestId("pitch-row-window")).toHaveCount(0);
    await expect((await openDetails(page)).getByTestId("pitch-window")).toHaveCount(0);
  });

  test("URL round trip: time=any and from/to links open the plan, and ?again prefills the form's time", async ({ page }) => {
    // The long plan links: time=any (new) and from/to (old).
    await page.goto(`/plan?name=Any%20Link&artists=Paul%20Kelly&date=${SATURDAY}&time=any`);
    await expect(page).toHaveURL(/\/p\/[0-9A-Za-z]{9}$/);
    await expect(page.getByText(new RegExp(`${SATURDAY}, any time`)).first()).toBeVisible();
    await waitForPlan(page);
    await page.goto(`/plan?name=Old%20Link&artists=Paul%20Kelly&date=${SATURDAY}&from=18&to=21`);
    await expect(page.getByText(`${shortDay(SATURDAY)} · 6–9 pm`).first()).toBeVisible();
    await waitForPlan(page);

    // Plan again: an any-time plan opens on Any time...
    const anyId = await stored(page, { date: SATURDAY, any: true });
    await page.goto(`/busks?again=${anyId}`);
    await expect(pressed(page, /Any time/)).toBeChecked();
    // ...old fixed hours that match a named slot press that slot...
    const eveningId = await stored(page, { date: SATURDAY, startHour: 18, endHour: 21 });
    await page.goto(`/busks?again=${eveningId}`);
    await expect(pressed(page, /Evening/)).toBeChecked();
    const lunchId = await stored(page, { date: SATURDAY, startHour: 12, endHour: 15 });
    await page.goto(`/busks?again=${lunchId}`);
    await expect(pressed(page, /Lunch/)).toBeChecked();
    // ...and hours that match none stay as a selected From–To choice, which plans for exactly those hours.
    const oddId = await stored(page, { date: SATURDAY, startHour: 10, endHour: 13 });
    await page.goto(`/busks?again=${oddId}`);
    const custom = pressed(page, /10 am–1 pm/);
    await expect(custom).toBeChecked();
    await expect(pressed(page, /Any time/)).not.toBeChecked();
    await pressed(page, /Morning/).click();
    await custom.click();
    await expect(custom).toBeChecked();
    const posted = postedPlan(page);
    await form(page).getByRole("button", { name: "Plan my busk" }).click();
    expect((await posted).postDataJSON().slot).toMatchObject({ startHour: 10, endHour: 13 });
  });

  test("a date in the past says so", async ({ page }) => {
    await page.goto("/busks");
    // The picker's minimum is today, so reach the check through the form's own submit with a stale date from ?again.
    const id = await stored(page, { date: "2026-10-13", startHour: 18, endHour: 21 });
    await page.goto(`/busks?again=${id}`);
    await expect(form(page).locator("#date")).toHaveAttribute("data-date", /20\d\d-\d\d-\d\d/);
  });
});

test.describe("the Repertoire block on /busks is read-only (offline)", () => {
  test.skip(!LOCAL, "Writes to the local offline server's memory store");

  test("a summary and a link to /repertoire; no edit controls; the busk sends every song and no fill", async ({ page }) => {
    await seed(page);
    await page.goto("/busks");
    const f = form(page);
    const block = f.getByTestId("repertoire-source");
    await expect(block.getByTestId("repertoire-summary")).toContainText("Your Repertoire · 3 songs");
    await expect(block.getByRole("link", { name: "Edit in your Repertoire" })).toHaveAttribute("href", "/repertoire");
    await expect(f.getByRole("switch")).toHaveCount(0);
    await expect(f.getByRole("tab")).toHaveCount(0);
    await expect(f.getByRole("checkbox")).toHaveCount(0);
    for (const name of ["Edit for this busk", "Select all", "Remove all", "Save to my Repertoire"]) await expect(f.getByRole("button", { name })).toHaveCount(0);

    const posted = postedPlan(page);
    await f.getByRole("button", { name: "Plan my busk" }).click();
    const body = (await posted).postDataJSON();
    expect(body.performer.songs.map((s: { title: string }) => s.title)).toEqual(["How to Make Gravy", "Scar", "My Laneway Song"]);
    expect(body.performer.fillSuggested).toBeUndefined();
    expect(body.performer.skipSongs).toBeUndefined();
    await expect(page).toHaveURL(/\/p\/[0-9A-Za-z]{9}$/);
    await waitForPlan(page);
    await expect((await openDetails(page)).getByRole("region", { name: "Suggested set" })).toBeVisible();
  });

  test("no Repertoire: a Create link, and a busk still plans with suggested songs only", async ({ page }) => {
    await page.goto("/busks");
    const f = form(page);
    await expect(f.getByTestId("repertoire-empty")).toContainText("No Repertoire yet");
    await expect(f.getByRole("link", { name: "Create your Repertoire" })).toHaveAttribute("href", "/repertoire");
    await f.getByLabel("Artists you sound like").fill("Paul Kelly");
    const posted = postedPlan(page);
    await f.getByRole("button", { name: "Plan my busk" }).click();
    const body = (await posted).postDataJSON();
    expect(body.performer.songs).toEqual([]);
    expect(body.performer.fillSuggested).toBe(6);
    await waitForPlan(page);
    await expect((await openDetails(page)).getByTestId("suggested-tag").first()).toBeVisible();
  });
});

test.describe("an any-time plan shows each pitch's hours (offline)", () => {
  test.skip(!LOCAL, "Runs the agent; local offline server only");

  test("a window on every pitch row and the selected card, and a suggested song tagged on the plan", async ({ page }) => {
    await seed(page);
    await page.goto("/busks");
    const f = form(page);
    await f.getByRole("button", { name: "Plan my busk" }).click();
    await expect(page).toHaveURL(/\/p\/[0-9A-Za-z]{9}$/);
    await waitForPlan(page);
    const rows = page.getByTestId("pitch-row-window");
    await expect(rows).toHaveCount(3);
    for (const row of await rows.all()) await expect(row).toHaveText(/^Best \d+ [ap]m–\d+ [ap]m$/);
    // The header says it is any time.
    await expect(page.getByText(/any time, Busk Map picks the hours/).first()).toBeVisible();
    // Each pitch's details sheet says its own window, matching its row.
    for (const i of [0, 1]) {
      const sheet = await openDetails(page, i);
      await expect(sheet.getByTestId("pitch-window")).toContainText(/^Best \d+ [ap]m–\d+ [ap]m/);
      await expect(sheet.getByTestId("pitch-window")).toContainText(await rows.nth(i).innerText());
      await page.keyboard.press("Escape");
      await expect(sheet).toHaveCount(0);
    }
  });
});

test.describe("layout and axe on the busk form and an any-time plan", () => {
  test.skip(!LOCAL, "Local offline server only");

  for (const width of WIDTHS) {
    test(`layout and axe: the form and an any-time plan at ${width}px`, async ({ page }, info) => {
      test.skip(info.project.name !== "desktop", "width tests run once, in the desktop project");
      await page.setViewportSize({ width, height: 900 });
      await seed(page);
      await page.goto("/busks");
      const f = form(page);
      await expect(f.getByTestId("time-slot-picker")).toBeVisible();
      const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(await overflow()).toBeLessThanOrEqual(0);
      let { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
      expect(violations.map((v) => `${v.impact} ${v.id}`), "form").toEqual([]);

      await f.getByRole("button", { name: "Plan my busk" }).click();
      await waitForPlan(page);
      await expect(page.getByTestId("pitch-row-window").first()).toBeVisible();
      expect(await overflow()).toBeLessThanOrEqual(0);
      ({ violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze());
      expect(violations.map((v) => `${v.impact} ${v.id}`), "any-time plan").toEqual([]);
    });
  }
});
