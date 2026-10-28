import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NO_TRENDING, TOOL_UI } from "@/components/plan/tool-results";
import type { AgentStep } from "@/lib/agent-steps";

/** The learn run's "rising" step: Qloo's /v2/trending has had no rows for any act lately, so its empty state must read honestly. */
const step = { tool: "rising", label: "rising" } as unknown as AgentStep;
const render = (out: Record<string, unknown>) => renderToStaticMarkup(createElement(Fragment, null, TOOL_UI.rising.render(out, step, {})));

describe("the rising card", () => {
  it("shows the DS empty state with a short label, and no caption, when Qloo has no trending rows or no movement", () => {
    for (const out of [{ window: null, artists: [{ name: "Paul Kelly", trendDelta: null }] }, { window: { start: "a", end: "b" }, artists: [{ name: "Paul Kelly", trendDelta: null }] }, {}]) {
      const html = render(out);
      expect(html).toContain('data-testid="rising-empty"');
      expect(html).toContain('role="status"');
      expect(html).toContain(NO_TRENDING);
      expect(html).not.toContain("Paul Kelly");
      expect(html).not.toContain("empty-description");
    }
    expect(NO_TRENDING).toBe("No trending data yet");
  });

  it("lists the artists that moved, with their points", () => {
    const html = render({ window: { start: "a", end: "b" }, artists: [{ name: "Vance Joy", trendDelta: 2.4 }, { name: "Paul Kelly", trendDelta: null }] });
    expect(html).toContain('data-testid="rising-artists"');
    expect(html).toContain("Vance Joy");
    expect(html).toContain("+2.4 pts with your crowds");
    expect(html).not.toContain("Paul Kelly");
    expect(TOOL_UI.rising.title(step)).toBe("Who's rising with those crowds");
  });
});
