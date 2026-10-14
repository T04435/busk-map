import { test as base, expect } from "@playwright/test";

/** Fault injection and offline fixtures exist only on the local test server. */
export const LOCAL = !process.env.PLAYWRIGHT_BASE_URL;

export const test = base;
export { expect };

export async function waitForPlan(page: import("@playwright/test").Page) {
  await expect(page.getByRole("region", { name: "Pitches", exact: true })).toBeVisible();
}
