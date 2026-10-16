import { expect, test } from "./fixtures";

// The landing against the design deck's Main board (QA's audit, B-018..B-026).
test.describe("landing, as the deck draws it", () => {
  for (const width of [390, 768, 1440]) {
    test(`the headline keeps "What to play." on one line at ${width}px (B-025)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      const h1 = page.getByRole("heading", { level: 1 });
      await expect(h1).toBeVisible();
      const lines = await h1.evaluate((el) => {
        const last = el.querySelector("span.text-signal-text") as HTMLElement;
        return { play: last.getClientRects().length, text: last.textContent, fits: el.scrollWidth <= el.clientWidth };
      });
      expect(lines.text).toBe("What to play.");
      expect(lines.play).toBe(1);
      expect(lines.fits).toBe(true);
      // The deck sets it in at most 4 lines at 1440 ("Where to / busk. / When. / What to play.").
      if (width === 1440) {
        const { height, lh } = await h1.evaluate((el) => ({ height: el.getBoundingClientRect().height, lh: parseFloat(getComputedStyle(el).lineHeight) }));
        expect(Math.round(height / lh)).toBeLessThanOrEqual(4);
      }
    });
  }

  test("the brain teaser shows the deck's three numbers, nothing more (B-024)", async ({ page }) => {
    await page.goto("/");
    const numbers = page.getByTestId("brain-teaser").getByRole("list", { name: "Qloo in numbers" }).getByRole("listitem");
    await expect(numbers).toHaveCount(3);
    await expect(numbers.nth(0)).toHaveText("11kinds of Qloo call");
    await expect(numbers.nth(1)).toHaveText("24–33calls for a new busk");
    await expect(numbers.nth(2)).toHaveText("0on a rerun");
    await expect(page.getByTestId("brain-teaser").getByText("parts of your plan")).toHaveCount(0);
  });

  test("each act card says when it plays, who it sounds like and what it plays (B-022)", async ({ page }) => {
    await page.goto("/");
    const cards = page.locator('[data-slot="example-act-card"]');
    await expect(cards).toHaveCount(3);
    await expect(cards.nth(0)).toContainText("Saturday · 6–9 pm");
    await expect(cards.nth(0)).toContainText("Sounds like Paul Kelly, Courtney Barnett, Vance Joy");
    await expect(cards.nth(0)).toContainText("Plays How to Make Gravy, Dumb Things, Depreston");
    await expect(cards.nth(1)).toContainText("Friday · 5–8 pm");
    await expect(cards.nth(2)).toContainText("Sunday · 12–3 pm");
    await expect(cards.nth(2)).toContainText("Plays Big Jet Plane, Bloom, The Boxer");
  });
});
