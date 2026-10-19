import { expect, test, type Page } from "@playwright/test";
import { OFFLINE_TEST_ARTIST } from "../../../src/lib/repertoire-research";

/**
 * QA regression for B-027, B-028 and B-029 (dev/core f15688f..43343f6), carried onto the Repertoire research that replaced the
 * separate learn run (the "Find songs to learn" button and its "How we found these songs" fold are gone: the research is always
 * shown, U21/U22, and "Find more songs to learn" reruns the last three steps). Functional only (qa/test-plan.md §0): what the
 * run says and hides, not how it looks. Offline mock model; the faults switch makes Qloo look down.
 */
const RAW = /match_playlist|related_artists|crowd_at|top_tracks|finish_suggestions|research_[a-z_]+|\/v2\/|urn:|\{"|[0-9A-F]{8}-[0-9A-F]{4}-/;
const LINK = `https://open.spotify.com/artist/${OFFLINE_TEST_ARTIST.spotifyId}`;

const end = (page: Page) => page.getByTestId("research-end");
const research = async (page: Page, path = "/repertoire") => {
  await page.goto(path);
  await page.getByLabel("Your Spotify artist link").fill(LINK);
  await page.getByRole("button", { name: "Research my act" }).click();
  await expect(end(page)).toBeVisible({ timeout: 20_000 });
};

test.describe("QA learn feed (B-027..B-029)", () => {
  test("B-027: a finished run speaks plain words; the steps are always shown, in run order; raw data only behind the switch", async ({ page }) => {
    await research(page);
    const steps = page.getByTestId("research-steps");
    await expect(steps).toBeVisible();
    // No fold: nothing to open before reading the research (U21/U22).
    await expect(steps.locator("[aria-expanded]")).toHaveCount(0);
    await expect(page.getByTestId("research-results")).not.toContainText(RAW);
    const cards = steps.getByTestId("agent-step");
    await expect(cards.first()).toContainText(/Reading your Spotify profile/i);
    await expect(cards.last()).toContainText(/ranked \d+ songs/i);
    // The funnel and the end line agree.
    const found = (await end(page).innerText()).match(/found (\d+) songs?/)?.[1];
    await expect(steps).toContainText(new RegExp(`${found}\\s*new songs?`, "i"));
    const raw = page.getByRole("switch", { name: "Raw data" });
    await expect(raw).toHaveAttribute("aria-checked", "false");
    await raw.focus();
    await page.keyboard.press("Space");
    await expect(raw).toHaveAttribute("aria-checked", "true");
    await expect(steps).toContainText("research_fans_love");
  });

  test("B-027: no raw switch while a run is going", async ({ page }) => {
    // `research-slow` holds each step 600 ms (offline test mode), so the running state can be looked at.
    await page.goto("/repertoire?faults=research-slow");
    await page.getByLabel("Your Spotify artist link").fill(LINK);
    await page.getByRole("button", { name: "Research my act" }).click();
    await expect(page.getByTestId("research-page")).toHaveAttribute("data-phase", "running");
    await expect(page.getByRole("switch", { name: "Raw data" })).toHaveCount(0);
    await expect(end(page)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("switch", { name: "Raw data" })).toHaveCount(1);
  });

  test("B-028: Qloo down says the songs are safe and the run didn't count; the allowance is untouched", async ({ page }) => {
    await research(page, "/repertoire?faults=qloo");
    await expect(end(page)).toHaveAttribute("data-code", "qloo_unavailable");
    await expect(end(page)).toContainText("Your songs are safe.");
    const list = await (await page.request.get("/api/playlist/learn")).json();
    expect(list.limit.remaining).toBe(list.limit.max);
    // Back up: the saved profile and songs are kept, and refreshing the research on a healthy Qloo finds songs.
    await page.goto("/repertoire");
    await page.getByRole("button", { name: "Refresh my research" }).click();
    await expect(end(page)).not.toHaveAttribute("data-code", "qloo_unavailable", { timeout: 20_000 });
    await expect(end(page)).toContainText(/found \d+ songs/);
  });

  test("B-029: when no songs can be checked, the run says so instead of “suggested before”", async ({ page }) => {
    test.setTimeout(90_000);
    await research(page);
    // Find more reruns the last three steps; the mock runs out of new songs after a few rounds.
    const more = page.getByTestId("research-more");
    for (let i = 0; i < 12 && !/Couldn't find songs to check this time\./.test(await end(page).innerText()); i++) {
      await Promise.all([page.waitForResponse((r) => r.url().endsWith("/api/playlist/research") && r.request().method() === "POST"), more.click()]);
      // Disabled while the run goes; enabled again once its end line is in.
      await expect(more).toBeEnabled({ timeout: 20_000 });
      await expect(end(page)).toBeVisible();
    }
    await expect(end(page)).toContainText("Couldn't find songs to check this time.");
    await expect(end(page)).not.toContainText(/suggested before|already in your history/);
  });
});
