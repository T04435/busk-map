import { expect, test } from "./fixtures";

// Shadow tokens (QA): shadow-sm/md/lg are the hard poster offsets, never Tailwind's soft blur, in both themes.
test.describe("shadow tokens", () => {
  for (const scheme of ["light", "dark"] as const) {
    test(`shadow-sm, shadow-md and shadow-lg are hard offsets with no blur (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/");
      const shadows = await page.evaluate(() =>
        ["shadow-sm", "shadow-md", "shadow-lg"].map((c) => {
          const el = document.createElement("div");
          el.className = c;
          document.body.append(el);
          const value = getComputedStyle(el).boxShadow;
          el.remove();
          return value;
        }),
      );
      const offsets = ["2px 2px", "4px 4px", "6px 6px"];
      shadows.forEach((value, i) => {
        // "rgb(...) 4px 4px 0px 0px": offset x, y, then blur 0 and spread 0. A soft shadow has a blur and an offset of 0 4px.
        expect(value, `shadow ${i}`).toContain(`${offsets[i]} 0px 0px`);
        expect(value).not.toMatch(/ 0px [1-9]\d*px -?\d+px/);
      });
    });
  }
});
