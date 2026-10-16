import AxeBuilder from "@axe-core/playwright";
import { expect, LOCAL, test } from "./fixtures";

/**
 * Stage R3: Songs to learn, its own agent run (docs/playlist-architecture.md §2, §7). Offline: the memory stores, the Qloo
 * mock, the synthetic Spotify and the mock learn model, one cookie per browser context. No live model or Qloo call.
 */
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"];
const SHOTS = process.env.REPERTOIRE_SHOTS;
const WIDTHS = [390, 768, 1440] as const;
type Page = import("@playwright/test").Page;

const SONGS = [
  { title: "Dumb Things", artist: "Paul Kelly" },
  { title: "To Her Door", artist: "Paul Kelly" },
  { title: "Avant Gardener", artist: "Courtney Barnett" },
  { title: "Scar", artist: "Missy Higgins" },
  { title: "Riptide", artist: "Vance Joy" },
];

async function seed(page: Page, songs = SONGS) {
  for (const song of songs) expect((await page.request.post("/api/playlist/songs", { data: song })).ok()).toBe(true);
}

const section = (page: Page) => page.getByTestId("learn-section");
const findButton = (page: Page, name: "Find songs to learn" | "Find more songs to learn" = "Find songs to learn") => section(page).getByRole("button", { name, exact: true });
const group = (page: Page, run: number) => section(page).locator(`[data-testid="learn-group"][data-run="${run}"]`);
const cards = (scope: import("@playwright/test").Locator) => scope.getByTestId("learn-card");
/** Songs are identified by title and artist: the mock's catalogue repeats titles across artists. */
const keysOf = async (scope: import("@playwright/test").Locator) => (await cards(scope).evaluateAll((els) => els.map((e) => `${e.getAttribute("data-artist")} | ${e.getAttribute("data-song")}`))).sort();
const cardAt = (scope: import("@playwright/test").Locator, i: number) => cards(scope).nth(i);
const idOf = async (card: import("@playwright/test").Locator) => ({ title: (await card.getAttribute("data-song"))!, artist: (await card.getAttribute("data-artist"))! });
const cardOf = (scope: import("@playwright/test").Locator, s: { title: string; artist: string }) => scope.locator(`[data-testid="learn-card"][data-song=${JSON.stringify(s.title)}][data-artist=${JSON.stringify(s.artist)}]`);

/** A canned, valid learn stream, for the states a mock run doesn't reach on its own (UI states only). */
function stream(end: Record<string, unknown>, extra: object[] = []) {
  const events = [
    { type: "run", runId: "canned", number: 1, startedAt: new Date().toISOString(), model: "mock", inputs: { songs: 5, soundsLike: [], pitches: [] }, replay: false, stepsKept: true },
    { type: "status", message: "Looking for songs to learn" },
    ...extra,
    { type: "totals", totals: { artists: 4, crowds: 0, liked: 0, songsChecked: 0, alreadySuggested: 0, dismissedSkipped: 0, alreadyKnown: 0, newSongs: 0, qlooCalls: 4, qlooCacheHits: 0 } },
    { type: "end", ok: true, runId: "canned", mode: "agent", newCount: 0, skippedCount: 0, code: null, message: "", ...end },
  ];
  return events.map((e) => JSON.stringify(e)).join("\n") + "\n";
}
async function canned(page: Page, body: string) {
  await page.route("**/api/playlist/learn", (route) => (route.request().method() === "POST" ? route.fulfill({ status: 200, contentType: "application/x-ndjson", body }) : route.continue()));
}

test.describe("Songs to learn: a learn run (offline)", () => {
  test.skip(!LOCAL, "Writes to the local offline server's memory store");

  test("a run streams its steps and funnel, saves its songs, and a second run builds on what was learned", async ({ page }) => {
    await seed(page);
    await page.goto("/repertoire");
    await expect(section(page).getByTestId("learn-first-time")).toBeVisible();
    await expect(section(page).getByText("3 runs left this hour")).toBeVisible();

    await findButton(page).click();
    // The steps stream under the button, in the plan's step view, with the learn labels.
    const feed = section(page).getByTestId("learn-run");
    await expect(feed.getByRole("list", { name: "Learn run steps" })).toBeVisible();
    await expect(section(page).getByTestId("learn-end")).toHaveAttribute("data-state", "done");
    const steps = feed.getByRole("list", { name: "Learn run steps" });
    for (const label of ["Matching your songs on Qloo", "Reading your earlier runs", "Artists your fans also like", "Who the crowd likes at your pitch", "Who's rising with those crowds", "Top songs by those artists", "Choosing and explaining"]) {
      await expect(steps.getByText(label, { exact: true })).toBeVisible();
    }
    await expect(steps.getByTestId("agent-step").first()).toContainText("match_playlist");
    // The notes are by the test model, and the finishing step is not marked rejected.
    await expect(steps.getByTestId("agent-note-text").first()).toContainText("Test model:");
    await expect(steps.locator('[data-tool="finish_suggestions"]')).toContainText("done");
    // The funnel
    const totals = feed.getByTestId("learn-totals");
    await expect(totals.locator('[data-total="artists"] dd')).toHaveText("4");
    await expect(totals.locator('[data-total="crowds"] dd')).toHaveText("1");
    await expect(totals.locator('[data-total="songsChecked"] dd')).not.toHaveText("0");
    const newSongs = Number(await totals.locator('[data-total="newSongs"] dd').innerText());
    expect(newSongs).toBeGreaterThanOrEqual(3);
    await expect(section(page).getByTestId("learn-end")).toHaveText(`The test model found ${newSongs} songs to learn.`);

    // The list: Run 1, its songs, "New this run" on each.
    const run1 = group(page, 1);
    await expect(run1).toContainText("test model");
    await expect(run1).toContainText(`${newSongs} new`);
    await expect(cards(run1)).toHaveCount(newSongs);
    await expect(run1.getByText("New this run")).toHaveCount(newSongs);
    const first = await keysOf(run1);

    // Reload: the run is listed and its songs are stored.
    await page.reload();
    await expect(cards(group(page, 1))).toHaveCount(newSongs);
    await expect(section(page).getByTestId("learn-last-run")).toContainText(`${newSongs} new songs`);

    // Learned moves a song into Songs you can sing; focus lands on its Undo.
    const learned = await idOf(cardAt(group(page, 1), 0));
    await cardOf(group(page, 1), learned).getByRole("button", { name: /^Mark as learned: / }).click();
    await expect(section(page).getByRole("status").filter({ hasText: `${learned.title} is now in Songs you can sing.` })).toBeVisible();
    await expect(cardOf(group(page, 1), learned).getByRole("button", { name: /^Undo: / })).toBeFocused();
    await expect(page.getByRole("list", { name: "Learned", exact: true }).getByText(learned.artist)).toBeVisible();
    // Not for me folds a song under "Not for me", and focus moves on to the next song.
    const dismissed = await idOf(cardAt(group(page, 1), 1));
    await cardOf(group(page, 1), dismissed).getByRole("button", { name: /^Not for me: / }).click();
    await expect(group(page, 1).getByRole("button", { name: "Not for me (1)" })).toBeVisible();
    await expect(group(page, 1).getByRole("button", { name: /^Mark as learned: / }).first()).toBeFocused();

    // Run again: the first run's songs are history. None comes back; the new ones are new; one builds on the learned song.
    await findButton(page, "Find more songs to learn").click();
    await expect(section(page).getByTestId("learn-end")).toHaveAttribute("data-state", "done");
    const run2 = group(page, 2);
    await expect(cards(run2).first()).toBeVisible();
    const second = await keysOf(run2);
    expect(second.length).toBeGreaterThanOrEqual(3);
    for (const key of second) expect(first).not.toContain(key);
    await expect(run2.getByText("New this run")).toHaveCount(second.length);
    await expect(group(page, 1).getByText("New this run")).toHaveCount(0);
    await expect(run2.getByText(`Builds on ${learned.title}`).first()).toBeVisible();
    // The funnel shows what the server left out of the second run.
    const second2 = section(page).getByTestId("learn-run").getByTestId("learn-totals");
    await expect(second2.locator('[data-total="alreadySuggested"] dd')).not.toHaveText("0");
    // Run 2 sits above run 1.
    const order = await section(page).locator('[data-testid="learn-group"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-run")));
    expect(order).toEqual(["2", "1"]);

    // The newest run is open and the older one has folded (B-030): its songs are hidden until it is opened.
    await expect(group(page, 2)).toHaveAttribute("data-open", "true");
    await expect(group(page, 1)).toHaveAttribute("data-open", "false");
    await expect(group(page, 1).getByTestId("learn-group-toggle")).toHaveAttribute("aria-expanded", "false");
    await expect(cards(group(page, 1))).toHaveCount(0);
    await group(page, 1).getByTestId("learn-group-toggle").click();
    await expect(group(page, 1).getByTestId("learn-group-toggle")).toHaveAttribute("aria-expanded", "true");
    await expect(cards(group(page, 1)).first()).toBeVisible();

    // Undo on a dismissed song brings it back to the list (the only way back); Undo on a learned one takes it out of Songs you can sing.
    await group(page, 1).getByRole("button", { name: "Not for me (1)" }).click();
    await cardOf(group(page, 1), dismissed).getByRole("button", { name: /^Undo: / }).click();
    await expect(cardOf(group(page, 1), dismissed).getByRole("button", { name: /^Mark as learned: / })).toBeFocused();
    await expect(group(page, 1).getByRole("button", { name: /^Not for me \(/ })).toHaveCount(0);
    await cardOf(group(page, 1), learned).getByRole("button", { name: /^Undo: / }).click();
    await expect(cardOf(group(page, 1), learned).getByRole("button", { name: /^Mark as learned: / })).toBeVisible();
    await expect(page.getByRole("list", { name: "Learned", exact: true })).toHaveCount(0);
    // The API agrees: the three songs it holds are the ones typed in.
    const state = (await (await page.request.get("/api/playlist")).json()).playlist;
    expect(state.songs.map((s: { title: string }) => s.title)).toEqual(SONGS.map((s) => s.title));
  });

  test("replaying a stored run shows the same steps, labelled a replay, and makes no new run", async ({ page }) => {
    await seed(page);
    await page.goto("/repertoire");
    await findButton(page).click();
    await expect(section(page).getByTestId("learn-end")).toHaveAttribute("data-state", "done");
    const liveSteps = await section(page).getByTestId("learn-run").getByTestId("agent-step").evaluateAll((els) => els.map((e) => e.getAttribute("data-tool")));
    await page.reload();
    const posts: string[] = [];
    page.on("request", (r) => {
      if (r.method() === "POST" && r.url().includes("/api/playlist/learn")) posts.push(r.url());
    });
    const events = page.waitForResponse((r) => /\/api\/playlist\/learn\/runs\/[^/]+\/events$/.test(r.url()));
    await group(page, 1).getByRole("button", { name: "Replay steps" }).click();
    expect((await events).ok()).toBe(true);
    const replay = group(page, 1).getByTestId("learn-run");
    await expect(replay).toHaveAttribute("data-replay", "true");
    await expect(replay).toContainText("(replay)");
    await expect(replay.getByText(/Replaying run 1/)).toBeVisible();
    expect(await replay.getByTestId("agent-step").evaluateAll((els) => els.map((e) => e.getAttribute("data-tool")))).toEqual(liveSteps);
    expect(posts).toEqual([]);
    await expect(section(page).getByText("3 runs left this hour")).toBeVisible();
    await group(page, 1).getByRole("button", { name: "Hide steps" }).click();
    await expect(replay).toHaveCount(0);
  });

  test("a run can be left: it carries on, and its songs are on the list when you come back", async ({ page }) => {
    await seed(page);
    await page.goto("/repertoire");
    const started = page.waitForResponse((r) => r.url().endsWith("/api/playlist/learn") && r.request().method() === "POST");
    await findButton(page).click();
    await started;
    await page.goto("/");
    await page.goto("/repertoire");
    await expect(group(page, 1)).toBeVisible();
    await expect(cards(group(page, 1)).first()).toBeVisible();
  });
});

test.describe("Songs to learn: refusals and states (offline)", () => {
  test.skip(!LOCAL, "Fault injection exists only on the local test server");

  test("an empty Repertoire is refused: the button says why, and the API answers 404 / 409", async ({ page }) => {
    await page.goto("/repertoire");
    await expect(findButton(page)).toBeDisabled();
    await expect(section(page).getByTestId("learn-reason")).toHaveText("Save your Repertoire by adding a song above, then find songs to learn.");
    expect((await page.request.post("/api/playlist/learn")).status()).toBe(404);
    await seed(page, SONGS.slice(0, 2));
    await page.reload();
    await expect(findButton(page)).toBeDisabled();
    await expect(section(page).getByTestId("learn-reason")).toHaveText("Add at least 3 songs you can sing, then find songs to learn.");
    const res = await page.request.post("/api/playlist/learn");
    expect(res.status()).toBe(409);
    expect((await res.json()).error).toMatchObject({ code: "empty_playlist", minSongs: 3 });
    // Three songs and the button wakes up.
    await seed(page, SONGS.slice(2, 3));
    await page.reload();
    await expect(findButton(page)).toBeEnabled();
  });

  for (const [fault, scope, text] of [
    ["learn-limit", "repertoire", /^You've started 3 runs this hour\. Try again in about 45 minutes\.$/],
    ["learn-limit-ip", "ip", /^A lot of runs have started from this network in the last hour\. Try again in about 45 minutes\.$/],
  ] as const) {
    test(`the limit page, ${scope} scope (faults=${fault}): the message, no run started`, async ({ page }) => {
      await seed(page);
      await page.goto(`/repertoire?faults=${fault}`);
      const posts: number[] = [];
      page.on("response", (r) => {
        if (r.request().method() === "POST" && r.url().endsWith("/api/playlist/learn")) posts.push(r.status());
      });
      await findButton(page).click();
      const limit = section(page).getByTestId("learn-limit");
      await expect(limit).toHaveAttribute("data-scope", scope);
      await expect(limit.getByText(text)).toBeVisible();
      await expect(limit.getByText(scope === "repertoire" ? "Run limit reached" : "Lots of runs from this network")).toBeVisible();
      expect(posts).toEqual([429]);
      await expect(section(page).getByTestId("learn-run")).toHaveCount(0);
      expect((await (await page.request.get("/api/playlist/learn")).json()).runs).toEqual([]);
      // Nothing started, so the button is still there to try again.
      await expect(findButton(page)).toBeEnabled();
    });
  }

  test("Qloo down: the run says so in plain words and nothing is saved (faults=qloo)", async ({ page }) => {
    await seed(page);
    await page.goto("/repertoire?faults=qloo");
    await findButton(page).click();
    const end = section(page).getByTestId("learn-end");
    await expect(end).toHaveAttribute("data-state", "qloo");
    await expect(end).toContainText("Qloo isn't answering");
    await expect(end.getByTestId("learn-safe")).toHaveText("Your songs are safe. This run didn't count towards your limit.");
    await expect(section(page).getByTestId("learn-run").getByTestId("agent-step")).toHaveCount(1);
    await expect(cards(section(page))).toHaveCount(0);
    await expect(findButton(page, "Find more songs to learn")).toBeEnabled();
  });

  test("a full list is refused: 40 songs waiting means the button says to clear some first", async ({ page }) => {
    await seed(page);
    for (let i = 0; i < 40; i++) expect((await page.request.post("/api/playlist/learn/suggestions", { data: { title: `Plan song ${i}`, artist: `Plan artist ${i}`, reason: "From a plan" } })).ok()).toBe(true);
    await page.goto("/repertoire");
    await expect(findButton(page)).toBeDisabled();
    await expect(section(page).getByTestId("learn-reason")).toHaveText("Your list of songs to learn is full (40). Mark some learned or dismiss them first.");
    const res = await page.request.post("/api/playlist/learn");
    expect(res.status()).toBe(409);
    expect((await res.json()).error).toMatchObject({ code: "list_full", pending: 40, max: 40 });
    // They sit under "Added from plans".
    await expect(section(page).getByRole("heading", { name: "Added from plans" })).toBeVisible();
    await expect(cards(section(page)).first()).toContainText("From a plan");
  });

  test("fallback, nothing new and error endings, from canned streams", async ({ page }) => {
    await seed(page);
    await page.goto("/repertoire");
    await canned(page, stream({ ok: true, mode: "fallback", newCount: 3, skippedCount: 2, code: "model_unavailable", message: "The AI was unavailable, so these 3 songs come from the data alone." }));
    await findButton(page).click();
    await expect(section(page).getByTestId("learn-end")).toHaveAttribute("data-state", "fallback");
    await expect(section(page).getByTestId("learn-end")).toContainText("come from the data alone");
    await page.unroute("**/api/playlist/learn");
    await canned(page, stream({ ok: true, mode: "agent", newCount: 0, skippedCount: 7, code: "nothing_new", message: "Nothing new this time (7 left out). Try again after a new busk, or after you've learned a few songs." }));
    await findButton(page).click();
    await expect(section(page).getByTestId("learn-end")).toHaveAttribute("data-state", "nothing-new");
    await expect(section(page).getByTestId("learn-end")).toContainText("Nothing new this time (7 left out)");
    await page.unroute("**/api/playlist/learn");
    await page.route("**/api/playlist/learn", (route) => (route.request().method() === "POST" ? route.abort() : route.continue()));
    await findButton(page).click();
    await expect(section(page).getByTestId("learn-end")).toHaveAttribute("data-state", "error");
    await expect(section(page).getByRole("alert").getByText("The run didn't finish")).toBeVisible();
  });

  test("a stream that breaks before its end is an error, never silence", async ({ page }) => {
    await seed(page);
    await page.goto("/repertoire");
    await page.route("**/api/playlist/learn", (route) =>
      route.request().method() === "POST" ? route.fulfill({ status: 200, contentType: "application/x-ndjson", body: `${JSON.stringify({ type: "status", message: "Looking for songs to learn" })}\n` }) : route.continue(),
    );
    await findButton(page).click();
    await expect(section(page).getByTestId("learn-end")).toHaveAttribute("data-state", "error");
  });
});

test.describe("Songs to learn: widths, accessibility, screenshots (offline)", () => {
  test.skip(!LOCAL, "Writes to the local offline server's memory store");

  test("every state at 390, 768 and 1440: axe, no sideways scroll, screenshots", async ({ page }, info) => {
    test.setTimeout(120_000);
    const check = async (name: string, shot: string) => {
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 900 });
        const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
        expect(violations.map((v) => `${name}-${width} ${v.id}: ${v.nodes.map((n) => `${n.target.join(" ")} ${n.any[0]?.message ?? ""} ${n.html.slice(0, 160)}`).join(" | ")}`)).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${name}-${width} scrolls sideways`).toBe(true);
        if (SHOTS && info.project.name === "desktop") {
          await section(page).scrollIntoViewIfNeeded();
          await page.screenshot({ path: `${SHOTS}/r3-${shot}-${width}.png`, fullPage: true });
        }
      }
    };

    // Empty Repertoire
    await page.goto("/repertoire");
    await expect(findButton(page)).toBeDisabled();
    await check("empty", "learn-empty");

    // First time: three songs, no runs
    await seed(page);
    await page.reload();
    await expect(section(page).getByTestId("learn-first-time")).toBeVisible();
    await check("first-time", "learn-first-time");

    // Running: the request is held back so the state can be seen
    await page.route("**/api/playlist/learn", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      await new Promise((r) => setTimeout(r, 2500));
      return route.continue();
    });
    await findButton(page).click();
    await expect(section(page).getByTestId("learn-running")).toBeVisible();
    await check("running", "learn-running");
    await expect(section(page).getByTestId("learn-end")).toHaveAttribute("data-state", "done", { timeout: 15_000 });
    await page.unroute("**/api/playlist/learn");

    // Done: steps, funnel and the list
    await check("done", "learn-done");

    // A learned song, a dismissed one with its disclosure open, and a second run
    const learned = await idOf(cardAt(group(page, 1), 0));
    await cardOf(group(page, 1), learned).getByRole("button", { name: /^Mark as learned: / }).click();
    await expect(cardOf(group(page, 1), learned).getByRole("button", { name: /^Undo: / })).toBeVisible();
    const dismissed = await idOf(cardAt(group(page, 1), 1));
    await cardOf(group(page, 1), dismissed).getByRole("button", { name: /^Not for me: / }).click();
    await findButton(page, "Find more songs to learn").click();
    await expect(section(page).getByTestId("learn-end")).toHaveAttribute("data-state", "done");
    await group(page, 1).getByTestId("learn-group-toggle").click();
    await group(page, 1).getByRole("button", { name: "Not for me (1)" }).click();
    await group(page, 1).getByRole("button", { name: "Replay steps" }).click();
    await expect(group(page, 1).getByTestId("learn-run")).toBeVisible();
    await check("list", "learn-list");

    // Limit (both scopes), Qloo down
    for (const [fault, shot] of [["learn-limit", "learn-limit-repertoire"], ["learn-limit-ip", "learn-limit-ip"], ["qloo", "learn-qloo-down"]] as const) {
      await page.goto(`/repertoire?faults=${fault}`);
      await findButton(page, "Find more songs to learn").click();
      await expect(section(page).getByTestId(fault === "qloo" ? "learn-end" : "learn-limit")).toBeVisible();
      await check(shot, shot);
    }
  });
});
