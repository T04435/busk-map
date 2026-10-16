import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { holdAgentRunning } from "./layout-helpers";
import { agentSteps, expect, LOCAL, openDetails, SATURDAY, showRawData, test, waitForPlan } from "./fixtures";

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"];

test.describe("pitch details sheet", () => {
  test.skip(!LOCAL, "Runs the mock agent; local offline server only");

  test("opens from Full details, traps focus, closes with Escape and the close button, and returns focus", async ({ page }) => {
    await page.goto("/plan?example=acoustic");
    await waitForPlan(page);
    const opener = page.getByRole("region", { name: "Pitches", exact: true }).getByRole("listitem").first().getByRole("button", { name: /^Full details/ });
    await opener.focus();
    await page.keyboard.press("Enter");
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    await expect(page).toHaveURL(/pitch=/);
    // The four parts: the pitch card, the suggested set, the crowd and the weights.
    await expect(sheet.getByTestId("pitch-card")).toBeVisible();
    await expect(sheet.getByRole("region", { name: "Suggested set" })).toBeVisible();
    await expect(sheet.getByRole("region", { name: "Who this crowd likes" })).toBeVisible();
    await sheet.getByText("How this score adds up").click();
    await expect(sheet.getByRole("region", { name: "How pitches are scored" })).toBeVisible();
    await expect(sheet.getByRole("region", { name: "Foot traffic by hour" })).toBeVisible();
    // Focus is inside the sheet and stays there while tabbing.
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("Tab");
      expect(await sheet.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    }
    // Learn it appears on "Learn these" only.
    await expect(sheet.getByRole("region", { name: "Learn these" }).getByRole("button", { name: /^Learn it/ }).first()).toBeVisible();
    await expect(sheet.getByRole("region", { name: "Suggested set" }).getByRole("list").first().getByRole("button", { name: /^Learn it/ })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(sheet).toHaveCount(0);
    await expect(page).not.toHaveURL(/pitch=/);
    await expect(opener).toBeFocused();

    await opener.click();
    await sheet.getByRole("button", { name: "Close" }).click();
    await expect(sheet).toHaveCount(0);
    await expect(page).not.toHaveURL(/pitch=/);
  });

  test("?pitch= opens the sheet on that pitch, and closing it clears the parameter", async ({ page }) => {
    await page.goto("/plan?example=sax");
    await waitForPlan(page);
    const rows = page.getByRole("region", { name: "Pitches", exact: true }).getByRole("listitem");
    const id = await rows.nth(2).getAttribute("data-pitch-id");
    const name = await rows.nth(2).locator("button[data-pitch-name]").getAttribute("data-pitch-name");
    const base = new URL(page.url());
    await page.goto(`${base.pathname}?pitch=${id}`);
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByRole("heading", { name: new RegExp(`^${name}$`, "i") }).first()).toBeVisible();
    await expect(sheet.getByRole("heading", { name: "Setlist for this pitch" })).toBeVisible();
    // The pitch that opened it is the selected one behind it.
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(new RegExp(`${base.pathname}$`));
    await expect(rows.nth(2).locator("button[data-pitch-name]")).toHaveAttribute("aria-pressed", "true");
  });
});

test.describe("other scored pitches are dots on the map", () => {
  test.skip(!LOCAL, "The scores depend on the offline fixtures");

  test("the list is gone; a dot opens a summary from the keyboard and Escape returns focus to it", async ({ page }) => {
    await page.goto("/plan?example=acoustic");
    await waitForPlan(page);
    await expect(page.getByRole("button", { name: /^Other scored pitches/ })).toHaveCount(0);
    await page.getByRole("region", { name: "Map of pitches and Qloo taste affinity" }).scrollIntoViewIfNeeded();
    // The dots are drawn for the mouse; the keyboard and screen readers get one control that steps through them.
    await expect(page.getByTestId("other-dot").first()).toBeAttached();
    await expect(page.getByTestId("other-dot").first()).toHaveAttribute("aria-hidden", "true");
    const browse = page.getByTestId("browse-others");
    await browse.focus();
    await expect(browse).toBeFocused();
    await page.keyboard.press("Space");
    const popover = page.getByTestId("other-pitch-popover");
    await expect(popover).toBeVisible();
    await expect(popover.getByRole("img", { name: /^Score \d+ out of 100$/ })).toBeVisible();
    for (let i = 0; i < 40 && (await popover.getByTestId("too-close").count()) === 0; i++) await page.getByRole("button", { name: "Next pitch" }).click();
    await expect(popover.getByTestId("too-close")).toContainText(/^Too close to /);
    await page.keyboard.press("Escape");
    await expect(popover).toHaveCount(0);
    await expect(browse).toBeFocused();
    // Clicking a dot opens the same summary.
    await page.getByTestId("other-dot").first().click({ force: true });
    await expect(popover).toBeVisible();
    await page.getByRole("button", { name: "Close summary" }).click();
    // No events or no-busking zones on the map: only top pins and dots.
    await expect(page.getByLabel("Map legend")).not.toContainText(/event|no busking/i);
  });
});

test.describe("the plan map draws the taste cells even with no tiles (offline)", () => {
  test.skip(!LOCAL, "The scores depend on the offline fixtures");

  test("with the tile style blocked, the mock heatmap still draws orange cells", async ({ page }) => {
    await page.route(/openfreemap\.org/, (route) => route.abort());
    await page.goto("/plan?example=acoustic");
    await waitForPlan(page);
    await page.locator('[data-slot="map-frame"]').scrollIntoViewIfNeeded();
    const cells = page.locator("[data-taste-cells]");
    await expect.poll(async () => ((await cells.count()) ? Number(await cells.first().getAttribute("data-taste-cells")) : -1), { timeout: 20_000 }).toBeGreaterThan(0);
    await expect(page.getByLabel("Map legend")).toContainText("Taste match");
    await expect(page.locator("button[data-pitch-id]")).toHaveCount(3);
  });

  test("no matched artist: no taste cells, no taste in the legend", async ({ page }) => {
    await page.goto(`/plan?name=Nobody%20Knows&artists=Zzyzx%20Nobody|Qqq%20Unknown&date=${SATURDAY}&from=18&to=21`);
    await waitForPlan(page);
    await page.locator('[data-slot="map-frame"]').scrollIntoViewIfNeeded();
    const cells = page.locator("[data-taste-cells]");
    await expect.poll(async () => ((await cells.count()) ? await cells.first().getAttribute("data-taste-cells") : null), { timeout: 20_000 }).toBe("0");
    await expect(page.getByLabel("Map legend")).not.toContainText("Taste match");
  });
});

test.describe("the research feed", () => {
  test.skip(!LOCAL, "Runs the mock agent; local offline server only");

  test("raw data (tool names, inputs and JSON) sit behind the Show raw data switch", async ({ page }) => {
    await page.goto("/plan?example=folk-duo");
    await waitForPlan(page);
    const feed = await agentSteps(page);
    const toggle = page.getByRole("switch", { name: "Show raw data" });
    await expect(toggle).not.toBeChecked();
    await expect(feed.locator("code")).toHaveCount(0);
    await expect(feed.getByTestId("agent-step-data")).toHaveCount(0);
    await showRawData(page);
    await expect(feed.locator("code").first()).toBeVisible();
    await expect(feed.getByTestId("agent-step-data").first()).toBeAttached();
    await page.getByRole("button", { name: "JSON" }).click();
    await expect(feed.locator("pre").first()).toBeVisible();
    await toggle.click();
    await expect(feed.locator("code")).toHaveCount(0);
  });

  test("while the agent runs there is no raw switch, and the checks are plain words", async ({ page }) => {
    await holdAgentRunning(page);
    await page.goto("/plan?example=sax");
    await expect(page.getByTestId("plan-pending")).toBeVisible();
    await expect(page.getByTestId("agent-tag")).toHaveText("Live");
    await expect(page.getByRole("list", { name: "Research, newest first" }).getByRole("listitem").first()).toBeVisible();
    await expect(page.getByRole("switch", { name: "Show raw data" })).toHaveCount(0);
    await expect(page.getByTestId("plan-funnel")).toBeVisible();
  });

  test("a replay carries the replay badge and folds its checks", async ({ page }) => {
    await page.goto("/plan?example=folk-duo");
    await waitForPlan(page);
    await page.reload();
    await waitForPlan(page);
    await expect(page.getByTestId("replay-label")).toHaveText("Replay of an earlier run (no new model call)");
    await expect(page.getByTestId("agent-tag")).toHaveText("Replay");
    await expect(page.getByText(/^Every check, from earlier/)).toBeVisible();
  });

  test("the funnel fills from the totals", async ({ page }) => {
    await page.goto("/plan?example=acoustic");
    await waitForPlan(page);
    const funnel = page.getByTestId("plan-funnel");
    await expect(funnel.getByRole("img", { name: /^\d+ data points$/ })).toBeVisible();
    await expect(funnel.getByRole("img", { name: /taste cells? mapped \(Qloo\)$/ })).toBeVisible();
    await expect(funnel.getByRole("img", { name: /pitches scored \(Busk Map\)$/ })).toBeVisible();
    await expect(funnel.getByRole("img", { name: /^\d+ pitches for your busk$/ })).toBeVisible();
  });
});

test.describe("/p/<unknown id>", () => {
  test("says We can't find this busk, with a way home", async ({ page }) => {
    await page.goto("/p/ZZZZZZZZZ");
    const card = page.getByTestId("plan-not-found");
    await expect(card.getByRole("heading", { level: 1, name: "We can't find this busk" })).toBeVisible();
    await expect(card).toContainText("start a new busk");
    await expect(card.getByRole("link", { name: "Go to Busk Map home" })).toHaveAttribute("href", "/");
  });
});

// WCAG 2.2 AA on every plan state at the three widths, day and night.
const WIDTHS = [
  { name: "390", viewport: { width: 390, height: 844 } },
  { name: "768", viewport: { width: 768, height: 1024 } },
  { name: "1440", viewport: { width: 1440, height: 900 } },
] as const;

const STATES: { name: string; open: (page: Page) => Promise<void> }[] = [
  { name: "plan ready", open: async (p) => { await p.goto("/plan?example=acoustic"); await waitForPlan(p); } },
  { name: "sheet open", open: async (p) => { await p.goto("/plan?example=folk-duo"); await waitForPlan(p); await openDetails(p); } },
  { name: "dot popover", open: async (p) => { await p.goto("/plan?example=acoustic"); await waitForPlan(p); await p.getByTestId("browse-others").scrollIntoViewIfNeeded(); await p.getByTestId("browse-others").focus(); await p.keyboard.press("Enter"); await expect(p.getByTestId("other-pitch-popover")).toBeVisible(); } },
  { name: "raw data on", open: async (p) => { await p.goto("/plan?example=sax"); await waitForPlan(p); await showRawData(p); } },
  { name: "replay", open: async (p) => { await p.goto("/plan?example=folk-duo"); await waitForPlan(p); await p.reload(); await waitForPlan(p); } },
  { name: "qloo down", open: async (p) => { await p.goto("/plan?example=acoustic&faults=qloo"); await expect(p.getByRole("heading", { name: "No plan without taste data" })).toBeVisible(); } },
  { name: "no artist matched", open: async (p) => { await p.goto(`/plan?name=Nobody%20Knows&artists=Zzyzx%20Nobody|Qqq%20Unknown&date=${SATURDAY}&from=18&to=21`); await waitForPlan(p); } },
  { name: "no legal pitch", open: async (p) => { await p.goto("/plan?example=sax&faults=pitches,footfall"); await expect(p.getByRole("heading", { name: /^No legal pitch for/i })).toBeVisible(); } },
  { name: "researching", open: async (p) => { await p.emulateMedia({ reducedMotion: "reduce" }); await holdAgentRunning(p); await p.goto("/plan?example=sax"); await expect(p.getByTestId("plan-pending")).toBeVisible(); } },
  { name: "claude ran out of time (fallback)", open: async (p) => { await p.route("**/api/plan", (r) => r.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: { message: "The planner is unavailable right now." } }) })); await p.goto("/plan?example=acoustic"); await waitForPlan(p); await expect(p.getByTestId("agent-fallback")).toBeVisible(); } },
  { name: "source down", open: async (p) => { await p.goto("/plan?example=acoustic&faults=footfall,events,weather"); await waitForPlan(p); } },
  { name: "slot passed", open: async (p) => { await p.goto("/plan?name=Past%20Slot%20Duo&artists=Paul%20Kelly&date=2026-10-03&from=12&to=15&permit=premium"); await expect(p.getByTestId("slot-passed")).toBeVisible(); } },
  { name: "run limit", open: async (p) => { await p.goto("/plan?example=sax&faults=fresh-limit"); await expect(p.getByTestId("fresh-limit")).toBeVisible(); } },
  { name: "not found", open: async (p) => { await p.goto("/p/ZZZZZZZZZ"); await expect(p.getByTestId("plan-not-found")).toBeVisible(); } },
];

test.describe("plan states: axe, no sideways scroll", () => {
  test.skip(!LOCAL, "Mock agent and fault switches: local offline server only");
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Sets its own viewports: runs once, in the desktop project");
  });
  for (const width of WIDTHS) {
    for (const scheme of ["light", "dark"] as const) {
      test.describe(`${width.name} px, ${scheme}`, () => {
        test.use({ viewport: width.viewport, colorScheme: scheme });
        for (const state of STATES) {
          test(state.name, async ({ page }) => {
            await state.open(page);
            const size = await page.evaluate(() => ({ scroll: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth), inner: window.innerWidth }));
            expect(size.scroll, "horizontal page overflow").toBeLessThanOrEqual(size.inner + 1);
            const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
            expect(violations.map((v) => `${v.impact} ${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
          });
        }
      });
    }
  }
});
