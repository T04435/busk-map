import { EXAMPLES } from "../../src/lib/examples";
import { AGENT_KEPT_TOP3, agentSteps, CLAUDE_CREDIT, EXPLAINED_BY, EXPLANATIONS_LABEL, expect, LOCAL, MODEL_NOTE_PREFIX, MODEL_PLAN, openDetails, REPLAY_LINE, SATURDAY, showRawData, test, waitForPlan } from "./fixtures";

test.describe("landing", () => {
  test("shows the three example performers and a way to plan your own busk", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Busk Map" })).toBeVisible();
    for (const example of EXAMPLES) await expect(page.getByRole("link", { name: new RegExp(`^${example.label} `) })).toBeVisible();
    // The own-act form lives on /busks now; the landing links to it.
    await expect(page.getByRole("link", { name: "Plan a busk" }).first()).toHaveAttribute("href", "/busks");
  });
});

for (const example of EXAMPLES) {
  test.describe(`example: ${example.label}`, () => {
    test("opens instantly with three scored pitches, a map and a setlist", async ({ page }) => {
      await page.goto("/");
      await page.getByRole("link", { name: new RegExp(`^${example.label} `) }).click();
      // Example cards link to /plan?example=…, which redirects to the plan's short link.
      await expect(page).toHaveURL(/\/p\/[0-9A-Za-z]{9}$/);
      await expect(page.getByRole("heading", { level: 1, name: example.performer.name })).toBeVisible();
      await waitForPlan(page);

      const pitches = page.getByRole("region", { name: "Pitches", exact: true }).getByRole("listitem");
      await expect(pitches).toHaveCount(3);
      await expect(page.getByRole("region", { name: "Map of pitches and Qloo taste affinity" })).toBeVisible();
      // The pitch's details (card, setlist, crowd, weights) open in a sheet, not inline.
      await expect(page.getByRole("heading", { name: /^Suggested set for / })).toHaveCount(0);
      const sheet = await openDetails(page);
      await expect(sheet.getByRole("heading", { name: /^Suggested set for / })).toBeVisible();
      await expect(sheet.getByTestId("pitch-card")).toBeVisible();
      // The Learn it menu lives on "Learn these" only, not on the setlist rows.
      await expect(sheet.getByRole("region", { name: "Suggested set" }).getByRole("button", { name: /^Learn it/ }).first()).toBeVisible();
      if (LOCAL) await expect(sheet.getByText(EXPLAINED_BY)).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(sheet).toHaveCount(0);
      // The agent starts on load and the plan appears when it ends, with Claude's explanations (mock model offline).
      const steps = await agentSteps(page);
      if (LOCAL) {
        // The mock model wrote these: no Claude chip and no Claude credit (B-007).
        await expect(page.getByText(EXPLANATIONS_LABEL)).toBeVisible();
        await expect(page.getByText("Explanations: Claude")).toHaveCount(0);
        await expect(page.getByRole("link", { name: CLAUDE_CREDIT })).toHaveCount(0);
        // Nor do the steps, Agent vs engine, the pitch card or the plain-AI panel (B-010).
        await expect(page.getByTestId("agent-vs-engine")).toContainText(AGENT_KEPT_TOP3);
        await expect(page.getByText(/sent to the test model \(offline\) with no tools/)).toBeVisible();
        await expect(steps.getByTestId("agent-note-text").first()).toContainText(MODEL_NOTE_PREFIX);
        // The site footer credits Claude as a builder ("with Claude"): that is not a model claim, so look in the page body.
        // The landing page we came from stays mounted but hidden (cache components keep the previous route), and its PartnersSection
        // names the Claude tile: only the visible <main> is the plan page.
        await expect(page.locator("main:visible").getByText(/Claude/)).toHaveCount(0);
      }
      // Every data source is credited.
      for (const credit of ["Taste data by Qloo", "Busking locations and zones: City of Melbourne", "Weather data by Open-Meteo.com"]) {
        await expect(page.getByRole("link", { name: credit })).toBeVisible();
      }
      // Offline runs use the Qloo mock and say so; a deploy with the key says Live, never "test data".
      if (LOCAL) await expect(page.getByText("Qloo test data (local mock)").first()).toBeVisible();
      else {
        await expect(page.getByText("Live Qloo data").first()).toBeVisible();
        await expect(page.getByText(/Qloo test data/)).toHaveCount(0);
      }
    });

    test("selects a pitch from the keyboard; Full details opens the sheet and keeps it in the URL", async ({ page }) => {
      await page.goto(`/plan?example=${example.id}`);
      await waitForPlan(page);
      const second = page.getByRole("region", { name: "Pitches", exact: true }).locator("button[data-pitch-name]").nth(1);
      await second.focus();
      await page.keyboard.press("Enter");
      await expect(second).toHaveAttribute("aria-pressed", "true");
      // Selecting highlights the pitch; the URL and the sheet wait for Full details.
      await expect(page).not.toHaveURL(/pitch=/);
      const sheet = await openDetails(page, 1);
      await expect(page).toHaveURL(/pitch=/);
      await expect(sheet.getByRole("heading", { name: /^Suggested set for / })).toBeVisible();

      // The link reopens the sheet on that pitch (shareable deep link).
      await page.reload();
      await expect(page.getByRole("dialog").getByRole("heading", { name: /^Suggested set for / })).toBeVisible();
    });
  });
}

test.describe("data-led plans", () => {
  test("the three examples get different top pitches, each with a hidden gem and Qloo's reasons", async ({ page }) => {
    test.setTimeout(90_000);
    const tops: string[][] = [];
    for (const example of EXAMPLES) {
      await page.goto(`/plan?example=${example.id}`);
      await waitForPlan(page);
      const buttons = page.getByRole("region", { name: "Pitches", exact: true }).locator("button[data-pitch-name]");
      await expect(buttons).toHaveCount(3);
      const names = await buttons.evaluateAll((els) => els.map((el) => el.getAttribute("data-pitch-name") ?? ""));
      tops.push(names);
      if (example.id === "acoustic") {
        // The usual busking hotspots are always scored (the mock's layers rule out Bourke Street Mall): here they rank in the top 10.
        // They are quiet dots on the map; each opens a summary that names it as a usual pitch.
        const map = page.getByRole("region", { name: "Map of pitches and Qloo taste affinity" });
        await map.scrollIntoViewIfNeeded();
        const popover = page.getByTestId("other-pitch-popover");
        await page.getByTestId("browse-others").focus();
        await page.keyboard.press("Enter");
        const seen = new Map<string, string>();
        for (let i = 0; i < 40; i++) {
          // Keyed by the aria-label ("<name>, summary"): innerText is upper-cased by the title's CSS.
          const text = await popover.innerText();
          seen.set(((await popover.getAttribute("aria-label")) ?? "").replace(/, summary$/, ""), text);
          await page.getByRole("button", { name: "Next pitch" }).click();
        }
        // A hotspot that is one of the plan's top 3 is a pick (its card says usual pitch), not a dot in the popovers.
        const hotspots = ["Federation Wharf", "Degraves Street", "Federation Square", "Flinders St / Elizabeth St corner"].filter((h) => !names.includes(h));
        expect(hotspots.length).toBeGreaterThanOrEqual(3);
        for (const hotspot of hotspots) expect(seen.get(hotspot), hotspot).toContain("USUAL PITCH");
        await page.keyboard.press("Escape");
      }
      await expect(page.getByRole("region", { name: "Pitches", exact: true }).getByText("Hidden gem").first()).toBeVisible();
      await expect(page.getByTestId("funnel-sentence")).toContainText("Qloo mapped your taste");
      await expect(page.getByLabel("Map legend")).toContainText("Taste");
      // The crowd, the weights and the setlist sit in each pitch's details.
      const sheet = await openDetails(page);
      await expect(sheet.getByRole("heading", { name: "Who this crowd likes" })).toBeVisible();
      await expect(sheet.getByText(/^Because your fans like/).first()).toBeVisible();
      // Why this crowd: every block names its Qloo evidence; fans vs the usual crowd; age lean.
      const crowd = sheet.getByRole("region", { name: "Compared with the usual crowd" });
      await expect(crowd.getByRole("heading", { name: "Your fans vs the usual crowd" })).toBeVisible();
      await expect(crowd.getByText(/^Qloo insights for the hotspot/)).toBeVisible();
      // The local scene: the city's genres and the local acts your fans would like (Qloo compare + genre tag, re-scored).
      await expect(sheet.getByTestId("local-scene")).toContainText(/^Local scene: .+: acts your fans would like:$/);
      await expect(sheet.getByRole("heading", { name: "Who your fans are" })).toBeVisible();
      // What to play: songs carry their year and era fit.
      await expect(sheet.getByText(/from \d{4}: a (strong|good|fair|weak) era fit for a crowd leaning /).first()).toBeVisible();
      await expect(sheet.getByText(/\d+\/100/)).toHaveCount(0);
    }
    expect(new Set(tops.map((t) => t.join("|"))).size).toBe(3);
    expect(new Set(tops.map((t) => t[0])).size).toBe(3);
  });
});

test.describe("live agent (mock model offline)", () => {
  test.skip(!LOCAL, "Runs the agent; only against the local offline server to avoid spend");

  test("agent-first: steps stream while the plan waits, Claude's plan appears at the end; a reload replays it at once", async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(e.message));
    // A request no other test or project shares, so the first load is a cold run.
    const url = `/plan?name=Agent%20First%20${testInfo.project.name}&artists=Paul%20Kelly&songs=How%20to%20Make%20Gravy~Paul%20Kelly&date=${SATURDAY}&from=18&to=21`;
    // Hold the agent's stream until the pending state has been checked.
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    await page.route("**/api/plan", async (route) => {
      await held;
      await route.continue();
    });
    await page.goto(url);
    await expect(page.getByTestId("plan-pending")).toBeVisible();
    await expect(page.getByTestId("agent-status")).toHaveText(/Your busk replaces this in about half a minute/);
    await expect(page.getByRole("region", { name: "Pitches", exact: true })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /^Suggested set for / })).toHaveCount(0);
    await expect(page.getByText(/^Explanations: /)).toHaveCount(0);
    release();

    // The feed, in run order (U23): plain-words cards, with Claude's note before a call. No tool names, inputs or step numbers.
    // (It stays open on every width: no inner fold, U22.)
    await waitForPlan(page);
    await expect(page.getByTestId("plan-pending")).toHaveCount(0);
    const feed = await agentSteps(page);
    await expect(feed.getByText("Where your crowd gathers")).toBeVisible();
    await expect(feed.getByText("We'll start with the taste map to see where this act's fans concentrate.")).toBeVisible();
    await expect(feed.getByText("Your best pitches so far").first()).toBeVisible();
    await expect(feed.getByText("taste_map")).toHaveCount(0);
    await expect(page.getByText("Qloo /v2/insights · urn:heatmap")).toHaveCount(0);
    await expect(feed.getByText(/^Thinking \(summary\)/)).toHaveCount(0);
    // The live research totals fill the funnel: the plan's own numbers are the last ones.
    await expect(page.getByTestId("plan-funnel")).toBeVisible();

    // Raw data, behind the page-level switch: tool names, the inputs Claude chose, the source, the thinking and the data returned.
    await showRawData(page);
    const crowd = feed.locator('[data-tool="crowd_at"]');
    await expect(crowd.first()).toContainText("radiusM");
    await expect(feed.getByText("Qloo /v2/insights · urn:heatmap")).toBeVisible();
    await expect(feed.getByTestId("agent-note-reasoning").first()).toContainText("Thinking (summary):");
    await expect(crowd.first().getByTestId("agent-step-data").getByRole("table").first()).toBeVisible();
    await expect(crowd.first().getByTestId("agent-step-data").getByRole("columnheader", { name: "because" })).toBeVisible();
    await expect(feed.locator('[data-tool="finish_plan"]')).toContainText("Accepted:");
    await expect(page.getByTestId("agent-usage")).toContainText("model steps");
    // Switching it off hides them again.
    await page.getByRole("switch", { name: "Raw data" }).click();
    await expect(feed.getByText("Qloo /v2/insights · urn:heatmap")).toHaveCount(0);
    // Agent vs engine: the mock keeps Busk Map's top 3.
    await expect(page.getByTestId("agent-vs-engine")).toContainText("Agent vs engine");
    await expect(page.getByTestId("agent-vs-engine")).toContainText(AGENT_KEPT_TOP3);
    await expect(feed.getByTestId("agent-note-text").first()).toContainText(MODEL_NOTE_PREFIX);
    // Claude investigates first: score_pitches comes after three looks, one of them about the crowd. The feed lists in run order (U23).
    const order = await feed.getByTestId("agent-step").evaluateAll((els) => els.map((el) => el.getAttribute("data-tool")).filter(Boolean));
    expect(order.indexOf("score_pitches")).toBeGreaterThanOrEqual(3);
    expect(order.slice(0, order.indexOf("score_pitches")).some((t) => ["taste_map", "crowd_at", "events_near"].includes(t!))).toBe(true);
    expect(order.at(-1)).toBe("finish_plan");
    await expect(page.getByText(EXPLANATIONS_LABEL)).toBeVisible();
    await expect(page.getByText(/^Mock explanation/).first()).toBeHidden(); // the reasons sit in each pitch's details
    await expect(page.getByTestId("agent-fallback")).toHaveCount(0);

    // A reload replays the finished run: the plan at once, the steps folded and marked as a replay.
    await page.unroute("**/api/plan");
    await page.reload();
    await waitForPlan(page);
    await expect(page.getByText(REPLAY_LINE)).toBeVisible();
    // Labelled as a replay at the top, not only in the folded steps.
    await expect(page.getByTestId("replay-label")).toHaveText("Replay of an earlier run (no new model call)");
    await expect(page.getByText(EXPLANATIONS_LABEL)).toBeVisible();
    // U22: the replayed steps show directly, with no inner fold.
    const replayedSteps = page.getByRole("list", { name: "Research, in the order it ran" });
    await expect(replayedSteps.getByText("Your best pitches so far").first()).toBeVisible();
    // The replay keeps each step's data: raw data shows it.
    await page.getByRole("switch", { name: "Raw data" }).click();
    await expect(replayedSteps.locator('[data-tool="taste_map"]').getByTestId("agent-step-data").getByRole("columnheader", { name: "affinity" })).toBeVisible();

    // Buskers get no re-run button: a reload replays.
    await expect(page.getByTestId("agent-status")).toHaveText(REPLAY_LINE);
    await expect(page.getByRole("button", { name: /Re-run|Plan with the agent/ })).toHaveCount(0);
    expect(errors.filter((e) => /hydrat/i.test(e))).toEqual([]);
  });

  test("run=0 shows the engine's plan only", async ({ page }) => {
    await page.goto("/plan?example=folk-duo&run=0");
    await waitForPlan(page);
    await expect(page.getByText("Explanations: from the data")).toBeVisible();
    await expect(page.getByTestId("agent-status")).toHaveText("Planned from Busk Map's scores. The Hive didn't run.");
    await expect(page.getByRole("button", { name: /Re-run|Plan with the agent/ })).toHaveCount(0);
    await expect(page.getByRole("list", { name: "Research, in the order it ran" })).toHaveCount(0);
  });

  test("always sets a plain-AI baseline beside the plan, in three buckets, without changing a score", async ({ page }) => {
    await page.goto("/plan?example=sax");
    await waitForPlan(page);
    const scoresOf = () =>
      page.getByRole("region", { name: "Pitches", exact: true }).locator("button[data-pitch-name]").evaluateAll((els) => els.map((el) => el.querySelector('[aria-label^="Score "]')?.getAttribute("aria-label")));
    const scores = await scoresOf();
    await expect(page.getByRole("heading", { name: "Busk Map vs a plain AI" })).toBeVisible();
    await expect(page.getByTestId("compare-verdict")).toContainText("picks");
    await expect(page.getByTestId("compare-verdict")).toContainText("usual busking pitches");
    const onlyOurs = page.getByRole("region", { name: "Only Busk Map" });
    await expect(onlyOurs.getByText(/^The council's busking layers don't rule it out/).first()).toBeVisible();
    const onlyPlain = page.getByRole("region", { name: "Only plain AI" });
    await expect(onlyPlain.getByText(/Mock plain-LLM answer/).first()).toBeVisible();
    await expect(onlyPlain.getByText(/^(Scored by Busk Map|Not a legal pitch|No data for this spot)$/).first()).toBeVisible();
    // The baseline is a control: the pitch scores are the same once it has arrived.
    await expect(page.getByTestId("agent-status")).toHaveText(MODEL_PLAN);
    expect(await scoresOf()).toEqual(scores);
  });
});
