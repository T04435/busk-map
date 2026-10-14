import "server-only";
import { MockLanguageModelV4 } from "ai/test";

/**
 * A deterministic stand-in for the gateway model, used only in offline mode
 * (e2e and CI; never in production). It behaves like a well-behaved planner:
 * gather data in two rounds of parallel tool calls, score, build setlists,
 * then answer with the structured output using the engine's pitch ids.
 */
type PromptMessage = { role: string; content: unknown };
type ToolResult = { type: "tool-result"; toolName: string; output: { type: string; value: unknown } };

const usage = {
  inputTokens: { total: 100, noCache: 100, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 50, text: 50, reasoning: undefined },
};

function toolResults(prompt: PromptMessage[]): ToolResult[] {
  return prompt
    .filter((m) => m.role === "tool" && Array.isArray(m.content))
    .flatMap((m) => (m.content as ToolResult[]).filter((part) => part.type === "tool-result"));
}

const ROUNDS = [
  ["resolve_repertoire"],
  ["taste_map", "footfall", "busking_rules", "busy_places", "events", "weather", "local_artists"],
  ["score_pitches", "rising", "build_setlists"],
];

function call(toolName: string, i: number) {
  return { type: "tool-call" as const, toolCallId: `mock-${toolName}-${i}`, toolName, input: "{}" };
}

export function createMockPlanner() {
  return new MockLanguageModelV4({
    modelId: "mock-planner",
    doGenerate: async (options) => {
      const results = toolResults(options.prompt as PromptMessage[]);
      const done = new Set(results.map((r) => r.toolName));
      const next = ROUNDS.find((round) => round.some((name) => !done.has(name)));
      if (next) {
        return {
          content: next.filter((name) => !done.has(name)).map(call),
          finishReason: { unified: "tool-calls", raw: undefined },
          usage,
          warnings: [],
        };
      }
      const scored = results.find((r) => r.toolName === "score_pitches")?.output.value as
        | { pitches?: { pitchId: string; name: string; score: number }[] }
        | undefined;
      const pitches = (scored?.pitches ?? []).map((p) => ({
        pitchId: p.pitchId,
        why: `Mock explanation: ${p.name} scored ${p.score}/100 on the data gathered.`,
      }));
      const text = JSON.stringify({
        summary: "Mock planner summary (offline test mode).",
        pitches,
        notes: ["Offline test mode: explanations come from a mock model."],
      });
      return {
        content: [{ type: "text", text }],
        finishReason: { unified: "stop", raw: undefined },
        usage,
        warnings: [],
      };
    },
  });
}

export function createMockCompare() {
  return new MockLanguageModelV4({
    modelId: "mock-compare",
    doGenerate: async () => ({
      content: [{ type: "text", text: "Mock plain-LLM answer (offline test mode): play near the main station and cover well-known hits." }],
      finishReason: { unified: "stop", raw: undefined },
      usage,
      warnings: [],
    }),
  });
}
