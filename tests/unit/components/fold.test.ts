import { createElement, type FunctionComponent, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Fold } from "@/components/honeycomb/fold";

// Fold requires children; typed loosely here so the child can go in createElement's children argument (react/no-children-prop).
const F = Fold as unknown as FunctionComponent<{ label: string; count?: number; arriving?: boolean; children?: ReactNode }>;
const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);

describe("Fold (B-219)", () => {
  it("doesn't render its content while closed", () => {
    const out = html(createElement(F, { label: "Every check", count: 7 }, createElement("p", null, "secret step")));
    expect(out).toContain('aria-expanded="false"');
    expect(out).toContain("Every check");
    expect(out).not.toContain("secret step");
  });

  it("renders the content for the arriving fold, hidden and inert until it has folded shut", () => {
    const out = html(createElement(F, { label: "Every check", arriving: true }, createElement("p", null, "secret step")));
    expect(out).toContain("secret step");
    expect(out).toContain('aria-hidden="true"');
    expect(out).toContain("inert");
    expect(out).toContain("hc-fold-arrive");
  });
});
