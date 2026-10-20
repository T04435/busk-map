import AxeBuilder from "@axe-core/playwright";
import { OFFLINE_TEST_ACTS, OFFLINE_TEST_ARTIST } from "../../src/lib/repertoire-research";
import { expect, LOCAL, test } from "./fixtures";

/**
 * /repertoire as Repertoire research (docs/repertoire-research.md), on the offline mocks: one link field, a streamed run with
 * the research on top, then the results on top and the research folded below. Replaces the old form-page specs
 * (act-profile, learn-run, the /repertoire half of profile-header).
 */
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"];
const WIDTHS = [390, 768, 1440];
const SHOTS = process.env.REPERTOIRE_SHOTS;
const LINK = `https://open.spotify.com/artist/${OFFLINE_TEST_ARTIST.spotifyId}`;
type Page = import("@playwright/test").Page;

const field = (page: Page) => page.getByLabel("Your Spotify artist link");
const linkOf = (spotifyId: string) => `https://open.spotify.com/artist/${spotifyId}`;
/** `faults=research-slow` holds each step 600 ms (offline test mode), so the running state can be looked at before the run is over. */
async function research(page: Page, link = LINK, faults?: string) {
  await page.goto(faults ? `/repertoire?faults=${faults}` : "/repertoire");
  await field(page).fill(link);
  await page.getByRole("button", { name: "Research my act" }).click();
}
const done = (page: Page) => expect(page.getByTestId("research-end")).toBeVisible({ timeout: 20_000 });

test.describe("Repertoire research (offline)", () => {
  test.skip(!LOCAL, "Writes to the local offline server's memory store and uses the mock artist");

  test("empty state: one field and its example, nothing else; browsing sets no cookie", async ({ page }) => {
    await page.goto("/repertoire");
    await expect(page.getByRole("heading", { level: 1, name: "Your Repertoire" })).toBeVisible();
    await expect(field(page)).toBeVisible();
    await expect(page.getByText("It looks like open.spotify.com/artist/…")).toBeVisible();
    await expect(page.getByText(/We read your Spotify profile and your songs/)).toHaveCount(0);
    await expect(page.getByTestId("research-results")).toHaveCount(0);
    await expect(page.getByRole("combobox", { name: "Search songs on Spotify" })).toHaveCount(0);
    expect((await page.context().cookies()).some((c) => c.name === "buskmap_playlist")).toBe(false);
    // Offline only: the test artist fills the field.
    await page.getByTestId("research-test-artist").click();
    await expect(field(page)).toHaveValue(LINK);
  });

  test("a bad link is refused in plain words, before anything runs", async ({ page }) => {
    await research(page, "https://example.com/not-spotify");
    await expect(page.getByTestId("research-notice")).toContainText("isn't a Spotify artist link");
  });

  test("the run streams with the research on top, then the results land in order and the research folds below", async ({ page }) => {
    await research(page, LINK, "research-slow");
    const stream = page.getByTestId("agent-stream").first();
    await expect(stream).toBeVisible();
    // Still running: the heading is the live one, and the run has not ended.
    await expect(page.getByTestId("research-page")).toHaveAttribute("data-phase", "running");
    await expect(stream.getByRole("heading", { name: "Researching your act" })).toBeVisible();
    await expect(page.getByTestId("research-end")).toHaveCount(0);
    await done(page);
    // Done: the live heading gives way to the folded research.
    await expect(page.getByTestId("research-page")).not.toHaveAttribute("data-phase", "running");
    // Results (U37 to U43): the act row (profile, act name | audience), the fans row (who your fans are | sound-alikes, also love), the map,
    // the songs row (can sing | to learn), the summary, then the research; the DOM order is the same on a phone.
    const ids = (slot: string) => page.locator(`[data-slot="${slot}"] [data-testid^="research-"]`).evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")));
    expect(await ids("repertoire-act")).toEqual(expect.arrayContaining(["research-profile", "research-act-name"]));
    expect(await ids("repertoire-fans")).toEqual(["research-fans", "research-sounds-like", "research-fans-love"]);
    expect(await ids("repertoire-map")).toEqual(["research-fans-map"]);
    // "Find more songs to learn" belongs to the to-learn section, so it comes before the learned list.
    expect((await ids("repertoire-songs")).slice(0, 4)).toEqual(["research-can-sing", "research-to-learn", "research-more", "research-learned"]);
    // No paragraph about the act and no "plan a busk" under the map: the map stands alone.
    await expect(page.getByTestId("research-summary")).toHaveCount(0);
    await expect(page.getByText("Your act, in a paragraph")).toHaveCount(0);
    await expect(page.getByTestId("research-fans-map").getByText(/Your crowd is strongest in|not head counts/)).toHaveCount(0);
    await expect(page.getByTestId("research-fans-map").getByRole("link", { name: "Plan a busk" })).toHaveCount(0);
    expect(await ids("repertoire-research")).toContain("research-steps");
    const order = await page.locator('[data-slot="repertoire-results"] > [data-slot]').evaluateAll((els) => els.map((e) => e.getAttribute("data-slot")));
    expect(order).toEqual(["repertoire-act", "repertoire-fans", "repertoire-map", "repertoire-songs", "repertoire-research"]);
    await expect(page.getByTestId("profile-name")).toHaveText(OFFLINE_TEST_ARTIST.name);
    // Qloo's audience words sit in their own slot of the act row (U38), no longer in the profile header.
    await expect(page.locator('[data-slot="repertoire-act"]')).toContainText("Dreamy");
    await expect(page.getByLabel("Act name")).toHaveValue(OFFLINE_TEST_ARTIST.name);
    const canSing = page.getByRole("list", { name: "Songs you can sing" });
    await expect(canSing.getByRole("listitem")).toHaveCount(4);
    await expect(page.getByTestId("research-fans").getByRole("img").first()).toBeVisible();
    await expect(page.getByRole("list", { name: "Songs you should learn" }).getByTestId("learn-card").first()).toContainText("Mock reason: fans of");
    await expect(page.getByTestId("research-steps")).toContainText("The test model ranked");
    // The research sits below the results and is always shown (U21/U22): a heading, no toggle, no chevron, the ten steps in one surface.
    const folded = page.getByTestId("research-steps");
    await expect(folded).toBeVisible();
    await expect(folded.getByRole("heading", { name: "How we built your Repertoire" })).toBeVisible();
    await expect(folded.locator("[aria-expanded]")).toHaveCount(0);
    await expect(folded.getByRole("button", { name: /How we built your Repertoire/ })).toHaveCount(0);
    await expect(folded.getByTestId("agent-step")).toHaveCount(10);
    await expect(folded.getByTestId("agent-disclosure")).toHaveCount(0);
    // No card inside the panel: a step has no border of its own.
    const border = await folded.getByTestId("agent-step").first().evaluate((el) => getComputedStyle(el).borderTopWidth);
    expect(border).toBe("0px");
  });

  test("a reload shows the saved research without a new run; Find more reruns three steps and never repeats a song", async ({ page }) => {
    await research(page);
    await done(page);
    const before = await page.getByTestId("learn-card").allTextContents();
    let posts = 0;
    page.on("request", (r) => r.url().endsWith("/api/playlist/research") && r.method() === "POST" && posts++);
    await page.reload();
    await expect(page.getByTestId("profile-name")).toHaveText(OFFLINE_TEST_ARTIST.name);
    expect(posts).toBe(0);
    await page.getByTestId("research-more").click();
    await done(page);
    expect(posts).toBe(1);
    const titles = (await page.getByTestId("learn-card").evaluateAll((els) => els.map((e) => `${e.getAttribute("data-artist")}|${e.getAttribute("data-song")}`)));
    expect(new Set(titles).size).toBe(titles.length);
    expect(titles.length).toBeGreaterThan(before.length);
  });

  test("Refresh my research reruns everything, and your songs are not added twice", async ({ page }) => {
    await research(page);
    await done(page);
    await page.getByRole("button", { name: "Refresh my research" }).click();
    await done(page);
    await expect(page.getByRole("list", { name: "Songs you can sing" }).getByRole("listitem")).toHaveCount(4);
  });

  test("your songs are removable, the act name and sound-alikes are editable and saved", async ({ page }) => {
    await research(page);
    await done(page);
    await page.getByRole("button", { name: "Remove Synthetic original 1" }).click();
    await expect(page.getByRole("list", { name: "Songs you can sing" }).getByRole("listitem")).toHaveCount(3);
    await page.getByLabel("Act name").fill("Jess on guitar");
    await page.getByRole("button", { name: "Save act name" }).click();
    await page.reload();
    await expect(page.getByLabel("Act name")).toHaveValue("Jess on guitar");
    const body = (await (await page.request.get("/api/playlist")).json()).playlist;
    expect(body.soundsLike.length).toBe(6);
  });

  test("Qloo down: the profile and songs are kept, the rest is skipped, and the run didn't count (faults=qloo)", async ({ page }) => {
    await page.goto("/repertoire?faults=qloo");
    await field(page).fill(LINK);
    await page.getByRole("button", { name: "Research my act" }).click();
    await expect(page.getByTestId("research-end")).toHaveAttribute("data-code", "qloo_unavailable", { timeout: 20_000 });
    await expect(page.getByTestId("research-end")).toContainText("Your songs are safe.");
    const list = await (await page.request.get("/api/playlist/learn")).json();
    expect(list.limit.remaining).toBe(list.limit.max);
  });

  test("Qloo can't tell which artist is you: it asks (candidates), the answer is saved, and it isn't asked again", async ({ page }) => {
    test.setTimeout(90_000);
    await research(page, linkOf(OFFLINE_TEST_ACTS.candidates.spotifyId));
    const prompt = page.getByTestId("research-candidates");
    await expect(prompt).toBeVisible({ timeout: 20_000 });
    await expect(prompt.getByRole("heading", { name: "Is one of these you?" })).toBeVisible();
    await expect(prompt).toContainText("Pick yours, or say none of these");
    await expect(prompt.getByTestId("research-candidate")).toHaveCount(2);
    await expect(prompt.getByText("Mara Ellison")).toBeVisible();
    await expect(prompt.getByText("Maria Ellis")).toBeVisible();
    await expect(prompt.getByRole("button", { name: "None of these" })).toBeVisible();
    // Paused, not failed: no error box, your songs are in, nothing after "Finding you on Qloo" ran.
    await expect(page.getByTestId("research-end")).toHaveCount(0);
    await expect(page.getByRole("list", { name: "Songs you can sing" }).getByRole("listitem").first()).toBeVisible();
    await expect(page.getByTestId("research-to-learn")).toHaveCount(0);
    // The prompt is accessible at the three widths.
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
      expect(violations.map((v) => `candidates-${width} ${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
    }
    // A reload still shows the question (it is saved with the research).
    await page.reload();
    await expect(page.getByTestId("research-candidates")).toBeVisible();
    await page.getByRole("button", { name: "This is me: Mara Ellison" }).click();
    await done(page);
    await expect(page.getByTestId("research-candidates")).toHaveCount(0);
    expect((await (await page.request.get("/api/playlist")).json()).playlist.qlooArtistId).toMatch(/^4D4F434B-/);
    // Refreshing asks nothing: the chosen artist is remembered.
    await page.getByRole("button", { name: "Refresh my research" }).click();
    await done(page);
    await expect(page.getByTestId("research-candidates")).toHaveCount(0);
  });

  test("'None of these' goes on from the artists like you, in one line, and isn't asked again", async ({ page }) => {
    test.setTimeout(90_000);
    await research(page, linkOf(OFFLINE_TEST_ACTS.candidates.spotifyId));
    await expect(page.getByTestId("research-candidates")).toBeVisible({ timeout: 20_000 });
    // Sound-alikes already set (what a performer with a list has).
    const saved = (await (await page.request.get("/api/playlist")).json()).playlist;
    const patched = await page.request.patch("/api/playlist", { data: { revision: saved.revision, soundsLike: [{ name: "Paul Kelly" }, { name: "Courtney Barnett" }] } });
    expect(patched.ok()).toBe(true);
    await page.reload();
    await page.getByRole("button", { name: "None of these" }).click();
    await done(page);
    const label = "Qloo doesn't know you yet, so this is based on artists like you: Paul Kelly and Courtney Barnett.";
    // The Finding-you step says so in one line, and the later steps are "based on".
    const folded = page.getByTestId("research-steps");
    await expect(folded.getByTestId("agent-step")).toHaveCount(10);
    await expect(folded).toContainText(label);
    await expect(folded).toContainText("Based on the artists you sound like");
    await expect(page.getByTestId("research-candidates")).toHaveCount(0);
    await expect(page.getByTestId("research-fans-love")).toBeVisible();
    await expect(page.getByRole("list", { name: "Songs you should learn" }).getByTestId("learn-card").first()).toBeVisible();
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
      expect(violations.map((v) => `fallback-${width} ${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
    }
    // "Find more songs to learn" works from the fallback, and a refresh doesn't ask again.
    await page.getByRole("button", { name: "Refresh my research" }).click();
    await done(page);
    await expect(page.getByTestId("research-candidates")).toHaveCount(0);
    await expect(page.getByTestId("research-steps")).toContainText(label);
    await page.getByTestId("research-more").click();
    await done(page);
  });

  test("Qloo doesn't know you and no sound-alikes are set: the Hive finds them and the run completes", async ({ page }) => {
    test.setTimeout(90_000);
    await research(page, linkOf(OFFLINE_TEST_ACTS.unknown.spotifyId));
    await done(page);
    await expect(page.getByTestId("research-end")).not.toHaveAttribute("data-code", /^needs_/);
    await expect(page.getByTestId("research-pick-sounds-like")).toHaveCount(0);
    await expect(page.getByTestId("research-candidates")).toHaveCount(0);
    const folded = page.getByTestId("research-steps");
    await expect(folded.getByTestId("agent-step")).toHaveCount(10);
    await expect(folded).toContainText("Qloo doesn't know you yet, so this is based on artists like you: Paul Kelly, Courtney Barnett and Missy Higgins.");
    await expect(page.getByTestId("research-sounds-like")).toContainText("Courtney Barnett");
    await expect(page.getByTestId("research-fans-love")).toBeVisible();
    await expect(page.getByRole("list", { name: "Songs you should learn" }).getByTestId("learn-card").first()).toBeVisible();
    const body = (await (await page.request.get("/api/playlist")).json()).playlist;
    expect(body.soundsLike.map((a: { name: string; foundBy?: string }) => `${a.name}:${a.foundBy}`)).toEqual(["Paul Kelly:hive", "Courtney Barnett:hive", "Missy Higgins:hive"]);
    expect(body.qlooArtistId).toBeNull();
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
      expect(violations.map((v) => `found-${width} ${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
    }
  });

  test("nothing found anywhere: the run completes and an optional genre pick gives it a signal", async ({ page }) => {
    test.setTimeout(90_000);
    await research(page, linkOf(OFFLINE_TEST_ACTS.nothing.spotifyId));
    await done(page);
    await expect(page.getByTestId("research-end")).not.toHaveAttribute("data-code", /^needs_/);
    await expect(page.getByTestId("research-steps")).toContainText("has no taste data for you");
    const pick = page.getByTestId("research-genre-pick");
    await expect(pick).toBeVisible();
    await pick.getByRole("button", { name: "Folk" }).click();
    await done(page);
    await expect(page.getByTestId("research-steps")).toContainText("based on your genres: Folk");
    await expect(page.getByTestId("research-genre-pick")).toHaveCount(0);
  });

  test("a name variant is found without asking (accents and 'feat.' stripped)", async ({ page }) => {
    await research(page, linkOf(OFFLINE_TEST_ACTS.variant.spotifyId));
    await done(page);
    await expect(page.getByTestId("research-candidates")).toHaveCount(0);
    await expect(page.getByTestId("research-steps")).toContainText(/Found\s*\S*Zelia Marquez on/);
  });

  test("Spotify down: says so in plain words and saves no research (faults=repertoire)", async ({ page }) => {
    await page.goto("/repertoire?faults=repertoire");
    await field(page).fill(LINK);
    await page.getByRole("button", { name: "Research my act" }).click();
    await expect(page.getByTestId("research-end")).toHaveAttribute("data-code", "spotify_unavailable", { timeout: 20_000 });
    await expect(page.getByTestId("research-end")).toContainText("Spotify isn't answering");
  });

  test("the limit: a refused run says so and starts nothing (faults=learn-limit)", async ({ page }) => {
    await page.goto("/repertoire?faults=learn-limit");
    await field(page).fill(LINK);
    await page.getByRole("button", { name: "Research my act" }).click();
    await expect(page.getByTestId("research-notice")).toContainText("runs this hour");
  });

  test("the three states at 390, 768 and 1440: axe, no sideways scroll, screenshots", async ({ page }, info) => {
    test.setTimeout(120_000);
    const check = async (name: string) => {
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 900 });
        const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
        expect(violations.map((v) => `${name}-${width} ${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${name}-${width} scrolls sideways`).toBe(true);
        if (SHOTS && info.project.name === "desktop") await page.screenshot({ path: `${SHOTS}/research-${name}-${width}.png`, fullPage: true });
      }
    };
    await page.goto("/repertoire");
    await check("empty");
    await page.route("**/api/playlist/research", async (route) => {
      await new Promise((r) => setTimeout(r, 3000));
      return route.continue();
    });
    await field(page).fill(LINK);
    await page.getByRole("button", { name: "Research my act" }).click();
    await expect(page.getByTestId("research-page")).toHaveAttribute("data-phase", "running");
    await check("running");
    await done(page);
    await check("done");
  });
});
