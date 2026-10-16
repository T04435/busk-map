import { test as base, expect } from "@playwright/test";

/** Fault injection and offline fixtures exist only on the local test server. */
export const LOCAL = !process.env.PLAYWRIGHT_BASE_URL;

/** The explanations chip: the local offline server's mock model says so; a deploy's Claude says Claude (B-007). */
export const EXPLANATIONS_LABEL = LOCAL ? "Explanations: test model (offline)" : "Explanations: Claude";
/** The Data sources credit for Claude, shown only when Claude wrote the explanations. */
export const CLAUDE_CREDIT = "Plan explanations written by Claude (Anthropic) via Vercel AI Gateway";

export const test = base;
export { expect };

export async function waitForPlan(page: import("@playwright/test").Page) {
  await expect(page.getByRole("region", { name: "Pitches", exact: true })).toBeVisible();
}

/**
 * The agent's steps list. A run replayed from the cache (e.g. the other project already ran this example)
 * shows its steps collapsed: open them first.
 */
export async function agentSteps(page: import("@playwright/test").Page) {
  const list = page.getByRole("list", { name: "Agent steps" });
  const replayed = page.getByRole("button", { name: /^Agent steps \(replayed, \d+\)$/ });
  await expect(list.or(replayed).first()).toBeVisible();
  if (await replayed.isVisible()) await replayed.click();
  await expect(list).toBeVisible();
  return list;
}

/** YYYY-MM-DD for today plus `days`, in the browser's (test machine's) time zone. */
export function isoDay(days = 0, from = new Date()): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + days);
  return d.toLocaleDateString("en-CA");
}

/** Open a shadcn DatePicker and pick `iso`, paging months as needed. */
export async function pickDate(page: import("@playwright/test").Page, trigger: import("@playwright/test").Locator, iso: string) {
  const current = (await trigger.getAttribute("data-date")) ?? isoDay();
  await trigger.click();
  const cell = page.locator(`[role="gridcell"][data-day="${iso}"]:not([data-outside])`);
  const step = iso.slice(0, 7) > current.slice(0, 7) ? /next month/i : /previous month/i;
  for (let i = 0; i < 24 && (await cell.count()) === 0; i++) await page.getByRole("button", { name: step }).click();
  await cell.getByRole("button").click();
  await expect(trigger).toHaveAttribute("data-date", iso);
}

/** YYYY-MM-DD of the first `weekday` (0 = Sunday) at least a week from today: a slot that hasn't passed. */
export function futureDay(weekday: number, from = new Date()): string {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 7);
  const offset = (weekday - start.getDay() + 7) % 7;
  return isoDay(7 + offset, from);
}

/** A Saturday and a Sunday at least a week ahead, for typed plan links. */
export const SATURDAY = futureDay(6);
export const SUNDAY = futureDay(0);
