import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../../../src/app/globals.css", import.meta.url), "utf8");
const rule = css.match(/:where\(a, button, summary, \[tabindex\]\)[^{]*:focus-visible \{[^}]*\}/)?.[0] ?? "";

describe("the global focus fallback (BRAND ruling, 17 Oct)", () => {
  it("is zero-specificity (:where) and one single ring: --focus-ring, no gap layer, no offset", () => {
    expect(rule).toContain("box-shadow: var(--focus-ring)");
    expect(rule).not.toMatch(/outline-offset|0 0 0 \d+px var\(--background\)/);
    expect(css).toMatch(/--focus-ring: 0 0 0 2px var\(--ring\);/);
  });
  it("never matches input, textarea or select", () => {
    expect(rule).toContain(":not([tabindex=\"-1\"], input, textarea, select)");
    expect(rule).not.toMatch(/:where\([^)]*\b(input|textarea|select)\b/);
  });
});

// WCAG 1.4.11 (B-134): a button's focus ring is one outline 2px OUTSIDE the button, so it touches only the page ground (and the card
// the button may sit on), never the orange fill or an outline button's border.
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const dayCss = css.slice(css.indexOf(":root {"), css.indexOf('.dark,\n[data-theme="dark"] {'));
const nightCss = css.slice(css.indexOf('.dark,\n[data-theme="dark"] {'));
const tok = (block: string, name: string) => block.match(new RegExp(`${name}: (#[0-9a-fA-F]{6});`))?.[1] ?? "";
const button = readFileSync(new URL("../../../src/components/ui/button.tsx", import.meta.url), "utf8");

describe("the focus ring on buttons (1.4.11, 3:1 against what touches it)", () => {
  it("is one outline, 2px, offset 2px (outside the fill and the border)", () => {
    expect(button).toContain("focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:outline-solid");
    expect(button).not.toMatch(/focus-visible:ring-/);
  });
  for (const [name, block] of [["day", dayCss], ["night", nightCss]] as const) {
    it(`${name}: the ring clears 3:1 against the ground and the card`, () => {
      const ring = tok(block, "--ring");
      expect(contrast(ring, tok(block, "--background"))).toBeGreaterThanOrEqual(3);
      expect(contrast(ring, tok(block, "--card"))).toBeGreaterThanOrEqual(3);
    });
  }
  it("night: the old way failed (ring on the orange fill 1:1, on the outline border under 3:1)", () => {
    const ring = tok(nightCss, "--ring");
    expect(contrast(ring, tok(nightCss, "--primary"))).toBeLessThan(3);
    expect(contrast(ring, tok(nightCss, "--input"))).toBeLessThan(3);
  });
});
