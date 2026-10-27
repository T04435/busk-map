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

type ScoreRow = { pitchId: string; name: string; score: number; engineTop3: boolean; district?: string };

function lastScores(results: ToolResult[]): ScoreRow[] {
  const scored = results.filter((r) => r.toolName === "score_pitches").at(-1)?.output.value as { pitches?: ScoreRow[] } | undefined;
  return scored?.pitches ?? [];
}

type BestHoursOut = { pitches?: { pitchId: string; best: string }[] };

/** Any time: each pitch's best hours, as best_hours reported them (empty when it wasn't called). */
function bestHoursOf(results: ToolResult[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const r of results.filter((x) => x.toolName === "best_hours" && x.output.type !== "error-text" && x.output.type !== "error-json")) {
    for (const p of (r.output.value as BestHoursOut | undefined)?.pitches ?? []) out.set(p.pitchId, p.best);
  }
  return out;
}

function finish(results: ToolResult[], scenario: MockScenario, rejections: number): Move {
  const rows = lastScores(results);
  const hours = bestHoursOf(results);
  const hoursNote = (p: ScoreRow) => (hours.has(p.pitchId) ? ` Best hours ${hours.get(p.pitchId)}.` : "");
  const picks = rows.filter((r) => r.engineTop3);
  let chosen = (picks.length ? picks : rows).slice(0, 3);
  // "rerank": Claude puts the engine's #2 first, for a reason it found (the first sentence of its why).
  if (scenario === "rerank" && chosen.length >= 2) chosen = [chosen[1], chosen[0], ...chosen.slice(2)];
  const reason = (p: ScoreRow, i: number) =>
    scenario === "rerank" && i === 0 ? `The crowd at ${p.name} fits this act better on the data gathered. Mock explanation: it ranked high.${hoursNote(p)}` : null;
  const invented = scenario === "invented-numbers";
  const badFirst = scenario === "bad-finish" && rejections === 0;
  return {
    text: "We have enough to recommend three pitches.",
    calls: [
      {
        toolName: "finish_plan",
        input: {
          summary: "Mock planner summary (offline test mode).",
          pitches: badFirst
            ? [{ pitchId: "made-up", why: "Trust me." }, ...chosen.slice(1).map((p) => ({ pitchId: p.pitchId, why: `Mock explanation: ${p.name} ranked well.${hoursNote(p)}` }))]
            : chosen.map((p, i) => ({
                pitchId: p.pitchId,
                why: invented
                  ? `Mock explanation: about 98765 people pass ${p.name}.`
                  : (reason(p, i) ?? `Mock explanation: ${p.name} fits the data gathered.${hoursNote(p)}`),
              })),
          notes: ["Offline test mode: explanations come from a mock model."],
        },
      },
    ],
  };
}

type TasteOut = { strongest?: { near: string | null; lat?: number; lon?: number }[] };
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
    if (!scored && offered("score_pitches")) return { text: "Out of research budget: scoring what we have.", calls: [{ toolName: "score_pitches", input: {} }] };
    return finish(results, scenario, rejections);
  }
  if (scenario === "never-finish") return { text: "Looking at the taste map again.", calls: [{ toolName: "taste_map", input: { radiusM: 200 + 100 * results.length } }] };
  if (done("finish_plan").length > 0) return finish(results, scenario, rejections);
  // "lazy": scores as soon as score_pitches is offered, then finishes; until then, one plain look at a time.
  if (scenario === "lazy") {
    if (scored) return finish(results, scenario, rejections);
    if (offered("score_pitches")) return { text: "Scoring now.", calls: [{ toolName: "score_pitches", input: {} }] };
    const looks: Call[] = [
      { toolName: "activity_at", input: { at: { place: "Bourke Street Mall" } } },
      { toolName: "busy_places", input: { near: { place: "Bourke Street Mall" } } },
      { toolName: "check_pitch", input: { spot: { place: "Bourke Street Mall" } } },
      { toolName: "crowd_at", input: { at: { place: "Bourke Street Mall" } } },
    ];
    return { text: "One more look.", calls: [looks[Math.min(results.length, looks.length - 1)]] };
  }
  // A metro planned across its areas (compare_areas is offered only then): weigh the areas first.
  if (tools.includes("compare_areas") && !done("compare_areas").length && !done("taste_map").length) {
    return { text: "This city is planned across its areas, so we'll compare them before looking closer.", calls: [{ toolName: "compare_areas", input: {} }] };
  }
  if (!done("taste_map").length) return { text: "We'll start with the taste map to see where this act's fans concentrate.", calls: [{ toolName: "taste_map", input: {} }] };
  const cells = (done("taste_map")[0]?.output.value as TasteOut | undefined)?.strongest ?? [];
  // A city where Busk Map knows no place by name (any city but Melbourne): the strongest cell by its coordinates.
  const unnamed = cells.length > 0 && cells.every((c) => !c.near) && typeof cells[0].lat === "number" && typeof cells[0].lon === "number";
  const strongest = unnamed ? "the strongest taste cell" : (cells.find((c) => c.near)?.near ?? "Federation Square");
  const at = unnamed ? { lat: cells[0].lat, lon: cells[0].lon } : { place: strongest };
  if (!done("crowd_at").length) {
    return {
      reasoning: `The taste map's strongest area is near ${strongest}; who is there, and how busy it is, decides whether it makes our shortlist.`,
      text: `Checking who the crowd is near ${strongest}, and how busy it is estimated to be at the start of the slot.`,
      calls: [
        { toolName: "crowd_at", input: { at, radiusM: 400 } },
        { toolName: "activity_at", input: { at } },
      ],
    };
  }
  if (!done("check_pitch").length) {
    if (unnamed) return { text: "Checking the strongest taste cell as a spot, for our shortlist.", calls: [{ toolName: "check_pitch", input: { spot: at } }] };
    return { text: "Federation Square is a well-known spot; checking whether the rules allow it, for our shortlist.", calls: [{ toolName: "check_pitch", input: { spot: { place: "Federation Square" } } }] };
  }
  if (!scored && offered("score_pitches")) {
    const checked = done("check_pitch").at(-1)?.output.value as CheckOut | undefined;
    const add = checked?.pitchId && !checked.inPool ? [checked.pitchId] : [];
    return { text: "Letting the engine score its pool and our shortlist.", calls: [{ toolName: "score_pitches", input: add.length ? { add } : {} }] };
  }
  const rows = lastScores(results);
  const [first, second] = rows;
  // Any time (best_hours is offered only then): the hours of the engine's top pitches, before the crowds are compared.
  if (!done("best_hours").length && tools.includes("best_hours") && first) {
    const ids = rows.filter((r) => r.engineTop3).slice(0, 3).map((r) => r.pitchId);
    return { text: "This is an any-time busk, so we'll check the best hours for each of the engine's top pitches.", calls: [{ toolName: "best_hours", input: { pitchIds: ids.length ? ids : [first.pitchId] } }] };
  }
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
  const text = move?.text ?? "We can't find a better answer than the engine's.";
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

export type MockWeekScenario = "investigate" | "skip-last" | "bad-finish" | "never-finish" | "text-only" | "same-spot" | "insist" | "fail";

/** The playable days, from the week prompt's "Playable days:" line. */
function playableDays(prompt: PromptMessage[]): string[] {
  const user = prompt.find((m) => m.role === "user");
  const text = Array.isArray(user?.content) ? (user.content as { type: string; text?: string }[]).map((p) => p.text ?? "").join("") : String(user?.content ?? "");
  const line = text.split("\n").find((l) => l.startsWith("Playable days:")) ?? "";
  return [...line.matchAll(/\d{4}-\d{2}-\d{2}/g)].map((m) => m[0]);
}

/**
 * The week planner's next move: like Claude, one taste look and one crowd look (taste doesn't change by day), activity and
 * events for every day, then score_pitches for every day, then finish_week with each day's best engine-top-3 pitch.
 * "skip-last" says the last day isn't worth it; "bad-finish" first names a made-up pitch; "text-only" stops with words alone
 * once (the forced final round then finishes).
 */
export function nextWeekMove(results: ToolResult[], tools: string[], days: string[], scenario: MockWeekScenario): Move | null {
  const done = (name: string) => results.filter((r) => r.toolName === name);
  const ok = (r: ToolResult) => r.output.type !== "error-text" && r.output.type !== "error-json";
  const offered = (name: string) => tools.length === 0 || tools.includes(name);
  const dayOf = (r: ToolResult) => (r.output.value as { day?: string } | undefined)?.day;
  const scoredDays = new Set(done("score_pitches").filter(ok).map(dayOf));
  const rejections = done("finish_week").filter((r) => (r.output.value as { accepted?: boolean })?.accepted === false).length;
  const picked = new Set<string>();
  const districts = new Set<string>();
  // The last rejection's suggestions per day.
  const lastReject = done("finish_week").filter((r) => (r.output.value as { accepted?: boolean })?.accepted === false).at(-1)?.output.value as { summary?: string } | undefined;
  const suggested = new Map([...(lastReject?.summary ?? "").matchAll(/Try (\d{4}-\d{2}-\d{2}): ([^,.\s]+)/g)].map((m) => [m[1], m[2]]));
  const finishWeek = (): Move => ({
    text: "We have enough to plan the week.",
    calls: [
      {
        toolName: "finish_week",
        input: {
          summary: "Mock week summary (offline test mode).",
          days: days.map((day, i) => {
            const rows = (done("score_pitches").filter((r) => dayOf(r) === day).at(-1)?.output.value as { pitches?: ScoreRow[] } | undefined)?.pitches ?? [];
            const top = rows.find((r) => r.engineTop3) ?? rows[0];
            // Like Claude told to spread the week: a pitch (and a district) no earlier day took, else what finish_week suggested
            // ("Try <day>: id, …"); "same-spot" repeats the best until sent back, "insist" never stops repeating it.
            const tried = suggested.get(day);
            const spread = scenario === "insist" ? false : scenario !== "same-spot" || rejections > 0;
            const best = (spread ? (tried ? (rows.find((r) => r.pitchId === tried) ?? { pitchId: tried, name: tried, score: 0, engineTop3: false }) : undefined) ?? rows.find((r) => !picked.has(r.pitchId) && !(r.district && districts.has(r.district))) ?? rows.find((r) => !picked.has(r.pitchId)) : undefined) ?? top;
            if (best?.district) districts.add(best.district);
            if (best) picked.add(best.pitchId);
            if (scenario === "bad-finish" && rejections === 0 && i === 0) return { day, pitchId: "made-up", why: "Trust me." };
            if ((scenario === "skip-last" && i === days.length - 1 && days.length > 1) || !best) return { day, pitchId: null, why: "Mock explanation: a weaker day for this act on the data gathered." };
            return { day, pitchId: best.pitchId, why: `Mock explanation: ${best.name} fits this crowd on this day.` };
          }),
          notes: ["Offline test mode: explanations come from a mock model."],
        },
      },
    ],
  });
  // Wrapping up (only score_pitches and finish_week offered, or finish_week alone).
  if (!offered("taste_map")) {
    if (scenario === "never-finish") return null;
    const unscored = days.filter((d) => !scoredDays.has(d));
    if (unscored.length && offered("score_pitches") && done("finish_week").length === 0) return { text: "Out of research budget: scoring the days we have.", calls: unscored.map((day) => ({ toolName: "score_pitches", input: { day } })) };
    return finishWeek();
  }
  if (scenario === "never-finish") return { text: "Looking at the taste map again.", calls: [{ toolName: "taste_map", input: { day: days[0], radiusM: 200 + 100 * results.length } }] };
  if (done("finish_week").length > 0) return finishWeek();
  if (tools.includes("compare_areas") && !done("compare_areas").length && !done("taste_map").length) {
    return { text: "This city is planned across its areas, so we'll compare them first.", calls: [{ toolName: "compare_areas", input: { day: days[0] } }] };
  }
  if (!done("taste_map").length) return { text: "We'll start with the taste map: taste doesn't change by day, so once is enough.", calls: [{ toolName: "taste_map", input: { day: days[0] } }] };
  const cells = (done("taste_map")[0]?.output.value as TasteOut | undefined)?.strongest ?? [];
  const unnamed = cells.length > 0 && cells.every((c) => !c.near) && typeof cells[0].lat === "number" && typeof cells[0].lon === "number";
  const strongest = unnamed ? "the strongest taste cell" : (cells.find((c) => c.near)?.near ?? "Federation Square");
  const at = unnamed ? { lat: cells[0].lat, lon: cells[0].lon } : { place: strongest };
  if (!done("crowd_at").length) {
    return {
      reasoning: `The strongest taste area is near ${strongest}; who is there decides whether it suits this act any day of the week.`,
      text: `Checking who the crowd is near ${strongest}.`,
      calls: [{ toolName: "crowd_at", input: { day: days[0], at, radiusM: 400 } }],
    };
  }
  if (!done("activity_at").length) {
    return { text: `Comparing the estimated activity near ${strongest} across the days.`, calls: days.map((day) => ({ toolName: "activity_at", input: { day, at } })) };
  }
  if (!done("events_near").length) {
    return { text: "Checking which days have an event crowd nearby.", calls: days.map((day) => ({ toolName: "events_near", input: { day, near: at } })) };
  }
  const unscored = days.filter((d) => !scoredDays.has(d));
  if (unscored.length && offered("score_pitches")) return { text: "Letting the engine score each day's pitches.", calls: unscored.map((day) => ({ toolName: "score_pitches", input: { day } })) };
  if (scenario === "text-only") return { text: "That is everything we need for the week.", calls: [] };
  return finishWeek();
}

export function createMockWeekPlanner(scenario: MockWeekScenario = "investigate") {
  return new MockLanguageModelV4({
    modelId: "mock-week-planner",
    doStream: async (options) => {
      if (scenario === "fail") throw new Error("mock model failure");
      const prompt = options.prompt as PromptMessage[];
      const tools = (options.tools ?? []).map((t) => t.name);
      return streamOf(nextWeekMove(toolResults(prompt), tools, playableDays(prompt), scenario));
    },
  });
}
