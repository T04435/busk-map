import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AgentStepStream } from "@/components/plan/agent-steps";
import type { AgentStep } from "@/lib/agent-steps";

// B-010: with the mock model nothing on the page says Claude wrote the text.
const steps: AgentStep[] = [
  {
    id: "1",
    tool: "taste_map",
    label: "Taste map",
    status: "done",
    notes: [
      { kind: "text", text: "I'll start with the taste map." },
      { kind: "reasoning", text: "Crowds first." },
    ],
  },
];
const render = (props: Partial<Parameters<typeof AgentStepStream>[0]>) =>
  renderToStaticMarkup(createElement(AgentStepStream, { steps, phase: "done", ...props }));

describe("agent step notes name the model (B-010)", () => {
  it("tags notes with Test model offline", () => {
    const html = render({ model: "mock" });
    expect(html).toContain("Test model</span></span>I&#x27;ll start with the taste map.");
    expect(html).not.toContain("Claude");
  });

  it("tags notes with Hive otherwise, and for older plans", () => {
    expect(render({ model: "claude" })).toContain(">Hive</span>");
    expect(render({})).toContain(">Hive</span>");
  });
});

describe("the research feed", () => {
  const two: AgentStep[] = [
    { id: "a", tool: "taste_map", label: "Where the act's taste concentrates", status: "done", notes: [], input: { zoom: "x" }, output: { cells: 3, strongest: [{ rank: 1, near: "Hardware Lane", affinity: 0.9 }] } },
    { id: "b", tool: "crowd_at", label: "Who the crowd is", status: "done", notes: [{ kind: "reasoning", text: "Crowds first." }], output: { at: { label: "Hardware Lane" }, artists: [{ name: "Vance Joy", affinity: 0.86 }], genres: [] } },
  ];

  it("lists the steps in run order (U23), with no step numbers, and keeps tool names out", () => {
    const html = render({ steps: two });
    expect(html.indexOf("Where your crowd gathers")).toBeLessThan(html.indexOf("The crowd at Hardware Lane"));
    // data-tool is an attribute for tests; the tool's name is never text.
    expect(html).not.toContain("<code>");
    expect(html).not.toContain("zoom: x");
    expect(html).not.toContain("Thinking (summary)");
    expect(html).not.toMatch(/agent-step-data/);
  });

  it("has no raw data view, live or finished", () => {
    for (const phase of ["done", "working"] as const) {
      const html = render({ steps: two, phase });
      expect(html).not.toContain("<code>");
      expect(html).not.toContain("Raw data");
      expect(html).not.toContain("agent-step-raw");
    }
  });
});
