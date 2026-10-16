import { expect, test, type Page } from "@playwright/test";

/**
 * QA regression for B-027, B-028 and B-029 (dev/core f15688f..43343f6). Functional only (qa/test-plan.md §0): what the
 * learn run says and hides, not how it looks. Offline mock model; the faults switch makes Qloo look down.
 */
const SONGS = [["How to Make Gravy", "Paul Kelly"], ["Avant Gardener", "Courtney Barnett"], ["Riptide", "Vance Joy"], ["Scar", "Missy Higgins"]];
const RAW = /match_playlist|related_artists|crowd_at|top_tracks|finish_suggestions|\/v2\/|urn:|\{"|[0-9A-F]{8}-[0-9A-F]{4}-/;

const seed = (page: Page, songs = SONGS, soundsLike = [{ name: "Paul Kelly" }]) =>
  page.request.post("/api/playlist", { data: { actName: "QA learn", soundsLike, songs: songs.map(([title, artist]) => ({ title, artist, own: false })) } });
const panel = (page: Page) => page.locator("section").filter({ has: page.getByRole("heading", { name: /Songs you should learn/ }) }).last();
const run = async (page: Page, path = "/repertoire") => {
  await page.goto(path);
  await page.getByTestId("learn-run-button").click();
  await expect(page.getByTestId("learn-end").first()).toBeVisible({ timeout: 20_000 });
};

test.describe("QA learn feed (B-027..B-029)", () => {
  test("B-027: a finished run speaks plain words; the steps fold under “How we found these songs”, newest first; raw data only behind the switch", async ({ page }) => {
    await seed(page);
    await run(page);
    await expect(panel(page)).not.toContainText(RAW);
    const fold = page.getByTestId("learn-how-found");
    const trigger = fold.getByRole("button", { name: "How we found these songs" });
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(fold).not.toContainText(RAW);
    const steps = fold.getByTestId("agent-step");
    await expect(steps.first()).toContainText(/Ranked \d+ songs/);
    await expect(steps.last()).toContainText(/Matched your \d+ songs? to \d+ artists?/);
    // The funnel and the cards agree.
    const card = (await steps.last().innerText()).match(/to (\d+) artists?/)?.[1];
    await expect(fold.getByTestId("learn-totals")).toContainText(new RegExp(`${card}\\s*artists? matched`));
    const found = (await page.getByTestId("learn-end").first().innerText()).match(/found (\d+) songs?/)?.[1];
    await expect(fold.getByTestId("learn-totals")).toContainText(new RegExp(`${found}\\s*new songs?`));
    const raw = page.getByTestId("learn-raw-switch");
    await raw.focus();
    await page.keyboard.press("Space");
    await expect(raw).toHaveAttribute("aria-checked", "true");
    await expect(fold).toContainText("match_playlist");
  });

  test("B-027: no raw switch while a run is going", async ({ page }) => {
    await seed(page);
    await page.route("**/api/playlist/learn", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      const res = await route.fetch();
      const body = await res.text();
      await new Promise((r) => setTimeout(r, 2500));
      await route.fulfill({ status: res.status(), headers: res.headers(), body });
    });
    await page.goto("/repertoire");
    await page.getByTestId("learn-run-button").click();
    await expect(page.getByTestId("learn-running")).toBeVisible();
    await expect(page.getByTestId("learn-raw-switch")).toHaveCount(0);
    // Let the held response finish inside the test, so the route handler never outlives the page.
    await expect(page.getByTestId("learn-end").first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("learn-raw-switch")).toHaveCount(1);
  });

  test("B-028: Qloo down and no match say the songs are safe and the run didn't count; the allowance is untouched", async ({ page }) => {
    await seed(page);
    await run(page, "/repertoire?faults=qloo");
    await expect(panel(page)).toContainText("Your songs are safe. This run didn't count towards your limit.");
    const list = await (await page.request.get("/api/playlist/learn")).json();
    expect(list.limit.remaining).toBe(list.limit.max);
    await run(page);
    await expect(page.getByTestId("learn-end").first()).toContainText(/found \d+ songs/);
  });

  test("B-028: no match says the same", async ({ page }) => {
    await seed(page, [["Zz One", "Qqzx Nobody"], ["Zz Two", "Qqzx Nobody"], ["Zz Three", "Vvwq Noone"]], []);
    await run(page);
    await expect(panel(page)).toContainText("Qloo couldn't match your artists");
    await expect(panel(page)).toContainText("Your songs are safe. This run didn't count towards your limit.");
  });

  test("B-029: with no songs checked, nothing new says so instead of “suggested before”", async ({ page }) => {
    await seed(page);
    for (let i = 0; i < 12; i++) {
      const text = await (await page.request.post("/api/playlist/learn")).text();
      if (/"nothing_new"/.test(text)) break;
    }
    await run(page);
    const end = page.getByTestId("learn-end").first();
    await expect(end).toContainText("Couldn't find songs to check this time.");
    await expect(end).not.toContainText(/suggested before|already in your history/);
  });
});
