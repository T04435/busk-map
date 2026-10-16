import "server-only";
import { formatHour, describeSlot } from "@/lib/slot";
import { titleCase } from "@/lib/text";
import { venueDetail } from "@/lib/venue";
import { planSchema, type Plan, type PlanPitch } from "@/lib/plan-schema";
import { leadingAgeBand, type ScoredPitch } from "@/server/scoring";
import * as qloo from "@/server/adapters/qloo";
import { agentChanges } from "@/lib/agent-vs-engine";
import { fromEngine, fromToolOutputs, type ToolResult } from "@/lib/research-totals";
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
  const nearby = pitch.evidence.places.slice(0, 2);
  if (nearby.length) {
    const open = nearby.every((p) => p.open === "open") ? ", open in your slot" : "";
    parts.push(`Near ${nearby.map((p) => `${p.name}${venueDetail(p) ? ` (${venueDetail(p)})` : ""}`).join(" and ")}${open}.`);
  }
  const event = pitch.evidence.events[0];
  if (event) {
    const time = TIME_FORMAT.format(new Date(event.moment === "leaving" ? event.end : event.start));
    const match = event.tasteMatch ? ` Qloo rates ${event.tasteMatch.artist}'s fans ${Math.round(event.tasteMatch.affinity * 100)}/100 for your taste.` : "";
    parts.push(`${event.name} crowd ${event.moment === "leaving" ? "leaves" : "arrives"} around ${time}${event.endEstimated && event.moment === "leaving" ? " (estimated)" : ""}.${match}`);
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
      places: pitch.evidence.places.map((p) => ({
        name: p.name,
        distanceM: p.distanceM,
        popularity: p.popularity,
        open: p.open,
        liveMusic: p.liveMusic ?? null,
        goodFor: p.goodFor ?? [],
        keywords: p.keywords ?? [],
      })),
      events: pitch.evidence.events.map((e) => ({
        name: e.name,
        venue: e.venue.name,
        moment: e.moment,
        localTime: TIME_FORMAT.format(new Date(e.moment === "leaving" ? e.end : e.start)),
        endEstimated: e.endEstimated,
        url: e.url ?? null,
        tasteMatch: e.tasteMatch ?? null,
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

export type AssembleOptions = {
  /** Every pitch the agent's score_pitches scored (the engine's pool plus the agent's additions). */
  pool?: ScoredPitch[];
  /** The agent run's own notes (fallbacks, limits). */
  agentNotes?: string[];
  /** Numbers in Claude's text that no tool returned (accepted only after repeated rejections): texts with them use the template. */
  unverifiedNumbers?: string[];
  /** The agent run's finished tool calls (tool-end, before any pruning): the research totals of an agent plan. */
  toolResults?: ToolResult[];
};

/**
 * Build the final plan from the engine's results and, when available, the
 * agent's answer. The agent may choose its three pitches from the pool the
 * engine scored (including spots it added and checked); any id outside that
 * pool is rejected and the engine's top three are used. Scores, places and
 * songs always come from the engine.
 */
export async function assemblePlan(context: PlanContext, ai: AiText | null, options: AssembleOptions = {}): Promise<Plan> {
  const { request, city } = context;
  const [engineTop, engineRanked, cells, locals, learn, weather, artists, footfall, trends, contrast, profile, impact, usual] = await Promise.all([
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
    context.entityIds().then((ids) => (ids.length > 0 ? context.hotspotCrowd() : null)),
  ]);
  const funnel = await context.funnel();
  const qlooDown = context.qlooFailed();
  const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);
  const unverified = options.unverifiedNumbers ?? [];
  const traceable = (text: string) => !unverified.some((n) => new RegExp(`(^|[^\\d.])${n.replace(".", "\\.")}([^\\d]|$)`).test(text.replaceAll(/(\d),(\d{3})/g, "$1$2")));

  // The pool the agent chose from: the engine's ranked candidates plus its scored additions.
  const poolById = new Map<string, ScoredPitch>([...engineRanked, ...(options.pool ?? [])].map((p) => [p.id, p]));
  const aiPicks = (ai?.pitches ?? []).filter((p, i, all) => poolById.has(p.pitchId) && all.findIndex((q) => q.pitchId === p.pitchId) === i);
  const valid = ai !== null && aiPicks.length > 0 && aiPicks.length === ai.pitches.length;
  let top = engineTop;
  if (valid) {
    // Claude's choice, best first; topped up from the engine's picks if it named fewer than three.
    const chosen = aiPicks.map((p) => poolById.get(p.pitchId)!);
    for (const p of engineTop) if (chosen.length < 3 && !chosen.some((c) => c.id === p.id)) chosen.push(p);
    top = chosen.slice(0, 3);
  }
  const ranked = [...poolById.values()].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const genres = top[0] ? await context.crowdGenres(top[0]) : [];

  const aiWhy = new Map(valid ? aiPicks.filter((p) => traceable(p.why)).map((p) => [p.pitchId, clip(p.why.trim(), 500)]) : []);
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
  // The engine's own order: its spaced top 3, then the rest of its pool by score (one rank per pitch).
  const engineIds = new Set(engineTop.map((p) => p.id));
  const engineOrder = [...engineTop, ...engineRanked.filter((p) => !engineIds.has(p.id))];
  const changes = agentChanges(engineTop, top, engineOrder, (id) => {
    const p = pitches.find((x) => x.id === id);
    return p && p.whySource === "ai" ? p.why : null;
  });

  // Research totals: from the agent's tool outputs when its pitches are the plan, else from the engine's own data.
  const agentPlan = valid && options.toolResults !== undefined;
  const researchTotals = agentPlan
    ? fromToolOutputs(options.toolResults!)
    : fromEngine({
        cells: cells.length,
        crowdReads: (locals.length > 0 ? 1 : 0) + (usual && usual.artists.length > 0 ? 1 : 0),
        pool: qlooDown ? [] : engineRanked,
        sensors: footfall.sensors,
        setlists: pitches.map((p) => p.setlist),
      });

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
      (usedAi && ai?.summary.trim() && traceable(ai.summary) && clip(ai.summary.trim(), 600)) ||
      (qlooDown
        ? "Without Qloo's taste data Busk Map can't tell where your crowd is, so nothing is recommended."
        : pitches.length > 0
        ? `Top pitch: ${pitches[0].name} (score ${pitches[0].score}/100).`
        : "No pitch could be recommended for this slot with the data available."),
    notes: [...context.notes, ...(options.agentNotes ?? []), ...(usedAi ? (ai?.notes ?? []).filter(traceable).slice(0, 3).map((n) => clip(n, 240)) : [])],
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
        explained: a.explanation.slice(0, 2).flatMap((e) => {
          const name = e.name ?? nameOf(e.entityId);
          return name === null ? [] : [{ name, score: Math.round(e.score * 100) / 100 }];
        }),
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
      usualCrowd:
        usual && usual.artists.length > 0 ? { hotspot: usual.hotspot, artists: usual.artists.slice(0, 5).map((a) => ({ name: a.name, affinity: a.affinity })) } : null,
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
    agent:
      usedAi && valid
        ? {
            engineTop: engineTop.map((p) => ({ id: p.id, name: p.name, score: p.score })),
            differs: changes.length > 0 || top.length !== engineTop.length,
            added: top.filter((p) => p.origin === "agent").map((p) => p.name),
            changes,
          }
        : null,
    researchTotals,
  };
  return planSchema.parse(plan);
}
