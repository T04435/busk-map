import { existsSync, readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ICON_NAMES, ICON_PATHS, Icon, type IconName } from "@/components/honeycomb/icon";

const DS_BUNDLE = "/Users/t04435/projects/CUBANOSDEV/hackathon/hackathons/qloo-2026/design-handoff/ds-src/bundle.js";

function parseTable(js: string): Record<string, string> {
  const m = /var P = (\{[\s\S]*?\n\s*\});/.exec(js);
  if (!m) throw new Error("DS icon table not found");
  return new Function(`return (${m[1]})`)() as Record<string, string>;
}

const render = (props: Parameters<typeof Icon>[0]) => renderToStaticMarkup(createElement(Icon, props));

describe("honeycomb Icon (DS v66 port)", () => {
  it("matches the checked-in DS table (fixture copied from bundle.js)", () => {
    const fixture = parseTable(readFileSync("tests/fixtures/ds-icon-paths.js.txt", "utf8"));
    expect(ICON_PATHS).toEqual(fixture);
    expect(ICON_NAMES).toEqual(Object.keys(fixture));
  });

  it.skipIf(!existsSync(DS_BUNDLE))("matches the live DS bundle.js when it is readable (catches drift)", () => {
    expect(ICON_PATHS).toEqual(parseTable(readFileSync(DS_BUNDLE, "utf8")));
  });

  it("exposes Icon.names", () => {
    expect(Icon.names).toBe(ICON_NAMES);
    expect(ICON_NAMES.length).toBeGreaterThanOrEqual(47);
  });

  it.each(ICON_NAMES)("renders %s as a 24-grid, 2px, round svg", (name: IconName) => {
    const html = render({ name });
    expect(html).toMatch(/^<svg /);
    expect(html).toContain('viewBox="0 0 24 24"');
    expect(html).toContain('stroke-width="2"');
    expect(html).toContain('stroke-linecap="round"');
    expect(html).toContain('stroke-linejoin="round"');
    expect(html).toContain('stroke="currentColor"');
    expect(html).toContain('width="20"');
    expect(html).toMatch(/<(path|circle) /);
  });

  it("draws circles and filled paths as the DS does", () => {
    expect(render({ name: "clock" })).toContain('<circle cx="12" cy="12" r="9"');
    expect(render({ name: "play" })).toContain('fill="currentColor" stroke="none"');
  });

  it("is aria-hidden without a label and role=img with one", () => {
    expect(render({ name: "pin" })).toContain('aria-hidden="true"');
    expect(render({ name: "pin" })).not.toContain("role=");
    const labelled = render({ name: "pin", label: "Pitch" });
    expect(labelled).toContain('role="img"');
    expect(labelled).toContain('aria-label="Pitch"');
    expect(labelled).not.toContain("aria-hidden");
  });

  it("honours size, strokeWidth and className", () => {
    const html = render({ name: "x", size: 12, strokeWidth: 3, className: "size-3" });
    expect(html).toContain('width="12"');
    expect(html).toContain('stroke-width="3"');
    expect(html).toContain("size-3");
  });

  it("falls back to info for an unknown name, like the DS", () => {
    expect(render({ name: "nope" as IconName })).toBe(render({ name: "info" }));
  });
});
