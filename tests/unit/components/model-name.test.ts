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
const noop = () => {};
const render = (props: Partial<Parameters<typeof AgentStepStream>[0]>) =>
  renderToStaticMarkup(createElement(AgentStepStream, { steps, phase: "done", showRaw: false, onShowRawChange: noop, ...props }));

describe("agent step notes name the model (B-010)", () => {
  it("tags notes with Test model offline", () => {
    const html = render({ model: "mock" });
    expect(html).toContain("Test model</span>I&#x27;ll start with the taste map.");
    expect(html).not.toContain("Claude");
  });

  it("tags notes with Claude otherwise, and for older plans", () => {
    expect(render({ model: "claude" })).toContain(">Claude</span>");
    expect(render({})).toContain(">Claude</span>");
  });
});

describe("the research feed", () => {
  const two: AgentStep[] = [
    { id: "a", tool: "taste_map", label: "Where the act's taste concentrates", status: "done", notes: [], input: { zoom: "x" }, output: { cells: 3, strongest: [{ rank: 1, near: "Hardware Lane", affinity: 0.9 }] } },
    { id: "b", tool: "crowd_at", label: "Who the crowd is", status: "done", notes: [{ kind: "reasoning", text: "Crowds first." }], output: { at: { label: "Hardware Lane" }, artists: [{ name: "Vance Joy", affinity: 0.86 }], genres: [] } },
  ];

  it("lists the newest first, with no step numbers, and keeps tool names out until raw data is on", () => {
    const html = render({ steps: two });
    expect(html.indexOf("The crowd at Hardware Lane")).toBeLessThan(html.indexOf("Where your crowd gathers"));
    // data-tool is an attribute for tests; the tool's name is never text.
    expect(html).not.toContain("<code>");
    expect(html).not.toContain("zoom: x");
    expect(html).not.toContain("Thinking (summary)");
    expect(html).not.toMatch(/agent-step-data/);
  });

  it("shows tool names, inputs and returned data with raw data on", () => {
    const html = render({ steps: two, showRaw: true });
    expect(html).toContain("<code>taste_map</code>");
    // DS raw inputs: the key in a muted span, then the value.
    expect(html).toMatch(/zoom<\/span>x/);
    expect(html).toContain("Thinking (summary): ");
    expect(html).toContain("agent-step-data");
  });

  it("never shows raw data while the run is live", () => {
    const html = render({ steps: two, phase: "working", showRaw: true });
    expect(html).not.toContain("<code>");
    expect(html).toContain("Finding your best pitches");
  });
});
