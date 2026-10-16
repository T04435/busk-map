import { test as base, expect } from "@playwright/test";

/** Fault injection and offline fixtures exist only on the local test server. */
export const LOCAL = !process.env.PLAYWRIGHT_BASE_URL;

/** The explanations chip: the local offline server's mock model says so; a deploy's Claude says Claude (B-007). */
export const EXPLANATIONS_LABEL = LOCAL ? "Explanations: test model (offline)" : "Explanations: Claude";
/** The Data sources credit for Claude, shown only when Claude wrote the explanations. */
export const CLAUDE_CREDIT = "Plan explanations written by Claude (Anthropic) via Vercel AI Gateway";
/** Who the page says wrote the notes, picks and whys (B-010): the test model on the local offline server, Claude on a deploy. */
export const MODEL_NOTE_PREFIX = LOCAL ? "Test model" : "Claude";
export const AGENT_KEPT_TOP3 = `${LOCAL ? "The test model" : "Claude"} checked Busk Map's top 3 and kept them`;
export const EXPLAINED_BY = LOCAL ? "Explained by the test model (offline)" : "Explained by Claude";

export const test = base;
export { expect };

export async function waitForPlan(page: import("@playwright/test").Page) {
  await expect(page.getByRole("region", { name: "Pitches", exact: true })).toBeVisible();
}

/**
 * The research feed (newest first). On phones and tablets, and for a replay, it sits folded under "Every check": open it first.
 */
export async function agentSteps(page: import("@playwright/test").Page) {
  const list = page.getByRole("list", { name: "Research, newest first" });
  const folded = page.getByText(/^Every check/);
  await expect(list.or(folded).first()).toBeVisible();
  if (!(await list.isVisible())) await folded.first().click();
  await expect(list).toBeVisible();
  return list;
}

/** Turn the page-level "Show raw data" switch on (it appears once the run has finished). */
export async function showRawData(page: import("@playwright/test").Page) {
  await agentSteps(page);
  const toggle = page.getByRole("switch", { name: "Show raw data" });
  await toggle.scrollIntoViewIfNeeded();
  await toggle.click();
  await expect(toggle).toBeChecked();
}

/** Open "Full details" for the pitch at `index` (0 = the top pitch): the right-hand sheet. */
export async function openDetails(page: import("@playwright/test").Page, index = 0) {
  const row = page.getByRole("region", { name: "Pitches", exact: true }).getByRole("listitem").nth(index);
  await row.getByRole("button", { name: /^Full details/ }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible();
  return sheet;
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

/** F25: a song Spotify doesn't have is typed in the song search and added with its last row, "Add “…” as typed". */
export async function addTypedSong(form: import("@playwright/test").Locator, text: string) {
  const box = form.getByPlaceholder("Search songs, e.g. Riptide");
  await box.fill(text);
  await form.getByRole("option", { name: /as typed/ }).last().click(); // the song search comes after the artists search
}
