import "server-only";
import { formatHour, describeSlot } from "@/lib/slot";
import { titleCase } from "@/lib/text";
import { planSchema, type Plan, type PlanPitch } from "@/lib/plan-schema";
import { leadingAgeBand, type ScoredPitch } from "@/server/scoring";
import * as qloo from "@/server/adapters/qloo";
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
  const day = `${weekday[0].toUpperCase()}${weekday.slice(1)}s`;
  if (pitch.factors.taste !== null) {
    const area = pitch.cell ? (pitch.cell.rank === 1 ? "your strongest area on Qloo's taste map" : `your no. ${pitch.cell.rank} area on Qloo's taste map`) : "this part of the city";
    parts.push(`Taste match ${Math.round(pitch.factors.taste * 100)}/100: ${area}.`);
  }
  if (pitch.discovery === "hidden-gem") parts.push("Off the usual busking circuit, so less competition for this crowd.");
  if (pitch.discovery === "usual" && pitch.usualSpot) parts.push(`A well-known busking spot (${pitch.usualSpot}): expect other buskers.`);
  if (pitch.evidence.sensor && pitch.footfallSource === "sensor") {
    parts.push(`About ${pitch.evidence.sensor.avgHourly.toLocaleString("en-AU")} people an hour passed ${pitch.evidence.sensor.name} on recent ${day}, ${formatHour(startHour)}–${formatHour(endHour)} (estimate from city sensors).`);
  } else if (pitch.evidence.sensor && pitch.footfallSource === "nearby-sensors") {
    parts.push(`Roughly ${pitch.evidence.sensor.avgHourly.toLocaleString("en-AU")} people an hour on recent ${day}, estimated from nearby sensors such as ${pitch.evidence.sensor.name}.`);
  } else if (pitch.footfallSource === "qloo-popularity") {
    parts.push("No pedestrian sensor nearby, so busyness is estimated from Qloo's popularity for the area.");
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
    origin: pitch.origin,
    cellRank: pitch.cell?.rank ?? null,
    discovery: pitch.discovery,
    usualSpot: pitch.usualSpot,
    footfallSource: pitch.footfallSource,
    amplification: pitch.amplification,
    rules: pitch.rules,
    rulesUrl: pitch.rulesUrl,
    cautions: pitch.cautions,
    score: pitch.score,
    factors: pitch.factors,
    why,
    whySource,
    tip: pitch.tip ? { points: Math.round(pitch.tip.bonus * 100), sessions: pitch.tip.sessions, perHour: pitch.tip.perHour, averagePerHour: pitch.tip.averagePerHour, lift: pitch.tip.lift } : null,
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
 * Each input artist's share of the crowd's top picks. Qloo's top-level
 * explainability aggregate (average score over the top 10 results) is used
 * when present; otherwise the per-result scores are averaged here.
 */
export function drivers(
  locals: { explanation: { entityId: string; score: number }[] }[],
  nameOf: (id: string) => string | null,
  impact: qloo.Impact[] = [],
) {
  const fromQloo = impact.flatMap((i) => {
    const share = i.top10 ?? i.top5 ?? i.all ?? i.top3;
    return share === null ? [] : [[i.entityId, share] as const];
  });
  if (fromQloo.length === 0 && locals.length === 0) return [];
  const totals = new Map<string, number>();
  if (fromQloo.length > 0) for (const [id, share] of fromQloo) totals.set(id, share);
  else for (const local of locals) for (const e of local.explanation) totals.set(e.entityId, (totals.get(e.entityId) ?? 0) + e.score / locals.length);
  return [...totals.entries()]
    .map(([id, share]) => ({ name: nameOf(id), share: Math.round(share * 100) / 100 }))
    .filter((d): d is { name: string; share: number } => d.name !== null && d.share > 0)
    .sort((a, b) => b.share - a.share);
}

/**
 * Build the final plan from the engine's results and, when available, the
 * model's words. Only the engine's top pitches can appear; a "why" from the
 * model is used only for a pitch id the engine produced.
 */
export async function assemblePlan(context: PlanContext, ai: AiText | null): Promise<Plan> {
  const { request, city } = context;
  const [top, ranked, cells, locals, learn, weather, artists, footfall, trends, contrast, profile, impact] = await Promise.all([
    context.topPitches(),
    context.ranked(),
    context.tasteCells(),
    context.localArtists(),
    context.learn(),
    context.weather(),
    context.artists(),
    context.footfall(),
    context.rising(),
    context.contrast(),
    context.crowdProfile(),
    context.localImpact(),
  ]);
  const funnel = await context.funnel();
  const genres = top[0] ? await context.crowdGenres(top[0]) : [];

  const qlooDown = context.qlooFailed();
  const aiWhy = new Map((ai?.pitches ?? []).map((p) => [p.pitchId, p.why.trim()]));
  const pitches = await Promise.all(
    (qlooDown ? [] : top).map(async (pitch) => {
      const fromAi = aiWhy.get(pitch.id);
      const why = fromAi || templateWhy(pitch, context.weekday, request.slot.startHour, request.slot.endHour);
      return toPlanPitch(pitch, why, fromAi ? "ai" : "template", await context.setlistFor(pitch));
    }),
  );
  const topIds = new Set(top.map((p) => p.id));
  const nameOf = (entityId: string) => artists.find((r) => r.entity?.id === entityId)?.entity?.name ?? null;
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
    qlooMode: qloo.qlooMode(context.adapters),
    explanations: usedAi ? "ai" : "template",
    summary:
      (usedAi && ai?.summary.trim()) ||
      (qlooDown
        ? "Without Qloo's taste data Busk Map can't tell where your crowd is, so nothing is recommended."
        : pitches.length > 0
        ? `Top pitch: ${pitches[0].name} (score ${pitches[0].score}/100).`
        : "No pitch could be recommended for this slot with the data available."),
    notes: [...context.notes, ...(usedAi ? (ai?.notes ?? []).slice(0, 3) : [])],
    weights: context.weights,
    pitches,
    others: (qlooDown ? [] : ranked)
      .filter((p) => !topIds.has(p.id))
      .slice(0, 25)
      .map((p) => ({ id: p.id, name: p.name, lat: p.lat, lon: p.lon, score: p.score, kind: p.kind, discovery: p.discovery, tipPoints: p.tip ? Math.round(p.tip.bonus * 100) : null })),
    tipHistory: request.history ? { source: request.history.source, sessions: request.history.sessions, perHour: request.history.perHour } : null,
    funnel,
    tasteCells: cells.map((c) => ({
      lat: c.lat,
      lon: c.lon,
      affinity: maxAffinity > 0 ? Math.round((c.affinity / maxAffinity) * 1000) / 1000 : 0,
      geohash: c.geohash,
    })),
    crowd: {
      localArtists: locals.slice(0, 8).map((a) => ({
        name: a.name,
        affinity: a.affinity,
        because: a.explanation
          .slice(0, 2)
          .map((e) => e.name ?? nameOf(e.entityId))
          .filter((n): n is string => n !== null),
        trend: trends.find((t) => t.entityId === a.id)?.windowChange ?? null,
      })),
      // Qloo genre names arrive in mixed case ("indie", "Alternative Rock"): shown in title case.
      genres: [...new Map(genres.map((g) => [titleCase(g.name), { name: titleCase(g.name), affinity: g.affinity }])).values()],
      contrast:
        contrast && (contrast.more.length > 0 || contrast.less.length > 0)
          ? { hotspot: contrast.hotspot, more: contrast.more.map(titleCase), less: contrast.less.map(titleCase) }
          : null,
      demographics: profile
        ? {
            age: Object.entries(profile.age).map(([band, lean]) => ({ band, lean: Math.round(lean * 100) / 100 })),
            gender: Object.entries(profile.gender).map(([band, lean]) => ({ band, lean: Math.round(lean * 100) / 100 })),
          }
        : null,
      drivers: drivers(locals.slice(0, 10), nameOf, impact),
    },
    learnThese: learn.map((l) => ({ artist: l.artist, title: l.title, playcount: l.playcount, reason: l.reason, audienceGrowth: l.audienceGrowth })),
    ageLean: leadingAgeBand(profile?.age ?? null),
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
