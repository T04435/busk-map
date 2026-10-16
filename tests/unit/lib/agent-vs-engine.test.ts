import { describe, expect, it } from "vitest";
import { agentChanges, agentVsEngineLines, agentVsEngineTitle, becauseClause, firstSentence } from "@/lib/agent-vs-engine";

const p = (id: string, score: number) => ({ id, name: id.toUpperCase(), score });
const engineTop = [p("a", 70), p("b", 66), p("c", 64)];
const engineOrder = [...engineTop, p("d", 61), p("e", 58)];

describe("Agent vs engine", () => {
  it("says Claude checked Busk Map's top 3 and kept them when set and order match", () => {
    const changes = agentChanges(engineTop, engineTop, engineOrder, () => "x");
    expect(changes).toEqual([]);
    expect(agentVsEngineLines({ changes })).toEqual(["Claude checked Busk Map's top 3 and kept them."]);
  });

  it("lists each changed position with both engine ranks and scores, and the reason from the pick's why", () => {
    const whys: Record<string, string> = {
      d: "The Comedy Festival crowd leaves next door at 9:30 pm, and its fans rate this act's taste 0.71. Estimated end time.",
      added: "Busier at 6 pm than anywhere else checked: about 1,900 people an hour.",
    };
    const changes = agentChanges(engineTop, [p("a", 70), p("d", 61), p("added", 55)], engineOrder, (id) => whys[id] ?? null);
    expect(changes).toEqual([
      { position: 2, pick: { id: "d", name: "D", score: 61, engineRank: 4 }, over: { id: "b", name: "B", score: 66, engineRank: 2 }, reason: "The Comedy Festival crowd leaves next door at 9:30 pm, and its fans rate this act's taste 0.71." },
      { position: 3, pick: { id: "added", name: "ADDED", score: 55, engineRank: null }, over: { id: "c", name: "C", score: 64, engineRank: 3 }, reason: whys.added },
    ]);
    expect(agentVsEngineLines({ changes })).toEqual([
      "#2: D (Busk Map's no. 4, score 61) over B (Busk Map's no. 2, score 66) because the Comedy Festival crowd leaves next door at 9:30 pm, and its fans rate this act's taste 0.71.",
      "#3: ADDED (added by Claude, score 55) over C (Busk Map's no. 3, score 64) because busier at 6 pm than anywhere else checked: about 1,900 people an hour.",
    ]);
  });

  it("a swap changes two positions; a pick with no why ends the line without a reason", () => {
    const changes = agentChanges(engineTop, [p("b", 66), p("a", 70), p("c", 64)], engineOrder, () => null);
    expect(changes.map((c) => [c.position, c.pick.engineRank, c.over!.engineRank])).toEqual([
      [1, 2, 1],
      [2, 1, 2],
    ]);
    expect(agentVsEngineLines({ changes })[0]).toBe("#1: B (Busk Map's no. 2, score 66) over A (Busk Map's no. 1, score 70).");
  });

  it("names the test model, not Claude, when the mock model ran (B-010)", () => {
    expect(agentVsEngineLines({ changes: [] }, "mock")).toEqual(["The test model checked Busk Map's top 3 and kept them."]);
    expect(agentVsEngineTitle(0, "mock")).toBe("The test model checked Busk Map's top 3 and kept them");
    expect(agentVsEngineTitle(2, "claude")).toBe("Claude changed 2 of Busk Map's top 3");
    expect(agentVsEngineLines({ changes: [] }, "claude")).toEqual(["Claude checked Busk Map's top 3 and kept them."]);
    const changes = agentChanges(engineTop, [p("a", 70), p("b", 66), p("added", 55)], engineOrder, () => null);
    expect(agentVsEngineLines({ changes }, "mock")).toEqual(["#3: ADDED (added by the test model, score 55) over C (Busk Map's no. 3, score 64)."]);
    expect(agentVsEngineLines({ changes }, "mock").join(" ")).not.toContain("Claude");
  });

  it("takes the first sentence (abbreviations stay whole) and reads it after 'because'", () => {
    expect(firstSentence("It is 3.5 km away. Second.")).toBe("It is 3.5 km away.");
    expect(firstSentence("No full stop here")).toBe("No full stop here");
    expect(firstSentence("x".repeat(300))).toHaveLength(240);
    expect(becauseClause("The crowd leaves at 9.")).toBe("the crowd leaves at 9");
    expect(becauseClause("Federation Square is busier.")).toBe("Federation Square is busier");
  });
});
