import "server-only";
import { convertArrayToReadableStream, MockLanguageModelV4 } from "ai/test";

/**
 * A deterministic stand-in for the gateway model, used only in offline mode
 * (e2e and CI; never in production) and in tests. It behaves like an
 * investigating planner: a note (and sometimes a reasoning summary) before
 * each call, inputs chosen from what earlier tools returned, then
 * finish_plan with pitch ids from score_pitches. Scenarios exercise the
 * guardrails.
 */
type PromptMessage = { role: string; content: unknown };
type ToolResult = { type: "tool-result"; toolName: string; output: { type: string; value: unknown } };
type Call = { toolName: string; input: unknown };
type Move = { reasoning?: string; text: string; calls: Call[] };

export type MockScenario = "investigate" | "bad-finish" | "never-finish" | "invented-numbers" | "fail";

const usage = {
  inputTokens: { total: 100, noCache: 100, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 50, text: 50, reasoning: undefined },
};

function toolResults(prompt: PromptMessage[]): ToolResult[] {
  return prompt
    .filter((m) => m.role === "tool" && Array.isArray(m.content))
    .flatMap((m) => (m.content as ToolResult[]).filter((part) => part.type === "tool-result"));
}

type ScoreRow = { pitchId: string; name: string; score: number; engineTop3: boolean };

function lastScores(results: ToolResult[]): ScoreRow[] {
  const scored = results.filter((r) => r.toolName === "score_pitches").at(-1)?.output.value as { pitches?: ScoreRow[] } | undefined;
  return scored?.pitches ?? [];
}

function finish(results: ToolResult[], scenario: MockScenario, rejections: number): Move {
  const rows = lastScores(results);
  const picks = rows.filter((r) => r.engineTop3);
  const chosen = (picks.length ? picks : rows).slice(0, 3);
  const invented = scenario === "invented-numbers";
  const badFirst = scenario === "bad-finish" && rejections === 0;
  return {
    text: "I have enough to recommend three pitches.",
    calls: [
      {
        toolName: "finish_plan",
        input: {
          summary: "Mock planner summary (offline test mode).",
          pitches: badFirst
            ? [{ pitchId: "made-up", why: "Trust me." }, ...chosen.slice(1).map((p) => ({ pitchId: p.pitchId, why: `Mock explanation: ${p.name} scored ${p.score}/100.` }))]
            : chosen.map((p) => ({
                pitchId: p.pitchId,
                why: invented ? `Mock explanation: about 98765 people pass ${p.name}.` : `Mock explanation: ${p.name} scored ${p.score}/100 on the data gathered.`,
              })),
          notes: ["Offline test mode: explanations come from a mock model."],
        },
      },
    ],
  };
}

/** The next move, from the tool results so far. */
export function nextMove(results: ToolResult[], tools: string[], scenario: MockScenario): Move | null {
  const done = (name: string) => results.filter((r) => r.toolName === name);
  const rejections = done("finish_plan").filter((r) => (r.output.value as { accepted?: boolean })?.accepted === false).length;
  const onlyFinish = tools.length === 1 && tools[0] === "finish_plan";
  if (scenario === "never-finish") {
    if (onlyFinish) return null;
    return { text: "Looking at the taste map again.", calls: [{ toolName: "taste_map", input: { radiusM: 200 + 100 * results.length } }] };
  }
  if (onlyFinish || done("finish_plan").length > 0) return finish(results, scenario, rejections);
  const rows = lastScores(results);
  const [first, second] = rows;
  if (!done("taste_map").length) return { text: "I'll start with the taste map to see where this act's fans concentrate.", calls: [{ toolName: "taste_map", input: {} }] };
  if (!done("score_pitches").length) {
    return { reasoning: "The taste map has a clear strongest area; the engine's pool will show which pitches sit in it.", text: "Scoring the engine's pool to see which pitches lead.", calls: [{ toolName: "score_pitches", input: {} }] };
  }
  if (!done("crowd_at").length && first) {
    return {
      text: `Checking who the crowd is at ${first.name}, and how busy it gets at the start of the slot.`,
      calls: [
        { toolName: "crowd_at", input: { at: { pitchId: first.pitchId }, radiusM: 400 } },
        { toolName: "footfall_at", input: { at: { pitchId: first.pitchId } } },
      ],
    };
  }
  if (!done("check_pitch").length) return { text: "Federation Square is a well-known spot; checking whether the rules allow it.", calls: [{ toolName: "check_pitch", input: { spot: { place: "Federation Square" } } }] };
  const checked = done("check_pitch").at(-1)?.output.value as { pitchId?: string | null; inPool?: boolean } | undefined;
  if (done("score_pitches").length === 1 && checked?.pitchId && !checked.inPool) {
    return { text: "Adding Federation Square to the pool so the engine scores it.", calls: [{ toolName: "score_pitches", input: { add: [checked.pitchId] } }] };
  }
  if (!done("compare_crowds").length && first && second) {
    return { text: `Comparing the crowds at ${first.name} and ${second.name}.`, calls: [{ toolName: "compare_crowds", input: { a: first.pitchId, b: second.pitchId } }] };
  }
  if (!done("build_setlist").length && first) return { text: `Ordering the setlist for ${first.name}.`, calls: [{ toolName: "build_setlist", input: { pitchId: first.pitchId } }] };
  return finish(results, scenario, rejections);
}

let ids = 0;

function streamOf(move: Move | null) {
  const parts: unknown[] = [{ type: "stream-start", warnings: [] }];
  const id = String(++ids);
  if (move?.reasoning) parts.push({ type: "reasoning-start", id: `r${id}` }, { type: "reasoning-delta", id: `r${id}`, delta: move.reasoning }, { type: "reasoning-end", id: `r${id}` });
  const text = move?.text ?? "I can't find a better answer than the engine's.";
  parts.push({ type: "text-start", id: `t${id}` }, { type: "text-delta", id: `t${id}`, delta: text }, { type: "text-end", id: `t${id}` });
  for (const [i, call] of (move?.calls ?? []).entries()) {
    parts.push({ type: "tool-call", toolCallId: `mock-${call.toolName}-${id}-${i}`, toolName: call.toolName, input: JSON.stringify(call.input) });
  }
  parts.push({ type: "finish", usage, finishReason: { unified: move?.calls.length ? "tool-calls" : "stop", raw: undefined } });
  return { stream: convertArrayToReadableStream(parts as never[]) };
}

export function createMockPlanner(scenario: MockScenario = "investigate") {
  return new MockLanguageModelV4({
    modelId: "mock-planner",
    doStream: async (options) => {
      if (scenario === "fail") throw new Error("mock model failure");
      const tools = (options.tools ?? []).map((t) => t.name);
      return streamOf(nextMove(toolResults(options.prompt as PromptMessage[]), tools, scenario));
    },
  });
}

/**
 * Offline stand-in for the plain-LLM comparison. It answers the way a model
 * with no data typically does: the famous tourist spots and the biggest hits.
 */
export function createMockCompare() {
  return new MockLanguageModelV4({
    modelId: "mock-compare",
    doGenerate: async () => ({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            spots: [
              { name: "Bourke Street Mall", lat: -37.8137, lon: 144.9645, why: "Mock plain-LLM answer (offline test mode): the busiest shopping strip in the city." },
              { name: "Federation Square", lat: null, lon: null, why: "Mock plain-LLM answer: tourists and big crowds all day." },
              { name: "Flinders Street Station", lat: -37.8183, lon: 144.9671, why: "Mock plain-LLM answer: thousands of commuters pass the steps." },
            ],
            setlist: ["Wonderwall", "Hallelujah", "Riptide", "Shallow"],
          }),
        },
      ],
      finishReason: { unified: "stop", raw: undefined },
      usage,
      warnings: [],
    }),
  });
}

/** Offline stand-in for the week explainer: echoes the session keys it was given. */
export function createMockWeekExplainer() {
  return new MockLanguageModelV4({
    modelId: "mock-week",
    doGenerate: async (options) => {
      const user = (options.prompt as PromptMessage[]).find((m) => m.role === "user");
      const text = Array.isArray(user?.content) ? (user.content as { type: string; text?: string }[]).map((p) => p.text ?? "").join("") : "";
      let keys: string[] = [];
      try {
        keys = (JSON.parse(text) as { sessions: { key: string }[] }).sessions.map((s) => s.key);
      } catch {
        keys = [];
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              summary: "Mock week summary (offline test mode).",
              sessions: keys.map((key) => ({ key, why: `Mock explanation for ${key}.` })),
            }),
          },
        ],
        finishReason: { unified: "stop", raw: undefined },
        usage,
        warnings: [],
      };
    },
  });
}
