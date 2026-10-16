import AxeBuilder from "@axe-core/playwright";
import { expect, LOCAL, openDetails, test, waitForPlan } from "./fixtures";

/** Stage R2: the planners read the Repertoire (docs/playlist-architecture.md §3). Offline, memory store, one cookie per context. */
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"];
const SHOTS = process.env.REPERTOIRE_SHOTS;
type Page = import("@playwright/test").Page;

const SONGS = [
  { title: "How to Make Gravy", artist: "Paul Kelly", own: false },
  { title: "Scar", artist: "Missy Higgins", own: false },
  { title: "My Laneway Song", artist: "Jess", own: true },
];

async function seed(page: Page, songs = SONGS, actName = "Jess on guitar") {
  const res = await page.request.post("/api/playlist", { data: { actName, soundsLike: [{ name: "Paul Kelly" }, { name: "Missy Higgins" }], songs } });
  expect(res.ok()).toBe(true);
}
const state = async (page: Page) => (await (await page.request.get("/api/playlist")).json()).playlist;
const form = (page: Page) => page.getByRole("form", { name: "Plan for your own act" });

test.describe("planners read the Repertoire (offline)", () => {
  test.skip(!LOCAL, "Writes to the local offline server's memory store");

  test("the busk form is pre-filled, and the plan's request is a snapshot of it", async ({ page }) => {
    // A unique act, so the run is this device's own: an identical busk another device already planned opens from the stored run
    // with no plan request, and so records no usual pitch.
    const act = `Jess ${Math.random().toString(36).slice(2, 8)}`;
    await seed(page, SONGS, act);
    await page.goto("/busks");
    const f = form(page);
    await expect(f.getByTestId("repertoire-summary")).toContainText("Your Repertoire · 3 songs");
    await expect(f.getByLabel("Act name")).toHaveValue(act);
    // Read-only here: the songs are summarised, with a link to edit them on /repertoire.
    await expect(f.getByRole("link", { name: "Edit in your Repertoire" })).toHaveAttribute("href", "/repertoire");
    await expect(f.getByRole("list", { name: "Artists you picked" })).toContainText("Paul Kelly");

    const posted = page.waitForRequest((r) => r.url().endsWith("/api/plans") && r.method() === "POST");
    await f.getByRole("button", { name: "Plan my busk" }).click();
    const body = (await posted).postDataJSON();
    expect(body.performer.songs.map((s: { title: string }) => s.title)).toEqual(SONGS.map((s) => s.title));
    // The request holds the act and its songs, never a Repertoire id, revision or cookie.
    expect(JSON.stringify(body)).not.toMatch(/playlist|revision|buskmap_/);
    await expect(page).toHaveURL(/\/p\/[0-9A-Za-z]{9}$/);
    await waitForPlan(page);
    // The plan's songs match the Repertoire's, and "Save these songs" is not offered to a device that has one.
    await expect(page.getByTestId("save-as-repertoire")).toHaveCount(0);
    const set = (await openDetails(page)).getByRole("region", { name: "Suggested set" });
    for (const s of SONGS) await expect(set).toContainText(s.title);
    await page.keyboard.press("Escape");
    // The top pitch of this busk is now a usual pitch; the revision did not move.
    await expect.poll(async () => (await state(page)).usualPitches.length).toBe(1);
  });

  test("planning a busk (even with the act renamed on the form) leaves the Repertoire as it was", async ({ page }) => {
    await seed(page);
    const before = await state(page);
    await page.goto("/busks");
    const f = form(page);
    await f.getByLabel("Act name").fill("Renamed for this busk");
    await f.getByRole("button", { name: "Plan my busk" }).click();
    await expect(page).toHaveURL(/\/p\/[0-9A-Za-z]{9}$/);
    await waitForPlan(page);
    const after = await state(page);
    expect(after.revision).toBe(before.revision);
    expect(after.actName).toBe(before.actName);
    expect(after.songs.map((s: { title: string }) => s.title)).toEqual(SONGS.map((s) => s.title));
  });

  test("with no Repertoire the form says so, and a planned busk with songs offers to save them", async ({ page }) => {
    await page.goto("/busks");
    await expect(form(page).getByTestId("repertoire-empty")).toBeVisible();
    await expect(form(page).getByRole("link", { name: "Create your Repertoire" })).toHaveAttribute("href", "/repertoire");
    // Songs reach a busk without a Repertoire through a plan link; the form itself cannot add them any more.
    await page.goto("/plan?name=Jess%20on%20guitar&artists=Paul%20Kelly&songs=How%20to%20Make%20Gravy~Paul%20Kelly&date=2099-01-03&from=18&to=21");
    await waitForPlan(page);
    expect(await state(page)).toBeNull();
    const nudge = page.getByTestId("save-as-repertoire");
    await expect(nudge).toBeVisible();
    await nudge.getByRole("button", { name: "Save these songs as your Repertoire" }).click();
    await expect(nudge.getByRole("status")).toContainText("Saved to your Repertoire.");
    const saved = await state(page);
    expect(saved.songs.map((s: { title: string }) => s.title)).toEqual(["How to Make Gravy"]);
    expect(saved.actName).toBe("Jess on guitar");
    await page.goto("/busks");
    await expect(form(page).getByTestId("repertoire-summary")).toContainText("Your Repertoire · 1 song");
  });

  test("Add to Repertoire from Songs you should learn: a pending suggestion, and a second add is refused politely", async ({ page }) => {
    await seed(page);
    await page.goto("/busks");
    await form(page).getByRole("button", { name: "Plan my busk" }).click();
    await waitForPlan(page);
    const learn = (await openDetails(page)).getByRole("region", { name: "Songs you should learn" });
    const first = learn.getByRole("button", { name: /^Add to Repertoire: / }).first();
    await first.scrollIntoViewIfNeeded();
    const name = (await first.getAttribute("aria-label"))!;
    const before = await state(page);
    await first.click();
    await expect(learn.getByRole("status").filter({ hasText: "Added to Songs you should learn." })).toBeVisible();
    // It is a suggestion, not a song: the Repertoire itself did not change.
    const after = await state(page);
    expect(after.songs).toEqual(before.songs);
    expect(after.revision).toBe(before.revision);
    // Again (a fresh page, so a fresh button): refused, kindly, with no error.
    await page.goto(page.url().split("?")[0]);
    await waitForPlan(page);
    const again = (await openDetails(page)).getByRole("region", { name: "Songs you should learn" });
    await again.getByRole("button", { name }).click();
    await expect(again.getByRole("status").filter({ hasText: "Already on your list of songs to learn." })).toBeVisible();
    await expect(again.getByRole("alert")).toHaveCount(0);
  });

  test("an example never reads or writes the Repertoire", async ({ page }) => {
    await seed(page);
    const before = await state(page);
    await page.goto("/busks");
    // The form is the only place that reads it; the example card is a plain link.
    await page.getByRole("link", { name: /Acoustic/i }).first().click();
    await expect(page).toHaveURL(/\/plan\?example=|\/p\//);
    await waitForPlan(page);
    await expect(page.getByTestId("save-as-repertoire")).toHaveCount(0);
    // No Repertoire switch (the plan's only switch is the research's "Raw data").
    await expect(page.getByRole("switch", { name: /Repertoire/ })).toHaveCount(0);
    await expect((await openDetails(page)).getByRole("button", { name: /^Add to Repertoire/ })).toHaveCount(0);
    await page.keyboard.press("Escape");
    // A moment for any stray write to land, then compare.
    await page.waitForTimeout(500);
    expect(await state(page)).toEqual(before);
    expect((await state(page)).usualPitches).toEqual([]);
    expect(await state(page)).toEqual(before);
  });

  test("layout and axe at 390, 768 and 1440: the form with the Repertoire, the plan", async ({ page }, info) => {
    await seed(page);
    const check = async (label: string) => {
      const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
      expect(violations.map((v) => `${label} ${v.impact} ${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    };
    const shot = async (name: string, width: number) => {
      if (SHOTS && info.project.name === "desktop") await page.screenshot({ path: `${SHOTS}/r2-${name}-${width}.png`, fullPage: true });
    };
    const widths = [390, 768, 1440];
    await page.goto("/busks");
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      await check(`form-${width}`);
      await form(page).scrollIntoViewIfNeeded();
      await shot("busk-form", width);
    }
    await page.goto("/busks");
    await form(page).getByRole("button", { name: "Plan my busk" }).click();
    await waitForPlan(page);
    const learnHere = (await openDetails(page)).getByRole("region", { name: "Songs you should learn" });
    await learnHere.getByRole("button", { name: /^Add to Repertoire: / }).first().click();
    await expect(learnHere.getByRole("status").filter({ hasText: "Added to Songs you should learn." })).toBeVisible();
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      await check(`plan-${width}`);
      await shot("plan", width);
    }
    // No Repertoire: the plan shows the save nudge.
    const other = await page.context().browser()!.newContext({ baseURL: info.project.use.baseURL });
    const p2 = await other.newPage();
    await p2.goto("/plan?name=Nudge%20Duo&artists=Paul%20Kelly&songs=Gravy~Paul%20Kelly&date=2099-01-03&from=18&to=21");
    await waitForPlan(p2);
    await expect(p2.getByTestId("save-as-repertoire")).toBeVisible();
    for (const width of widths) {
      await p2.setViewportSize({ width, height: 900 });
      const { violations } = await new AxeBuilder({ page: p2 }).withTags(WCAG).analyze();
      expect(violations.map((v) => `nudge-${width} ${v.id}`)).toEqual([]);
      if (SHOTS && info.project.name === "desktop") await p2.screenshot({ path: `${SHOTS}/r2-plan-save-nudge-${width}.png`, fullPage: true });
    }
    await other.close();
  });

  test("R4 words: the plan says Suggested set and Songs you should learn, never Setlist or Learn these (3 widths, axe, screenshots)", async ({ page }, info) => {
    await page.goto("/plan?name=Words%20Duo&artists=Paul%20Kelly&songs=Gravy~Paul%20Kelly&date=2099-01-03&from=18&to=21");
    await waitForPlan(page);
    const sheet = await openDetails(page);
    const heading = sheet.getByRole("heading", { name: /^Suggested set for / });
    await expect(heading).toBeVisible();
    const card = sheet.getByRole("region", { name: "Suggested set" });
    const learn = sheet.getByRole("region", { name: "Songs you should learn" });
    await expect(learn.getByRole("heading", { name: "Songs you should learn" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Setlist|Learn these/ })).toHaveCount(0);
    await expect(page.getByText(/\bsetlist\b|learn these|playlist/i)).toHaveCount(0);
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await card.scrollIntoViewIfNeeded();
      const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
      expect(violations.map((v) => `${width} ${v.impact} ${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      if (SHOTS && info.project.name === "desktop") await card.screenshot({ path: `${SHOTS}/r4-suggested-set-${width}.png` });
    }
  });
});
