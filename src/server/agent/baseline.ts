import "server-only";
import { isAnyTime } from "@/lib/slot";
import type { BaselineView, PlanRequest } from "@/lib/plan-schema";
import type { AdapterContext } from "@/server/adapters/core";
import { CITIES } from "@/server/cities";
import { USUAL_HOTSPOTS } from "@/server/data/spots";
import { comparisonStore, recordComparison } from "@/server/comparisons/store";
import { log } from "@/server/log";
import { processMap } from "@/server/memo";
import { compareWithBaseline, comparisonRecord, scorePitchAnyTime, type Candidate } from "@/server/scoring";
import { plainLlmSuggestion } from "./compare";
import { planKey, planStore, storeGet, storePut } from "./plan-store";
import { buildEnginePlan, engineContext, presetIdFor } from "./preload";
import { RUN_TTL_MS } from "./runs";
import { knownPlaces } from "./where";
import { serverToday } from "@/server/clock";

/**
 * The plain-AI baseline for a plan: asked as soon as the plan page starts
 * (in parallel with the engine plan), cached under the plan's key, then
 * matched to the engine's pitches. It never feeds the engine.
 */
export type BaselineResult = { status: "ok"; baseline: BaselineView } | { status: "unavailable" | "error" };

const TTL_MS = 10 * 60_000;
const MAX = 100;
const memo = processMap<string, { at: number; result: Promise<BaselineResult> }>("baselines");

async function build(request: PlanRequest, adapters: AdapterContext, day: string): Promise<BaselineResult> {
  // The engine plan first, so every data call is cached before the comparison reads the context.
  const [plain] = await Promise.all([plainLlmSuggestion(request, adapters.offline), buildEnginePlan(request, adapters, day)]);
  if (plain.text === null) return { status: plain.reason };
  const ctx = engineContext(request, adapters, day);
  const [top, ranked, pitchData] = await Promise.all([ctx.topPitches(), ctx.ranked(), ctx.pitchData()]);
  // Any time: the plain AI's spots are scored at their own best window, like the pool.
  const anyTime = ctx.isAnyTime ? await ctx.anyTimeBase() : null;
  const windows = ctx.windows();
  const comparison = compareWithBaseline(plain.spots, {
    top,
    ranked,
    places: knownPlaces(pitchData.sites),
    area: ctx.city.bbox,
    legality: { sites: pitchData.sites, zones: pitchData.zones, hotspots: USUAL_HOTSPOTS, permit: request.permit },
    ...(anyTime ? { scoreCandidate: (c: Candidate) => scorePitchAnyTime(c, anyTime, windows, ctx.weights) } : { scoreInputs: await ctx.scoreInputs() }),
    weights: ctx.weights,
  });
  // Recorded for the uniqueness stats (GET /api/baseline-stats): ids and scores only, never the act's name.
  const performerKey = presetIdFor(request) ?? "custom";
  const slot = isAnyTime(request.slot) ? `${request.slot.date} any` : `${request.slot.date} ${request.slot.startHour}-${request.slot.endHour}`;
  void recordComparison(comparisonStore(adapters.offline), comparisonRecord(comparison, top, performerKey, request.city, slot), planKey(request, adapters.offline, day));
  return {
    status: "ok",
    baseline: {
      model: plain.model,
      setlist: plain.setlist,
      bothAgree: comparison.bothAgree,
      onlyBuskMap: comparison.onlyBuskMap,
      plain: comparison.picks.map((p, i) => ({
        name: p.name,
        why: p.why,
        usualSpot: plain.spots[i].usualSpot,
        status: p.status,
        locatedBy: p.located?.via ?? null,
        place: p.located?.place ?? null,
        pitchId: p.pitchId,
        pitchName: p.pitchName,
        score: p.score,
        beatsOurs: p.beatsOurs,
        tooCloseTo: p.tooCloseTo,
      })),
    },
  };
}

function keyFor(request: PlanRequest, adapters: AdapterContext, today?: string) {
  const day = today ?? serverToday(CITIES[request.city].timeZone);
  return { day, key: JSON.stringify([request, adapters.offline, [...adapters.faults].sort(), day]) };
}

/** Whether the baseline for this request is already started or done (asking again costs no model call). */
export function hasBaseline(request: PlanRequest, adapters: AdapterContext, today?: string): boolean {
  const hit = memo.get(keyFor(request, adapters, today).key);
  return hit !== undefined && Date.now() - hit.at < TTL_MS;
}

/** The baseline comparison for a plan request: started once per request and day, then reused. */
export function baselineFor(request: PlanRequest, adapters: AdapterContext, today?: string): Promise<BaselineResult> {
  const { day, key } = keyFor(request, adapters, today);
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.result;
  // Shared across instances (plan-store.ts), like the agent's runs, for as long as a run is replayed. Test faults are never stored.
  const store = planStore(adapters.offline);
  const storeKey = planKey(request, adapters.offline, day);
  const shared = adapters.faults.length === 0;
  const ttl = RUN_TTL_MS;
  const result = (async (): Promise<BaselineResult> => {
    const stored = shared ? await storeGet<BaselineResult>(store, "baseline", storeKey) : null;
    if (stored?.value.status === "ok") return stored.value;
    const built = await build(request, adapters, day);
    if (shared && built.status === "ok") void storePut(store, "baseline", storeKey, built, ttl);
    return built;
  })().catch((error): BaselineResult => {
    log.error("baseline comparison failed", { error: error instanceof Error ? error.message : "unknown" });
    return { status: "error" };
  });
  memo.set(key, { at: Date.now(), result });
  // A failed comparison is retried on the next ask.
  void result.then((r) => {
    if (r.status !== "ok") memo.delete(key);
  });
  if (memo.size > MAX) memo.delete(memo.keys().next().value!);
  return result;
}
