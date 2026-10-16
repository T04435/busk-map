import { mkdirSync } from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import { expect, LOCAL, MODEL_PLAN, SATURDAY, test, waitForPlan } from "./fixtures";
import { expectNoOverflow, expectOnTop, holdAgentRunning } from "./layout-helpers";

/**
 * Layout at three widths, actually rendered: phone 390, tablet 768, desktop 1440 (user rule).
 *
 * Each test sets its own viewport, so this spec runs in the desktop project only: QA's specs keep their two
 * projects and the run time doesn't triple. Per page and width it checks:
 * - no horizontal page overflow (scrollWidth <= innerWidth + 1 px);
 * - no element's visible box past the viewport, except content clipped inside its own overflow-x container
 *   (the week grid's table scrolls sideways in one);
 * - the main controls are visible and on top (elementFromPoint at their centre);
 * - on plan pages, nothing covers the top-pitch pins (the legend, the zoom buttons, the attribution).
 * Screenshots go to the hackathon folder (screens/layout-<page>-<width>.png), or LAYOUT_SCREENS_DIR.
 */
const WIDTHS = [
  { name: "390", viewport: { width: 390, height: 844 } },
  { name: "768", viewport: { width: 768, height: 1024 } },
  { name: "1440", viewport: { width: 1440, height: 900 } },
] as const;

const SCREENS = process.env.LAYOUT_SCREENS_DIR ?? path.resolve(__dirname, "../../../hackathon/hackathons/qloo-2026/screens");

/** The pitch list buttons beside the map, the top-pitch pins on it, and the legend clear of the pins. */
async function expectPitchesAndPins(page: Page) {
  const list = page.getByRole("region", { name: "Pitches", exact: true }).locator("button[data-pitch-name]");
  await expect(list).toHaveCount(3);
  for (let i = 0; i < 3; i++) await expectOnTop(list.nth(i), `pitch list item ${i + 1}`);

  const map = page.getByRole("region", { name: "Map of pitches and Qloo taste affinity" });
  const pins = map.locator("button[data-pitch-id]");
  await expect(pins).toHaveCount(3);
  await map.scrollIntoViewIfNeeded();
  for (let i = 0; i < 3; i++) await expectOnTop(pins.nth(i), `map pin ${i + 1}`);

  // The legend must not overlap any pin, wherever it is placed.
  const legend = page.getByLabel("Map legend");
  await expect(legend).toBeVisible();
  const box = (await legend.boundingBox())!;
  for (let i = 0; i < 3; i++) {
    const pin = (await pins.nth(i).boundingBox())!;
    const overlaps = pin.x < box.x + box.width && pin.x + pin.width > box.x && pin.y < box.y + box.height && pin.y + pin.height > box.y;
    expect(overlaps, `the map legend covers pin ${i + 1}`).toBe(false);
  }
}

type PageCase = {
  name: string;
  local?: boolean;
  open: (page: Page) => Promise<void>;
  controls: (page: Page) => Promise<void>;
};

const PAGES: PageCase[] = [
  {
    name: "home",
    open: async (page) => {
      await page.goto("/");
      await expect(page.getByRole("heading", { level: 1, name: "Busk Map" })).toBeVisible();
    },
    controls: async (page) => {
      await expectOnTop(page.getByRole("link", { name: /^Soul and funk sax player / }), "example card");
      await expectOnTop(page.getByRole("link", { name: "Plan a busk" }).first(), "Plan a busk");
      await expectOnTop(page.getByRole("link", { name: "Open the brain" }), "Open the brain");
    },
  },
  {
    name: "busks",
    open: async (page) => {
      await page.goto("/busks");
      await expect(page.getByRole("heading", { level: 1, name: "Plan your busk" })).toBeVisible();
      await expect(page.getByRole("form", { name: "Plan for your own act" })).toBeVisible();
    },
    controls: async (page) => {
      await expectOnTop(page.getByRole("link", { name: /^Soul and funk sax player / }), "example card");
      await expectOnTop(page.getByRole("radio", { name: "General permit" }), "General permit");
      await expectOnTop(page.getByRole("button", { name: "Plan my busk" }), "Plan my busk");
    },
  },
  {
    name: "terms",
    open: async (page) => {
      await page.goto("/terms");
      await expect(page.getByText(/^Busk Map never confirms a pitch is legal/)).toBeVisible();
    },
    controls: async (page) => {
      await expectOnTop(page.locator('[data-slot="site-footer"]').getByRole("link", { name: "Privacy" }), "Privacy link");
    },
  },
  {
    name: "privacy",
    open: async (page) => {
      await page.goto("/privacy");
      await expect(page.getByRole("heading", { level: 1, name: /keeps/i })).toBeVisible();
    },
    controls: async (page) => {
      await expectOnTop(page.locator('[data-slot="site-footer"]').getByRole("link", { name: "Terms" }), "Terms link");
    },
  },
  {
    name: "brand",
    open: async (page) => {
      await page.goto("/brand");
      await expect(page.getByRole("heading", { level: 1, name: /Honeycomb/ })).toBeVisible();
    },
    controls: async (page) => {
      await expectOnTop(page.getByRole("link", { name: "Assets" }).first(), "Assets anchor");
    },
  },
  {
    name: "plan",
    local: true,
    open: async (page) => {
      await page.goto("/plan?example=acoustic");
      await expect(page).toHaveURL(/\/p\/[0-9A-Za-z]{9}$/);
      await waitForPlan(page);
      await expect(page.getByTestId("agent-status")).toHaveText(MODEL_PLAN);
    },
    controls: async (page) => {
      await expectOnTop(page.getByTestId("copy-link"), "Copy link");
      await expectPitchesAndPins(page);
    },
  },
  {
    name: "plan-running",
    local: true,
    open: async (page) => {
      await holdAgentRunning(page);
      await page.goto("/plan?example=sax");
      await expect(page).toHaveURL(/\/p\/[0-9A-Za-z]{9}$/);
      await expect(page.getByTestId("plan-pending")).toBeVisible();
      await expect(page.getByRole("list", { name: "Research, newest first" }).getByRole("listitem").first()).toBeVisible();
    },
    controls: async (page) => {
      // R01: no Copy link until the busk exists.
      await expect(page.getByTestId("copy-link")).toHaveCount(0);
      await expectOnTop(page.getByTestId("agent-status"), "the status line");
    },
  },
  {
    name: "replay",
    local: true,
    open: async (page) => {
      await page.goto("/plan?example=folk-duo");
      await expect(page).toHaveURL(/\/p\/[0-9A-Za-z]{9}$/);
      await waitForPlan(page);
      await page.reload();
      await expect(page.getByTestId("replay-label")).toBeVisible();
      await waitForPlan(page);
    },
    controls: async (page) => {
      await expectOnTop(page.getByTestId("copy-link"), "Copy link");
      await expectOnTop(page.getByText(/^Every check, from earlier/), "Every check, from earlier");
      await expectPitchesAndPins(page);
    },
  },
  {
    name: "plan-qloo-down",
    local: true,
    open: async (page) => {
      await page.goto("/plan?example=acoustic&faults=qloo");
      await expect(page.getByRole("heading", { name: "No plan without taste data" })).toBeVisible();
    },
    controls: async (page) => {
      await expectOnTop(page.getByTestId("qloo-down").getByRole("button", { name: "Try again" }), "Try again");
    },
  },
  {
    name: "plan-no-match",
    local: true,
    open: async (page) => {
      await page.goto(`/plan?name=Nobody%20Knows&artists=Zzyzx%20Nobody|Qqq%20Unknown&date=${SATURDAY}&from=18&to=21`);
      await waitForPlan(page);
      await expect(page.getByTestId("unmatched-artists")).toBeVisible();
    },
    controls: async (page) => {
      await expectPitchesAndPins(page);
    },
  },
  {
    name: "plan-no-pitch",
    local: true,
    open: async (page) => {
      await page.goto("/plan?example=sax&faults=pitches,footfall");
      await expect(page.getByRole("heading", { name: /^No legal pitch for/i })).toBeVisible();
    },
    controls: async (page) => {
      await expect(page.getByRole("link", { name: "Read the council's busking rules" })).toBeVisible();
    },
  },
  {
    name: "plan-source-down",
    local: true,
    open: async (page) => {
      await page.goto("/plan?example=acoustic&faults=footfall,events,weather");
      await waitForPlan(page);
      await expect(page.getByTestId("source-down")).toBeVisible();
    },
    controls: async (page) => {
      await expectPitchesAndPins(page);
    },
  },
  {
    name: "plan-slot-passed",
    local: true,
    open: async (page) => {
      await page.goto("/plan?name=Past%20Slot%20Duo&artists=Paul%20Kelly&date=2026-10-03&from=12&to=15&permit=premium");
      await expect(page.getByTestId("slot-passed")).toBeVisible();
    },
    controls: async (page) => {
      await expectOnTop(page.getByRole("link", { name: "Plan again for a new date" }), "Plan again for a new date");
    },
  },
  {
    name: "plan-not-found",
    open: async (page) => {
      await page.goto("/p/ZZZZZZZZZ");
      await expect(page.getByTestId("plan-not-found")).toBeVisible();
    },
    controls: async (page) => {
      await expectOnTop(page.getByRole("link", { name: "Go to Busk Map home" }), "Go to Busk Map home");
    },
  },
  {
    name: "plan-sheet",
    local: true,
    open: async (page) => {
      await page.goto("/plan?example=folk-duo");
      await waitForPlan(page);
      await page.getByRole("region", { name: "Pitches", exact: true }).getByRole("button", { name: /^Full details/ }).first().click();
      await expect(page.getByRole("dialog")).toBeVisible();
    },
    controls: async (page) => {
      await expectOnTop(page.getByRole("button", { name: "Close" }), "Close the sheet");
    },
  },
  {
    name: "brain",
    open: async (page) => {
      await page.goto("/brain");
      await expect(page.getByRole("heading", { level: 1, name: /Qloo/ })).toBeVisible();
    },
    controls: async (page) => {
      await expectOnTop(page.locator('[data-node-id="c1"]'), "first Qloo call");
      await expectOnTop(page.locator('[data-node-id="ticketmaster"]'), "Ticketmaster");
      await expectOnTop(page.locator('[data-node-id="f_agent"]'), "last feature");
      await expectOnTop(page.getByRole("link", { name: "Back to Busk Map" }), "Back to Busk Map");
    },
  },
  {
    name: "not-found",
    open: async (page) => {
      await page.goto("/this-is-not-a-pitch");
      await expect(page.getByTestId("site-not-found")).toBeVisible();
    },
    controls: async (page) => {
      await expectOnTop(page.getByRole("link", { name: "Try an example plan" }), "Try an example plan");
      await expectOnTop(page.getByRole("link", { name: "Go to Busk Map home" }), "Go to Busk Map home");
    },
  },
  {
    name: "error",
    local: true,
    open: async (page) => {
      await page.goto("/plan?example=acoustic&faults=render");
      await expect(page.getByTestId("route-error")).toBeVisible();
    },
    controls: async (page) => {
      await expectOnTop(page.getByRole("button", { name: "Try again" }), "Try again");
      await expectOnTop(page.getByRole("link", { name: "Go home" }), "Go home");
    },
  },
  {
    name: "rate-limit",
    local: true,
    open: async (page) => {
      await page.goto("/plan?example=sax&faults=fresh-limit");
      await expect(page.getByTestId("fresh-limit")).toBeVisible();
    },
    controls: async (page) => {
      await expectOnTop(page.getByRole("link", { name: "Back to Busk Map home" }), "Back to Busk Map home");
    },
  },
];

test.describe("layout at phone, tablet and desktop widths", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Sets its own viewports: runs once, in the desktop project");
  });
  test.beforeAll(() => mkdirSync(SCREENS, { recursive: true }));

  for (const width of WIDTHS) {
    test.describe(`${width.name} px`, () => {
      test.use({ viewport: width.viewport });

      for (const p of PAGES) {
        test(`${p.name}: no sideways overflow, controls on top`, async ({ page }) => {
          if (p.local) test.skip(!LOCAL, "Mock agent or test faults: local offline server only");
          await p.open(page);
          await expectNoOverflow(page);
          await p.controls(page);
          // Back to the top for the screenshot, and once more after any scrolling the checks did.
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.screenshot({ path: path.join(SCREENS, `layout-${p.name}-${width.name}.png`), fullPage: true });
          await expectNoOverflow(page);
        });
      }
    });
  }
});
