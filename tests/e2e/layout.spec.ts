import { mkdirSync } from "node:fs";
import path from "node:path";
import type { Locator, Page } from "@playwright/test";
import { expect, LOCAL, test, waitForPlan } from "./fixtures";

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

type Overflow = { what: string; left: number; right: number };

/** Elements whose visible box (after clipping by overflow containers) leaves the viewport horizontally. */
async function overflowingElements(page: Page): Promise<Overflow[]> {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const out: { what: string; left: number; right: number }[] = [];
    for (const el of Array.from(document.body.querySelectorAll("*"))) {
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden" || style.display === "contents") continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      let left = r.left;
      let right = r.right;
      // Clip by every ancestor that clips horizontally (overflow-x other than visible): a sideways scroller,
      // the map's own container. Its content may be wider; the container itself is checked as an element.
      for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) {
        const ox = getComputedStyle(a).overflowX;
        if (ox === "visible") continue;
        const ar = a.getBoundingClientRect();
        left = Math.max(left, ar.left);
        right = Math.min(right, ar.right);
      }
      if (right <= left) continue;
      if (left < -1 || right > vw + 1) {
        const id = el.getAttribute("data-testid") ?? el.getAttribute("aria-label") ?? el.id;
        const text = (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 50);
        out.push({ what: `${el.tagName.toLowerCase()}${id ? `[${id}]` : ""} "${text}"`, left: Math.round(left), right: Math.round(right) });
      }
    }
    return out;
  });
}

async function expectNoOverflow(page: Page) {
  const size = await page.evaluate(() => ({
    scroll: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
    inner: window.innerWidth,
  }));
  expect(size.scroll, "horizontal page overflow").toBeLessThanOrEqual(size.inner + 1);
  // Report only the outermost offenders: a too-wide box drags its children with it.
  const offenders = await overflowingElements(page);
  expect(offenders.slice(0, 10), "elements past the viewport").toEqual([]);
  expect(await clippedPlaceholders(page), "placeholders cut off by a too-narrow field").toEqual([]);
}

/** Empty, visible text fields whose placeholder is wider than the field: the hint is cut off. */
async function clippedPlaceholders(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const ctx = document.createElement("canvas").getContext("2d")!;
    const out: string[] = [];
    for (const input of Array.from(document.querySelectorAll<HTMLInputElement>("input[placeholder]"))) {
      if (input.value || input.offsetParent === null) continue;
      const style = getComputedStyle(input);
      ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const available = input.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      if (ctx.measureText(input.placeholder).width > available + 1) out.push(`${input.getAttribute("aria-label") ?? input.id}: "${input.placeholder}"`);
    }
    return out;
  });
}

/** Visible, in view and on top: the element at its centre is the control itself or inside it. */
async function expectOnTop(control: Locator, what: string) {
  await control.scrollIntoViewIfNeeded();
  await expect(control, what).toBeVisible();
  await expect
    .poll(
      () =>
        control.evaluate((el) => {
          const r = el.getBoundingClientRect();
          const x = r.left + r.width / 2;
          const y = r.top + r.height / 2;
          if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return `centre out of view (${Math.round(x)}, ${Math.round(y)})`;
          const hit = document.elementFromPoint(x, y);
          return hit && (hit === el || el.contains(hit)) ? "on top" : `covered by ${hit?.outerHTML.slice(0, 140) ?? "nothing"}`;
        }),
      { message: `${what} is covered or out of view`, timeout: 5_000 },
    )
    .toBe("on top");
}

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

/**
 * Holds the agent mid-run: the page's /api/plan stream delivers the real events up to the last step started,
 * then stays open. No plan or usage event arrives, so the page shows the agent running.
 */
async function holdAgentRunning(page: Page) {
  await page.addInitScript(() => {
    const original = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (new URL(url, location.href).pathname !== "/api/plan") return original(input, init);
      const response = await original(input, init);
      const lines = (await response.text()).split("\n").filter(Boolean);
      const lastStart = lines.findLastIndex((line) => (JSON.parse(line) as { type: string }).type === "tool-start");
      const kept = lines.slice(0, lastStart + 1).map((line) => `${line}\n`).join("");
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(kept)); // and never close: the run is still going
        },
      });
      return new Response(body, { status: response.status, headers: { "Content-Type": "application/x-ndjson" } });
    };
  });
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
      await expectOnTop(page.getByRole("button", { name: "Plan my set" }), "Plan my set");
      await expectOnTop(page.getByRole("link", { name: "Open the brain" }), "Open the brain");
    },
  },
  {
    name: "plan",
    local: true,
    open: async (page) => {
      await page.goto("/plan?example=acoustic");
      await expect(page).toHaveURL(/\/p\/[0-9A-Za-z]{9}$/);
      await waitForPlan(page);
      await expect(page.getByTestId("agent-status")).toHaveText("The agent's plan.");
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
      await expect(page.getByRole("list", { name: "Agent steps" }).getByRole("listitem").first()).toBeVisible();
    },
    controls: async (page) => {
      await expectOnTop(page.getByTestId("copy-link"), "Copy link");
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
      await expectOnTop(page.getByRole("button", { name: /^Agent steps \(replayed, \d+\)$/ }), "Agent steps (replayed)");
      await expectPitchesAndPins(page);
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
      await expectOnTop(page.getByRole("link", { name: "Busk Map home" }), "Busk Map home");
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
