import "server-only";
import { formatHour, describeSlot, DEFAULT_SLOT_HOURS } from "@/lib/slot";
import { activityPhrase, activitySentence } from "@/lib/activity";
import { plainScores, strengthPhrase, strengthWord } from "@/lib/plain-scores";
import { plainTools } from "@/lib/plain-tools";
import { noBuskingCells } from "./zone-cells";
import { titleCase } from "@/lib/text";
import { venueDetail } from "@/lib/venue";
import { planSchema, type Plan, type PlanPitch } from "@/lib/plan-schema";
import { leadingAgeBand, relativeActivity, SCENE_ACTS_SHOWN, skippedForSpacing, type ScoredPitch } from "@/server/scoring";
import * as qloo from "@/server/adapters/qloo";
import { agentChanges } from "@/lib/agent-vs-engine";
import { fromEngine, fromToolOutputs, type ToolResult } from "@/lib/research-totals";
import type { PlanContext } from "./context";
import { MELBOURNE, rulesFor } from "@/server/cities";

/** What the model contributes: words only. Numbers and places come from the engine. */
export type AiText = {
  summary: string;
  pitches: { pitchId: string; why: string }[];
  notes: string[];
};

const clocks = new Map<string, Intl.DateTimeFormat>();
/** "9:45 pm" in the city's time zone. */
function clockTime(iso: string, timeZone: string): string {
  let format = clocks.get(timeZone);
  if (!format) clocks.set(timeZone, (format = new Intl.DateTimeFormat("en-AU", { hour: "numeric", minute: "2-digit", hour12: true, timeZone })));
  return format.format(new Date(iso));
}

/** A plain, factual "why" built only from the evidence. Used when the model is unavailable. */
export function templateWhy(pitch: ScoredPitch, weekday: string, startHour: number, relative: number | null = null, timeZone = MELBOURNE.timeZone): string {
  const parts: string[] = [];
  if (pitch.factors.taste !== null) {
    const area = pitch.cell ? (pitch.cell.rank === 1 ? "your strongest area on Qloo's taste map" : `your no. ${pitch.cell.rank} area on Qloo's taste map`) : "this part of the city";
    parts.push(`${strengthWord(pitch.factors.taste)} taste match: ${area}.`);
  }
  if (pitch.discovery === "hidden-gem") parts.push("Off the usual busking circuit, so less competition for this crowd.");
  if (pitch.discovery === "usual" && pitch.usualSpot) parts.push(`A well-known busking spot (${pitch.usualSpot}): expect other buskers.`);
  if (pitch.activityBasis !== "none") parts.push(`${activitySentence({ level: relative ?? pitch.evidence.activity.level, basis: pitch.activityBasis, weekday, startHour })}.`);
  const nearby = pitch.evidence.places.slice(0, 2);
  if (nearby.length) {
    const open = nearby.every((p) => p.open === "open") ? ", open in your slot" : "";
    parts.push(`Near ${nearby.map((p) => `${p.name}${venueDetail(p) ? ` (${venueDetail(p)})` : ""}`).join(" and ")}${open}.`);
  }
  const event = pitch.evidence.events[0];
  if (event) {
    const time = clockTime(event.moment === "leaving" ? event.end : event.start, timeZone);
    const match = event.tasteMatch ? ` Qloo rates ${event.tasteMatch.artist}'s fans a ${strengthPhrase(event.tasteMatch.affinity)} match for your taste.` : "";
    parts.push(`${event.name} crowd ${event.moment === "leaving" ? "leaves" : "arrives"} around ${time}${event.endEstimated && event.moment === "leaving" ? " (estimated)" : ""}.${match}`);
  }
  return parts.join(" ") || "Scored on the data available for this slot.";
}

/** "6 pm–9 pm". */
export const windowLabel = (w: { startHour: number; endHour: number }) => `${formatHour(w.startHour)}–${formatHour(w.endHour)}`;

/**
 * Why this pitch's best window is the best one, from the window's evidence only (no model):
 * "Best 6 pm–9 pm: busy, with popular places open nearby (estimate), the Forum crowd leaving at 9:45 pm, dry".
 */
export function windowWhy(pitch: ScoredPitch, weather: { hour: number; precipitationProbability: number | null }[] | null, relative: number | null = null, timeZone = MELBOURNE.timeZone): string {
  const w = pitch.window;
  if (!w) return "";
  const parts: string[] = [];
  const activity = activityPhrase(relative ?? pitch.evidence.activity.level, pitch.activityBasis);
  if (activity) parts.push(activity);
  const event = pitch.evidence.events[0];
  if (event) {
    const time = clockTime(event.moment === "leaving" ? event.end : event.start, timeZone);
    parts.push(`the ${event.name} crowd ${event.moment === "leaving" ? "leaving" : "arriving"} at ${time}${event.endEstimated && event.moment === "leaving" ? " (estimated)" : ""}`);
  }
  const rain = (weather ?? []).filter((h) => h.hour >= w.startHour && h.hour < w.endHour).flatMap((h) => (h.precipitationProbability === null ? [] : [h.precipitationProbability]));
  if (rain.length > 0) {
    const top = Math.max(...rain);
    parts.push(top >= 50 ? `rain likely (up to ${top}%)` : top >= 25 ? `some rain risk (up to ${top}%)` : "dry");
  }
  return `Best ${windowLabel(w)}${parts.length ? `: ${parts.join(", ")}` : ""}`;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function toPlanPitch(
  pitch: ScoredPitch,
  why: string,
  whySource: PlanPitch["whySource"],
  setlist: PlanPitch["setlist"],
  weather: { hour: number; precipitationProbability: number | null }[] | null,
  hourly: number[] | null = null,
  relative: number | null = null,
  timeZone = MELBOURNE.timeZone,
): PlanPitch {
  return {
    window: pitch.window
      ? {
          startHour: pitch.window.startHour,
          endHour: pitch.window.endHour,
          label: windowLabel(pitch.window),
          score: pitch.score,
          why: windowWhy(pitch, weather, relative, timeZone),
          runnersUp: pitch.window.runnersUp,
        }
      : null,
    id: pitch.id,
    name: pitch.name,
    lat: pitch.lat,
    lon: pitch.lon,
    kind: pitch.kind,
    origin: pitch.origin,
    cellRank: pitch.cell?.rank ?? null,
    discovery: pitch.discovery,
    usualSpot: pitch.usualSpot,
    activityBasis: pitch.activityBasis,
    amplification: pitch.amplification,
    rules: pitch.rules,
    rulesUrl: pitch.rulesUrl,
    cautions: pitch.cautions,
    score: pitch.score,
    factors: pitch.factors,
    why,
    whySource,
    evidence: {
      activity:
        pitch.activityBasis === "none"
          ? null
          : { level: round2(pitch.evidence.activity.level), area: pitch.evidence.activity.area === null ? null : round2(pitch.evidence.activity.area), venues: pitch.evidence.activity.venues === null ? null : round2(pitch.evidence.activity.venues), relative: relative === null ? null : round2(relative), hourly },
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
        localTime: clockTime(e.moment === "leaving" ? e.end : e.start, timeZone),
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
  /** Which model wrote `ai`'s text: the offline mock model or Claude (the default). */
  model?: "claude" | "mock";
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
  const [engineTop, engineRanked, cells, locals, learn, weather, artists, trends, contrast, profile, impact, usual, localScene, ownFans] = await Promise.all([
    context.topPitches(),
    context.ranked(),
    context.tasteCells(),
    context.localArtists(),
    context.learn(),
    context.weather(),
    context.artists(),
    context.rising(),
    context.contrast(),
    context.crowdProfile(),
    context.localImpact(),
    context.entityIds().then((ids) => (ids.length > 0 ? context.hotspotCrowd() : null)),
    context.localScene(),
    context.ownFans(),
  ]);
  const funnel = await context.funnel();
  const districts = context.qlooFailed() ? [] : await context.namedDistricts();
  const [areas, mapCells] = await Promise.all([context.qlooFailed() ? [] : context.rankedAreas(), context.mapCells()]);
  // Artist photos already fetched with the crowd (Qloo entities), for the learn-these rows.
  const photoOf = new Map(locals.flatMap((a) => (a.image && /^https:\/\//.test(a.image) ? [[a.id, a.image] as const] : [])));
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
  // Higher-scored pitches the 250 m spacing left out, with the pick each is too close to.
  const spacing = skippedForSpacing(ranked, top);
  const genres = top[0] ? await context.crowdGenres(top[0]) : [];

  const aiWhy = new Map(valid ? aiPicks.filter((p) => traceable(p.why)).map((p) => [p.pitchId, clip(plainTools(plainScores(p.why.trim())), 500)]) : []);
  const poolLevels = ranked.filter((p) => p.activityBasis !== "none").map((p) => p.evidence.activity.level);
  const pitches = await Promise.all(
    (qlooDown ? [] : top).map(async (pitch) => {
      const fromAi = aiWhy.get(pitch.id);
      const slotOf = context.slotFor(pitch);
      const relative = pitch.activityBasis === "none" ? null : relativeActivity(pitch.evidence.activity.level, poolLevels);
      const why = fromAi || templateWhy(pitch, context.weekday, slotOf.startHour, relative, city.timeZone);
      return toPlanPitch(
        pitch,
        why,
        fromAi ? "ai" : "template",
        await context.setlistFor(pitch),
        weather?.hours ?? null,
        pitch.activityBasis === "none" ? null : ((await context.activityDay(pitch))?.map((h) => round2(h.level)) ?? null),
        relative,
        city.timeZone,
      );
    }),
  );
  const topIds = new Set(top.map((p) => p.id));
  const nameOf = (entityId: string) => context.entityName(entityId, artists);
  const own = context.ownArtist();
  const ownIds = await context.entityIds();
  const ownUsed = own !== null && ownIds.includes(own.qlooId);
  // "From your music": the own artist's share of the crowd's top picks (Qloo explainability), when it drove them.
  const ownShare = own === null ? null : (drivers(locals.slice(0, 10), nameOf, impact).find((d) => d.name === own.name)?.share ?? null);
  const maxAffinity = Math.max(0, ...mapCells.map((c) => c.affinity));
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
  const anyTime = context.isAnyTime;
  const researchTotals = agentPlan
    ? fromToolOutputs(options.toolResults!)
    : fromEngine({
        cells: cells.length,
        crowdReads: (locals.length > 0 ? 1 : 0) + (usual && usual.artists.length > 0 ? 1 : 0),
        pool: qlooDown ? [] : engineRanked,
        setlists: pitches.map((p) => p.setlist),
      });

  // Any time: the plan's slot is the top pitch's window, so every reader of plan.slot still gets a real slot (D1, 2.4).
  const planSlot = anyTime ? (top[0] && !qlooDown ? context.slotFor(top[0]) : { date: request.slot.date, ...DEFAULT_SLOT_HOURS }) : context.slotFor({});
  if (anyTime) researchTotals.windows = context.windows().length;

  const plan: Plan = {
    version: 1,
    city: request.city,
    cityName: city.name,
    slot: planSlot,
    slotLabel: describeSlot(request.slot),
    anyTime,
    performerName: request.performer.name,
    permit: request.permit,
    qlooMode: qloo.qlooMode(context.adapters),
    explanations: usedAi ? "ai" : "template",
    explanationsModel: usedAi ? (options.model ?? "claude") : null,
    summary:
      (usedAi && ai?.summary.trim() && traceable(ai.summary) && clip(plainTools(plainScores(ai.summary.trim())), 600)) ||
      (qlooDown
        ? "Without Qloo's taste data Busk Map can't tell where your crowd is, so nothing is recommended."
        : pitches.length > 0
        ? `Top pitch: ${pitches[0].name}.`
        : "No pitch could be recommended for this slot with the data available."),
    notes: [...context.notes, ...(options.agentNotes ?? []), ...(usedAi ? (ai?.notes ?? []).filter(traceable).slice(0, 3).map((n) => clip(plainTools(plainScores(n)), 240)) : [])],
    ...(districts.length > 0 ? { districts: districts.map((d) => ({ name: d.name, lat: d.center.lat, lon: d.center.lon })) } : {}),
    ...(areas.length > 0 ? { areas: areas.map((a) => ({ name: a.name, lat: a.lat, lon: a.lon, zoomed: districts.some((d) => d.area && d.name === a.name) })) } : {}),
    weights: context.weights,
    pitches,
    others: (qlooDown ? [] : ranked)
      .filter((p) => !topIds.has(p.id))
      .slice(0, 25)
      .map((p) => ({ id: p.id, name: p.name, lat: p.lat, lon: p.lon, score: p.score, kind: p.kind, discovery: p.discovery,
        tooCloseTo: spacing.has(p.id) ? { id: spacing.get(p.id)!.id, name: spacing.get(p.id)!.name } : null,
      })),
    funnel,
    zones: qlooDown ? [] : noBuskingCells(await context.pitchData(), [...pitches, ...ranked.slice(0, 40)]),
    tasteCells: mapCells.map((c) => ({
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
        ...(a.image && /^https:\/\//.test(a.image) ? { image: a.image } : {}),
        ...(a.spotifyId && /^[A-Za-z0-9]{22}$/.test(a.spotifyId) ? { spotifyId: a.spotifyId } : {}),
      })),
      // The local scene: the city's over-indexed genres and its local acts, re-scored for the performer's fans (null: today's crowd only).
      localScene:
        localScene && localScene.acts.length > 0
          ? {
              genres: localScene.genres.map((g) => ({ name: titleCase(g.name), over: g.over, ...(localScene.yours?.includes(g.id) ? { yours: true } : {}) })),
              acts: localScene.acts.slice(0, SCENE_ACTS_SHOWN).map((a) => ({ name: a.name, affinity: a.affinity === null ? null : Math.round(a.affinity * 100) / 100, ...(a.image ? { image: a.image } : {}) })),
            }
          : null,
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
    learnThese: learn.map((l) => ({ artist: l.artist, title: l.title, playcount: l.playcount, reason: l.reason, audienceGrowth: l.audienceGrowth, ...(photoOf.get(l.entityId) ? { artistImage: photoOf.get(l.entityId) } : {}) })),
    ageLean: leadingAgeBand(profile?.age ?? null),
    weather: weather
      ? {
          hours: weather.hours.map((h) => ({ hour: h.hour, temperatureC: h.temperatureC, precipitationProbability: h.precipitationProbability, windKmh: h.windKmh })),
          around: (weather.around ?? []).map((h) => ({ hour: h.hour, temperatureC: h.temperatureC, precipitationProbability: h.precipitationProbability, windKmh: h.windKmh })),
        }
      : null,
    resolvedArtists: artists.map((a) => ({ query: a.query, matched: a.entity?.name ?? null })),
    dataStatus: context.dataStatus(),
    rulesUrl: rulesFor(city).url,
    cityLevels: context.levels,
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
    ...(own
      ? {
          ownArtist: {
            name: own.name,
            used: ownUsed,
            share: ownUsed ? ownShare : null,
            fans: ownFans
              ? {
                  age: Object.entries(ownFans.age).map(([band, lean]) => ({ band, lean: Math.round(lean * 100) / 100 })),
                  gender: Object.entries(ownFans.gender).map(([band, lean]) => ({ band, lean: Math.round(lean * 100) / 100 })),
                }
              : null,
          },
        }
      : {}),
  };
  return planSchema.parse(plan);
}
