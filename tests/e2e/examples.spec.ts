import { EXAMPLES } from "../../src/lib/examples";
import { AGENT_KEPT_TOP3, agentSteps, CLAUDE_CREDIT, EXPLAINED_BY, EXPLANATIONS_LABEL, expect, LOCAL, MODEL_NOTE_PREFIX, SATURDAY, test, waitForPlan } from "./fixtures";

test.describe("landing", () => {
  test("shows the three example performers and the own-act form", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Busk Map" })).toBeVisible();
    for (const example of EXAMPLES) await expect(page.getByRole("link", { name: new RegExp(`^${example.label} `) })).toBeVisible();
    await expect(page.getByRole("form", { name: "Plan for your own act" })).toBeVisible();
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
      await expect(page.getByRole("heading", { name: /^Setlist for / })).toBeVisible();
      // The agent starts on load and the plan appears when it ends, with Claude's explanations (mock model offline).
      const steps = await agentSteps(page);
      if (LOCAL) {
        // The mock model wrote these: no Claude chip and no Claude credit (B-007).
        await expect(page.getByText(EXPLANATIONS_LABEL)).toBeVisible();
        await expect(page.getByText("Explanations: Claude")).toHaveCount(0);
        await expect(page.getByRole("link", { name: CLAUDE_CREDIT })).toHaveCount(0);
        // Nor do the steps, Agent vs engine, the pitch card or the plain-AI panel (B-010).
        await expect(page.getByText(EXPLAINED_BY)).toBeVisible();
        await expect(page.getByTestId("agent-vs-engine")).toContainText(AGENT_KEPT_TOP3);
        await expect(page.getByText(/sent to the test model \(offline\) with no tools/)).toBeVisible();
        await expect(steps.getByTestId("agent-note-text").first()).toContainText(MODEL_NOTE_PREFIX);
        await expect(page.getByText(/Claude/)).toHaveCount(0);
      }
      // Every data source is credited.
      for (const credit of ["Taste data by Qloo", "Pedestrian counts: City of Melbourne Open Data", "Weather data by Open-Meteo.com"]) {
        await expect(page.getByRole("link", { name: credit })).toBeVisible();
      }
      // Offline runs use the Qloo mock and say so; a deploy with the key says Live, never "test data".
      if (LOCAL) await expect(page.getByText("Qloo test data (local mock)").first()).toBeVisible();
      else {
        await expect(page.getByText("Live Qloo data").first()).toBeVisible();
        await expect(page.getByText(/Qloo test data/)).toHaveCount(0);
      }
    });

    test("selects a pitch from the keyboard and keeps it in the URL", async ({ page }) => {
      await page.goto(`/plan?example=${example.id}`);
      await waitForPlan(page);
      const second = page.getByRole("region", { name: "Pitches", exact: true }).locator("button[data-pitch-name]").nth(1);
      const name = (await second.getAttribute("data-pitch-name"))!;
      await second.focus();
      await page.keyboard.press("Enter");
      await expect(second).toHaveAttribute("aria-pressed", "true");
      await expect(page).toHaveURL(/pitch=/);
      await expect(page.getByRole("heading", { name: `Setlist for ${name}` })).toBeVisible();

      // The selection survives a reload (shareable link).
      await page.reload();
      await expect(page.getByRole("heading", { name: `Setlist for ${name}` })).toBeVisible();
    });
  });
}

test.describe("data-led plans", () => {
  test("the three examples get different top pitches, each with a hidden gem and Qloo's reasons", async ({ page }) => {
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
        await page.getByRole("button", { name: /^Other scored pitches/ }).click();
        const scored = (await page.getByRole("button", { name: /^Other scored pitches/ }).locator("xpath=..").getByRole("listitem").allInnerTexts()).join("\n");
        for (const hotspot of ["Federation Wharf", "Degraves Street", "Federation Square", "Flinders St / Elizabeth St corner"]) expect(scored).toContain(`${hotspot} · usual spot`);
      }
      await expect(page.getByRole("region", { name: "Pitches", exact: true }).getByText("Hidden gem").first()).toBeVisible();
      await expect(page.getByTestId("plan-funnel")).toContainText("Qloo mapped your taste");
      await expect(page.getByRole("heading", { name: "Who this crowd likes" })).toBeVisible();
      await expect(page.getByText(/^Because your fans like /).first()).toBeVisible();
      await expect(page.getByLabel("Map legend")).toContainText("Taste map (Qloo heatmap");
      // Why this crowd: every block names its Qloo evidence; fans vs the usual crowd; age lean.
      const crowd = page.getByRole("region", { name: "Compared with the usual crowd" });
      await expect(crowd.getByRole("heading", { name: "Your fans vs the usual crowd" })).toBeVisible();
      await expect(crowd.getByText(/^Evidence: Qloo insights/)).toBeVisible();
      await expect(page.getByRole("heading", { name: "Who your fans are" })).toBeVisible();
      // What to play: songs carry their year and era fit.
      await expect(page.getByText(/from \d{4}: a (strong|good|fair|weak) era fit for a crowd leaning /).first()).toBeVisible();
      await expect(page.getByText(/era fit \d+\/100/)).toHaveCount(0);
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
    await expect(page.getByTestId("agent-status")).toHaveText(/The plan appears when it finishes/);
    await expect(page.getByRole("region", { name: "Pitches", exact: true })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /^Setlist for / })).toHaveCount(0);
    await expect(page.getByText(/^Explanations: /)).toHaveCount(0);
    release();

    // Each step: Claude's note before the call, the tool and the inputs it chose, the data source, and the data returned.
    const steps = page.getByRole("list", { name: "Agent steps" });
    await expect(steps.getByText("Where the act's taste concentrates")).toBeVisible();
    await expect(steps.getByText("I'll start with the taste map to see where this act's fans concentrate.")).toBeVisible();
    await expect(steps.getByText("Qloo /v2/insights · urn:heatmap")).toBeVisible();
    await expect(steps.getByText("Scoring the pitch pool").first()).toBeVisible();
    await expect(steps.getByTestId("agent-note-reasoning").first()).toContainText("Thinking (summary):");
    const crowd = steps.locator('[data-tool="crowd_at"]');
    await expect(crowd.first()).toContainText("radiusM: 400");
    await waitForPlan(page);
    await crowd.first().getByRole("button", { name: "Data returned" }).click();
    await expect(crowd.first().getByTestId("agent-step-data").getByRole("table").first()).toBeVisible();
    await expect(crowd.first().getByTestId("agent-step-data").getByRole("columnheader", { name: "because" })).toBeVisible();
    await expect(steps.locator('[data-tool="finish_plan"]')).toContainText("Accepted:");
    await expect(page.getByTestId("agent-usage")).toContainText("model steps");
    // Agent vs engine: the mock keeps the engine's top 3.
    await expect(page.getByTestId("agent-vs-engine")).toContainText("Agent vs engine");
    await expect(page.getByTestId("agent-vs-engine")).toContainText(AGENT_KEPT_TOP3);
    await expect(steps.getByTestId("agent-note-text").first()).toContainText(MODEL_NOTE_PREFIX);
    // Claude investigates first: score_pitches comes after three looks, one of them about the crowd.
    const order = await steps.getByTestId("agent-step").evaluateAll((els) => els.map((el) => el.getAttribute("data-tool")).filter(Boolean));
    expect(order.indexOf("score_pitches")).toBeGreaterThanOrEqual(3);
    expect(order.slice(0, order.indexOf("score_pitches")).some((t) => ["taste_map", "crowd_at", "events_near"].includes(t!))).toBe(true);
    await expect(page.getByTestId("plan-pending")).toHaveCount(0);
    await expect(page.getByText(EXPLANATIONS_LABEL)).toBeVisible();
    await expect(page.getByText(/^Mock explanation/).first()).toBeVisible();
    await expect(page.getByTestId("agent-fallback")).toHaveCount(0);

    // A reload replays the finished run: the plan at once, the steps collapsed and marked as replayed.
    await page.unroute("**/api/plan");
    await page.reload();
    await waitForPlan(page);
    await expect(page.getByText(/^Replaying the agent's run from .* \(cached, no new model call\)$/)).toBeVisible();
    await expect(page.getByText(EXPLANATIONS_LABEL)).toBeVisible();
    await expect(page.getByRole("list", { name: "Agent steps" })).toHaveCount(0);
    await page.getByRole("button", { name: /^Agent steps \(replayed, \d+\)$/ }).click();
    const replayedSteps = page.getByRole("list", { name: "Agent steps" });
    await expect(replayedSteps.getByText("Scoring the pitch pool").first()).toBeVisible();
    // The replay keeps each step's data.
    await replayedSteps.locator('[data-tool="taste_map"]').getByRole("button", { name: "Data returned" }).click();
    await expect(replayedSteps.locator('[data-tool="taste_map"]').getByTestId("agent-step-data").getByRole("columnheader", { name: "affinity" })).toBeVisible();

    // Buskers get no re-run button: a reload replays.
    await expect(page.getByTestId("agent-status")).toHaveText("The agent's plan, replayed.");
    await expect(page.getByRole("button", { name: /Re-run|Plan with the agent/ })).toHaveCount(0);
    expect(errors.filter((e) => /hydrat/i.test(e))).toEqual([]);
  });

  test("run=0 shows the engine's plan only", async ({ page }) => {
    await page.goto("/plan?example=folk-duo&run=0");
    await waitForPlan(page);
    await expect(page.getByText("Explanations: from the data")).toBeVisible();
    await expect(page.getByTestId("agent-status")).toHaveText("Shown: the engine's plan from the data, without the agent.");
    await expect(page.getByRole("button", { name: /Re-run|Plan with the agent/ })).toHaveCount(0);
    await expect(page.getByRole("list", { name: "Agent steps" })).toHaveCount(0);
  });

  test("always sets a plain-AI baseline beside the plan, in three buckets, without changing a score", async ({ page }) => {
    await page.goto("/plan?example=sax");
    await waitForPlan(page);
    const scores = await page.getByRole("region", { name: "Pitches", exact: true }).locator("button[data-pitch-name]").allTextContents();
    await expect(page.getByRole("heading", { name: "Busk Map vs a plain AI" })).toBeVisible();
    await expect(page.getByTestId("compare-verdict")).toContainText("picks");
    await expect(page.getByTestId("compare-verdict")).toContainText("usual busking spots");
    const onlyOurs = page.getByRole("region", { name: "Only Busk Map" });
    await expect(onlyOurs.getByText(/^The council's busking layers don't rule it out/).first()).toBeVisible();
    const onlyPlain = page.getByRole("region", { name: "Only plain AI" });
    await expect(onlyPlain.getByText(/Mock plain-LLM answer/).first()).toBeVisible();
    await expect(onlyPlain.getByText(/^(Scored by Busk Map|Not a legal pitch|No data for this spot)$/).first()).toBeVisible();
    // The baseline is a control: the pitch scores are the same once it has arrived.
    await expect(page.getByTestId("agent-status")).toHaveText(/^The agent's plan/);
    const after = await page.getByRole("region", { name: "Pitches", exact: true }).locator("button[data-pitch-name]").allTextContents();
    expect(after.map((t) => t.match(/\d+\/100/)?.[0])).toEqual(scores.map((t) => t.match(/\d+\/100/)?.[0]));
  });
});
