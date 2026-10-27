import { describe, expect, it, vi } from "vitest";
import { convertArrayToReadableStream, MockLanguageModelV4 } from "ai/test";
import { EXAMPLES } from "@/lib/examples";
import { planRequestSchema } from "@/lib/plan-schema";
import { mockFetch, OFFLINE } from "../../helpers";

const usage = { inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 5, text: 5, reasoning: undefined } };
const turn = (text: string, calls: { toolName: string; input: unknown }[] = []) => ({
  stream: convertArrayToReadableStream([
    { type: "stream-start", warnings: [] },
    { type: "text-start", id: "t" },
    { type: "text-delta", id: "t", delta: text },
    { type: "text-end", id: "t" },
    ...calls.map((c, i) => ({ type: "tool-call", toolCallId: `call-${text.length}-${i}`, toolName: c.toolName, input: JSON.stringify(c.input) })),
    { type: "finish", usage, finishReason: { unified: calls.length ? "tool-calls" : "stop", raw: undefined } },
  ] as never[]),
});

describe("the busk agent's forced final round", () => {
  it("is sent every earlier step (the tool results it found), not just the last step's words", async () => {
    vi.resetModules();
    mockFetch([]);
    const { PlanContext } = await import("@/server/agent/context");
    const { runPlanAgent } = await import("@/server/agent/agent");
    const prompts: string[] = [];
    let n = 0;
    const model = new MockLanguageModelV4({
      modelId: "final-round",
      doStream: async (options) => {
        prompts.push(JSON.stringify(options.prompt));
        n++;
        // Step 1 looks at the taste map; step 2 stops with words alone; the forced round then answers.
        if (n === 1) return turn("Looking at the taste map.", [{ toolName: "taste_map", input: {} }]);
        if (n === 2) return turn("That is all.");
        return turn("Finishing.");
      },
    });
    const request = planRequestSchema.parse({ city: "melbourne", slot: { date: "2026-10-17", startHour: 18, endHour: 21 }, performer: EXAMPLES[0].performer });
    await runPlanAgent(new PlanContext(request, OFFLINE, "2026-10-15"), {}, undefined, { model });
    expect(prompts.length).toBeGreaterThanOrEqual(3);
    const forced = prompts[2];
    expect(forced).toContain("You stopped without calling finish_plan");
    // The first step's tool call and its result are in the forced round's messages.
    expect(forced).toContain('"toolName":"taste_map"');
    expect(forced).toMatch(/"type":"tool-result"[^]*taste_map|taste_map[^]*"type":"tool-result"/);
    expect(forced).toContain("Looking at the taste map.");
  });
});
