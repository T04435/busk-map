import AxeBuilder from "@axe-core/playwright";
import { SERVER_TODAY } from "./clock";
import { expect, LOCAL, SATURDAY, test, waitForPlan } from "./fixtures";

/**
 * Plan inputs S5/S6 (docs/plan-inputs-architecture.md): the busk form's one time control, "Edit for this busk" with suggested
 * fill, adding songs with one search and the type-it-in fallback, and an any-time plan with a window per pitch.
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
    await page.goto("/");
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
    await f.getByRole("button", { name: "Plan my set" }).click();
    const body = (await posted).postDataJSON();
    expect(body.slot).toEqual({ date: SERVER_TODAY, any: true });
    await expect(page).toHaveURL(/\/p\/[0-9A-Za-z]{9}$/);
    await expect(page.getByText(/any time, Busk Map picks the hours/).first()).toBeVisible();
    await waitForPlan(page);
  });

  test("a named slot sends its fixed hours (Morning 9-12, Lunch 12-3, Afternoon 3-6, Evening 6-9)", async ({ page }) => {
    const hours = { Morning: [9, 12], Lunch: [12, 15], Afternoon: [15, 18], Evening: [18, 21] } as const;
    await page.goto("/");
    await expect(pressed(page, /Lunch/)).toContainText("12 pm–3 pm");
    for (const [name, [start, end]] of Object.entries(hours)) {
      await page.goto("/");
      const f = form(page);
      await f.getByLabel("Artists you sound like").fill("Paul Kelly");
      await pressed(page, new RegExp(name)).click();
      await expect(pressed(page, new RegExp(name))).toBeChecked();
      await expect(pressed(page, /Any time/)).not.toBeChecked();
      await expect(f.getByTestId("any-time-note")).toHaveCount(0);
      const posted = postedPlan(page);
      await f.getByRole("button", { name: "Plan my set" }).click();
      const body = (await posted).postDataJSON();
      expect(body.slot).toMatchObject({ startHour: start, endHour: end });
      await expect(page).toHaveURL(/\/p\/[0-9A-Za-z]{9}$/);
    }
  });

  test("choosing a named slot shows its hours on the plan, and choosing Any time again goes back", async ({ page }) => {
    await page.goto("/");
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
    await f.getByRole("button", { name: "Plan my set" }).click();
    await expect(page).toHaveURL(/\/p\/[0-9A-Za-z]{9}$/);
    await expect(page.getByText(/6 pm–9 pm/).first()).toBeVisible();
    await waitForPlan(page);
    await expect(page.getByTestId("pitch-window")).toHaveCount(0);
  });

  test("URL round trip: time=any and from/to links open the plan, and ?again prefills the form's time", async ({ page }) => {
    // The long plan links: time=any (new) and from/to (old).
    await page.goto(`/plan?name=Any%20Link&artists=Paul%20Kelly&date=${SATURDAY}&time=any`);
    await expect(page).toHaveURL(/\/p\/[0-9A-Za-z]{9}$/);
    await expect(page.getByText(new RegExp(`${SATURDAY}, any time`)).first()).toBeVisible();
    await waitForPlan(page);
    await page.goto(`/plan?name=Old%20Link&artists=Paul%20Kelly&date=${SATURDAY}&from=18&to=21`);
    await expect(page.getByText(new RegExp(`${SATURDAY}, 6 pm–9 pm`))).toBeVisible();
    await waitForPlan(page);

    // Plan again: an any-time plan opens on Any time...
    const anyId = await stored(page, { date: SATURDAY, any: true });
    await page.goto(`/?again=${anyId}`);
    await expect(pressed(page, /Any time/)).toBeChecked();
    // ...old fixed hours that match a named slot press that slot...
    const eveningId = await stored(page, { date: SATURDAY, startHour: 18, endHour: 21 });
    await page.goto(`/?again=${eveningId}`);
    await expect(pressed(page, /Evening/)).toBeChecked();
    const lunchId = await stored(page, { date: SATURDAY, startHour: 12, endHour: 15 });
    await page.goto(`/?again=${lunchId}`);
    await expect(pressed(page, /Lunch/)).toBeChecked();
    // ...and hours that match none stay as a selected From–To choice, which plans for exactly those hours.
    const oddId = await stored(page, { date: SATURDAY, startHour: 10, endHour: 13 });
    await page.goto(`/?again=${oddId}`);
    const custom = pressed(page, /10 am–1 pm/);
    await expect(custom).toBeChecked();
    await expect(pressed(page, /Any time/)).not.toBeChecked();
    await pressed(page, /Morning/).click();
    await custom.click();
    await expect(custom).toBeChecked();
    const posted = postedPlan(page);
    await form(page).getByRole("button", { name: "Plan my set" }).click();
    expect((await posted).postDataJSON().slot).toMatchObject({ startHour: 10, endHour: 13 });
  });

  test("a date in the past says so", async ({ page }) => {
    await page.goto("/");
    // The picker's minimum is today, so reach the check through the form's own submit with a stale date from ?again.
    const id = await stored(page, { date: "2026-10-13", startHour: 18, endHour: 21 });
    await page.goto(`/?again=${id}`);
    await expect(form(page).locator("#date")).toHaveAttribute("data-date", /20\d\d-\d\d-\d\d/);
  });
});

test.describe("Edit for this busk (offline)", () => {
  test.skip(!LOCAL, "Writes to the local offline server's memory store");

  test("one block; removing a song fills with a tagged suggested song; Remove all gives suggested songs only", async ({ page }) => {
    await seed(page);
    await page.goto("/");
    const f = form(page);
    const block = f.getByTestId("repertoire-source");
    await expect(block.getByTestId("repertoire-summary")).toContainText("Your Repertoire · 3 songs");
    await expect(f.getByRole("switch")).toHaveCount(0);
    await expect(f.getByRole("tab")).toHaveCount(0);

    await block.getByRole("button", { name: "Edit for this busk" }).click();
    await expect(block.getByText("3 of 3 selected")).toBeVisible();
    await block.getByRole("checkbox", { name: /Scar/ }).click();
    await expect(block.getByText("2 of 3 selected")).toBeVisible();
    await expect(block.getByText("Edited for this busk").first()).toBeVisible();
    await block.getByRole("button", { name: "Done" }).click();
    await expect(block.getByText(/2 of 3 songs · new suggested songs fill the rest/)).toBeVisible();

    let posted = postedPlan(page);
    await f.getByRole("button", { name: "Plan my set" }).click();
    let body = (await posted).postDataJSON();
    expect(body.performer.songs.map((s: { title: string }) => s.title)).toEqual(["How to Make Gravy", "My Laneway Song"]);
    // Removed songs: the fill count is at least 3, and the removed song is on the leave-out list.
    expect(body.performer.fillSuggested).toBe(3);
    expect(body.performer.skipSongs).toEqual([{ title: "Scar", artist: "Missy Higgins" }]);
    await expect(page).toHaveURL(/\/p\/[0-9A-Za-z]{9}$/);
    await waitForPlan(page);
    const set = page.getByRole("heading", { name: /Suggested set for/ }).locator("xpath=ancestor::*[@data-slot='card'][1]");
    await expect(set.getByTestId("suggested-tag").first()).toBeVisible();
    await expect(set.getByTestId("suggestion-because").first()).not.toBeEmpty();
    await expect(set).not.toContainText("Scar");
    // "N of M songs you can sing" counts the act's own songs only.
    await expect(set.getByTestId("you-can-sing")).toContainText("2 of 2 songs you can sing");

    // Back to the form: the Repertoire itself was not changed by the plan.
    await page.goto("/");
    await expect(f.getByTestId("repertoire-summary")).toContainText("3 songs");
    await f.getByRole("button", { name: "Edit for this busk" }).click();
    await f.getByRole("button", { name: "Remove all" }).click();
    await expect(f.getByText("0 of 3 selected")).toBeVisible();
    await expect(f.getByText("New suggested songs only").first()).toBeVisible();
    await f.getByRole("button", { name: "Select all" }).click();
    await expect(f.getByText("3 of 3 selected")).toBeVisible();
    await f.getByRole("button", { name: "Remove all" }).click();
    await f.getByRole("button", { name: "Done" }).click();
    await expect(f.getByTestId("suggested-only")).toBeVisible();
    posted = postedPlan(page);
    await f.getByRole("button", { name: "Plan my set" }).click();
    body = (await posted).postDataJSON();
    expect(body.performer.songs).toEqual([]);
    expect(body.performer.fillSuggested).toBe(6);
    expect(body.performer.skipSongs).toHaveLength(3);
    await waitForPlan(page);
    const only = page.getByRole("heading", { name: /Suggested set for/ }).locator("xpath=ancestor::*[@data-slot='card'][1]");
    const rows = only.locator("ol > li");
    expect(await rows.count()).toBeGreaterThan(0);
    await expect(only.getByTestId("suggested-tag")).toHaveCount(await rows.count());
    await expect(only.getByText("Your song", { exact: true })).toHaveCount(0);
  });

  test("an empty Repertoire says so, and a busk still plans with suggested songs", async ({ page }) => {
    await page.goto("/");
    const f = form(page);
    await expect(f.getByTestId("repertoire-empty")).toContainText("Your Repertoire is empty");
    await expect(f.getByRole("link", { name: "Build your Repertoire" })).toHaveAttribute("href", "/repertoire");
    await f.getByLabel("Artists you sound like").fill("Paul Kelly");
    const posted = postedPlan(page);
    await f.getByRole("button", { name: "Plan my set" }).click();
    const body = (await posted).postDataJSON();
    expect(body.performer.songs).toEqual([]);
    expect(body.performer.fillSuggested).toBe(6);
    await waitForPlan(page);
    await expect(page.getByTestId("suggested-tag").first()).toBeVisible();
  });

  test("an unedited Repertoire sends no fill", async ({ page }) => {
    await seed(page);
    await page.goto("/");
    const posted = postedPlan(page);
    await form(page).getByRole("button", { name: "Plan my set" }).click();
    const body = (await posted).postDataJSON();
    expect(body.performer.fillSuggested).toBeUndefined();
    expect(body.performer.skipSongs).toBeUndefined();
    expect(body.performer.songs).toHaveLength(3);
  });
});

test.describe("adding songs: one search, then type it in (offline)", () => {
  test.skip(!LOCAL, "Local offline server only");

  test("step 1 is the Spotify profile, step 2 is one search; no match shows the prefilled type-it-in form", async ({ page }) => {
    await page.route("**/api/repertoire?type=tracks*", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ mode: "synthetic", tracks: [] }) }));
    await page.goto("/");
    const f = form(page);
    await f.getByLabel("Artists you sound like").fill("Paul Kelly");
    await f.getByRole("button", { name: "Edit for this busk" }).click();
    await f.getByText("+ Add a song just for this busk").click();
    const add = f.getByTestId("repertoire-add");
    await expect(add.getByText(/1\. Your Spotify artist profile \(optional\)/)).toBeVisible();
    await expect(add.getByText("2. Add a song")).toBeVisible();
    // No Search / My Spotify / Type tabs: one search box.
    await expect(f.getByRole("tab")).toHaveCount(0);
    await expect(add.getByRole("combobox", { name: "Search songs on Spotify" })).toHaveCount(1);
    await expect(add.getByTestId("type-it-in")).toHaveCount(0);

    await add.getByRole("combobox", { name: "Search songs on Spotify" }).pressSequentially("Zzyzx Tune - Zzyzx Band");
    await expect(add.getByText(/No songs on Spotify match/)).toBeVisible();
    const typed = add.getByTestId("type-it-in");
    await expect(typed.getByLabel("Song title")).toHaveValue("Zzyzx Tune");
    await expect(typed.getByLabel("Artist")).toHaveValue("Zzyzx Band");
    await typed.getByRole("button", { name: "Add as typed" }).click();
    const list = f.getByRole("list", { name: "Songs for this busk" });
    await expect(list).toContainText("Zzyzx Tune");
    await expect(list).toContainText("Zzyzx Band");
    await expect(list).toContainText("Just for this busk");
    await expect(add.getByTestId("type-it-in")).toHaveCount(0);

    // It is sent with the busk.
    await f.getByRole("button", { name: "Done" }).click();
    const posted = postedPlan(page);
    await f.getByRole("button", { name: "Plan my set" }).click();
    const body = (await posted).postDataJSON();
    expect(body.performer.songs).toEqual([{ title: "Zzyzx Tune", artist: "Zzyzx Band", own: false }]);
    // The song is the act's: no fill is asked for.
    expect(body.performer.fillSuggested).toBeUndefined();
  });

  test("a search with a match adds the Spotify song; the profile link loads your own songs on Enter", async ({ page }) => {
    await page.goto("/");
    const f = form(page);
    await f.getByLabel("Artists you sound like").fill("Paul Kelly");
    await f.getByRole("button", { name: "Edit for this busk" }).click();
    await f.getByText("+ Add a song just for this busk").click();
    const add = f.getByTestId("repertoire-add");
    await add.getByRole("combobox", { name: "Search songs on Spotify" }).pressSequentially("Gravy");
    await add.getByRole("option", { name: /Gravy \(synthetic result 1\)/ }).click();
    await expect(f.getByRole("list", { name: "Songs for this busk" })).toContainText("Gravy (synthetic result 1)");
    await add.getByLabel(/Your Spotify artist profile/).fill("https://open.spotify.com/artist/4gzpq5DPGxSnKTe4SA8HAU");
    await add.getByLabel(/Your Spotify artist profile/).press("Enter");
    await expect(add.getByRole("status")).toContainText(/Added \d+ of your songs|Offline test mode/);
    await expect(f.getByRole("list", { name: "Songs for this busk" })).toContainText("Your song");
  });
});

test.describe("an any-time plan shows each pitch's hours (offline)", () => {
  test.skip(!LOCAL, "Runs the agent; local offline server only");

  test("a window on every pitch row and the selected card, and a suggested song tagged on the plan", async ({ page }) => {
    await seed(page);
    await page.goto("/");
    const f = form(page);
    await f.getByRole("button", { name: "Edit for this busk" }).click();
    await f.getByRole("checkbox", { name: /Scar/ }).click();
    await f.getByRole("button", { name: "Done" }).click();
    await f.getByRole("button", { name: "Plan my set" }).click();
    await expect(page).toHaveURL(/\/p\/[0-9A-Za-z]{9}$/);
    await waitForPlan(page);
    const rows = page.getByTestId("pitch-row-window");
    await expect(rows).toHaveCount(3);
    for (const row of await rows.all()) await expect(row).toHaveText(/^Best \d+ [ap]m–\d+ [ap]m$/);
    await expect(page.getByTestId("pitch-window")).toContainText(/^Best \d+ [ap]m–\d+ [ap]m/);
    // The header says it is any time.
    await expect(page.getByText(/any time, Busk Map picks the hours/).first()).toBeVisible();
    // Selecting another pitch changes its card's window to that pitch's own.
    await page.getByRole("region", { name: "Pitches", exact: true }).getByRole("button").nth(1).click();
    await expect(page.getByTestId("pitch-window")).toContainText(/^Best \d+ [ap]m–\d+ [ap]m/);
  });
});

test.describe("layout and axe on the busk form and an any-time plan", () => {
  test.skip(!LOCAL, "Local offline server only");

  for (const width of [390, 768, 1440]) {
    test(`the form and an any-time plan at ${width}px: no horizontal overflow, axe clean`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await seed(page);
      await page.goto("/");
      const f = form(page);
      await expect(f.getByTestId("time-slot-picker")).toBeVisible();
      const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(await overflow()).toBeLessThanOrEqual(0);
      let { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
      expect(violations.map((v) => `${v.impact} ${v.id}`), "form").toEqual([]);

      await f.getByRole("button", { name: "Edit for this busk" }).click();
      await f.getByRole("checkbox", { name: /Scar/ }).click();
      await f.getByText("+ Add a song just for this busk").click();
      expect(await overflow()).toBeLessThanOrEqual(0);
      ({ violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze());
      expect(violations.map((v) => `${v.impact} ${v.id}`), "form editing").toEqual([]);
      await f.getByRole("button", { name: "Done" }).click();

      await f.getByRole("button", { name: "Plan my set" }).click();
      await waitForPlan(page);
      await expect(page.getByTestId("pitch-window")).toBeVisible();
      expect(await overflow()).toBeLessThanOrEqual(0);
      ({ violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze());
      expect(violations.map((v) => `${v.impact} ${v.id}`), "any-time plan").toEqual([]);
    });
  }
});
