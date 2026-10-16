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

// WCAG 1.4.11: the focus indicator on a filled button, at night, against every colour next to it.
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const night = css.slice(css.indexOf('.dark,\n[data-theme="dark"] {'));
const token = (name: string) => night.match(new RegExp(`${name}: (#[0-9a-fA-F]{6});`))?.[1] ?? "";

describe("the focus ring on a filled button at night (1.4.11, 3:1 against adjacent colours)", () => {
  const fill = token("--primary");
  const page = token("--background");
  const ring = night.match(/--ring-on-primary: (#[0-9a-fA-F]{6});/)?.[1] ?? "";
  it("keeps three separate pairs at 3:1 or more: edge on fill, ring on edge, ring on page", () => {
    expect(night).toContain("--focus-edge: var(--background)");
    expect(contrast(page, fill)).toBeGreaterThanOrEqual(3);
    expect(contrast(ring, page)).toBeGreaterThanOrEqual(3);
  });
  it("would fail with the plain orange ring (the reason for the token)", () => {
    expect(contrast(token("--ring"), fill)).toBeLessThan(3);
  });
});
