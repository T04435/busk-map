import { describe, expect, it } from "vitest";
import { AGENT_NAME, AGENT_MODEL_CREDIT, AGENT_RUNS_ON, PERSONA_PROMPT, agentName, hiveProgress, hiveProgressOfRepertoire, hiveProgressOfSteps } from "@/lib/agent-persona";
import { explanationsLabel, modelName } from "@/lib/sources";

describe("agent persona", () => {
  it("has one name and routes modelName through it", () => {
    expect(AGENT_NAME).toBe("Hive");
    expect(agentName()).toBe("the Hive");
    expect(agentName({ start: true })).toBe("The Hive");
    expect(modelName("claude")).toBe("the Hive");
    expect(modelName(null, "start")).toBe("The Hive");
    expect(modelName("claude", "label")).toBe("Hive");
    expect(modelName("mock")).toBe("the test model");
    expect(explanationsLabel({ explanations: "ai", explanationsModel: "claude" })).toBe("Written by Hive (runs on Claude)");
    expect(AGENT_MODEL_CREDIT).toBe("AI · powered by Claude");
    expect(AGENT_RUNS_ON).toBe("The Hive, our agent, runs on Claude");
  });
  it("keeps the never-do list in the prompt", () => {
    expect(PERSONA_PROMPT).toMatch(/run on Claude/);
    expect(PERSONA_PROMPT).toMatch(/never invent/i);
    expect(PERSONA_PROMPT).toMatch(/never say a pitch is legal/i);
    expect(PERSONA_PROMPT).toMatch(/never hype/i);
  });
});

describe("hiveProgress", () => {
  it("is round(done/total*7), clamped", () => {
    expect(hiveProgress(0, 9)).toBe(0);
    expect(hiveProgress(9, 9)).toBe(7);
    expect(hiveProgress(3, 9)).toBe(2);
    expect(hiveProgress(20, 9)).toBe(7);
    expect(hiveProgress(-1, 9)).toBe(0);
    expect(hiveProgress(3, 0)).toBe(0);
  });
  it("counts finished tool steps of a busk stream; notes don't count; the end fills the comb", () => {
    const steps = [
      { tool: null, status: "notes" },
      { tool: "taste_map", status: "done" },
      { tool: "crowd_at", status: "failed" },
      { tool: "events_near", status: "running" },
    ];
    expect(hiveProgressOfSteps(steps)).toBe(hiveProgress(2, 8));
    expect(hiveProgressOfSteps(steps, true)).toBe(7);
    const many = Array.from({ length: 12 }, () => ({ tool: "t", status: "done" }));
    expect(hiveProgressOfSteps(many)).toBe(6);
  });
  it("derives from the Repertoire view model", () => {
    const keys = ["profile", "songs", "qloo", "soundsLike", "fans", "fansLove", "learn", "genres", "summary"];
    const st = (n: number) => keys.map((key, i) => ({ key, status: i < n ? "done" : i === n ? "running" : "pending" }));
    expect(hiveProgressOfRepertoire({ phase: "empty", mode: null, steps: st(0) })).toBe(0);
    expect(hiveProgressOfRepertoire({ phase: "running", mode: "full", steps: st(3) })).toBe(hiveProgress(3, 9));
    expect(hiveProgressOfRepertoire({ phase: "done", mode: "full", steps: st(9) })).toBe(7);
    const more = keys.map((key) => ({ key, status: ["fansLove", "learn"].includes(key) ? "done" : "skipped" }));
    expect(hiveProgressOfRepertoire({ phase: "running", mode: "more", steps: more.map((s) => (s.key === "summary" ? { ...s, status: "running" } : s)) })).toBe(hiveProgress(2, 3));
  });
});
