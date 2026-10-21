import type { Locator, Page } from "@playwright/test";
import { expect } from "./fixtures";

type Overflow = { what: string; left: number; right: number };

/** Elements whose visible box (after clipping by overflow containers) leaves the viewport horizontally. */
export async function overflowingElements(page: Page): Promise<Overflow[]> {
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

export async function expectNoOverflow(page: Page) {
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
export async function expectOnTop(control: Locator, what: string) {
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
      { message: `${what} is covered or out of view`, timeout: 15_000 },
    )
    .toBe("on top");
}

/**
 * Holds the agent mid-run: the page's /api/plan stream delivers the real events up to the last step started,
 * then stays open. No plan or usage event arrives, so the page shows the agent running.
 */
export async function holdAgentRunning(page: Page) {
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


/** The three widths every layout and axe test runs at, one test per width, in the desktop project only. */
export const WIDTHS = [390, 768, 1440] as const;
