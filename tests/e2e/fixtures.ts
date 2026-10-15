import { test as base, expect } from "@playwright/test";

/** Fault injection and offline fixtures exist only on the local test server. */
export const LOCAL = !process.env.PLAYWRIGHT_BASE_URL;

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
