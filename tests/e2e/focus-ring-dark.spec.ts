import { expect, test } from "./fixtures";

// QA P1 dark-pinned focus ring: on surfaces pinned to night (data-theme="dark": /brain, the landing hero and dark bands, the footer),
// the focus ring is the night orange (#ff6a2b) whatever the visitor's OS setting, and has 3:1 contrast against the ground.
const ORANGE = "rgb(255, 106, 43)";

const TARGETS: { path: string; name: string; selector: string }[] = [
  { path: "/", name: "header", selector: "header[data-slot='app-header'] a" },
  { path: "/brain", name: "header on brain", selector: "header[data-slot='app-header'] a" },
  { path: "/", name: "landing hero", selector: "section[aria-labelledby='hero'] a, section[aria-labelledby='hero'] button" },
  { path: "/", name: "landing dark band (brain teaser)", selector: "section[data-testid='brain-teaser'] a[href]" },
  { path: "/", name: "landing closing band", selector: "section[aria-labelledby='cta-h'] a, section[aria-labelledby='cta-h'] button" },
  { path: "/", name: "footer", selector: "footer[data-slot='site-footer'][data-theme='dark'] a" },
  { path: "/brain", name: "brain piece", selector: "main[data-theme='dark'] [data-node-id]" },
  { path: "/brain", name: "brain link", selector: "main[data-theme='dark'] a[href='/']" },
];

for (const scheme of ["light", "dark"] as const) {
  test.describe(`dark-pinned focus ring, OS ${scheme}`, () => {
    test.use({ colorScheme: scheme });
    for (const t of TARGETS) {
      test(`${t.name} (${t.path})`, async ({ page }) => {
        await page.goto(t.path);
        await page.addStyleTag({ content: "*, *::before, *::after { transition: none !important; }" });
        const el = page.locator(t.selector).locator("visible=true").first();
        await el.scrollIntoViewIfNeeded();
        await page.keyboard.press("Tab"); // keyboard modality, so :focus-visible matches
        await el.focus();
        const r = await el.evaluate((node) => {
          const cs = getComputedStyle(node);
          const parse = (c: string) => (c.match(/[\d.]+/g) ?? []).slice(0, 4).map(Number);
          const lum = ([r, g, b]: number[]) => {
            const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
            return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
          };
          let ground: number[] = [255, 255, 255];
          for (let n: Element | null = node.parentElement; n; n = n.parentElement) {
            const c = parse(getComputedStyle(n).backgroundColor);
            if (c.length >= 3 && (c.length === 3 || c[3] > 0.99)) {
              ground = c;
              break;
            }
          }
          const shadow = cs.boxShadow;
          const outline = cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0 ? cs.outlineColor : "";
          const found: string[] = [...(shadow.match(/rgb\(\d+, \d+, \d+\)/g) ?? []), ...(outline ? [outline] : [])];
          const ring = found.find((c) => c === "rgb(255, 106, 43)") ?? "";
          const a = lum(parse(ring || "rgb(0, 0, 0)")) + 0.05;
          const b = lum(ground) + 0.05;
          return { shadow, outline, ring, contrast: Math.max(a, b) / Math.min(a, b) };
        });
        expect(r.ring, `ring colour in box-shadow "${r.shadow}" / outline "${r.outline}"`).toBe(ORANGE);
        expect(r.contrast, "ring vs ground").toBeGreaterThanOrEqual(3);
      });
    }
  });
}
