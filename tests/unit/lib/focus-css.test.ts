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
