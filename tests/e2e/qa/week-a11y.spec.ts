/**
 * QA: B-017 (fixed in 1b5a4e5). /week's loading state and its score and "Past" cells, at 390, 768 and 1440 px.
 * The loading state is the page's Suspense fallback, streamed in the server HTML. Offline it shows for a moment
 * only, so the spec renders the server HTML with its scripts removed: the fallback stays (and the streamed content
 * stays hidden), exactly as before React swaps it.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, LOCAL, test } from "../fixtures";

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"];
const URL_ = "/week?example=sax";

test.describe("QA /week accessibility (B-017)", () => {
  test.skip(!LOCAL, "Offline fixtures");

  test("loading state: a status that says Loading week, and no axe violations", async ({ page, request, baseURL }) => {
    const html = (await (await request.get(URL_)).text()).replace(/<script\b[\s\S]*?<\/script>/gi, "");
    expect(html).toContain('role="status"');
    await page.setContent(html.replace("<head>", `<head><base href="${baseURL}/">`), { waitUntil: "load" });
    const status = page.getByRole("status").filter({ hasText: "Loading week" });
    await expect(status).toBeAttached();
    await expect(status).toHaveAttribute("aria-busy", "true");
    expect(await status.getAttribute("aria-label")).toBeNull();
    const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    expect(violations.map((v) => `${v.impact} ${v.id}: ${v.nodes[0]?.html.slice(0, 120)}`)).toEqual([]);
  });

  test("loaded: no axe violations; scores and Past cells read as words, with no aria-label on spans", async ({ page }) => {
    await page.goto(URL_);
    const top = page.getByRole("list", { name: "Top sessions" });
    await expect(top).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    expect(violations.map((v) => `${v.impact} ${v.id}`)).toEqual([]);

    // What a screen reader gets for the sessions: "Score N out of 100", never the visual "N/100".
    // (Prose like "Taste match 93/100 here (Qloo)" keeps its visual form; only the score cell is checked.)
    const tree = await top.ariaSnapshot();
    const headings = tree.split("\n").filter((l) => /paragraph: "?\d+\. /.test(l));
    expect(headings.length).toBe(await top.getByRole("listitem").count());
    for (const line of headings) {
      expect(line).toMatch(/Score \d+ out of 100"?$/);
      expect(line).not.toMatch(/\d+\/100/);
    }

    // Past cells (today's earlier slots), when the week starts today: the visual "Past" is hidden, the words are there.
    const grid = page.getByRole("table");
    const gridTree = await grid.ariaSnapshot();
    if (/already started/.test(gridTree)) expect(gridTree).not.toMatch(/\bPast\b/);

    // No aria-label left on a span or div without a role anywhere on the page.
    const stray = await page.evaluate(() =>
      [...document.querySelectorAll("span[aria-label], div[aria-label]")].filter((el) => !el.getAttribute("role")).map((el) => el.outerHTML.slice(0, 100)),
    );
    expect(stray).toEqual([]);
  });
});
