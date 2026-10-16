import "server-only";
import { tool } from "ai";
import { z } from "zod";
import { distanceM, type LatLon } from "@/lib/geo";
import { ANY_TIME_DAY, formatHour } from "@/lib/slot";
import { nameKey } from "@/lib/text";
import * as qloo from "@/server/adapters/qloo";
import { getTypicalFootfall } from "@/server/adapters/footfall";
import { candidateAt, openDuring, pickTopPitches, scoreWindows, typicalForSlot, type Candidate, type KnownPlace, type ScoredPitch } from "@/server/scoring";
import { USUAL_HOTSPOTS } from "@/server/data/spots";
import type { PlanContext } from "./context";
import { NumberBag } from "./number-bag";

export { NumberBag };
import { boxAround, knownPlaces, nearestName, resolveWhere, snapPoint, snapRadius, whereSchema, WhereError, type Resolved, type Where } from "./where";
import { PLAYLIST_COPY } from "@/lib/playlist-copy";

/**
 * Agent v2 tools. Claude chooses each tool's inputs; the tools reuse the
 * per-request PlanContext and the cached, paced adapters, so every Qloo call
 * stays behind the same caching, pacing and timeouts as the engine.
 *
 * Every output is what the model sees and what the page shows under the step
 * ("the data the tool returned"), so outputs are compact and flat where they
 * can be. Each has a one-line `summary`.
 *
 * Guardrails live here: inputs are validated with zod and bounded to the
 * city's planning area; score_pitches is the only source of scores; the
 * final answer (finish_plan) is checked against the pool the engine scored.
 */
const r2 = (n: number | null | undefined) => (n === null || n === undefined ? null : Math.round(n * 100) / 100);
const r4 = (n: number) => Math.round(n * 10_000) / 10_000;

/** At most this many places the agent may add to the engine's pool. */
export const MAX_ADDED = 5;
/** Final pitches closer than this are the same corner: the engine's own top-3 spacing (pickTopPitches). */
export const MIN_FINAL_SPACING_M = 250;
/** How many finish_plan rejections before the run gives up on Claude's words. */
export const MAX_FINISH_REJECTIONS = 2;
/** Rows shown from score_pitches. */
export const SCORE_ROWS = 8;

export const TOOL_LABELS: Record<string, string> = {
  taste_map: "Where the act's taste concentrates",
  crowd_at: "Who the crowd is around a point",
  busy_places: "Busy places open near a point",
  events_near: "Events near a point",
  footfall_at: "Foot traffic at a point",
  check_pitch: "Checking a spot against the busking rules",
  score_pitches: "Scoring the pitch pool",
  best_hours: "Finding the best hours",
  compare_crowds: "Comparing two pitches' crowds",
  build_setlist: PLAYLIST_COPY.suggestedSetStepLabel,
  learn_these: PLAYLIST_COPY.toLearnStepLabel,
  finish_plan: "Final answer",
};

/** The data call behind each tool, shown next to the step. */
export const TOOL_SOURCES: Record<string, string> = {
  taste_map: "Qloo /v2/insights · urn:heatmap",
  crowd_at: "Qloo /v2/insights · urn:entity:artist with signal.location and explainability, urn:tag, urn:demographics",
  busy_places: "Qloo /v2/insights · urn:entity:place with filter.location and filter.hours",
  events_near: "Ticketmaster, with Qloo affinity of each headliner",
  footfall_at: "City of Melbourne pedestrian sensors (typical by weekday and hour)",
  check_pitch: "City of Melbourne busking layers",
  score_pitches: "Busk Map scoring engine (no model)",
  best_hours: "Busk Map scoring engine, City of Melbourne sensors, Ticketmaster, Open-Meteo",
  compare_crowds: "Qloo /v2/insights · urn:tag and per-point artist affinity, plus engine factors",
  build_setlist: "Qloo /v2/insights per pitch, Last.fm, Spotify release years",
  learn_these: "Qloo insights and trending, Last.fm",
  finish_plan: "Checked against the engine's scored pool",
};

/** What the model contributes: words and a choice among scored pitches. */
export type AgentAnswer = { summary: string; pitches: { pitchId: string; why: string }[]; notes: string[] };

export const finishSchema = z.object({
  summary: z.string().max(1500).describe("Two sentences for the performer: where to play and why, from tool results only."),
  pitches: z
    .array(
      z.object({
        pitchId: z.string().describe("A pitchId exactly as returned by score_pitches."),
        why: z.string().max(1200).describe("Why this crowd: one or two sentences citing what you checked. Say 'estimated' for estimates."),
      }),
    )
    .max(3)
    .describe("Three pitches; none only when score_pitches found no legal pitch."),
  notes: z.array(z.string().max(600)).max(8).describe("Data caveats, e.g. a missing source or an estimate."),
});

/** Per-run state the tools share: the agent's additions, the scored pool and the accepted answer. */
export class AgentState {
  /** Legal spots the agent checked, by id: candidates it may add to the pool. */
  readonly checked = new Map<string, Candidate>();
  /** Spots added to the engine's pool (ids into `checked`). */
  readonly added = new Set<string>();
  /** Every pitch score_pitches has scored, by id (engine pool plus additions). */
  readonly pool = new Map<string, ScoredPitch>();
  /** Numbers the model has seen (prompt and tool outputs), for the numbers check. */
  readonly seen = new NumberBag();
  answer: AgentAnswer | null = null;
  rejections = 0;
  /** Set once score_pitches has run: compare_crowds and build_setlist need its pitchIds. */
  scored = false;
  /** Set near the step or token cap: score_pitches opens whatever the looks, so finish_plan gets a scored pool. */
  wrappingUp = false;
  /** Investigation looks that returned data (GATE_TOOLS), in order: they open score_pitches. */
  readonly looks: string[] = [];
  /** Set when the answer was accepted only after the numbers check failed MAX_FINISH_REJECTIONS times. */
  unverifiedNumbers: string[] = [];
  /** Calls per tool, for the trace. */
  readonly calls: string[] = [];
}

/** A point, labelled, for outputs. */
const at = (r: Resolved) => ({ label: r.label, lat: r4(r.lat), lon: r4(r.lon), ...(r.pitchId ? { pitchId: r.pitchId } : {}) });

/**
 * For each pitch too close to a better one, that better pitch's name: going
 * down the ranking, a pitch is kept unless it is within MIN_FINAL_SPACING_M
 * of one already kept (the engine's own spacing rule, applied to the pool).
 */
export function sameCorners(ranked: ScoredPitch[]): Map<string, string> {
  const kept: ScoredPitch[] = [];
  const out = new Map<string, string>();
  for (const p of ranked) {
    const near = kept.find((q) => distanceM(p, q) < MIN_FINAL_SPACING_M);
    if (near) out.set(p.id, near.name);
    else kept.push(p);
  }
  return out;
}

function compactPitch(p: ScoredPitch, engineTop: Set<string>, added: Set<string>, corners: Map<string, string>) {
  const higher = corners.has(p.id) ? { name: corners.get(p.id)! } : null;
  return {
    pitchId: p.id,
    name: p.name,
    score: p.score,
    engineTop3: engineTop.has(p.id),
    sameCornerAs: higher?.name ?? null,
    addedByYou: added.has(p.id),
    kind: p.kind,
    discovery: p.discovery,
    usualSpot: p.usualSpot,
    // Any time only: the pitch's best 3-hour window (additive; fixed-slot rows are unchanged).
    ...(p.window ? { window: `${formatHour(p.window.startHour)}–${formatHour(p.window.endHour)}`, windowStartHour: p.window.startHour, windowEndHour: p.window.endHour } : {}),
    taste: r2(p.factors.taste),
    footfall: r2(p.factors.footfall),
    places: r2(p.factors.places),
    events: r2(p.factors.events),
    weatherPenalty: r2(p.factors.weatherPenalty),
    footfallSource: p.footfallSource,
    peoplePerHour: p.evidence.sensor?.avgHourly ?? null,
    cautions: p.cautions.length,
  };
}

/** Investigation looks that count towards opening score_pitches. */
export const GATE_TOOLS = ["taste_map", "crowd_at", "events_near", "footfall_at", "busy_places", "check_pitch"] as const;
/** At least one look must be about the crowd itself: its taste, who it is, or an event crowd. */
export const CROWD_TOOLS = ["taste_map", "crowd_at", "events_near"] as const;
/** Looks before score_pitches opens. */
export const MIN_LOOKS = 3;
/** Tools closed until the pool is scored (or, for score_pitches, until the looks are in). */
export const AFTER_SCORING = ["score_pitches", "best_hours", "compare_crowds", "build_setlist", "finish_plan"] as const;

/** Whether score_pitches is open: enough looks, one of them about the crowd; or the run is wrapping up. */
export function scoringOpen(state: Pick<AgentState, "looks" | "wrappingUp">): boolean {
  if (state.wrappingUp) return true;
  return state.looks.length >= MIN_LOOKS && state.looks.some((t) => (CROWD_TOOLS as readonly string[]).includes(t));
}

/** What is still missing before score_pitches opens, for the tool error the model sees. */
export function gateMessage(state: Pick<AgentState, "looks">): string {
  const need = Math.max(0, MIN_LOOKS - state.looks.length);
  const crowd = state.looks.some((t) => (CROWD_TOOLS as readonly string[]).includes(t));
  const missing = [
    need > 0 ? `${need} more look${need === 1 ? "" : "s"} (taste_map, crowd_at, events_near, footfall_at, busy_places or check_pitch)` : null,
    crowd ? null : "at least one of taste_map, crowd_at or events_near",
  ].filter(Boolean);
  return `score_pitches isn't open yet: investigate first and form your own shortlist. Still needed: ${missing.join(" and ")}. Looks so far: ${state.looks.join(", ") || "none"}.`;
}

export function createTools(ctx: PlanContext, state: AgentState) {
  const tools = buildTools(ctx, state);
  // Record each call, and each investigation look that returned data (they open score_pitches).
  for (const [name, t] of Object.entries(tools) as [string, { execute?: (...args: never[]) => unknown }][]) {
    const execute = t.execute;
    if (!execute) continue;
    t.execute = (async (...args: never[]) => {
      state.calls.push(name);
      const out = await execute(...args);
      if ((GATE_TOOLS as readonly string[]).includes(name)) state.looks.push(name);
      return out;
    }) as typeof execute;
  }
  return tools;
}

function buildTools(ctx: PlanContext, state: AgentState) {
  const area = ctx.city.bbox;
  let placesCache: Promise<KnownPlace[]> | null = null;
  const places = () =>
    (placesCache ??= Promise.all([ctx.pitchData(), ctx.footfall()]).then(([pitchData, footfall]) => knownPlaces(pitchData.sites, footfall.sensors)));
  const knownPitches = async () => [...(await ctx.ranked()), ...state.pool.values()];
  const where = async (w: Where): Promise<Resolved> => resolveWhere(w, { area, pitches: await knownPitches(), places: await places() });
  const ids = () => ctx.entityIds();
  /** Every output is recorded for the numbers check, then returned. */
  const seen = <T>(output: T): T => {
    state.seen.add(output);
    return output;
  };

  /** The best window of a pitch the agent pointed at (by pitchId), when the request is any time and the pitch is scored. */
  const windowOfPitch = async (pitchId: string | null | undefined) => {
    if (!pitchId || !ctx.isAnyTime) return null;
    const p = state.pool.get(pitchId) ?? (await ctx.ranked()).find((x) => x.id === pitchId);
    return p?.window ?? null;
  };
  const clock = (iso: string) => new Intl.DateTimeFormat("en-AU", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: ctx.city.timeZone }).format(new Date(iso));

  /** The engine's pool plus the agent's additions, scored with the same inputs and weights. */
  async function scorePool(): Promise<{ ranked: ScoredPitch[]; engineTop: ScoredPitch[] }> {
    const [ranked, scoredAdditions] = await Promise.all([ctx.ranked(), Promise.all([...state.added].map((id) => ctx.scoreCandidate(state.checked.get(id)!)))]);
    const additions = scoredAdditions.filter((p): p is ScoredPitch => p !== null);
    const all = [...ranked, ...additions].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
    for (const p of all) state.pool.set(p.id, p);
    state.scored = true;
    return { ranked: all, engineTop: pickTopPitches(ranked, 3) };
  }

  const tools = {
    taste_map: tool({
      description:
        "Qloo heatmap: where in the city the act's taste concentrates. Optionally signal only some of the act's matched artists, or zoom into one part of the planning area. Returns the strongest cells with the nearest known place.",
      inputSchema: z.object({
        signals: z.array(z.string().max(80)).max(10).optional().describe("Names of the act's matched artists to signal; default all."),
        around: whereSchema.optional().describe("Zoom into this part of the planning area; default the whole area."),
        radiusM: z.number().int().min(200).max(1500).optional().describe("Zoom radius in metres (snapped to 200, 400, 800 or 1500)."),
      }),
      execute: async ({ signals, around, radiusM }) => {
        const artists = (await ctx.artists()).filter((a) => a.entity);
        let chosen = artists;
        if (signals?.length) {
          chosen = artists.filter((a) => signals.some((s) => nameKey(s) === nameKey(a.query) || nameKey(s) === nameKey(a.entity!.name)));
          if (chosen.length === 0) throw new WhereError(`None of ${signals.join(", ")} is a matched artist. Matched: ${artists.map((a) => a.entity!.name).join(", ")}.`);
        }
        const all = chosen.length === artists.length;
        const zoom = around ? await where(around) : null;
        const box = zoom ? boxAround(snapPoint(zoom), snapRadius(radiusM, 800), area) : area;
        const cells =
          all && !zoom
            ? await ctx.tasteCells()
            : await ctx.trackQloo(`agent:taste:${chosen.map((a) => a.entity!.id).sort().join(",")}:${JSON.stringify(box)}`, () =>
                qloo.tasteMap(chosen.map((a) => a.entity!.id), box, ctx.adapters),
              );
        const known = await places();
        const max = Math.max(0, ...cells.map((c) => c.affinity));
        const top = [...cells].sort((a, b) => b.affinity - a.affinity).slice(0, 8);
        return seen({
          summary: cells.length
            ? `${cells.length} cells for ${all ? "all your artists" : chosen.map((a) => a.entity!.name).join(", ")}${zoom ? ` around ${zoom.label}` : ""}; strongest near ${nearestName(top[0], known) ?? "an unnamed block"}`
            : "No taste data for that area",
          signals: chosen.map((a) => a.entity!.name),
          area: zoom ? { around: zoom.label, radiusM: snapRadius(radiusM, 800) } : "planning area",
          cells: cells.length,
          strongest: top.map((c, i) => ({
            rank: i + 1,
            near: nearestName(c, known),
            lat: r4(c.lat),
            lon: r4(c.lon),
            affinity: max > 0 ? r2(c.affinity / max) : 0,
            popularity: r2(c.popularity),
          })),
        });
      },
    }),

    crowd_at: tool({
      description:
        "Who the crowd around a point is, given the act's taste: artists this crowd likes (with which of the act's artists explain each, Qloo explainability), the genres that characterise it, and the age and gender lean of the act's fans. Also the city's local scene when Qloo has one: the genres this city leans to more than global pop, and the local acts of those genres that the act's fans would like (city-wide, not specific to the point).",
      inputSchema: z.object({ at: whereSchema, radiusM: z.number().int().min(200).max(1500).optional().describe("Default 400 (snapped to 200, 400, 800 or 1500).") }),
      execute: async ({ at: w, radiusM }) => {
        const point = await where(w);
        const radius = snapRadius(radiusM, 400);
        const snapped = snapPoint(point);
        const entityIds = await ids();
        if (entityIds.length === 0) throw new WhereError("No matched artists: there is no taste to profile.");
        const box = boxAround(snapped, radius, area);
        const [crowd, genres, profile, resolved, scene] = await Promise.all([
          ctx.trackQloo(`agent:crowd:${JSON.stringify(box)}`, () => qloo.localArtists(entityIds, box, 10, ctx.adapters)),
          ctx.trackQloo(`agent:genres:${snapped.lat},${snapped.lon},${radius}`, () => qloo.crowdTags(entityIds, snapped, radius, 6, ctx.adapters)),
          ctx.crowdProfile(),
          ctx.artists(),
          ctx.localScene(),
        ]);
        const nameOf = (id: string) => resolved.find((r) => r.entity?.id === id)?.entity?.name ?? null;
        const lean = (rows: Record<string, number> | undefined) =>
          Object.entries(rows ?? {})
            .sort((a, b) => b[1] - a[1])
            .map(([band, value]) => ({ band, lean: r2(value) }));
        return seen({
          summary: crowd.artists.length ? `${crowd.artists.length} artists liked within ${radius} m of ${point.label}; top ${crowd.artists[0].name}` : `No crowd data within ${radius} m of ${point.label}`,
          at: at(point),
          radiusM: radius,
          artists: crowd.artists.slice(0, 8).map((a) => ({
            name: a.name,
            affinity: r2(a.affinity),
            because: a.explanation
              .slice(0, 2)
              .map((e) => `${e.name ?? nameOf(e.entityId) ?? "?"} ${r2(e.score)}`)
              .join("; "),
          })),
          genres: genres.map((g) => ({ genre: g.name.trim(), affinity: r2(g.affinity) })),
          fansAge: lean(profile?.age),
          fansGender: lean(profile?.gender),
          // Additive (the design contract's fields above are unchanged): the city's local scene, when Qloo has one.
          ...(scene && scene.acts.length > 0
            ? { localScene: { genres: scene.genres.map((g) => g.name.trim()), acts: scene.acts.slice(0, 6).map((a) => ({ name: a.name, fansWouldLike: r2(a.affinity) })) } }
            : {}),
        });
      },
    }),

    busy_places: tool({
      description: "Popular places (bars, venues, stations, markets) near a point, ranked for this taste (Qloo), and whether each is open at the hour you give.",
      inputSchema: z.object({
        near: whereSchema,
        radiusM: z.number().int().min(200).max(1500).optional().describe("Default 400."),
        openAt: z.number().int().min(0).max(23).optional().describe("Hour of the slot's day, 0–23; default the slot's start (any time: the pitch's best window, else the day's 10 am to 10 pm)."),
      }),
      execute: async ({ near, radiusM, openAt }) => {
        const point = await where(near);
        const radius = snapRadius(radiusM, 400);
        const snapped = snapPoint(point);
        const best = await windowOfPitch(point.pitchId);
        // Any time: open at the pitch's best window start; with no window known, open at any point of the day's 10 am to 10 pm.
        const dayWide = ctx.isAnyTime && openAt === undefined && !best;
        const hour = openAt ?? best?.startHour ?? (ctx.isAnyTime ? ANY_TIME_DAY.startHour : ctx.slotFor({}).startHour);
        const entityIds = await ids();
        const found = await ctx.trackQloo(`agent:places:${snapped.lat},${snapped.lon},${radius}`, () =>
          qloo.busyPlaces(entityIds, snapped, radius, ctx.weekday, ctx.adapters),
        );
        const rows = found.slice(0, 10).map((p) => ({
          name: p.name,
          distanceM: Math.round(distanceM(point, p)),
          open: dayWide ? openDuring(p.hours, ctx.weekday, ANY_TIME_DAY.startHour, ANY_TIME_DAY.endHour) : openDuring(p.hours, ctx.weekday, hour, hour + 1),
          popularity: r2(p.popularity),
          affinity: r2(p.affinity),
          liveMusic: p.liveMusic,
          goodFor: p.goodFor.slice(0, 2).join(", "),
          keywords: p.keywords.slice(0, 3).join(", "),
        }));
        return seen({
          summary: `${found.length} places within ${radius} m of ${point.label} open ${ctx.weekday}; ${rows.filter((r) => r.open === "open").length} of the top ${rows.length} open ${dayWide ? `between ${formatHour(ANY_TIME_DAY.startHour)} and ${formatHour(ANY_TIME_DAY.endHour)}` : `at ${formatHour(hour)}`}`,
          at: at(point),
          radiusM: radius,
          hour,
          places: rows,
        });
      },
    }),

    events_near: tool({
      description:
        "Ticketed events near a point within a time window of the slot's day: when each crowd arrives or leaves, and how close its headliner's fans are to the act's taste (Qloo affinity). End times may be estimated.",
      inputSchema: z.object({
        near: whereSchema,
        radiusM: z.number().int().min(200).max(1500).optional().describe("Default 800."),
        fromHour: z.number().int().min(0).max(23).optional().describe("Default one hour before the slot (any time: the pitch's best window, else the whole day from 9 am)."),
        toHour: z.number().int().min(1).max(24).optional().describe("Default the slot's end (any time: the pitch's best window, else 10 pm)."),
      }),
      execute: async ({ near, radiusM, fromHour, toHour }) => {
        const point = await where(near);
        const radius = snapRadius(radiusM, 800);
        const best = await windowOfPitch(point.pitchId);
        const slot = best ?? (ctx.isAnyTime ? ANY_TIME_DAY : ctx.slotFor({}));
        const from = fromHour ?? Math.max(0, slot.startHour - 1);
        const to = toHour ?? slot.endHour;
        const [events, taste] = await Promise.all([ctx.events(), ctx.eventTaste()]);
        const hourOf = (iso: string) => Number(new Intl.DateTimeFormat("en-AU", { hour: "numeric", hour12: false, timeZone: ctx.city.timeZone }).format(new Date(iso))) % 24;
        const time = (iso: string) => new Intl.DateTimeFormat("en-AU", { hour: "numeric", minute: "2-digit", timeZone: ctx.city.timeZone }).format(new Date(iso));
        const rows = events
          .map((e) => ({ e, d: distanceM(point, e.venue) }))
          .filter(({ e, d }) => d <= radius && (hourOf(e.start) < to && hourOf(e.end) >= from))
          .sort((a, b) => a.d - b.d)
          .slice(0, 8)
          .map(({ e, d }) => ({
            name: e.name,
            venue: e.venue.name,
            distanceM: Math.round(d),
            starts: time(e.start),
            ends: time(e.end),
            endEstimated: e.endEstimated,
            segment: e.segment,
            headlinerMatch: taste.get(e.id) ? `${taste.get(e.id)!.artist} ${r2(taste.get(e.id)!.affinity)}` : null,
          }));
        return seen({
          summary: `${rows.length} events within ${radius} m of ${point.label} between ${formatHour(from)} and ${formatHour(to)}`,
          at: at(point),
          radiusM: radius,
          window: `${formatHour(from)}–${formatHour(to)}`,
          events: rows,
        });
      },
    }),

    footfall_at: tool({
      description: "Typical pedestrians per hour at the sensors nearest a point, for the slot's weekday at the hour you give (average of recent weeks; an estimate).",
      inputSchema: z.object({
        at: whereSchema,
        hour: z.number().int().min(0).max(23).optional().describe("Default the slot's start (any time: the pitch's best window start, else the busiest hour of the day, 10 am to 10 pm)."),
      }),
      execute: async ({ at: w, hour }) => {
        const point = await where(w);
        const best = await windowOfPitch(point.pitchId);
        const [typical, slot] = await Promise.all([
          ctx.trackFootfallTypical(() => getTypicalFootfall(ctx.request.city, 0, 24, ctx.adapters, ctx.today)),
          ctx.footfall(),
        ]);
        const nearestSensor = typical.sensors.map((s) => ({ s, d: distanceM(point, s) })).filter((x) => x.d <= 600).sort((a, b) => a.d - b.d)[0]?.s;
        // Any time with no window known: the nearest sensor's busiest hour of the day.
        const peakHour = nearestSensor
          ? Array.from({ length: ANY_TIME_DAY.endHour - ANY_TIME_DAY.startHour }, (_, i) => ANY_TIME_DAY.startHour + i).reduce(
              (top, hh) => ((nearestSensor.byWeekdayHour[ctx.weekday]?.[hh] ?? -1) > (nearestSensor.byWeekdayHour[ctx.weekday]?.[top] ?? -1) ? hh : top),
              ANY_TIME_DAY.startHour,
            )
          : ANY_TIME_DAY.startHour;
        const h = hour ?? best?.startHour ?? (ctx.isAnyTime ? peakHour : ctx.slotFor({}).startHour);
        const slotAvg = new Map(slot.sensors.map((s) => [s.id, s.avgHourly]));
        const rows = typical.sensors
          .map((s) => ({ s, d: distanceM(point, s) }))
          .filter((x) => x.d <= 600)
          .sort((a, b) => a.d - b.d)
          .slice(0, 4)
          .map(({ s, d }) => ({
            sensor: s.name,
            distanceM: Math.round(d),
            peopleThisHour: s.byWeekdayHour[ctx.weekday]?.[h] !== undefined ? Math.round(s.byWeekdayHour[ctx.weekday][h]) : null,
            slotAveragePerHour: best
              ? (() => {
                  const v = typicalForSlot(s, ctx.weekday, best.startHour, best.endHour);
                  return v === null ? null : Math.round(v);
                })()
              : slotAvg.get(s.id) != null
                ? Math.round(slotAvg.get(s.id)!)
                : null,
          }));
        return seen({
          summary:
            typical.level === "unavailable"
              ? "Sensor data unavailable"
              : rows.length === 0
                ? `No sensor within 600 m of ${point.label}`
                : rows[0].peopleThisHour === null
                  ? `No count at ${rows[0].sensor} for ${ctx.weekday}s at ${formatHour(h)}`
                  : `About ${rows[0].peopleThisHour} people an hour at ${rows[0].sensor} on ${ctx.weekday}s at ${formatHour(h)} (estimate)`,
          at: at(point),
          weekday: ctx.weekday,
          hour: h,
          weeksOfHistory: slot.baselineDates.length,
          sensors: rows,
        });
      },
    }),

    check_pitch: tool({
      description:
        "Check a spot against the council's busking layers for the act's permit: snaps to the nearest known public space, says whether the rules rule it out, and lists cautions. A legal spot gets a pitchId you can add with score_pitches.",
      inputSchema: z.object({ spot: whereSchema }),
      execute: async ({ spot }) => {
        const point = await where(spot);
        const [pitchData, ranked, funnel] = await Promise.all([ctx.pitchData(), ctx.ranked(), ctx.funnel()]);
        if (funnel === null) {
          // Without the council's layers nothing can be checked: never add a spot then.
          return seen({ summary: "The council's busking rules are unavailable, so no spot can be checked", name: point.label, legal: "unknown", inPool: false, pitchId: null, cautions: [] as string[] });
        }
        const existing = point.pitchId ? null : ranked.find((p) => distanceM(p, point) <= 60);
        if (point.pitchId || existing) {
          const p = point.pitchId ? (await knownPitches()).find((x) => x.id === point.pitchId)! : existing!;
          return seen({
            summary: `${p.name} is already in the engine's pool (${p.id})`,
            pitchId: p.id,
            name: p.name,
            legal: "not ruled out",
            inPool: true,
            amplification: p.amplification,
            usualSpot: p.usualSpot,
            cautions: p.cautions,
          });
        }
        const id = `agent:${nameKey(point.label).replaceAll(" ", "-").slice(0, 40) || `${r4(point.lat)},${r4(point.lon)}`}`;
        const candidate = candidateAt(
          { id, name: point.label.replace(/^near /, "Near "), lat: point.lat, lon: point.lon },
          { sites: pitchData.sites, zones: pitchData.zones, hotspots: USUAL_HOTSPOTS, permit: ctx.request.permit },
        );
        if (candidate) candidate.origin = "agent";
        if (!candidate) {
          return seen({ summary: `${point.label}: ruled out by the council's busking layers`, name: point.label, legal: "ruled out", inPool: false, pitchId: null, cautions: [] as string[] });
        }
        state.checked.set(id, candidate);
        return seen({
          summary: `${candidate.name}: not ruled out; add it with score_pitches to score it`,
          pitchId: id,
          name: candidate.name,
          legal: "not ruled out",
          inPool: false,
          amplification: candidate.amplification,
          usualSpot: candidate.usualSpot,
          cautions: candidate.cautions,
        });
      },
    }),

    score_pitches: tool({
      description: `Score the engine's candidate pool plus any spots you add (pitchIds from check_pitch, up to ${MAX_ADDED}), with the engine's fixed weights. Returns the best ${SCORE_ROWS} with factor values (0–1), marks the engine's own top 3 and any pitch within ${MIN_FINAL_SPACING_M} m of a higher one (sameCornerAs), and the pool size. Final pitches must come from here.`,
      inputSchema: z.object({ add: z.array(z.string().max(80)).max(MAX_ADDED).optional().describe("pitchIds from check_pitch to add to the pool.") }),
      execute: async ({ add }) => {
        if (!scoringOpen(state)) throw new WhereError(gateMessage(state));
        const unknown = (add ?? []).filter((id) => !state.checked.has(id) && !state.pool.has(id));
        if (unknown.length) throw new WhereError(`Not checked: ${unknown.join(", ")}. Call check_pitch first and use the pitchId it returns.`);
        for (const id of add ?? []) if (state.checked.has(id)) state.added.add(id);
        if (state.added.size > MAX_ADDED) throw new WhereError(`At most ${MAX_ADDED} added spots.`);
        const { ranked, engineTop } = await scorePool();
        const engineIds = new Set(engineTop.map((p) => p.id));
        // The best rows, plus every pitch the agent asked about (added, or already in the pool), wherever it ranks.
        const asked = new Set([...state.added, ...(add ?? [])]);
        const shown = [...ranked.slice(0, SCORE_ROWS), ...ranked.filter((p, i) => i >= SCORE_ROWS && asked.has(p.id))];
        const weather = await ctx.weather();
        const corners = sameCorners(ranked);
        return seen({
          summary: ranked.length ? `${ranked.length} pitches scored; best ${ranked[0].name} ${ranked[0].score}/100; engine's top 3: ${engineTop.map((p) => p.name).join(", ")}` : "No legal pitch found",
          weights: ctx.weights,
          poolSize: ranked.length,
          ...(ctx.isAnyTime ? { windows: ctx.windows().length, note: "Any time: each pitch is scored at its own best 3-hour window that day; call best_hours for the hours." } : {}),
          added: [...state.added],
          rankOf: Object.fromEntries([...asked].map((id) => [id, ranked.findIndex((p) => p.id === id) + 1])),
          slotWeather: weather ? weather.hours.map((h) => `${formatHour(h.hour)} ${h.temperatureC ?? "?"}°C rain ${h.precipitationProbability ?? "?"}% wind ${h.windKmh ?? "?"} km/h`).join("; ") : "no forecast",
          pitches: shown.map((p) => compactPitch(p, engineIds, state.added, corners)),
        });
      },
    }),

    best_hours: tool({
      description:
        "Any time only: for up to 3 scored pitches, the engine's top 3 three-hour windows of the day (10 am to 10 pm) with scores, typical people an hour at the nearest sensor for each hour, the events arriving or leaving nearby, rain by hour and the places open then. Engine data only.",
      inputSchema: z.object({ pitchIds: z.array(z.string().max(80)).min(1).max(3).describe("pitchIds from score_pitches.") }),
      execute: async ({ pitchIds }) => {
        if (!state.scored) throw new WhereError("Call score_pitches first: ask for the best hours of pitchIds it returned.");
        const unknown = pitchIds.filter((id) => !state.pool.has(id));
        if (unknown.length) throw new WhereError(`Unknown pitchId ${unknown.join(", ")}: use ids from score_pitches.`);
        const windows = ctx.windows();
        if (windows.length === 0) throw new WhereError("No busking hours are left on that day.");
        const [base, reference] = await Promise.all([ctx.anyTimeBase(), ctx.footfallReference()]);
        const hours = Array.from({ length: ANY_TIME_DAY.endHour - ANY_TIME_DAY.startHour }, (_, i) => ANY_TIME_DAY.startHour + i);
        const label = (w: { startHour: number; endHour: number }) => `${formatHour(w.startHour)}–${formatHour(w.endHour)}`;
        const pitches = [...new Set(pitchIds)].map((id) => {
          const pitch = state.pool.get(id)!;
          const top = scoreWindows(pitch, base, windows, ctx.weights, reference)
            .sort((a, b) => b.score - a.score || a.window!.startHour - b.window!.startHour)
            .slice(0, 3);
          const sensor = base.sensors.map((s) => ({ s, d: distanceM(pitch, s) })).filter((x) => x.d <= 600).sort((a, b) => a.d - b.d)[0]?.s ?? null;
          const people = (h: number) => (sensor && sensor.byWeekdayHour[ctx.weekday]?.[h] !== undefined ? Math.round(sensor.byWeekdayHour[ctx.weekday][h]) : null);
          const rain = (h: number) => base.weather?.find((x) => x.hour === h)?.precipitationProbability ?? null;
          const peak = hours.reduce<number | null>((best, h) => ((people(h) ?? -1) > (best === null ? -1 : (people(best) ?? -1)) ? h : best), null);
          return {
            pitchId: id,
            name: pitch.name,
            best: label(top[0].window!),
            windows: top.map((t) => ({
              window: label(t.window!),
              startHour: t.window!.startHour,
              endHour: t.window!.endHour,
              score: t.score,
              peoplePerHour: t.evidence.sensor?.avgHourly ?? null,
              events: t.evidence.events.slice(0, 2).map((e) => ({
                name: e.name,
                moment: e.moment,
                at: clock(e.moment === "leaving" ? e.end : e.start),
                endEstimated: e.endEstimated,
              })),
              rainPercent: (() => {
                const v = base.weather?.filter((x) => x.hour >= t.window!.startHour && x.hour < t.window!.endHour).map((x) => x.precipitationProbability ?? 0);
                return v && v.length ? Math.max(...v) : null;
              })(),
              placesOpen: t.evidence.places.filter((p) => p.open === "open").slice(0, 3).map((p) => p.name),
            })),
            sensor: sensor?.name ?? null,
            peakHour: peak,
            hourly: hours.map((h) => ({ hour: h, people: people(h), rainPercent: rain(h) })),
          };
        });
        const first = pitches[0];
        const firstEvent = first.windows[0].events[0];
        return seen({
          summary: `Best ${first.windows[0].window} at ${first.name}${first.peakHour !== null ? `: foot traffic peaks at ${formatHour(first.peakHour)}` : ""}${firstEvent ? `${first.peakHour !== null ? " and" : ":"} the ${firstEvent.name} crowd ${firstEvent.moment === "leaving" ? "lets out" : "arrives"} at ${firstEvent.at}` : ""}`,
          weekday: ctx.weekday,
          windowsScored: windows.length,
          pitches,
          note: "Typical people an hour are estimates from recent weeks at the nearest sensor; event end times may be estimated.",
        });
      },
    }),

    compare_crowds: tool({
      description: "Compare two scored pitches: the genres that characterise each crowd (Qloo), the act's artists' affinity at each, and the engine's factors side by side.",
      inputSchema: z.object({ a: z.string().max(80).describe("pitchId"), b: z.string().max(80).describe("pitchId") }),
      execute: async ({ a, b }) => {
        if (!state.scored) throw new WhereError("Call score_pitches first: compare pitchIds it returned.");
        const pa = state.pool.get(a);
        const pb = state.pool.get(b);
        if (!pa || !pb) throw new WhereError(`Unknown pitchId ${!pa ? a : b}: use ids from score_pitches.`);
        const entityIds = await ids();
        const side = async (p: ScoredPitch) => {
          const s = snapPoint(p);
          const [genres, affinity] = await Promise.all([
            ctx.crowdGenres(p),
            entityIds.length ? ctx.trackQloo(`agent:affinity:${s.lat},${s.lon}`, () => qloo.artistAffinityAt(entityIds, s, 400, ctx.adapters)) : Promise.resolve({} as Record<string, number>),
          ]);
          return { genres, affinity };
        };
        const [sa, sb] = await Promise.all([side(pa), side(pb)]);
        const artists = await ctx.artists();
        const genreNames = [...new Set([...sa.genres, ...sb.genres].map((g) => g.name.trim()))];
        const g = (list: qloo.TasteTag[], name: string) => r2(list.find((x) => x.name.trim() === name)?.affinity ?? null);
        return seen({
          summary: `${pa.name} ${pa.score}/100 vs ${pb.name} ${pb.score}/100`,
          scores: { [pa.name]: pa.score, [pb.name]: pb.score },
          factors: (["taste", "footfall", "places", "events"] as const).map((f) => ({ factor: f, a: r2(pa.factors[f]), b: r2(pb.factors[f]) })),
          genres: genreNames.map((name) => ({ genre: name, a: g(sa.genres, name), b: g(sb.genres, name) })),
          yourArtists: artists
            .filter((r) => r.entity)
            .map((r) => ({ artist: r.entity!.name, a: r2(sa.affinity[r.entity!.id] ?? null), b: r2(sb.affinity[r.entity!.id] ?? null) })),
          note: "a = first pitch, b = second; null = no local score",
        });
      },
    }),

    build_setlist: tool({
      description: "Order the act's own songs for one scored pitch: crowd affinity for each song's artist there (Qloo), popularity (Last.fm) and era fit with the fans' age lean.",
      inputSchema: z.object({ pitchId: z.string().max(80) }),
      execute: async ({ pitchId }) => {
        if (!state.scored) throw new WhereError("Call score_pitches first: build the suggested set for a pitchId it returned.");
        const pitch = state.pool.get(pitchId);
        if (!pitch) throw new WhereError(`Unknown pitchId ${pitchId}: use ids from score_pitches.`);
        const setlist = await ctx.setlistFor(pitch);
        return seen({
          summary: setlist.length ? `${setlist.length} songs for ${pitch.name}; open with ${setlist[0].title}` : "No songs given",
          pitch: pitch.name,
          songs: setlist.slice(0, 10).map((s, i) => ({ order: i + 1, song: s.title, artist: s.artist, year: s.year, score: s.score, why: s.reason, ...(s.origin === "suggested" ? { suggested: true } : {}), ...(s.localScene ? { localScene: true } : {}) })),
        });
      },
    }),

    learn_these: tool({
      description: "Songs worth learning: favourites of this crowd the act doesn't play, ranked by Qloo audience growth (falls back to affinity and Last.fm listeners).",
      inputSchema: z.object({}),
      execute: async () => {
        const learn = await ctx.learn();
        return seen({
          summary: `${learn.length} songs to learn`,
          songs: learn.map((l) => ({ artist: l.artist, title: l.title, playcount: l.playcount, why: l.reason })),
        });
      },
    }),

    finish_plan: tool({
      description:
        `Finish: the three pitches you recommend (pitchIds from score_pitches, best first, at least ${MIN_FINAL_SPACING_M} m apart) with a short evidence-based why for each, a two-sentence summary and data caveats. Rejected answers say why; fix and call again.`,
      inputSchema: finishSchema,
      execute: async (answer) => {
        // A run cut short before score_pitches still finishes against a scored pool: the engine's.
        if (!state.scored && state.wrappingUp) await scorePool();
        const problems = checkAnswer(answer, state);
        if (problems.length > 0 && !(problems.every((p) => p.kind === "numbers") && state.rejections >= MAX_FINISH_REJECTIONS)) {
          state.rejections++;
          return { accepted: false, summary: `Rejected: ${problems.map((p) => p.message).join(" ")}`, problems: problems.map((p) => p.message) };
        }
        if (problems.length > 0) state.unverifiedNumbers = problems.flatMap((p) => p.numbers ?? []);
        state.answer = answer;
        return { accepted: true, summary: `Accepted: ${answer.pitches.map((p) => state.pool.get(p.pitchId)!.name).join(", ")}` };
      },
    }),
  };
  // best_hours exists only for an any-time request (plan-inputs-architecture.md 2.4); the key stays in the type.
  if (!ctx.isAnyTime) delete (tools as Partial<typeof tools>).best_hours;
  return tools;
}

type Problem = { kind: "pool" | "count" | "spacing" | "numbers"; message: string; numbers?: string[] };

/** The guardrails on the final answer. Pure, so tests can call it directly. */
export function checkAnswer(answer: AgentAnswer, state: AgentState): Problem[] {
  const problems: Problem[] = [];
  if (state.pool.size === 0) return [{ kind: "pool", message: "Call score_pitches before finishing." }];
  const ids = answer.pitches.map((p) => p.pitchId);
  const unknown = ids.filter((id) => !state.pool.has(id));
  if (unknown.length) {
    const best = [...state.pool.values()].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, SCORE_ROWS);
    const listing = best.map((p) => `${p.id} (${p.name}, ${p.score})`).join("; ");
    state.seen.add(listing);
    problems.push({ kind: "pool", message: `Not in the scored pool: ${unknown.join(", ")}. Use pitchIds from score_pitches. Best scored: ${listing}.` });
  }
  if (new Set(ids).size !== ids.length) problems.push({ kind: "count", message: "Each pitch only once." });
  const want = Math.min(3, state.pool.size);
  if (ids.length < want) problems.push({ kind: "count", message: `Recommend ${want} pitches.` });
  const chosen = ids.flatMap((id) => (state.pool.has(id) ? [state.pool.get(id)!] : []));
  for (let i = 0; i < chosen.length; i++) {
    for (let j = i + 1; j < chosen.length; j++) {
      if (distanceM(chosen[i], chosen[j]) < MIN_FINAL_SPACING_M) {
        problems.push({ kind: "spacing", message: `${chosen[i].name} and ${chosen[j].name} are the same corner (under ${MIN_FINAL_SPACING_M} m apart): pick pitches that differ.` });
      }
    }
  }
  const text = [answer.summary, ...answer.pitches.map((p) => p.why), ...answer.notes].join(" ");
  const unknownNumbers = state.seen.unknownIn(text);
  if (unknownNumbers.length) {
    problems.push({ kind: "numbers", numbers: unknownNumbers, message: `These numbers aren't in any tool result: ${unknownNumbers.join(", ")}. Use only numbers the tools returned.` });
  }
  return problems;
}

/** The point of a pitch, for tests. */
export const pointOf = (p: LatLon) => ({ lat: p.lat, lon: p.lon });

export type PlanTools = ReturnType<typeof createTools>;
