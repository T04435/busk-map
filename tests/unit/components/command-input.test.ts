import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Command, CommandInput, CommandList } from "@/components/ui/command";

/** The server HTML of an inline combobox: its input's attributes before any JavaScript runs (B-011). */
function input(expanded: boolean | undefined): string {
  const html = renderToStaticMarkup(
    createElement(Command, { label: "Search" }, createElement(CommandInput, { expanded, placeholder: "Search" }), expanded ? createElement(CommandList) : null),
  );
  const tag = html.match(/<input[^>]*>/);
  expect(tag, html).toBeTruthy();
  return tag![0];
}

describe("CommandInput server HTML (B-011)", () => {
  it("a closed inline list: aria-expanded false and no aria-controls", () => {
    const tag = input(false);
    expect(tag).toContain('role="combobox"');
    expect(tag).toContain('aria-expanded="false"');
    expect(tag).not.toContain("aria-controls");
    expect(tag).not.toContain("aria-activedescendant");
    // The rest of cmdk's input and ours still apply.
    expect(tag).toContain('data-slot="command-input"');
    expect(tag).toContain('placeholder="Search"');
    expect(tag).toContain("cmdk-input");
  });

  it("an open list: aria-expanded true and aria-controls on the list", () => {
    const tag = input(true);
    expect(tag).toContain('aria-expanded="true"');
    expect(tag).toMatch(/aria-controls="[^"]+"/);
  });

  it("without `expanded`, cmdk's own attributes stand", () => {
    expect(input(undefined)).toContain('aria-expanded="true"');
  });
});
