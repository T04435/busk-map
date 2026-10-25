import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { NO_TOOL_NAMES_RULE, TOOL_WORDS, plainTools } from "@/lib/plain-tools";
import { INSTRUCTIONS } from "@/server/agent/agent";

describe("no tool names in the Hive's words (plainTools)", () => {
  it("rewrites the live Santo Domingo notes into plain words", () => {
    expect(plainTools("No events or forecast came back (score_pitches reported 'no forecast'), so the event and weather parts of the scoring were empty.")).toBe(
      "No events or forecast came back (the scoring reported 'no forecast'), so the event and weather parts of the scoring were empty.",
    );
    expect(plainTools("We never ran best_hours; the hours quoted are the engine's best 3-hour window for each pitch from score_pitches.")).toBe(
      "We never ran the best-hours check; the hours quoted are the engine's best 3-hour window for each pitch from the scoring.",
    );
  });

  it("capitalises at a sentence start, drops backticks, () and a doubled 'the … tool'", () => {
    expect(plainTools("`score_pitches` isn't available. best_hours() said 5 pm.")).toBe("The scoring isn't available. The best-hours check said 5 pm.");
    expect(plainTools("I ran the crowd_at tool twice.")).toBe("I ran the crowd check twice.");
    expect(plainTools("Then call finish_plan with three pitchIds.")).toBe("Then call the final plan with three pitches.");
  });

  it("plain words for field names and any other snake_case identifier, but leaves URLs alone", () => {
    expect(plainTools("score_pitches flagged no sameCornerAs.")).toBe("The scoring flagged no same-corner flag.");
    expect(plainTools("The some_other_thing step failed.")).toBe("The some other thing step failed.");
    expect(plainTools("See https://example.com/a_b for more.")).toBe("See https://example.com/a_b for more.");
  });

  it("leaves plain text unchanged and is idempotent", () => {
    const plain = "Busy from 5 pm; the crowd likes reggaeton.";
    expect(plainTools(plain)).toBe(plain);
    const once = plainTools("We never ran best_hours.");
    expect(plainTools(once)).toBe(once);
  });

  it("knows every agent tool, and the prompt forbids tool names", () => {
    const source = readFileSync("src/server/agent/tools.ts", "utf8");
    const tools = [...source.matchAll(/^ {4}([a-z_]+): tool\(/gm)].map((m) => m[1]);
    expect(tools.length).toBeGreaterThan(10);
    for (const t of tools) expect(TOOL_WORDS[t], t).toBeTruthy();
    expect(INSTRUCTIONS).toContain(NO_TOOL_NAMES_RULE);
  });
});
