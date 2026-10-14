import "server-only";
import { formatHour, describeSlot } from "@/lib/slot";
import { planSchema, type Plan, type PlanPitch } from "@/lib/plan-schema";
import type { ScoredPitch } from "@/server/scoring";
import type { PlanContext } from "./context";

/** What the model contributes: words only. Numbers and places come from the engine. */
export type AiText = {
  summary: string;
  pitches: { pitchId: string; why: string }[];
  notes: string[];
};

const TIME_FORMAT = new Intl.DateTimeFormat("en-AU", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Australia/Melbourne" });

/** A plain, factual "why" built only from the evidence. Used when the model is unavailable. */
export function templateWhy(pitch: ScoredPitch, weekday: string, startHour: number, endHour: number): string {
  const parts: string[] = [];
  if (pitch.factors.taste !== null) parts.push(`Taste match ${Math.round(pitch.factors.taste * 100)}/100 for your artists in this part of the city (Qloo).`);
  if (pitch.evidence.sensor) {
    parts.push(
      `About ${pitch.evidence.sensor.avgHourly.toLocaleString("en-AU")} people an hour passed ${pitch.evidence.sensor.name} on recent ${weekday[0].toUpperCase()}${weekday.slice(1)}s, ${formatHour(startHour)}–${formatHour(endHour)} (estimate from city sensors).`,
    );
  }
  const places = pitch.evidence.places.slice(0, 2).map((p) => p.name);
  if (places.length) parts.push(`Near ${places.join(" and ")}${pitch.evidence.places.every((p) => p.open === "open") ? ", open in your slot" : ""}.`);
  const event = pitch.evidence.events[0];
  if (event) {
    const time = TIME_FORMAT.format(new Date(event.moment === "leaving" ? event.end : event.start));
    parts.push(`${event.name} crowd ${event.moment === "leaving" ? "leaves" : "arrives"} around ${time}${event.endEstimated && event.moment === "leaving" ? " (estimated)" : ""}.`);
  }
  return parts.join(" ") || "Scored on the data available for this slot.";
}

function toPlanPitch(pitch: ScoredPitch, why: string, whySource: PlanPitch["whySource"], setlist: PlanPitch["setlist"]): PlanPitch {
  return {
    id: pitch.id,
    name: pitch.name,
    lat: pitch.lat,
    lon: pitch.lon,
    kind: pitch.kind,
    amplification: pitch.amplification,
    rules: pitch.rules,
    rulesUrl: pitch.rulesUrl,
    cautions: pitch.cautions,
    score: pitch.score,
    factors: pitch.factors,
    why,
    whySource,
    evidence: {
      sensor: pitch.evidence.sensor ? { name: pitch.evidence.sensor.name, avgHourly: pitch.evidence.sensor.avgHourly } : null,
      places: pitch.evidence.places.map((p) => ({ name: p.name, distanceM: p.distanceM, popularity: p.popularity, open: p.open })),
      events: pitch.evidence.events.map((e) => ({
        name: e.name,
        venue: e.venue.name,
        moment: e.moment,
        localTime: TIME_FORMAT.format(new Date(e.moment === "leaving" ? e.end : e.start)),
        endEstimated: e.endEstimated,
        url: e.url ?? null,
      })),
    },
    setlist,
  };
}

/**
 * Build the final plan from the engine's results and, when available, the
 * model's words. Only the engine's top pitches can appear; a "why" from the
 * model is used only for a pitch id the engine produced.
 */
export async function assemblePlan(context: PlanContext, ai: AiText | null): Promise<Plan> {
  const { request, city } = context;
  const [top, ranked, cells, locals, learn, weather, artists, footfall] = await Promise.all([
    context.topPitches(),
    context.ranked(),
    context.tasteCells(),
    context.localArtists(),
    context.learn(),
    context.weather(),
    context.artists(),
    context.footfall(),
  ]);

  const aiWhy = new Map((ai?.pitches ?? []).map((p) => [p.pitchId, p.why.trim()]));
  const pitches = await Promise.all(
    top.map(async (pitch) => {
      const fromAi = aiWhy.get(pitch.id);
      const why = fromAi || templateWhy(pitch, context.weekday, request.slot.startHour, request.slot.endHour);
      return toPlanPitch(pitch, why, fromAi ? "ai" : "template", await context.setlistFor(pitch));
    }),
  );
  const topIds = new Set(top.map((p) => p.id));
  const maxAffinity = Math.max(0, ...cells.map((c) => c.affinity));
  const usedAi = pitches.some((p) => p.whySource === "ai");

  const plan: Plan = {
    version: 1,
    city: request.city,
    cityName: city.name,
    slot: request.slot,
    slotLabel: describeSlot(request.slot),
    performerName: request.performer.name,
    permit: request.permit,
    qlooMode: context.adapters.offline || context.dataStatus().find((s) => s.adapter === "qloo")?.mode === "synthetic" ? "synthetic" : "live",
    explanations: usedAi ? "ai" : "template",
    summary:
      (usedAi && ai?.summary.trim()) ||
      (pitches.length > 0
        ? `Top pitch: ${pitches[0].name} (score ${pitches[0].score}/100).`
        : "No pitch could be recommended for this slot with the data available."),
    notes: [...context.notes, ...(usedAi ? (ai?.notes ?? []).slice(0, 3) : [])],
    weights: context.weights,
    pitches,
    others: ranked
      .filter((p) => !topIds.has(p.id))
      .slice(0, 25)
      .map((p) => ({ id: p.id, name: p.name, lat: p.lat, lon: p.lon, score: p.score, kind: p.kind })),
    tasteCells: cells.map((c) => ({ lat: c.lat, lon: c.lon, affinity: maxAffinity > 0 ? Math.round((c.affinity / maxAffinity) * 1000) / 1000 : 0 })),
    crowd: {
      localArtists: locals.slice(0, 8).map((a) => ({
        name: a.name,
        affinity: a.affinity,
        because: a.explanation
          .slice(0, 2)
          .map((e) => e.name ?? artists.find((r) => r.entity?.id === e.entityId)?.entity?.name ?? null)
          .filter((n): n is string => n !== null),
      })),
    },
    learnThese: learn.map((l) => ({ artist: l.artist, title: l.title, playcount: l.playcount, reason: l.reason })),
    weather: weather
      ? { hours: weather.hours.map((h) => ({ hour: h.hour, temperatureC: h.temperatureC, precipitationProbability: h.precipitationProbability, windKmh: h.windKmh })) }
      : null,
    resolvedArtists: artists.map((a) => ({ query: a.query, matched: a.entity?.name ?? null })),
    dataStatus: context.dataStatus(),
    footfallLevel: footfall.level,
    rulesUrl: city.rulesUrl,
    qlooFailed: context.qlooFailed(),
  };
  return planSchema.parse(plan);
}
