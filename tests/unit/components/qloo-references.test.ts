import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HiveMark } from "@/components/honeycomb/hive-mark";
import { SiteFooterView } from "@/components/honeycomb/site-footer";
import { SourceLogo } from "@/components/honeycomb/source-logo";
import { PartnersSection } from "@/components/landing/partners-section";
import { QlooDownPanel } from "@/components/plan/qloo-down-panel";
import { callKinds } from "@/lib/qloo-map";
import { SOURCES } from "@/lib/sources";

/**
 * Qloo references (v1.2.1): Qloo is named in plain text only. No Qloo logo, wordmark or icon renders anywhere, no sponsor or
 * partner wording, and the footer carries the not-affiliated line on every page.
 */
const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);
const DISCLAIMER = "Busk Map is not affiliated with or endorsed by Qloo.";

/** Signs of a Qloo mark in rendered markup: the old wordmark slot or label, the icon files, the wordmark's purple bar, the ring-and-tail. */
function expectNoQlooMark(out: string) {
  expect(out).not.toMatch(/qloo-wordmark|qloo-icon|aria-label="Qloo \(opens|href="https:\/\/qloo\.com"/i);
  expect(out).not.toMatch(/#8C8CC8|#5b5ba3/i);
  expect(out).not.toContain('r="7.5"');
  expect(out).not.toMatch(/<svg[^>]*aria-label="Qloo"/);
}

describe("no Qloo logo renders", () => {
  it("the footer: plain-text credit and the disclaimer, no lockup", () => {
    const out = html(createElement(SiteFooterView, {}));
    expectNoQlooMark(out);
    expect(out).toContain('data-testid="qloo-disclaimer"');
    expect(out).toContain(`Taste data from the Qloo API. ${DISCLAIMER}`);
    expect(out).not.toMatch(/>\s*with\s*</);
  });

  it("the landing's Thanks to: no sponsor card, no wordmark", () => {
    const out = html(createElement(PartnersSection, {}));
    expectNoQlooMark(out);
    expect(out).not.toMatch(/sponsor/i);
    expect(out).toContain("Taste data from the Qloo API");
  });

  it("a Qloo source: the neutral glyph plus the word Qloo, never an image", () => {
    const out = html(createElement(SourceLogo, { source: "qloo" }));
    expectNoQlooMark(out);
    expect(out).not.toContain("<img");
    expect(out).toMatch(/<\/svg>Qloo<\/span>$/);
    expect(out).toContain("text-slate");
  });

  it("the Hive mark on a Qloo step: the neutral glyph in the centre cell", () => {
    const out = html(createElement(HiveMark, { source: "qloo", size: 40 }));
    expectNoQlooMark(out);
    expect(out).toContain('<rect x="3" y="9.5" width="18" height="5"');
  });

  it("the Qloo-down panel names Qloo in words", () => {
    const out = html(createElement(QlooDownPanel, { onRetry: () => {} }));
    expectNoQlooMark(out);
    expect(out).toContain(">Qloo</span>");
  });
});

describe("no Qloo marks or partner wording in the source", () => {
  const ROOT = join(__dirname, "../../..");
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
  const src = walk(join(ROOT, "src")).filter((f) => /\.(tsx?|css)$/.test(f));

  it("no Qloo logo files are shipped", () => {
    expect(readdirSync(join(ROOT, "public/partners")).filter((f) => /qloo/i.test(f))).toEqual([]);
  });

  it("no component draws or links a Qloo logo, and the Qloo purple token is gone", () => {
    for (const f of src) {
      const s = readFileSync(f, "utf8");
      expect(s, f).not.toMatch(/QlooWordmark|QlooLink|qloo-icon|hc-qloo-rise|--qloo\b|--qloo-brand|#8C8CC8/);
      expect(s, f).not.toMatch(/\b(text|bg|border|stroke|fill)-qloo\b(?!-)/);
    }
  });

  it("no sponsor, partner or powered-by wording about Qloo", () => {
    for (const f of src) {
      const s = readFileSync(f, "utf8");
      expect(s, f).not.toMatch(/Sponsored by|Powered by Qloo|powered by Qloo|Built with Qloo|Qloo, our partner|our partner/);
    }
  });

  it("the credit line, and the README's count of Qloo call kinds is the computed one", () => {
    expect(SOURCES.qloo.credit).toBe("Taste data from the Qloo API, used under Qloo's Terms of Use.");
    const readme = readFileSync(join(ROOT, "README.md"), "utf8");
    expect(readme).toContain(`${callKinds} kinds of call`);
    expect(readme).toContain(DISCLAIMER);
  });
});
