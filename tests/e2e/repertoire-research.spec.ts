import AxeBuilder from "@axe-core/playwright";
import { OFFLINE_PICKED_ARTISTS, OFFLINE_SPOTIFY_ONLY_ARTISTS, OFFLINE_TEST_ACTS, OFFLINE_TEST_ARTIST } from "../../src/lib/repertoire-research";
import { expect, LOCAL, test } from "./fixtures";
import { WIDTHS } from "./layout-helpers";

/**
 * /repertoire as Repertoire research (docs/repertoire-research.md), on the offline mocks: one link field, a streamed run with
 * the research on top, then the results on top and the research folded below. Replaces the old form-page specs
 * (act-profile, learn-run, the /repertoire half of profile-header).
 */
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"];
const SHOTS = process.env.REPERTOIRE_SHOTS;
const LINK = `https://open.spotify.com/artist/${OFFLINE_TEST_ARTIST.spotifyId}`;
type Page = import("@playwright/test").Page;

const field = (page: Page) => page.getByLabel("Your Spotify artist", { exact: true });
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

  test("empty state: one field, nothing else; browsing sets no cookie", async ({ page }) => {
    await page.goto("/repertoire");
    await expect(page.getByRole("heading", { level: 1, name: "Your Repertoire" })).toBeVisible();
    await expect(field(page)).toBeVisible();
    await expect(field(page)).toHaveAttribute("placeholder", "Search Spotify or paste your artist link");
    await expect(page.getByText(/We read your Spotify profile and your songs/)).toHaveCount(0);
    await expect(page.getByTestId("research-results")).toHaveCount(0);
    await expect(page.getByRole("combobox", { name: "Search songs on Spotify" })).toHaveCount(0);
    expect((await page.context().cookies()).some((c) => c.name === "buskmap_playlist")).toBe(false);
    // Offline only: the test artist fills the field.
    await page.getByTestId("research-test-artist").click();
    await expect(field(page)).toHaveValue(LINK);
  });

  test("the field looks the act up on Spotify: type the name, pick it, research it (axe clean, open and picked)", async ({ page }) => {
    await page.goto("/repertoire");
    await field(page).fill(OFFLINE_TEST_ARTIST.name.slice(0, 5));
    const option = page.getByRole("option", { name: new RegExp(OFFLINE_TEST_ARTIST.name) }).first();
    await expect(option).toBeVisible();
    await expect(field(page)).toHaveAttribute("aria-expanded", "true");
    // No "add as typed" row: the act must be a Spotify artist.
    await expect(page.getByText("Not on Spotify?")).toHaveCount(0);
    expect((await new AxeBuilder({ page }).withTags(WCAG).analyze()).violations).toEqual([]);
    await option.click();
    // One pick: the box gives way to the artist's chip, focus on its Remove.
    const chip = page.getByRole("list", { name: "Your Spotify artist" });
    await expect(chip.getByRole("link", { name: OFFLINE_TEST_ARTIST.name })).toHaveAttribute("href", LINK);
    await expect(page.getByRole("button", { name: `Remove ${OFFLINE_TEST_ARTIST.name}` })).toBeFocused();
    await expect(page.getByRole("combobox", { name: "Your Spotify artist" })).toHaveCount(0);
    expect((await new AxeBuilder({ page }).withTags(WCAG).analyze()).violations).toEqual([]);
    // Remove brings the box back, focused, for another try.
    await page.getByRole("button", { name: `Remove ${OFFLINE_TEST_ARTIST.name}` }).click();
    await expect(field(page)).toBeFocused();
    await field(page).fill(OFFLINE_TEST_ARTIST.name);
    await page.getByRole("option", { name: new RegExp(OFFLINE_TEST_ARTIST.name) }).first().click();
    await page.getByRole("button", { name: "Research my act" }).click();
    await done(page);
    await expect(page.getByTestId("profile-name")).toHaveText(OFFLINE_TEST_ARTIST.name);
  });

  test("a pasted link still runs, with Enter, and is never searched for", async ({ page }) => {
    await page.goto("/repertoire");
    await field(page).fill(LINK);
    await expect(page.getByRole("option")).toHaveCount(0);
    await expect(field(page)).toHaveAttribute("aria-expanded", "false");
    await field(page).press("Enter");
    await done(page);
    await expect(page.getByTestId("profile-name")).toHaveText(OFFLINE_TEST_ARTIST.name);
  });

  test("a name typed but not picked asks for a pick", async ({ page }) => {
    await page.goto("/repertoire");
    await field(page).fill("Nobody in particular");
    await page.getByRole("button", { name: "Research my act" }).click();
    await expect(page.getByTestId("research-notice")).toContainText("Pick your act from the Spotify results");
  });

  test("a bad link is refused in plain words, before anything runs", async ({ page }) => {
    await research(page, "https://example.com/not-spotify");
    await expect(page.getByTestId("research-notice")).toContainText("isn't a Spotify artist link");
  });

  test("a run cut off mid-step (the stream ends with no end) shows as stopped: the step cut, the Stopped tag and Try again", async ({ page }) => {
    // `faults=research-cut`: the server drops the run right after step 2 ("Your songs") starts, as a stopped function would.
    await research(page, LINK, "research-cut");
    const stream = page.getByTestId("agent-stream").first();
    await expect(stream.getByTestId("agent-tag")).toHaveText("Stopped", { timeout: 20_000 });
    await expect(page.getByTestId("research-page")).not.toHaveAttribute("data-phase", "running");
    await expect(stream.getByText("Stopped before it finished.")).toHaveCount(1);
    await expect(stream.getByText("The research stopped before finishing")).toBeVisible();
    await expect(stream.getByRole("button", { name: "Try again" })).toBeVisible();
    // Never "still going": no live heading, no running spinner left behind.
    await expect(stream.getByRole("heading", { name: "Researching your act" })).toHaveCount(0);
  });

  test("song lists keep their rows' hidden labels inside the scroller, so the page ends at the footer", async ({ page }) => {
    await research(page, LINK);
    await done(page);
    // With 300 songs, a row's absolute child placed against an element outside the scroller hangs far below the footer.
    const escaped = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('[data-slot="scroll-area-viewport"]')].flatMap((v) =>
        [...v.querySelectorAll<HTMLElement>(".sr-only")].filter((e) => e.offsetParent && !v.contains(e.offsetParent) && e.offsetParent !== v).map((e) => e.textContent)
      )
    );
    expect(escaped).toEqual([]);
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
    await expect(page.getByTestId("research-fans-map").getByRole("link", { name: "Plan a busk", exact: true })).toHaveCount(0);
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
  });

  test("no taste signal anywhere (the Victoria Queen case): the run waits at Who you sound like and asks in the step", async ({ page }) => {
    test.setTimeout(120_000);
    await research(page, linkOf(OFFLINE_TEST_ACTS.silent.spotifyId));
    const stream = page.getByTestId("agent-stream");
    const ask = stream.getByTestId("research-ask");
    await expect(ask).toBeVisible({ timeout: 20_000 });
    await expect(ask.getByTestId("research-ask-line")).toHaveText("Qloo doesn't know you yet. Add 2 or 3 artists you sound like, or pick a genre.");
    // Profile, songs and Qloo above; the waiting step; the rest not started (never shown as empty Qloo steps).
    await expect(stream.getByTestId("agent-step")).toHaveCount(4);
    await expect(stream.locator('[data-testid="agent-step"][data-status="waiting"]')).toHaveAttribute("data-tool", "research_sounds_like");
    await expect(stream.getByTestId("agent-step-upcoming")).toHaveCount(6);
    await expect(stream).not.toContainText("No taste data yet");
    await expect(stream).not.toContainText("Qloo found no artists like you");
    await expect(stream.getByTestId("agent-tag")).toHaveText("Waiting");
    await expect(page.getByTestId("research-end")).toHaveCount(0);
    // No raw view: no call tables, no description lines.
    await expect(stream.getByTestId("agent-step-calls")).toHaveCount(0);
    await expect(stream).not.toContainText("Qloo /entities by Spotify id");
    // A refresh (or a later visit) shows the waiting step with its input.
    const runId = (await (await page.request.get("/api/playlist")).json()).playlist.research.runId;
    await page.reload();
    await expect(page.getByTestId("research-ask")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("agent-step-upcoming")).toHaveCount(6);
    // The answer carries on the same run, from the waiting step.
    await page.getByTestId("research-ask").getByPlaceholder("Search Spotify, e.g. Paul Kelly").fill("Paul Kelly, Courtney Barnett");
    await page.getByTestId("research-ask-carry-on").click();
    await done(page);
    await expect(page.getByTestId("research-end")).not.toHaveAttribute("data-code", /^needs_/);
    const folded = page.getByTestId("research-steps");
    await expect(folded.getByTestId("agent-step")).toHaveCount(10);
    await expect(folded.getByTestId("agent-step-upcoming")).toHaveCount(0);
    const body = (await (await page.request.get("/api/playlist")).json()).playlist;
    expect(body.research.runId).toBe(runId);
    expect(body.research.waiting ?? null).toBeNull();
    expect(body.soundsLike.map((a: { name: string; foundBy?: string }) => `${a.name}:${a.foundBy ?? "you"}`)).toEqual(["Paul Kelly:you", "Courtney Barnett:you"]);
    await expect(page.getByTestId("research-fans-love")).toBeVisible();
  });

  test("the pause is a selection: artists and a genre combine, nothing is sent until Carry on, the step says what is used, and the page stays on the research", async ({ page }) => {
    test.setTimeout(120_000);
    const inputs: string[] = [];
    page.on("request", (r) => {
      if (r.method() === "POST" && /\/research\/[^/]+\/input$/.test(r.url())) inputs.push(r.postData() ?? "");
    });
    await page.setViewportSize({ width: 390, height: 700 });
    await research(page, linkOf(OFFLINE_TEST_ACTS.silent.spotifyId));
    const ask = page.getByTestId("research-ask");
    await expect(ask).toBeVisible({ timeout: 20_000 });
    // Paused is not done: the research stays on top as researching, with the waiting step in view, and no completed layout.
    await expect(page.getByTestId("research-page")).toHaveAttribute("data-phase", "running");
    await expect(page.getByTestId("research-actions")).toHaveCount(0);
    await expect(page.getByTestId("research-end")).toHaveCount(0);
    await expect(ask).toBeInViewport({ timeout: 10_000 });
    const atEnd = await page.evaluate(() => Math.ceil(window.scrollY + window.innerHeight) >= document.scrollingElement!.scrollHeight - 2);
    expect(atEnd, "the page jumped to the very bottom").toBe(false);
    const picker = ask.getByPlaceholder("Search Spotify, e.g. Paul Kelly");
    const carryOn = page.getByTestId("research-ask-carry-on");
    const genres = page.getByTestId("research-genre-pick");
    await expect(carryOn).toBeDisabled();
    // A genre alone enables Carry on, toggles, and sends nothing.
    await genres.getByRole("button", { name: "Pop" }).click();
    await expect(genres.getByRole("button", { name: "Pop" })).toHaveAttribute("aria-pressed", "true");
    await expect(carryOn).toBeEnabled();
    await genres.getByRole("button", { name: "Pop" }).click();
    await expect(genres.getByRole("button", { name: "Pop" })).toHaveAttribute("aria-pressed", "false");
    await expect(carryOn).toBeDisabled();
    // Up to three genres; the artists stay when a genre is picked; a fourth is blocked until one is unpressed.
    await picker.fill("Paul Kelly, Courtney Barnett");
    for (const name of ["Folk", "Pop", "Jazz"]) await genres.getByRole("button", { name }).click();
    for (const name of ["Folk", "Pop", "Jazz"]) await expect(genres.getByRole("button", { name })).toHaveAttribute("aria-pressed", "true");
    await expect(genres.getByRole("button", { name: "Rock" })).toBeDisabled();
    await expect(genres.getByRole("button", { name: "Jazz" })).toBeEnabled();
    await genres.getByRole("button", { name: "Jazz" }).click();
    await expect(genres.getByRole("button", { name: "Rock" })).toBeEnabled();
    await genres.getByRole("button", { name: "Folk" }).click();
    await expect(genres.getByRole("button", { name: "Folk" })).toHaveAttribute("aria-pressed", "false");
    await expect(genres.getByRole("button", { name: "Pop" })).toHaveAttribute("aria-pressed", "true");
    await expect(ask).toContainText("Paul Kelly");
    await page.waitForTimeout(500);
    expect(inputs, "nothing is sent before Carry on").toEqual([]);
    await carryOn.click();
    await done(page);
    expect(inputs).toHaveLength(1);
    expect(JSON.parse(inputs[0])).toEqual({ artists: [{ name: "Paul Kelly" }, { name: "Courtney Barnett" }], genres: ["Pop"] });
    const qloo = page.getByTestId("research-steps").locator('[data-testid="agent-step"][data-tool="research_qloo"]');
    await expect(qloo).toContainText("Qloo doesn't know you yet. Using your artists: Paul Kelly and Courtney Barnett; your genre: Pop.");
    await expect(qloo).not.toContainText("has no taste data for you");
    // Saved: a refresh shows the same line.
    await page.reload();
    await expect(page.getByTestId("research-steps").locator('[data-testid="agent-step"][data-tool="research_qloo"]')).toContainText("Using your artists: Paul Kelly and Courtney Barnett; your genre: Pop.");
  });

  test("artists picked from Spotify and two genres: the step names both artists and both genres, and the sound-alikes show photos", async ({ page }) => {
    test.setTimeout(120_000);
    const inputs: string[] = [];
    page.on("request", (r) => {
      if (r.method() === "POST" && /\/research\/[^/]+\/input$/.test(r.url())) inputs.push(r.postData() ?? "");
    });
    // The offline photos are https URLs nothing serves: answer them with a small picture.
    const picture = '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#888"/></svg>';
    await page.route(/i\.scdn\.co|images\.qloo\.test/, (route) => route.fulfill({ contentType: "image/svg+xml", body: picture }));
    await research(page, linkOf(OFFLINE_TEST_ACTS.silent.spotifyId));
    const ask = page.getByTestId("research-ask");
    await expect(ask).toBeVisible({ timeout: 20_000 });
    const picker = ask.getByPlaceholder("Search Spotify, e.g. Paul Kelly");
    for (const artist of [OFFLINE_PICKED_ARTISTS.mariah, OFFLINE_PICKED_ARTISTS.celia]) {
      await picker.fill(artist.name);
      await page.getByRole("option", { name: new RegExp(artist.name) }).filter({ hasNotText: "as typed" }).first().click();
    }
    const picked = ask.getByRole("list", { name: "Artists you picked" });
    await expect(picked.locator("li")).toHaveCount(2);
    await expect(picked.locator("img")).toHaveCount(1);
    const genres = page.getByTestId("research-genre-pick");
    await genres.getByRole("button", { name: "Folk" }).click();
    await genres.getByRole("button", { name: "Pop" }).click();
    await page.getByTestId("research-ask-carry-on").click();
    await done(page);
    expect(inputs).toHaveLength(1);
    expect(JSON.parse(inputs[0])).toEqual({
      artists: [
        { name: "Mariah Carey", spotifyId: OFFLINE_PICKED_ARTISTS.mariah.spotifyId, image: OFFLINE_PICKED_ARTISTS.mariah.spotifyImage },
        { name: "Celia Cruz", spotifyId: OFFLINE_PICKED_ARTISTS.celia.spotifyId },
      ],
      genres: ["Folk", "Pop"],
    });
    const qloo = page.getByTestId("research-steps").locator('[data-testid="agent-step"][data-tool="research_qloo"]');
    await expect(qloo).toContainText("Qloo doesn't know you yet. Using your artists: Mariah Carey and Celia Cruz; your genres: Folk and Pop.");
    // Artists you sound like: both have photos (the Spotify one, and Qloo's where Spotify sent none), not initials.
    const alikes = page.getByTestId("research-sounds-like");
    await expect(alikes.getByRole("list", { name: "Artists you picked" }).locator("li")).toHaveCount(2);
    await expect(alikes.getByRole("list", { name: "Artists you picked" }).locator("li img")).toHaveCount(2);
    const saved = (await (await page.request.get("/api/playlist")).json()).playlist.soundsLike;
    expect(saved).toMatchObject([{ name: "Mariah Carey", image: OFFLINE_PICKED_ARTISTS.mariah.spotifyImage }, { name: "Celia Cruz", image: OFFLINE_PICKED_ARTISTS.celia.qlooImage }]);
  });

  test("sound-alikes Qloo doesn't know (the Wow Popy case): the ask is prefilled with them and suggested genres, sits right under the title, the Hive's and a searched genre can be picked, and Carry on goes on", async ({ page }) => {
    test.setTimeout(120_000);
    const inputs: string[] = [];
    page.on("request", (r) => {
      if (r.method() === "POST" && /\/research\/[^/]+\/input$/.test(r.url())) inputs.push(r.postData() ?? "");
    });
    const picture = '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#888"/></svg>';
    await page.route(/i\.scdn\.co|images\.qloo\.test/, (route) => route.fulfill({ contentType: "image/svg+xml", body: picture }));
    const act = OFFLINE_TEST_ACTS.taggedAlikes;
    await research(page, linkOf(act.spotifyId));
    const ask = page.getByTestId("research-ask");
    await expect(ask).toBeVisible({ timeout: 20_000 });
    // The sound-alikes the research found are there to confirm, with their Spotify photos: not an empty picker.
    const picked = ask.getByRole("list", { name: "Artists you picked" });
    await expect(picked.locator("li")).toHaveCount(act.similar.length);
    for (const name of act.similar) await expect(picked).toContainText(name);
    await expect(picked.locator("img")).toHaveCount(act.similar.length);
    await expect(ask.getByTestId("artists-hint")).toContainText(`${act.similar.length} of 10`);
    // Up to three suggestions start picked: the one the research and the Hive both named (Reggaeton), then the research's.
    const chips = ask.getByTestId("research-genres-picked");
    await expect(chips.getByRole("button")).toHaveText(["Reggaeton", "Dembow", "Cuban Urban"]);
    // The rest are on the Suggested row, above the broad quick picks: the Hive's own (test model offline) carries its mark.
    const suggested = ask.getByTestId("research-genre-suggested");
    // Named as the Hive's for screen readers (sr-only text, no title= tooltip).
    const hiveFunk = /^Funk, .+'s suggestion$/;
    await expect(suggested.getByRole("button")).toHaveText([hiveFunk]);
    await expect(suggested.getByRole("button", { name: "Funk" })).toHaveAttribute("data-source", "hive");
    await expect(suggested.getByRole("button", { name: "Funk" })).toBeDisabled();
    const genres = page.getByTestId("research-genre-pick");
    await expect(genres.getByRole("button", { name: "Reggae", exact: true })).toHaveAttribute("aria-pressed", "false");
    // Unpick one, and the Hive's can be picked instead; its chip keeps the mark.
    await chips.getByRole("button", { name: "Remove Cuban Urban" }).click();
    await expect(suggested.getByRole("button")).toHaveText(["Cuban Urban", hiveFunk]);
    await suggested.getByRole("button", { name: "Funk" }).click();
    await expect(chips.getByRole("button")).toHaveText(["Reggaeton", "Dembow", "Funk"]);
    await expect(chips.getByRole("button", { name: "Remove Funk" })).toHaveAttribute("data-source", "hive");
    // No gap: the ask starts right under the step's title row (the title and its "Your turn" tag, which wraps on a phone).
    // Both measured in one frame: the page scrolls the ask into view smoothly, so two separate reads can disagree.
    const { gap } = await page.evaluate(() => {
      const step = document.querySelector('[data-testid="agent-step"][data-status="waiting"]')!;
      const row = step.querySelector("b")!.parentElement!.getBoundingClientRect();
      const line = step.querySelector('[data-testid="research-ask-line"]')!.getBoundingClientRect();
      return { gap: line.top - row.bottom };
    });
    expect(gap, "space between the title and the ask").toBeLessThanOrEqual(16);
    expect(gap).toBeGreaterThanOrEqual(-1);
    // The genre search: type, pick one of Qloo's genres; it joins the picked ones (axe clean with the list open).
    const search = ask.getByTestId("research-genre-search");
    await expect(search).toBeDisabled();
    await chips.getByRole("button", { name: "Remove Dembow" }).click();
    await search.fill("dem");
    const option = ask.getByRole("option", { name: "Dembow" });
    await expect(option).toBeVisible({ timeout: 10_000 });
    const axe = await new AxeBuilder({ page }).include('[data-testid="research-ask"]').withTags(WCAG).analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
    await option.click();
    await expect(chips.getByRole("button")).toHaveText(["Reggaeton", "Funk", "Dembow"]);
    await expect(search).toHaveValue("");
    // Carry on: the found sound-alikes as they were, and the genres picked.
    await page.getByTestId("research-ask-carry-on").click();
    await done(page);
    await expect(page.getByTestId("research-end")).not.toHaveAttribute("data-code", /^needs_/);
    expect(JSON.parse(inputs[0])).toEqual({
      artists: act.similar.map((name) => ({ name, spotifyId: OFFLINE_SPOTIFY_ONLY_ARTISTS[name].spotifyId, image: OFFLINE_SPOTIFY_ONLY_ARTISTS[name].image })),
      genres: ["Reggaeton", "Funk", "Dembow"],
    });
    const steps = page.getByTestId("research-steps");
    await expect(steps.locator('[data-testid="agent-step"][data-tool="research_fans_love"]')).toContainText("Based on Reggaeton, Funk and Dembow: your fans also love");
    const saved = (await (await page.request.get("/api/playlist")).json()).playlist.soundsLike;
    expect(saved.map((a: { name: string; foundBy?: string }) => `${a.name}:${a.foundBy ?? "you"}`)).toEqual(act.similar.map((name) => `${name}:you`));
  });

  test("still nothing Qloo knows: it asks again in the same step, then stops after three asks in one line", async ({ page }) => {
    test.setTimeout(120_000);
    await research(page, linkOf(OFFLINE_TEST_ACTS.silent.spotifyId));
    const line = page.getByTestId("research-ask-line");
    await expect(line).toBeVisible({ timeout: 20_000 });
    const runId = (await (await page.request.get("/api/playlist")).json()).playlist.research.runId;
    await page.getByTestId("research-ask").getByPlaceholder("Search Spotify, e.g. Paul Kelly").fill("Qzv Nobody");
    await page.getByTestId("research-ask-carry-on").click();
    await expect(line).toHaveText("Qloo doesn't know Qzv Nobody either. Try better-known artists, or pick a genre.", { timeout: 20_000 });
    await page.getByTestId("research-genre-pick").getByRole("button", { name: "Latin" }).click();
    await page.getByTestId("research-ask-carry-on").click();
    await expect(line).toHaveText("Qloo has no tag for Latin. Pick another genre, or add artists you sound like.", { timeout: 20_000 });
    await page.getByTestId("research-genre-pick").getByRole("button", { name: "Latin" }).click();
    await page.getByTestId("research-ask-carry-on").click();
    await expect(page.getByTestId("research-end")).toHaveAttribute("data-code", "no_taste_data", { timeout: 20_000 });
    await expect(page.getByTestId("research-end")).toHaveText("Qloo has no taste data for your act yet, so the research stopped at Who you sound like.");
    await expect(page.getByTestId("research-ask")).toHaveCount(0);
    expect((await (await page.request.get("/api/playlist")).json()).playlist.research.runId).toBe(runId);
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

  test("the daily Qloo budget spent: the shared paused message and the example plans, not the Qloo-down alert (faults=qloo-budget)", async ({ page }) => {
    await page.goto("/repertoire?faults=qloo-budget");
    await field(page).fill(LINK);
    await page.getByRole("button", { name: "Research my act" }).click();
    const end = page.getByTestId("research-end");
    await expect(end.getByText("Taste data paused for today")).toBeVisible();
    await expect(end.getByText(/used today's allowance of taste data from Qloo/)).toBeVisible();
    await expect(end.getByTestId("budget-examples").getByRole("link").first()).toHaveAttribute("href", /^\/plan\?example=/);
    await expect(page.getByText("Qloo isn't answering")).toHaveCount(0);
  });

  test("the limit: a refused run says so and starts nothing (faults=learn-limit)", async ({ page }) => {
    await page.goto("/repertoire?faults=learn-limit");
    await field(page).fill(LINK);
    await page.getByRole("button", { name: "Research my act" }).click();
    await expect(page.getByTestId("research-notice")).toContainText("runs this hour");
  });

  for (const width of WIDTHS) {
    test.describe(`at ${width}px`, () => {
      test.use({ viewport: { width, height: 900 } });
      test.skip(!LOCAL, "Writes to the local offline server's memory store and uses the mock artist");

      /** Axe over the page as it is now, named like a failure should be (state and width). */
      const axeClean = async (page: Page, name: string, sideways = false) => {
        const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
        expect(violations.map((v) => `${name}-${width} ${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
        if (sideways) {
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${name}-${width} scrolls sideways`).toBe(true);
        }
      };
      const onlyDesktop = (info: { project: { name: string } }) => test.skip(info.project.name !== "desktop", "width tests run once, in the desktop project");

      test("layout and axe: the 'is one of these you?' prompt", async ({ page }, info) => {
        onlyDesktop(info);
        await research(page, linkOf(OFFLINE_TEST_ACTS.candidates.spotifyId));
        await expect(page.getByTestId("research-candidates")).toBeVisible({ timeout: 20_000 });
        await expect(page.getByRole("list", { name: "Songs you can sing" }).getByRole("listitem").first()).toBeVisible();
        await axeClean(page, "candidates");
      });

      test("layout and axe: the fallback from artists like you", async ({ page }, info) => {
        onlyDesktop(info);
        test.setTimeout(90_000);
        await research(page, linkOf(OFFLINE_TEST_ACTS.candidates.spotifyId));
        await expect(page.getByTestId("research-candidates")).toBeVisible({ timeout: 20_000 });
        const saved = (await (await page.request.get("/api/playlist")).json()).playlist;
        const patched = await page.request.patch("/api/playlist", { data: { revision: saved.revision, soundsLike: [{ name: "Paul Kelly" }, { name: "Courtney Barnett" }] } });
        expect(patched.ok()).toBe(true);
        await page.reload();
        await page.getByRole("button", { name: "None of these" }).click();
        await done(page);
        await expect(page.getByTestId("research-fans-love")).toBeVisible();
        await expect(page.getByRole("list", { name: "Songs you should learn" }).getByTestId("learn-card").first()).toBeVisible();
        await axeClean(page, "fallback");
      });

      test("layout and axe: sound-alikes found by the Hive", async ({ page }, info) => {
        onlyDesktop(info);
        test.setTimeout(90_000);
        await research(page, linkOf(OFFLINE_TEST_ACTS.unknown.spotifyId));
        await done(page);
        await expect(page.getByTestId("research-fans-love")).toBeVisible();
        await expect(page.getByRole("list", { name: "Songs you should learn" }).getByTestId("learn-card").first()).toBeVisible();
        await axeClean(page, "found");
      });

      test("layout and axe: the run waiting at Who you sound like", async ({ page }, info) => {
        onlyDesktop(info);
        test.setTimeout(120_000);
        await research(page, linkOf(OFFLINE_TEST_ACTS.silent.spotifyId));
        const stream = page.getByTestId("agent-stream");
        await expect(stream.getByTestId("research-ask")).toBeVisible({ timeout: 20_000 });
        await expect(stream.getByTestId("agent-tag")).toHaveText("Waiting");
        await expect(page.getByTestId("research-end")).toHaveCount(0);
        await axeClean(page, "waiting", true);
      });

      test("layout and axe: the pause as a selection (artists and a genre)", async ({ page }, info) => {
        onlyDesktop(info);
        test.setTimeout(120_000);
        await research(page, linkOf(OFFLINE_TEST_ACTS.silent.spotifyId));
        const ask = page.getByTestId("research-ask");
        await expect(ask).toBeVisible({ timeout: 20_000 });
        const picker = ask.getByPlaceholder("Search Spotify, e.g. Paul Kelly");
        await picker.fill("Paul Kelly, Courtney Barnett");
        // Axe with the artist search list open (a listbox of options only).
        const list = page.getByRole("listbox", { name: "Artist results" });
        await expect(list).toBeVisible();
        await expect(list.getByRole("option").first()).toBeVisible();
        await axeClean(page, "search-open");
        await picker.fill("");
        await expect(list).toHaveCount(0);
        const pop = page.getByTestId("research-genre-pick").getByRole("button", { name: "Pop" });
        await pop.click();
        await expect(pop).toHaveAttribute("aria-pressed", "true");
        // Axe with the selected genre button hovered (pressed + hover).
        await pop.hover();
        await axeClean(page, "pressed-hover");
        await page.mouse.move(0, 0);
        await axeClean(page, "selection");
      });

      test("layout and axe: artists picked from Spotify and two genres", async ({ page }, info) => {
        onlyDesktop(info);
        test.setTimeout(120_000);
        // The offline photos are https URLs nothing serves: answer them with a small picture.
        const picture = '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#888"/></svg>';
        await page.route(/i\.scdn\.co|images\.qloo\.test/, (route) => route.fulfill({ contentType: "image/svg+xml", body: picture }));
        await research(page, linkOf(OFFLINE_TEST_ACTS.silent.spotifyId));
        const ask = page.getByTestId("research-ask");
        await expect(ask).toBeVisible({ timeout: 20_000 });
        const picker = ask.getByPlaceholder("Search Spotify, e.g. Paul Kelly");
        for (const artist of [OFFLINE_PICKED_ARTISTS.mariah, OFFLINE_PICKED_ARTISTS.celia]) {
          await picker.fill(artist.name);
          await page.getByRole("option", { name: new RegExp(artist.name) }).filter({ hasNotText: "as typed" }).first().click();
        }
        const genres = page.getByTestId("research-genre-pick");
        await genres.getByRole("button", { name: "Folk" }).click();
        await genres.getByRole("button", { name: "Pop" }).click();
        await page.getByTestId("research-ask-carry-on").click();
        await done(page);
        const alikes = page.getByTestId("research-sounds-like");
        await expect(alikes.getByRole("list", { name: "Artists you picked" }).locator("li img")).toHaveCount(2);
        await axeClean(page, "picked");
      });

      test("layout and axe: asking again in the same step", async ({ page }, info) => {
        onlyDesktop(info);
        test.setTimeout(120_000);
        await research(page, linkOf(OFFLINE_TEST_ACTS.silent.spotifyId));
        const line = page.getByTestId("research-ask-line");
        await expect(line).toBeVisible({ timeout: 20_000 });
        await page.getByTestId("research-ask").getByPlaceholder("Search Spotify, e.g. Paul Kelly").fill("Qzv Nobody");
        await page.getByTestId("research-ask-carry-on").click();
        await expect(line).toHaveText("Qloo doesn't know Qzv Nobody either. Try better-known artists, or pick a genre.", { timeout: 20_000 });
        await page.getByTestId("research-genre-pick").getByRole("button", { name: "Latin" }).click();
        await page.getByTestId("research-ask-carry-on").click();
        await expect(line).toHaveText("Qloo has no tag for Latin. Pick another genre, or add artists you sound like.", { timeout: 20_000 });
        await axeClean(page, "ask-again");
      });

      test("layout and axe: the empty, running and done states", async ({ page }, info) => {
        onlyDesktop(info);
        test.setTimeout(120_000);
        const check = async (name: string) => {
          await axeClean(page, name, true);
          if (SHOTS) await page.screenshot({ path: `${SHOTS}/research-${name}-${width}.png`, fullPage: true });
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
  }

  for (const width of [390, 1440]) {
    test.describe(`at ${width}px`, () => {
      test.use({ viewport: { width, height: 900 } });

      test("layout: nothing scrolls below the footer (the phone nav's own padding aside): empty, after a run, waiting for input, and the other pages", async ({ page }, info) => {
        test.skip(info.project.name !== "desktop", "width tests run once, in the desktop project");
        test.setTimeout(120_000);
        // Exactly one footer once the page has streamed in: React holds a streamed boundary in a hidden div (S:n) until it swaps it in.
        const oneFooter = async () => {
          await expect(page.locator("footer[data-slot=site-footer]")).toHaveCount(1);
          await expect(page.locator("footer[data-slot=site-footer]")).toBeVisible();
        };
        // The footer's bottom against the scrollable height; under 721px the body keeps the fixed bottom nav's height (plus the safe area) as padding on purpose.
        const below = () =>
          page.evaluate(() => {
            const footer = document.querySelector("footer[data-slot=site-footer]")!;
            const pad = parseFloat(getComputedStyle(document.body).paddingBottom) || 0;
            return document.scrollingElement!.scrollHeight - (footer.getBoundingClientRect().bottom + window.scrollY) - pad;
          });
        await page.goto("/repertoire");
        await expect(field(page)).toBeVisible();
        await oneFooter();
        expect(await below(), `/repertoire empty at ${width}`).toBeLessThanOrEqual(2);
        await field(page).fill(LINK);
        await page.getByRole("button", { name: "Research my act" }).click();
        await done(page);
        await oneFooter();
        expect(await below(), `/repertoire after a run at ${width}`).toBeLessThanOrEqual(2);
        // Paused for input (no taste signal), after a reload, and once the answer has carried the run on.
        await page.context().clearCookies();
        await research(page, linkOf(OFFLINE_TEST_ACTS.silent.spotifyId));
        await expect(page.getByTestId("research-ask")).toBeVisible({ timeout: 20_000 });
        await oneFooter();
        expect(await below(), `/repertoire waiting at ${width}`).toBeLessThanOrEqual(2);
        await page.reload();
        await expect(page.getByTestId("research-ask")).toBeVisible({ timeout: 20_000 });
        await oneFooter();
        expect(await below(), `/repertoire waiting, reloaded, at ${width}`).toBeLessThanOrEqual(2);
        await page.getByTestId("research-ask").getByPlaceholder("Search Spotify, e.g. Paul Kelly").fill("Paul Kelly, Courtney Barnett");
        await page.getByTestId("research-ask-carry-on").click();
        await done(page);
        await oneFooter();
        expect(await below(), `/repertoire after the answer at ${width}`).toBeLessThanOrEqual(2);
        for (const path of ["/", "/busks", "/brain", "/brand", "/p/ZZZZZZZZZ"]) {
          await page.goto(path);
          await oneFooter();
          expect(await below(), `${path} at ${width}`).toBeLessThanOrEqual(2);
        }
      });
    });
  }
});
