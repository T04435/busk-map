import { EXAMPLES } from "../../src/lib/examples";
import { FAKE_NOW } from "./clock";
import { expect, LOCAL, test, waitForPlan } from "./fixtures";

/**
 * The late-clock gate (plan-inputs-architecture.md 2.5): an any-time busk planned at Friday 21:30 in Melbourne has no window left
 * that day (the last starts at 7 pm), so the form defaults to Saturday and the engine scores all ten windows there.
 * Runs only under that clock: `pnpm e2e:late` (BUSKMAP_FAKE_NOW=2026-10-16T21:30:00+11:00; point PORT at a server started
 * with the same clock, the e2e server has one clock per process). Skipped under the default Wednesday-noon clock.
 */
const LATE = "2026-10-16T21:30:00+11:00";
const FRIDAY = "2026-10-16";
const SATURDAY = "2026-10-17";

test.describe("@late any time at Friday 21:30", () => {
  test.skip(!LOCAL || FAKE_NOW !== LATE, "Needs the frozen clock at Friday 21:30: run pnpm e2e:late");

  test("the busk form defaults to Saturday, on Any time", async ({ page }) => {
    await page.goto("/busks");
    const f = page.getByRole("form", { name: "Plan for your own act" });
    await expect(f.locator("#date")).toHaveAttribute("data-date", SATURDAY);
    await expect(f.getByRole("radio", { name: /Any time/ })).toBeChecked();
  });

  test("an any-time busk rolls to Saturday and gives every pitch a window", async ({ page }) => {
    await page.goto("/busks");
    const f = page.getByRole("form", { name: "Plan for your own act" });
    await f.getByLabel("Artists you sound like").fill("Paul Kelly");
    const posted = page.waitForRequest((r) => r.url().endsWith("/api/plans") && r.method() === "POST");
    await f.getByRole("button", { name: "Plan my busk" }).click();
    expect((await posted).postDataJSON().slot).toEqual({ date: SATURDAY, any: true });
    await expect(page).toHaveURL(/\/p\/[0-9A-Za-z]{9}$/);
    await waitForPlan(page);
    await expect(page.getByText(new RegExp(`Saturday ${SATURDAY}, any time`)).first()).toBeVisible();
    await expect(page.getByTestId("slot-passed")).toHaveCount(0);
    const rows = page.getByTestId("pitch-row-window");
    await expect(rows).toHaveCount(3);
    for (const row of await rows.all()) await expect(row).toHaveText(/^Best \d+ [ap]m–\d+ [ap]m$/);
  });

  test("an any-time link for Friday has no hours left; Plan again opens Saturday on Any time", async ({ page }) => {
    const res = await page.request.post("/api/plans", { data: { city: "melbourne", slot: { date: FRIDAY, any: true }, performer: EXAMPLES[0].performer } });
    const { path } = (await res.json()) as { path: string };
    await page.goto(path);
    await expect(page.getByTestId("slot-passed")).toBeVisible();
    await expect(page.getByTestId("slot-passed")).toContainText("any time");
    await page.getByRole("link", { name: "Plan again for a new date" }).click();
    await expect(page.getByRole("radio", { name: /Any time/ })).toBeChecked();
    await expect(page.locator("#date")).toHaveAttribute("data-date", SATURDAY);
  });
});
