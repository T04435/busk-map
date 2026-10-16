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

export type MockScenario = "investigate" | "lazy" | "bad-finish" | "never-finish" | "invented-numbers" | "rerank" | "fail";

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
  let chosen = (picks.length ? picks : rows).slice(0, 3);
  // "rerank": Claude puts the engine's #2 first, for a reason it found (the first sentence of its why).
  if (scenario === "rerank" && chosen.length >= 2) chosen = [chosen[1], chosen[0], ...chosen.slice(2)];
  const reason = (p: ScoreRow, i: number) =>
    scenario === "rerank" && i === 0 ? `The crowd at ${p.name} fits this act better on the data gathered. Mock explanation: it scored ${p.score}/100.` : null;
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
            : chosen.map((p, i) => ({
                pitchId: p.pitchId,
                why: invented
                  ? `Mock explanation: about 98765 people pass ${p.name}.`
                  : (reason(p, i) ?? `Mock explanation: ${p.name} scored ${p.score}/100 on the data gathered.`),
              })),
          notes: ["Offline test mode: explanations come from a mock model."],
        },
      },
    ],
  };
}

type TasteOut = { strongest?: { near: string | null }[] };
type CheckOut = { pitchId?: string | null; inPool?: boolean };

/**
 * The next move, from the tool results so far and the tools offered. Like
 * Claude, it investigates first (score_pitches isn't offered until three
 * looks are in), checks a well-known spot for its shortlist, lets the engine
 * score everything, then chooses.
 */
export function nextMove(results: ToolResult[], tools: string[], scenario: MockScenario): Move | null {
  const done = (name: string) => results.filter((r) => r.toolName === name);
  const ok = (name: string) => done(name).filter((r) => r.output.type !== "error-text" && r.output.type !== "error-json");
  const offered = (name: string) => tools.length === 0 || tools.includes(name);
  const rejections = done("finish_plan").filter((r) => (r.output.value as { accepted?: boolean })?.accepted === false).length;
  const scored = ok("score_pitches").length > 0;
  // Wrapping up (only score_pitches and finish_plan offered, or finish_plan alone).
  if (!offered("taste_map")) {
    if (scenario === "never-finish") return null;
    if (!scored && offered("score_pitches")) return { text: "Out of research budget: scoring what I have.", calls: [{ toolName: "score_pitches", input: {} }] };
    return finish(results, scenario, rejections);
  }
  if (scenario === "never-finish") return { text: "Looking at the taste map again.", calls: [{ toolName: "taste_map", input: { radiusM: 200 + 100 * results.length } }] };
  if (done("finish_plan").length > 0) return finish(results, scenario, rejections);
  // "lazy": scores as soon as score_pitches is offered, then finishes; until then, one plain look at a time.
  if (scenario === "lazy") {
    if (scored) return finish(results, scenario, rejections);
    if (offered("score_pitches")) return { text: "Scoring now.", calls: [{ toolName: "score_pitches", input: {} }] };
    const looks: Call[] = [
      { toolName: "footfall_at", input: { at: { place: "Bourke Street Mall" } } },
      { toolName: "busy_places", input: { near: { place: "Bourke Street Mall" } } },
      { toolName: "check_pitch", input: { spot: { place: "Bourke Street Mall" } } },
      { toolName: "crowd_at", input: { at: { place: "Bourke Street Mall" } } },
    ];
    return { text: "One more look.", calls: [looks[Math.min(results.length, looks.length - 1)]] };
  }
  if (!done("taste_map").length) return { text: "I'll start with the taste map to see where this act's fans concentrate.", calls: [{ toolName: "taste_map", input: {} }] };
  const strongest = (done("taste_map")[0]?.output.value as TasteOut | undefined)?.strongest?.find((c) => c.near)?.near ?? "Federation Square";
  if (!done("crowd_at").length) {
    return {
      reasoning: `The taste map's strongest area is near ${strongest}; who is there, and how busy it is, decides whether it makes my shortlist.`,
      text: `Checking who the crowd is near ${strongest}, and how busy it gets at the start of the slot.`,
      calls: [
        { toolName: "crowd_at", input: { at: { place: strongest }, radiusM: 400 } },
        { toolName: "footfall_at", input: { at: { place: strongest } } },
      ],
    };
  }
  if (!done("check_pitch").length) return { text: "Federation Square is a well-known spot; checking whether the rules allow it, for my shortlist.", calls: [{ toolName: "check_pitch", input: { spot: { place: "Federation Square" } } }] };
  if (!scored && offered("score_pitches")) {
    const checked = done("check_pitch").at(-1)?.output.value as CheckOut | undefined;
    const add = checked?.pitchId && !checked.inPool ? [checked.pitchId] : [];
    return { text: "Letting the engine score its pool and my shortlist.", calls: [{ toolName: "score_pitches", input: add.length ? { add } : {} }] };
  }
  const rows = lastScores(results);
  const [first, second] = rows;
  if (!done("compare_crowds").length && first && second) {
    return { text: `Comparing the crowds at ${first.name} and ${second.name}.`, calls: [{ toolName: "compare_crowds", input: { a: first.pitchId, b: second.pitchId } }] };
  }
  if (!done("build_setlist").length && first) return { text: `Ordering the suggested set for ${first.name}.`, calls: [{ toolName: "build_setlist", input: { pitchId: first.pitchId } }] };
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
