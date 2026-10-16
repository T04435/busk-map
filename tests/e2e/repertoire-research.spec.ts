import AxeBuilder from "@axe-core/playwright";
import { OFFLINE_TEST_ARTIST } from "../../src/lib/repertoire-research";
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
async function research(page: Page, link = LINK) {
  await page.goto("/repertoire");
  await field(page).fill(link);
  await page.getByRole("button", { name: "Research my act" }).click();
}
const done = (page: Page) => expect(page.getByTestId("research-end")).toBeVisible({ timeout: 20_000 });

test.describe("Repertoire research (offline)", () => {
  test.skip(!LOCAL, "Writes to the local offline server's memory store and uses the mock artist");

  test("empty state: one field, one line on what happens, nothing else; browsing sets no cookie", async ({ page }) => {
    await page.goto("/repertoire");
    await expect(page.getByRole("heading", { level: 1, name: "Your Repertoire" })).toBeVisible();
    await expect(field(page)).toBeVisible();
    await expect(page.getByText(/We read your Spotify profile and your songs/)).toBeVisible();
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
    await page.route("**/api/playlist/research", async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      return route.continue();
    });
    await research(page);
    const stream = page.getByTestId("agent-stream").first();
    await expect(stream).toBeVisible();
    await expect(stream.getByRole("heading", { name: "Researching your act" })).toBeVisible();
    await done(page);
    // Results, in order: profile, songs you can sing, sound-alikes, fans, fans also love, songs to learn, summary.
    const order = await page.getByTestId("research-results").locator(":scope > [data-testid]").evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")));
    expect(order).toEqual(["research-profile", "research-can-sing", "research-sounds-like", "research-fans", "research-fans-love", "research-to-learn", "research-summary"]);
    await expect(page.getByTestId("profile-name")).toHaveText(OFFLINE_TEST_ARTIST.name);
    await expect(page.getByTestId("profile-audience")).toContainText("Dreamy");
    await expect(page.getByLabel("Act name")).toHaveValue(OFFLINE_TEST_ARTIST.name);
    const canSing = page.getByRole("list", { name: "Songs you can sing" });
    await expect(canSing.getByRole("listitem")).toHaveCount(4);
    await expect(canSing).toContainText("Your song");
    await expect(page.getByTestId("research-fans").getByRole("img").first()).toBeVisible();
    await expect(page.getByRole("list", { name: "Songs you should learn" }).getByTestId("learn-card").first()).toContainText("Mock reason: fans of");
    await expect(page.getByTestId("research-summary")).toContainText("Mock summary (offline test mode)");
    // The research is folded below the results.
    const folded = page.getByTestId("research-folded");
    await expect(folded).toBeVisible();
    await expect(folded.getByRole("button", { name: /How we built your Repertoire/ })).toHaveAttribute("aria-expanded", "false");
    await folded.getByRole("button", { name: /How we built your Repertoire/ }).click();
    await expect(folded.getByTestId("agent-step")).toHaveCount(9);
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
