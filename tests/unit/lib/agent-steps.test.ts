import { describe, expect, it } from "vitest";
import { applyStreamEvent, formatInput, type AgentStep } from "@/lib/agent-steps";
import type { PlanStreamEvent } from "@/lib/plan-schema";

describe("agent steps", () => {
  it("attach Claude's notes to the next call, and the data each call returned", () => {
    const events: PlanStreamEvent[] = [
      { type: "note", kind: "reasoning", text: "Taste is strongest near Degraves." },
      { type: "note", kind: "text", text: "Checking how busy it is there." },
      { type: "tool-start", id: "1", tool: "activity_at", label: "Estimated activity", input: { at: { place: "Degraves Street" }, hour: 19 } },
      { type: "tool-start", id: "2", tool: "busy_places", label: "Places", input: { near: { place: "Degraves Street" } } },
      { type: "tool-end", id: "1", tool: "activity_at", ok: true, summary: "Busy here on Fridays", output: { level: 0.7, basis: "places" } },
      { type: "tool-end", id: "2", tool: "busy_places", ok: false, summary: "outside the area", output: { error: "outside" } },
      { type: "note", kind: "text", text: "Done." },
    ];
    const steps = events.reduce<AgentStep[]>(applyStreamEvent, []);
    expect(steps.map((s) => [s.tool, s.status, s.notes.length])).toEqual([
      ["activity_at", "done", 2],
      ["busy_places", "failed", 0],
      [null, "notes", 1],
    ]);
    expect(steps[0].output).toEqual({ level: 0.7, basis: "places" });
    expect(steps[0].input).toEqual({ at: { place: "Degraves Street" }, hour: 19 });
  });

  it("show inputs as short key: value pairs", () => {
    expect(formatInput({})).toBe("(defaults)");
    expect(formatInput({ at: { pitchId: "spot:x" }, radiusM: 400, signals: ["A", "B"] })).toBe("at: pitchId spot:x · radiusM: 400 · signals: A, B");
    expect(formatInput(undefined)).toBe("none");
  });
});
