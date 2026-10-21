import { expect, test } from "./fixtures";

// Poster size regression (QA Landing v5): the poster variant owns its heights, 76px in the hero and 64px in the closing call to action.
test.describe("poster buttons", () => {
  for (const width of [390, 1440]) {
    test(`hero 76px and closing 64px, outline focus ring 3px at 10px offset (${width}px)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      const hero = page.locator('[data-variant="poster"][data-size="poster-lg"]').first();
      const closing = page.locator('[data-variant="poster"][data-size="poster"]').last();
      await expect(hero).toBeVisible();
      // A streamed page swaps its Suspense fallbacks for the real nodes after the load event, and React then hydrates them.
      // Focus given before that lands on a node that is replaced or not yet interactive, so :focus-visible has not matched
      // and the outline offset reads 0px (the flake under load). Wait for the stream and the buttons to be hydrated.
      await page.waitForFunction(() => !document.querySelector("template[id^='B:'], [id^='S:'][hidden]"));
      for (const b of [hero, closing]) {
        await expect.poll(() => b.evaluate((n) => Object.keys(n).some((k) => k.startsWith("__reactFiber"))), { message: "button hydrated" }).toBe(true);
      }
      await closing.scrollIntoViewIfNeeded();
      expect(Math.round((await hero.boundingBox())!.height)).toBe(76);
      expect(Math.round((await closing.boundingBox())!.height)).toBe(64);
      for (const button of [hero, closing]) {
        await button.focus();
        await page.keyboard.press("Shift+Tab");
        await page.keyboard.press("Tab");
        await expect(button).toBeFocused();
        await expect(button).toHaveCSS("outline-offset", "10px"); // settles; asserted unchanged below
        const style = await button.evaluate((el) => {
          const s = getComputedStyle(el);
          return { width: s.outlineWidth, offset: s.outlineOffset, style: s.outlineStyle, shadow: s.boxShadow };
        });
        expect(style.width).toBe("3px");
        expect(style.offset).toBe("10px");
        expect(style.style).toBe("solid");
        expect(style.shadow).toContain("6px 6px 0px 0px");
      }
    });
  }
});
