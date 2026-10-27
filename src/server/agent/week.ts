import "server-only";
import { tool, ToolLoopAgent, type LanguageModel, type ModelMessage, type StopCondition, type ToolSet } from "ai";
import { z } from "zod";
import { PERSONA_PROMPT } from "@/lib/agent-persona";
import { planRequestSchema, type Plan, type PlanRequest } from "@/lib/plan-schema";
import { NO_SCORES_RULE, plainScores } from "@/lib/plain-scores";
import { NO_TOOL_NAMES_RULE, plainTools } from "@/lib/plain-tools";
import { boundSongs, PLAN_PROMPT_SONGS } from "@/lib/plan-songs-bound";
import { fromToolOutputs, ZERO_TOTALS, type ResearchTotals, type ToolResult } from "@/lib/research-totals";
import { isAnyTime, localHour, weekdayOf } from "@/lib/slot";
import { isAnyTimeDay, isOffDay, weekResultSchema, type WeekDayInput, type WeekDayResult, type WeekRequest, type WeekResult } from "@/lib/week-schema";
import { PASSED_REASON, weekShellFor, windowOf, type ShellDay } from "@/lib/week-shell";

export { PASSED_REASON, windowOf };
import type { AdapterContext } from "@/server/adapters/core";
import * as qloo from "@/server/adapters/qloo";
import { withQlooUsage, type QlooUsage } from "@/server/adapters/qloo/usage";
import { cityOf } from "@/server/cities";
import { serverNow } from "@/server/clock";
import { providerStatus } from "@/server/env";
import { log } from "@/server/log";
import { slotPassed } from "@/server/plans";
import { QlooUnavailableError, type AgentEvents, type Usage } from "./agent";
import { assemblePlan } from "./assemble";
import { PlanContext } from "./context";
import { createMockWeekPlanner } from "./mock-model";
import { MODELS, PLANNER_PROVIDER_OPTIONS } from "./models";
import { AgentState, CROWD_TOOLS, createTools, GATE_TOOLS, MAX_FINISH_REJECTIONS, MIN_LOOKS, NumberBag, outputForPage, toolStart } from "./tools";
import { WhereError } from "./where";
import { enforceSpread, spreadProblems, WEEK_MIN_SPACING_M, type SpreadDay } from "./week-spread";
import { districtOf } from "@/server/scoring";

/**
 * "Plan my week" (V2 plan phase 4): ONE run of the Hive over the next 7 days. The model gets the busk agent's tools, each
 * with a `day` argument that routes to that day's PlanContext (taste doesn't change by day, so those calls hit the cache),
 * sees every day, and decides the best pitch per day and which days are worth it. There is no engine fallback: without an
 * accepted answer the week fails. Each picked day is assembled from the Hive's pick only and becomes a normal busk plan; the
 * route stores it behind its own short link (/p/<id>).
 */

/** The week run's caps: steps, wall time, model spend (US$) and Qloo requests (cache hits are free). */
export const WEEK_LIMITS = {
  maxSteps: 30,
  timeoutMs: 240_000,
  maxOutputTokensPerStep: 4000,
  costCapUsd: 1.2,
  qlooCap: 150,
  /** Share of a cap at which the run wraps up: score what's unscored, then finish_week. Leaves room for the day plans' own loads. */
  wrapAt: 0.7,
};

/** Claude Sonnet list price through AI Gateway, US$ per million tokens. */
export const PLANNER_PRICE = { input: 2, output: 10 };
export const costUsd = (inputTokens: number, outputTokens: number) => (inputTokens * PLANNER_PRICE.input + outputTokens * PLANNER_PRICE.output) / 1_000_000;

export class WeekNoMatchError extends Error {
  constructor() {
    super("Qloo matched none of the artists");
    this.name = "WeekNoMatchError";
  }
}

export class WeekNoDaysLeftError extends Error {
  constructor() {
    super("every playable day has passed");
    this.name = "WeekNoDaysLeftError";
  }
}

export class WeekPlannerUnavailableError extends Error {
  constructor(readonly reason: "not-configured" | "failed" | "timeout" | "no-answer") {
    super(`week planner ${reason}`);
    this.name = "WeekPlannerUnavailableError";
  }
}

export const WEEK_INSTRUCTIONS = `${PERSONA_PROMPT}

Your job here: a street performer wants the best pitch for each day they can play in the next 7 days, and to know which of those days are worth going out at all. You investigate with tools; every tool takes the day it is for. Busk Map's scoring engine is a calculator you call per day: score_pitches scores that day's pitches, and you choose among the pitches it scored.

How to work:
1. Investigate first. score_pitches stays closed until you have made at least 3 looks with taste_map, crowd_at, events_near, activity_at, busy_places or check_pitch (any days), and at least one of them is taste_map, crowd_at or events_near. Taste (taste_map, crowd_at) doesn't change by day: look once. What changes by day is the activity at that weekday and hour, the events that day and the weather: compare the days on those.
2. Run check_pitch on promising spots the data points to, for the days you'd play them, so the engine can score them.
3. Call score_pitches for each day you might recommend (add the spots you checked for that day).
4. Choose. For each day, the single best pitch, or no pitch when the day is clearly weak for this act (quiet at those hours, rain, nothing for this crowd). Compare the days with each other: say what makes the strong days strong.
5. Spread the week, a hard rule. In a city planned in areas (score_pitches shows each pitch's district), each day's pick comes from an area no other day uses, while that day has a scored pitch in an unused area; only when every area is used may one repeat (the least-used, never the day before's). Elsewhere, never the same pitch twice, and each day's pick at least ${WEEK_MIN_SPACING_M} m from every other day's. finish_week sends back a pick that breaks it and names the areas used; if you insist, Busk Map swaps in that day's best allowed pitch.
6. Finish with finish_week: every playable day once, with a pitchId from that day's score_pitches and a why, or pitchId null and the reason the day isn't worth it; a two-sentence summary of the week; data caveats. If finish_week rejects your answer, fix what it says and call it again. Always end the run with finish_week.

Before each tool call, write one short sentence saying what you will check next and why. You may call several tools at once. Look only inside the planning area. Point at places by pitchId, by name, or with coordinates from a tool result. You have about 25 tool calls for the whole week. Don't repeat a call with the same inputs.

Rules:
- Never invent a number, a place, an event or a song. Every number you write must come from a tool result.
- ${NO_SCORES_RULE}
- ${NO_TOOL_NAMES_RULE}
- Activity is a relative estimate from Qloo, never a count of people; event end times are estimates too: say so.
- Busk Map never claims a pitch is legal. Mention cautions when a tool lists them.
- Taste data is aggregate. Never describe an individual.
- Be brief and concrete. Australian English.`;

/** The tools offered per day (learn_these is the Repertoire's own run, not part of the week). */
const DAY_TOOLS = ["compare_areas", "taste_map", "crowd_at", "busy_places", "events_near", "activity_at", "check_pitch", "score_pitches", "best_hours", "compare_crowds", "build_setlist"] as const;
type DayTool = (typeof DAY_TOOLS)[number];
const INVESTIGATION: readonly string[] = GATE_TOOLS;

export const finishWeekSchema = (dates: [string, ...string[]]) =>
  z.object({
    summary: z.string().max(1500).describe("Two sentences on the week: which days are best and why, from tool results only."),
    days: z
      .array(
        z.object({
          day: z.enum(dates),
          pitchId: z.string().nullable().describe("A pitchId exactly as score_pitches returned it for that day, or null when the day isn't worth it."),
          why: z.string().max(1200).describe("Why this crowd on this day (one or two sentences citing what you checked), or why the day is weak."),
        }),
      )
      .max(7)
      .describe("Every playable day, once."),
    notes: z.array(z.string().max(600)).max(8).describe("Data caveats, e.g. a missing source or an estimate."),
  });
export type WeekAnswer = { summary: string; days: { day: string; pitchId: string | null; why: string }[]; notes: string[] };

/** One playable day: its plan request, context and tool state. */
export type WeekDay = { date: string; request: PlanRequest; ctx: PlanContext; state: AgentState };

/** The busk request for one day of the week: a normal plan request with that day's hours. Outside Melbourne no permit is asked. */
export function dayRequest(week: WeekRequest, day: Exclude<WeekDayInput, { off: true }>): PlanRequest {
  const melbourne = week.city === "melbourne";
  // Parsed, so its keys are in the schema's order: the stored plan's run key (planKey hashes the JSON) then matches the
  // request /p/<id> reads back, and the day's link replays its stored run instead of running again.
  return planRequestSchema.parse({
    city: week.city,
    ...(week.place ? { place: week.place } : {}),
    permit: melbourne ? week.permit : "general",
    performer: week.performer,
    slot: isAnyTimeDay(day) ? { date: day.date, any: true } : { date: day.date, startHour: day.startHour, endHour: day.endHour },
    ...(week.weights ? { weights: week.weights } : {}),
  });
}

/** The city a week is planned in. */
export const weekCity = (week: Pick<WeekRequest, "city" | "place">) => cityOf(week);


/** Playable days whose hours are over at `now` (city time): not researched, shown as can't play with PASSED_REASON. */
export function daysPassed(request: WeekRequest, now = serverNow().getTime()): Set<string> {
  const { timeZone } = weekCity(request);
  return new Set(request.days.flatMap((d) => (!isOffDay(d) && slotPassed(dayRequest(request, d).slot, timeZone, now) ? [d.date] : [])));
}


export function buildWeekPrompt(week: WeekRequest, days: WeekDay[], matched: { query: string; match: string | null }[], areas: string[] = []): string {
  const first = days[0];
  const songs = boundSongs(first.ctx.songs$, PLAN_PROMPT_SONGS).map((s) => `${s.title} (${s.artist}${s.own ? ", own song" : ""})`).join("; ");
  const city = first.ctx.city;
  const box = city.bbox;
  const found = matched.filter((m) => m.match);
  const missing = matched.filter((m) => !m.match).map((m) => m.query);
  const off = week.days.filter(isOffDay).map((d) => `${d.date} (${weekdayOf(d.date)})`);
  return [
    `Performer: ${week.performer.name}.`,
    `Sounds like: ${week.performer.artists.join(", ")}. Qloo matched: ${found.map((m) => m.match).join(", ") || "none"}${missing.length ? `; no match for ${missing.join(", ")}` : ""}.`,
    songs ? `Can play: ${songs}.` : "No song list given.",
    `City: ${city.name}.${first.ctx.levels.rules === "none" ? " This city's busking rules are not checked: never call a pitch allowed or legal." : ` Permit: ${first.request.permit}.`}`,
    `Playable days: ${days.map((d) => `${d.date} (${weekdayOf(d.date)}, ${isAnyTime(d.request.slot) ? "any time: the engine picks the hours, see best_hours" : windowOf(d.request.slot)})`).join("; ")}.`,
    off.length ? `Can't play: ${off.join(", ")}.` : "",
    `Planning area: latitude ${box.south} to ${box.north}, longitude ${box.west} to ${box.east}.`,
    areas.length > 1 ? `${city.name} is planned across its areas: ${areas.join(", ")}. Call compare_areas once and weigh areas across the city before you pick.` : "",
    "Find the best pitch for each playable day, say which days are worth it, and explain why each crowd fits.",
  ]
    .filter(Boolean)
    .join("\n");
}

type Problem = { kind: "pool" | "days" | "numbers" | "spread"; message: string; numbers?: string[] };

/** Each playable day's scored pool and (a metro planned in districts) the area a pitch is in, for the spread rule. */
export function spreadDays(days: ReadonlyMap<string, WeekDay>): Map<string, SpreadDay> {
  return new Map(
    [...days.values()].map((d) => {
      const districts = d.state.districts;
      const areaOf = districts.length > 1 ? (p: { lat: number; lon: number }) => districts.find((x) => x.id === districtOf(p, districts))?.name ?? null : null;
      return [d.date, { pool: [...d.state.pool.values()], areaOf }];
    }),
  );
}


/** The guardrails on the week's answer. Pure, so tests can call it directly. */
export function checkWeekAnswer(answer: WeekAnswer, days: Map<string, WeekDay>, seen: NumberBag): Problem[] {
  const problems: Problem[] = [];
  const given = answer.days.map((d) => d.day);
  const missing = [...days.keys()].filter((d) => !given.includes(d));
  const repeated = given.filter((d, i) => given.indexOf(d) !== i);
  if (missing.length) problems.push({ kind: "days", message: `Every playable day needs an entry: missing ${missing.join(", ")}.` });
  if (repeated.length) problems.push({ kind: "days", message: `Each day only once: ${[...new Set(repeated)].join(", ")}.` });
  for (const entry of answer.days) {
    const day = days.get(entry.day);
    if (!day || entry.pitchId === null) continue;
    if (day.state.pool.size === 0) {
      problems.push({ kind: "pool", message: `Call score_pitches for ${entry.day} before choosing a pitch for it.` });
    } else if (!day.state.pool.has(entry.pitchId)) {
      const best = [...day.state.pool.values()].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, 5);
      const listing = best.map((p) => `${p.id} (${p.name})`).join("; ");
      problems.push({ kind: "pool", message: `${entry.pitchId} isn't in ${entry.day}'s scored pool. Best scored that day: ${listing}.` });
    }
  }
  // Spread: no area (a metro) or pitch and 400 m (elsewhere) twice in the week while the pools allow it.
  for (const message of spreadProblems(answer.days, spreadDays(days))) problems.push({ kind: "spread", message });
  const anyPool = [...days.values()].some((d) => d.state.pool.size > 0);
  if (anyPool && answer.days.length > 0 && answer.days.every((d) => d.pitchId === null)) problems.push({ kind: "days", message: "Recommend a pitch for at least one day." });
  const text = [answer.summary, ...answer.days.map((d) => d.why), ...answer.notes].join(" ");
  const unknownNumbers = seen.unknownIn(text);
  if (unknownNumbers.length) {
    problems.push({ kind: "numbers", numbers: unknownNumbers, message: `These numbers aren't in any tool result: ${unknownNumbers.join(", ")}. Use only numbers the tools returned.` });
  }
  return problems;
}

/** Shared state for the week: the looks (they open score_pitches for every day), the numbers seen, the answer. */
export class WeekState {
  readonly looks: string[] = [];
  readonly seen = new NumberBag();
  answer: WeekAnswer | null = null;
  rejections = 0;
  unverifiedNumbers: string[] = [];
  wrappingUp = false;
}

type AnyTool = { description?: string; inputSchema: unknown; execute?: (input: never, options: never) => unknown };

/** The busk agent's tools for the week: each takes a `day` and runs that day's own tool; plus finish_week. */
export function createWeekTools(days: Map<string, WeekDay>, week: WeekState, qlooUsage: QlooUsage, qlooStop: number, offer: readonly DayTool[] = DAY_TOOLS) {
  const dates = [...days.keys()] as [string, ...string[]];
  const perDay = new Map([...days.values()].map((d) => [d.date, createTools(d.ctx, d.state) as unknown as Record<DayTool, AnyTool>]));
  const dayArg = z.enum(dates).describe("The day this is for: one of the playable days (YYYY-MM-DD).");
  const run = async (name: DayTool, day: string, input: unknown, options: unknown) => {
    // Qloo-backed looks stop at the week's Qloo cap; score_pitches and the rest use what's loaded.
    if (qlooUsage.calls >= qlooStop && INVESTIGATION.includes(name)) throw new WhereError("This week's Qloo budget is used up: score the days you have and call finish_week.");
    const own = perDay.get(day)?.[name];
    // best_hours exists only for any-time days.
    if (!own?.execute) throw new WhereError(`${name} isn't available for ${day}: that day has picked hours.`);
    const out = (await own.execute(input as never, options as never)) as Record<string, unknown>;
    return { day, ...out };
  };
  const tools: ToolSet = {};
  for (const name of offer) {
    // Offered when at least one day has it (best_hours: any-time days only).
    const base = [...perDay.values()].map((t) => t[name]).find((t) => t?.execute);
    if (!base) continue;
    const schema = base.inputSchema as z.ZodObject;
    tools[name] = tool({
      description: `${base.description ?? ""} For one day: give its date as \`day\`.`,
      inputSchema: schema.extend({ day: dayArg }),
      execute: async (input: Record<string, unknown>, options) => {
        const { day, ...rest } = input as { day: string };
        return run(name, day, rest, options);
      },
    });
  }
  tools.finish_week = tool({
    description: "Finish: for every playable day, the best pitchId from that day's score_pitches with a short evidence-based why, or null with why the day isn't worth it; a two-sentence summary; data caveats. Rejected answers say why; fix and call again.",
    inputSchema: finishWeekSchema(dates),
    execute: async (answer: WeekAnswer, options) => {
      // A run cut short still finishes against scored pools: score each unscored day now (scoring is open when wrapping up).
      if (week.wrappingUp) for (const d of days.values()) if (!d.state.scored) await run("score_pitches", d.date, {}, options).catch(() => null);
      const problems = checkWeekAnswer(answer, days, week.seen);
      // Spread and numbers problems stop blocking after MAX_FINISH_REJECTIONS, or at once when the run is wrapping up: the engine
      // then enforces the spread rule itself (below).
      if (problems.length > 0 && !(problems.every((p) => p.kind === "numbers" || p.kind === "spread") && (week.rejections >= MAX_FINISH_REJECTIONS || week.wrappingUp))) {
        week.rejections++;
        return { accepted: false, summary: `Rejected: ${problems.map((p) => p.message).join(" ")}`, problems: problems.map((p) => p.message) };
      }
      if (problems.length > 0) week.unverifiedNumbers = problems.flatMap((p) => p.numbers ?? []);
      // The engine holds the spread rule even when the model insists: a pick that breaks it becomes the day's best allowed one.
      const { picks, changed } = enforceSpread(answer.days, spreadDays(days));
      if (changed.length) log.warn("week spread enforced by the engine", { days: changed });
      week.answer = { ...answer, days: picks };
      const picked = answer.days.filter((d) => d.pitchId !== null);
      return { accepted: true, summary: `Accepted: ${picked.length} day${picked.length === 1 ? "" : "s"} planned` };
    },
  });
  return tools;
}

export type WeekRunEvents = AgentEvents & { onStatus?: (message: string) => void };
export type WeekRunOptions = { model?: LanguageModel; limits?: Partial<typeof WEEK_LIMITS>; now?: Date };

export type DayOutcome = { date: string; request: PlanRequest; plan: Plan; toolCallIds: Set<string> };

export type WeekRun = {
  /** The week, before the day plans get their ids (the route stores them and fills planId). */
  week: WeekResult;
  /** One per planned day: the assembled plan to store as /p/<id>. */
  plans: DayOutcome[];
  usage: Usage;
  costUsd: number;
  qlooCalls: number;
};

/** Forcing a tool call is refused while Claude's thinking is on, so a forced wrap-up step turns it off. */
const NO_THINKING = { anthropic: { thinking: { type: "disabled" } } } as const;
const FINAL_ROUND_STEPS = 3;
const FINISH_NUDGE = "You stopped without calling finish_week, so the performer has no week yet. Call finish_week now with every playable day (score_pitches first for a day you haven't scored), and put anything that failed or was missing in notes.";

/** The week's shell before or without a run: the days from the request (pending, or can't play). */
export function weekShell(id: string | null, request: WeekRequest, days: readonly ShellDay[] | null, adapters: Pick<AdapterContext, "offline">, passed: Set<string> = new Set()): WeekResult {
  return weekShellFor(request, { id, days, passed, qlooMode: qloo.qlooMode({ offline: adapters.offline, faults: [] }) });
}

/** One ready day, from its plan. */
export function dayFromPlan(day: WeekDayResult, planId: string | null, plan: Plan): WeekDayResult {
  const top = plan.pitches[0];
  if (!top) return { ...day, status: "failed", planId, reason: plan.notes[0] ?? "No pitch could be planned for this day." };
  return {
    ...day,
    status: "ready",
    planId,
    slot: { startHour: plan.slot.startHour, endHour: plan.slot.endHour },
    window: windowOf(plan.slot),
    pitch: { id: top.id, name: top.name, lat: top.lat, lon: top.lon, score: top.score, discovery: top.discovery, why: top.why },
    reason: null,
    weather: plan.weather,
  };
}

/**
 * Run the week. Throws QlooUnavailableError (Qloo down, checked before any model call), WeekNoMatchError (no artist matched,
 * nothing to investigate), WeekNoDaysLeftError, or WeekPlannerUnavailableError (no gateway, the model failed or timed out, or
 * no acceptable answer): the week never falls back to the engine.
 */
export async function runWeekAgent(request: WeekRequest, adapters: AdapterContext, today: string, events: WeekRunEvents = {}, abortSignal?: AbortSignal, options: WeekRunOptions = {}): Promise<WeekRun> {
  return withQlooUsage((qlooUsage) => runWeek(request, adapters, today, events, abortSignal, options, qlooUsage));
}

async function runWeek(request: WeekRequest, adapters: AdapterContext, today: string, events: WeekRunEvents, abortSignal: AbortSignal | undefined, options: WeekRunOptions, qlooUsage: QlooUsage): Promise<WeekRun> {
  const limits = { ...WEEK_LIMITS, ...options.limits };
  const now = options.now ?? serverNow();
  const city = weekCity(request);
  const nowHour = localHour(city.timeZone, now);
  const days = new Map<string, WeekDay>();
  const week = new WeekState();
  const passed = daysPassed(request, now.getTime());
  // The days share every load that doesn't depend on the day (taste, crowd, scene, songs): made once for the week.
  const shared = new Map<string, Promise<unknown>>();
  for (const d of request.days) {
    if (isOffDay(d) || passed.has(d.date)) continue;
    const req = dayRequest(request, d);
    const state = new AgentState();
    // One set of looks and one numbers bag for the whole week: the gate and the numbers check see every day.
    (state as { looks: string[] }).looks = week.looks;
    (state as { seen: NumberBag }).seen = week.seen;
    days.set(d.date, { date: d.date, request: req, ctx: new PlanContext(req, adapters, today, nowHour, shared), state });
  }
  if (days.size === 0) throw new WeekNoDaysLeftError();
  const first = days.values().next().value!;

  // Qloo is required: check it before spending anything.
  events.onStatus?.("Checking Qloo for your artists");
  const artists = await first.ctx.artists();
  if (first.ctx.qlooFailed()) throw new QlooUnavailableError();
  if ((await first.ctx.entityIds()).length === 0) throw new WeekNoMatchError();
  const offline = adapters.offline;
  if (!offline && !options.model && !providerStatus().aiGateway) throw new WeekPlannerUnavailableError("not-configured");

  const ranked = await first.ctx.rankedAreas();
  const prompt = buildWeekPrompt(request, [...days.values()], artists.map((a) => ({ query: a.query, match: a.entity?.name ?? null })), ranked.map((a) => a.name));
  week.seen.add(prompt);
  week.seen.add(WEEK_INSTRUCTIONS);
  // compare_areas only where there are areas to compare (a metro), like a busk.
  const offer = DAY_TOOLS.filter((t) => t !== "compare_areas" || ranked.length > 1);
  const tools = createWeekTools(days, week, qlooUsage, limits.qlooCap * limits.wrapAt, offer);
  const toolNames = Object.keys(tools);
  const gateOpen = () => week.wrappingUp || (week.looks.length >= MIN_LOOKS && week.looks.some((t) => (CROWD_TOOLS as readonly string[]).includes(t)));
  const setWrapping = () => {
    week.wrappingUp = true;
    for (const d of days.values()) d.state.wrappingUp = true;
  };

  let inputTokens = 0;
  let outputTokens = 0;
  let reasoningTokens = 0;
  let steps = 0;
  const spent = () => costUsd(inputTokens, outputTokens);
  const finished: StopCondition<ToolSet> = () => week.answer !== null;
  const overBudget: StopCondition<ToolSet> = () => spent() >= limits.costCapUsd;
  const outOfSteps: StopCondition<ToolSet> = ({ steps: s }) => s.length >= limits.maxSteps;
  const started = Date.now();
  const timeout = AbortSignal.timeout(limits.timeoutMs);
  const deadline = started + limits.timeoutMs;
  const pastDeadline = () => timeout.aborted || Date.now() >= deadline;
  const signal = AbortSignal.any([timeout, ...(abortSignal ? [abortSignal] : [])]);
  const toolResults: (ToolResult & { day: string | null; id: string })[] = [];
  const dayOf = new Map<string, string>();
  const model = options.model ?? (offline ? createMockWeekPlanner() : MODELS.planner);
  const wrapStep = (instructions: string) => ({
    activeTools: [...days.values()].some((d) => !d.state.scored) ? ["score_pitches", "finish_week"] : ["finish_week"],
    toolChoice: "required" as const,
    providerOptions: NO_THINKING,
    instructions: `${WEEK_INSTRUCTIONS}\n\n${instructions}`,
  });
  const totals = () => ({ ...weekTotals(toolResults, days), qlooCalls: qlooUsage.calls, qlooCacheHits: qlooUsage.cacheHits });

  events.onStatus?.(`Planning ${days.size} day${days.size === 1 ? "" : "s"}`);
  try {
    const agent = new ToolLoopAgent({
      model,
      instructions: WEEK_INSTRUCTIONS,
      tools,
      stopWhen: [finished, overBudget, outOfSteps],
      maxOutputTokens: limits.maxOutputTokensPerStep,
      providerOptions: PLANNER_PROVIDER_OPTIONS,
      prepareStep: ({ stepNumber }) => {
        const near = stepNumber >= limits.maxSteps - 2 || spent() >= limits.costCapUsd * limits.wrapAt || qlooUsage.calls >= limits.qlooCap * limits.wrapAt;
        if (near) {
          setWrapping();
          return wrapStep("Your research budget for the week is used up: score any day you haven't scored, then call finish_week with what you have.");
        }
        if (!gateOpen()) return { activeTools: toolNames.filter((t) => INVESTIGATION.includes(t)) };
        return {};
      },
    });
    const buffers = new Map<string, { kind: "reasoning" | "text"; text: string }>();
    const flush = (key: string) => {
      const b = buffers.get(key);
      buffers.delete(key);
      const text = b ? plainTools(b.text.trim()) : "";
      if (b && text) events.onNote?.({ kind: b.kind, text });
    };
    const unshown = new Set<string>();
    const consume = async (run: Awaited<ReturnType<typeof agent.stream>>) => {
      for await (const part of run.fullStream) {
        // The run's own deadline, between parts too (a model that ignores the abort signal still stops).
        if (signal.aborted || pastDeadline()) throw Object.assign(new Error(pastDeadline() ? "agent timeout" : "agent aborted"), { name: pastDeadline() ? "TimeoutError" : "AbortError" });
        switch (part.type) {
          case "reasoning-start":
            buffers.set(`r:${part.id}`, { kind: "reasoning", text: "" });
            break;
          case "text-start":
            buffers.set(`t:${part.id}`, { kind: "text", text: "" });
            break;
          case "reasoning-delta": {
            const b = buffers.get(`r:${part.id}`);
            if (b) b.text += part.text;
            break;
          }
          case "text-delta": {
            const b = buffers.get(`t:${part.id}`);
            if (b) b.text += part.text;
            break;
          }
          case "reasoning-end":
            flush(`r:${part.id}`);
            break;
          case "text-end":
            flush(`t:${part.id}`);
            break;
          case "tool-call": {
            if (part.invalid) {
              unshown.add(part.toolCallId);
              break;
            }
            for (const key of [...buffers.keys()]) flush(key);
            const day = (part.input as { day?: unknown } | undefined)?.day;
            if (typeof day === "string") dayOf.set(part.toolCallId, day);
            const start = part.toolName === "finish_week" ? { label: "Final answer for the week" } : toolStart(part.toolName, first.ctx.levels);
            events.onToolStart?.({ id: part.toolCallId, tool: part.toolName, ...start, input: part.input });
            break;
          }
          case "tool-result": {
            const output = part.output as { summary?: unknown; accepted?: boolean } | undefined;
            const ok = part.toolName !== "finish_week" || output?.accepted === true;
            const day = dayOf.get(part.toolCallId) ?? null;
            const own = day ? days.get(day) : undefined;
            const shown = own ? await outputForPage(part.toolName, part.input, part.output, own.ctx, own.state) : part.output;
            toolResults.push({ id: part.toolCallId, day, tool: part.toolName, ok, output: shown });
            events.onToolEnd?.({ id: part.toolCallId, tool: part.toolName, ok, summary: typeof output?.summary === "string" ? output.summary : "Done", output: shown });
            events.onTotals?.(totals());
            break;
          }
          case "tool-error": {
            if (unshown.has(part.toolCallId)) break;
            const message = part.error instanceof Error ? part.error.message : String(part.error);
            toolResults.push({ id: part.toolCallId, day: dayOf.get(part.toolCallId) ?? null, tool: part.toolName, ok: false });
            events.onToolEnd?.({ id: part.toolCallId, tool: part.toolName, ok: false, summary: message.slice(0, 300), output: { error: message.slice(0, 600) } });
            events.onTotals?.(totals());
            break;
          }
          case "finish-step":
            steps++;
            inputTokens += part.usage.inputTokens ?? 0;
            outputTokens += part.usage.outputTokens ?? 0;
            reasoningTokens += part.usage.outputTokenDetails?.reasoningTokens ?? 0;
            break;
          case "error":
            if (part.error instanceof Error && part.error.name === "AI_ToolChoiceViolationError") return;
            throw part.error instanceof Error ? part.error : new Error(String(part.error));
          case "abort":
            throw Object.assign(new Error(timeout.aborted ? "agent timeout" : "agent aborted"), { name: timeout.aborted ? "TimeoutError" : "AbortError" });
          default:
            break;
        }
      }
      for (const key of [...buffers.keys()]) flush(key);
    };
    const result = await agent.stream({ prompt, abortSignal: signal });
    await consume(result);
    // The model ended a step with text alone: one short final round, with the same tools, forces finish_week.
    const left = limits.maxSteps - steps;
    if (!week.answer && left > 0 && spent() < limits.costCapUsd && !signal.aborted) {
      log.warn("week agent stopped without finish_week; forcing a final answer", { steps });
      setWrapping();
      // Every step's messages (result.response holds the last step's only).
      const messages = await result.responseMessages;
      const finalRound = new ToolLoopAgent({
        model,
        instructions: WEEK_INSTRUCTIONS,
        tools,
        stopWhen: [finished, overBudget, ({ steps: done }) => done.length >= Math.min(left, FINAL_ROUND_STEPS)],
        maxOutputTokens: limits.maxOutputTokensPerStep,
        providerOptions: PLANNER_PROVIDER_OPTIONS,
        prepareStep: () => wrapStep("You stopped without calling finish_week: call it now with what you have."),
      });
      const nudge: ModelMessage = { role: "user", content: FINISH_NUDGE };
      await consume(await finalRound.stream({ messages: [{ role: "user", content: prompt }, ...messages, nudge], abortSignal: signal }));
    }
  } catch (error) {
    const timedOut = pastDeadline() || (error instanceof Error && error.name === "TimeoutError");
    log.error("week agent failed", { error: error instanceof Error ? error.message : "unknown", timedOut });
    throw new WeekPlannerUnavailableError(timedOut ? "timeout" : "failed");
  }
  const stoppedBy: Usage["stoppedBy"] = week.answer ? "finished" : spent() >= limits.costCapUsd ? "tokens" : steps >= limits.maxSteps ? "steps" : "no-answer";
  const usage: Usage = { inputTokens, outputTokens, reasoningTokens, steps, ms: Date.now() - started, stoppedBy };
  log.info("week agent finished", { ...usage, costUsd: spent(), qlooCalls: qlooUsage.calls, model: options.model ? "custom" : offline ? "mock" : MODELS.planner });
  if (!week.answer) throw new WeekPlannerUnavailableError("no-answer");
  const answer = week.answer;

  // Each picked day: the Hive's pick only, assembled into a normal plan with that day's own steps.
  const modelName = offline && !options.model ? "mock" : "claude";
  const outcomes: DayOutcome[] = [];
  const results = new Map<string, WeekDayResult>();
  const shell = weekShell(null, request, null, adapters, passed);
  const shellDay = new Map(shell.days.map((d) => [d.date, d]));
  for (const entry of answer.days) {
    const day = days.get(entry.day);
    if (!day) continue;
    const base = shellDay.get(day.date)!;
    if (entry.pitchId === null) {
      results.set(day.date, { ...base, status: "not-worth", reason: plainTools(plainScores(entry.why.trim())) || "The Hive found this day weak for your act." });
      continue;
    }
    const own = toolResults.filter((r) => r.day === day.date);
    const plan = await assemblePlan(
      day.ctx,
      { summary: entry.why, pitches: [{ pitchId: entry.pitchId, why: entry.why }], notes: answer.notes },
      { pool: [...day.state.pool.values()], toolResults: own, unverifiedNumbers: week.unverifiedNumbers, model: modelName, agentOnly: true },
    );
    if (plan.researchTotals) plan.researchTotals = { ...plan.researchTotals, qlooCalls: qlooUsage.calls, qlooCacheHits: qlooUsage.cacheHits };
    const result = dayFromPlan(base, null, plan);
    if (result.status === "ready") outcomes.push({ date: day.date, request: day.request, plan, toolCallIds: new Set(own.map((r) => r.id)) });
    results.set(day.date, result);
  }

  const traceable = (text: string) => !week.unverifiedNumbers.some((n) => text.includes(n));
  const weekResult = weekResultSchema.parse({
    ...shell,
    status: "done",
    summary: traceable(answer.summary) ? plainTools(plainScores(answer.summary.trim())).slice(0, 600) : null,
    days: shell.days.map((d) => (d.status === "pending" ? (results.get(d.date) ?? { ...d, status: "failed", reason: "The Hive gave no answer for this day." }) : d)),
    notes: [...new Set([...[...days.values()].flatMap((d) => d.ctx.notes), ...answer.notes.filter(traceable).map((n) => plainTools(plainScores(n))).slice(0, 3)])],
    qlooMode: qloo.qlooMode(adapters),
    tasteCells: outcomes[0]?.plan.tasteCells ?? [],
    explanationsModel: modelName,
    researchTotals: totals(),
    usage: { steps: usage.steps, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, reasoningTokens: usage.reasoningTokens, ms: usage.ms },
    dataStatus: mergeStatus([...days.values()].flatMap((d) => d.ctx.dataStatus())),
  });
  return { week: weekResult, plans: outcomes, usage, costUsd: spent(), qlooCalls: qlooUsage.calls };
}

/** The week's research totals: each day's own totals, added up (taste and crowds are looked at once, for one day). */
export function weekTotals(results: (ToolResult & { day: string | null })[], days: Map<string, WeekDay>): ResearchTotals {
  const sum: ResearchTotals = { ...ZERO_TOTALS };
  for (const date of days.keys()) {
    const t = fromToolOutputs(results.filter((r) => r.day === date));
    for (const k of Object.keys(sum) as (keyof ResearchTotals)[]) (sum as Record<string, number>)[k] = (sum[k] ?? 0) + (t[k] ?? 0);
  }
  return sum;
}

/** One status per adapter, the worst of the days': fallback beats synthetic beats live. */
function mergeStatus<T extends { adapter: string; mode: "live" | "synthetic" | "fallback" }>(all: T[]): T[] {
  const rank = { live: 0, synthetic: 1, fallback: 2 } as const;
  const out = new Map<string, T>();
  for (const s of all) if (!out.has(s.adapter) || rank[s.mode] > rank[out.get(s.adapter)!.mode]) out.set(s.adapter, s);
  return [...out.values()];
}
