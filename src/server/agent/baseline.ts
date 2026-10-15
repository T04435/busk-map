import "server-only";
import { localToday } from "@/lib/slot";
import type { BaselineView, PlanRequest } from "@/lib/plan-schema";
import type { AdapterContext } from "@/server/adapters/core";
import { CITIES } from "@/server/cities";
import { PUBLIC_SPOTS, USUAL_HOTSPOTS } from "@/server/data/spots";
import { comparisonStore, recordComparison } from "@/server/comparisons/store";
import { log } from "@/server/log";
import { compareWithBaseline, comparisonRecord, type KnownPlace } from "@/server/scoring";
import { HOTSPOT_ALIASES, plainLlmSuggestion } from "./compare";
import { buildEnginePlan, engineContext, exampleIdFor } from "./preload";

/**
 * The plain-AI baseline for a plan: asked as soon as the plan page starts
 * (in parallel with the engine plan), cached under the plan's key, then
 * matched to the engine's pitches. It never feeds the engine.
 */
export type BaselineResult = { status: "ok"; baseline: BaselineView } | { status: "unavailable" | "error" };

const TTL_MS = 10 * 60_000;
const MAX = 100;
const memo = new Map<string, { at: number; result: Promise<BaselineResult> }>();

function knownPlaces(sites: { name: string; lat: number; lon: number }[], sensors: { name: string; lat: number; lon: number }[]): KnownPlace[] {
  const aliases = (name: string) => HOTSPOT_ALIASES.filter(([, target]) => target === name).map(([pattern]) => pattern);
  return [
    ...USUAL_HOTSPOTS.map((h) => ({ name: h.name, lat: h.lat, lon: h.lon, aliases: aliases(h.name) })),
    ...PUBLIC_SPOTS.map((s) => ({ name: s.name, lat: s.lat, lon: s.lon })),
    ...sites.map((s) => ({ name: s.name, lat: s.lat, lon: s.lon })),
    ...sensors.map((s) => ({ name: s.name, lat: s.lat, lon: s.lon })),
  ];
}

async function build(request: PlanRequest, adapters: AdapterContext, day: string): Promise<BaselineResult> {
  // The engine plan first, so every data call is cached before the comparison reads the context.
  const [plain] = await Promise.all([plainLlmSuggestion(request, adapters.offline), buildEnginePlan(request, adapters, day)]);
  if (plain.text === null) return { status: plain.reason };
  const ctx = engineContext(request, adapters, day);
  const [top, ranked, pitchData, footfall, scoreInputs] = await Promise.all([ctx.topPitches(), ctx.ranked(), ctx.pitchData(), ctx.footfall(), ctx.scoreInputs()]);
  const comparison = compareWithBaseline(plain.spots, {
    top,
    ranked,
    places: knownPlaces(pitchData.sites, footfall.sensors),
    area: ctx.city.bbox,
    legality: { sites: pitchData.sites, zones: pitchData.zones, hotspots: USUAL_HOTSPOTS, permit: request.permit },
    scoreInputs,
    weights: ctx.weights,
  });
  // Recorded for the uniqueness stats (GET /api/baseline-stats): ids and scores only, never the act's name.
  const performerKey = exampleIdFor(request, day) ?? "custom";
  const slot = `${request.slot.date} ${request.slot.startHour}-${request.slot.endHour}`;
  void recordComparison(comparisonStore(adapters.offline), comparisonRecord(comparison, top, performerKey, request.city, slot));
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
      })),
    },
  };
}

/** The baseline comparison for a plan request: started once per request and day, then reused. */
export function baselineFor(request: PlanRequest, adapters: AdapterContext, today?: string): Promise<BaselineResult> {
  const day = today ?? localToday(CITIES[request.city].timeZone);
  const key = JSON.stringify([request, adapters.offline, [...adapters.faults].sort(), day]);
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.result;
  const result = build(request, adapters, day).catch((error): BaselineResult => {
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
