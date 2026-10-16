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

  test("the footer has no Brand link and continues the closing band's dark ground (B-023)", async ({ page }) => {
    await page.goto("/");
    const footer = page.locator('[data-slot="site-footer"]');
    await expect(footer).toHaveCount(1); // the Suspense fallback is gone once the real footer has rendered
    await expect(footer).toBeVisible();
    await expect(footer.getByRole("link", { name: "Brand" })).toHaveCount(0);
    await expect(page.locator('a[href="/brand"]')).toHaveCount(0);
    await expect(footer).toHaveAttribute("data-theme", "dark");
    const bg = (sel: string) => page.locator(sel).first().evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(await bg('[data-slot="site-footer"]')).toBe(await bg('[aria-labelledby="cta-h"]'));
    // Everywhere else it stays on paper (and /brand is still there by its address).
    await page.goto("/brand");
    await expect(page.getByRole("heading", { level: 1, name: /Honeycomb/ })).toBeVisible();
    await expect(page.locator('[data-slot="site-footer"]')).toHaveCount(1);
    await expect(page.locator('[data-slot="site-footer"]')).not.toHaveAttribute("data-theme", "dark");
    await expect(page.locator('[data-slot="site-footer"]').getByRole("link", { name: "Brand" })).toHaveCount(0);
  });

  test("the hero ground has the deck's glowing cells and the deck's caption (B-021)", async ({ page }) => {
    await page.goto("/");
    const hero = page.locator('section[aria-labelledby="hero"]');
    await expect(hero.locator("svg[aria-hidden=true] path.hc-glow")).toHaveCount(104);
    await expect(hero.locator("figcaption")).toContainText("Qloo's taste map for a folk duo, filling in as the research runs: the brighter the cell, the more their crowd gathers there.");
    // Pulsing by default.
    expect(await hero.evaluate((el) => el.getAnimations({ subtree: true }).some((a) => (a as CSSAnimation).animationName === "hc-glow"))).toBe(true);
  });

  test("the glowing cells hold still under reduced motion (B-021)", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const hero = page.locator('section[aria-labelledby="hero"]');
    await expect(hero.locator("path.hc-glow").first()).toBeAttached();
    expect(await hero.evaluate((el) => el.getAnimations({ subtree: true }).filter((a) => (a as CSSAnimation).animationName === "hc-glow").length)).toBe(0);
  });

  test("What you get back shows the funnel, a taste map with pins, Learn these and the set length, labelled as an example (B-020)", async ({ page }) => {
    await page.goto("/");
    const get = page.getByTestId("what-you-get");
    await expect(get.getByText("Example data").first()).toBeVisible();
    const funnel = get.getByRole("region", { name: "The data behind your busk" });
    await expect(funnel).toContainText("496");
    await expect(funnel).toContainText("data points");
    await expect(funnel.getByRole("img", { name: "496 data points" })).toBeVisible();
    await expect(get.getByRole("img", { name: /taste map for the example busk/ })).toBeVisible();
    await expect(get.getByRole("heading", { name: "Your busk" })).toBeVisible();
    await expect(get.locator('[data-slot="pitch-row"]')).toHaveCount(3);
    await expect(get.getByRole("heading", { name: /to play there/ })).toBeVisible();
    await expect(get.getByTestId("set-length")).toHaveText("Set length: at least 13:05 (3 of 4 songs have a known length).");
    await expect(get.getByRole("region", { name: "Learn these" })).toContainText("Edge of Town");
    await expect(get.getByRole("region", { name: "Learn these" })).toContainText("Dinosaurs");
  });
});
