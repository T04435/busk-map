import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AgentSteps } from "@/components/plan/agent-steps";
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

describe("agent step notes name the model (B-010)", () => {
  it("prefixes notes with Test model offline", () => {
    const html = renderToStaticMarkup(createElement(AgentSteps, { steps, model: "mock" }));
    expect(html).toContain("Test model: </span>I&#x27;ll start with the taste map.");
    expect(html).toContain("Thinking (summary): ");
    expect(html).not.toContain("Claude");
  });

  it("prefixes notes with Claude otherwise, and for older plans", () => {
    expect(renderToStaticMarkup(createElement(AgentSteps, { steps, model: "claude" }))).toContain("Claude: </span>");
    expect(renderToStaticMarkup(createElement(AgentSteps, { steps }))).toContain("Claude: </span>");
  });
});
