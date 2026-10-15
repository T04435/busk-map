import "server-only";
import { tool } from "ai";
import { z } from "zod";
import { formatHour } from "@/lib/slot";
import type { PlanContext } from "./context";

/**
 * Agent tools. Each wraps the adapters or the scoring engine through the
 * per-request PlanContext, so results are fetched once, cached, and reused
 * by the final assembly. Outputs are compact summaries to keep tokens (and
 * cost) low; every output has a one-line `summary` that is also streamed to
 * the UI.
 */
const noInput = z.object({});
const r2 = (n: number | null | undefined) => (n === null || n === undefined ? null : Math.round(n * 100) / 100);

export const TOOL_LABELS: Record<string, string> = {
  resolve_repertoire: "Matching your artists to Qloo",
  taste_map: "Mapping where your taste concentrates (Qloo heatmap)",
  busy_places: "Finding busy places open in your slot (Qloo)",
  footfall: "Reading pedestrian sensors for your slot",
  busking_rules: "Checking legal pitches and zones",
  events: "Looking for events nearby (Ticketmaster)",
  weather: "Checking the forecast (Open-Meteo)",
  local_artists: "Finding what this crowd likes (Qloo)",
  rising: "Finding artists rising locally (Qloo trending)",
  crowd_profile: "Profiling the crowd (Qloo demographics)",
  score_pitches: "Scoring legal pitches",
  build_setlists: "Ordering your setlist for each pitch",
};

/** The data call behind each tool, shown next to the step so judges see each Qloo call as it happens. */
export const TOOL_SOURCES: Record<string, string> = {
  resolve_repertoire: "Qloo /search and /entities (Spotify ids)",
  taste_map: "Qloo /v2/insights · urn:heatmap",
  busy_places: "Qloo /v2/insights · urn:entity:place with filter.hours",
  footfall: "City of Melbourne pedestrian sensors",
  busking_rules: "City of Melbourne busking layers",
  events: "Ticketmaster, then Qloo /search and /v2/insights for headliner taste match",
  weather: "Open-Meteo",
  local_artists: "Qloo /v2/insights · urn:entity:artist with signal.location and explainability",
  rising: "Qloo /v2/trending",
  crowd_profile: "Qloo /v2/insights · urn:demographics",
  score_pitches: "Busk Map scoring engine (no model)",
  build_setlists: "Qloo /v2/insights per pitch, Last.fm, Spotify release years",
};

export function createTools(ctx: PlanContext) {
  return {
    resolve_repertoire: tool({
      description: "Match the performer's artists to Qloo entities. Call this first.",
      inputSchema: noInput,
      execute: async () => {
        const artists = await ctx.artists();
        const matched = artists.filter((a) => a.entity);
        return {
          summary: `Matched ${matched.length} of ${artists.length} artists in Qloo`,
          artists: artists.map((a) => ({ query: a.query, match: a.entity?.name ?? null })),
        };
      },
    }),

    taste_map: tool({
      description: "Qloo heatmap of where in the city the performer's taste concentrates. Retries over a wider area if empty.",
      inputSchema: noInput,
      execute: async () => {
        const cells = await ctx.tasteCells();
        const top = [...cells].sort((a, b) => b.affinity - a.affinity).slice(0, 3);
        return {
          summary: cells.length ? `${cells.length} taste cells; strongest affinity ${r2(top[0].affinity)}` : "No taste data",
          cells: cells.length,
          strongest: top.map((c) => ({ lat: Math.round(c.lat * 1000) / 1000, lon: Math.round(c.lon * 1000) / 1000, affinity: r2(c.affinity) })),
        };
      },
    }),

    busy_places: tool({
      description: "Popular places (bars, stations, markets, venues) open on the slot's weekday, ranked for this taste (Qloo).",
      inputSchema: noInput,
      execute: async () => {
        const places = await ctx.places();
        return {
          summary: `${places.length} places open that day`,
          top: places.slice(0, 8).map((p) => ({
            name: p.name,
            popularity: r2(p.popularity),
            affinity: r2(p.affinity),
            liveMusic: p.liveMusic,
            goodFor: p.goodFor.slice(0, 2),
            tags: p.tags.slice(0, 2).map((t) => t.name),
          })),
        };
      },
    }),

    footfall: tool({
      description: "Pedestrian counts for the slot from city sensors (average over recent same weekdays).",
      inputSchema: noInput,
      execute: async () => {
        const data = await ctx.footfall();
        const busiest = data.sensors
          .filter((s) => s.avgHourly !== null)
          .sort((a, b) => (b.avgHourly ?? 0) - (a.avgHourly ?? 0))
          .slice(0, 5);
        return {
          summary: data.level === "unavailable" ? "Sensor data unavailable" : `${data.sensors.length} sensors; busiest ${busiest[0]?.name ?? "n/a"}`,
          level: data.level,
          weeksOfHistory: data.baselineDates.length,
          busiest: busiest.map((s) => ({ name: s.name, peoplePerHour: Math.round(s.avgHourly ?? 0) })),
        };
      },
    }),

    busking_rules: tool({
      description:
        "Candidate pitches from the data: the performer's top Qloo taste cells snapped to public spaces and sensor footpaths, plus council sites, filtered by the council's busking layers for the performer's permit.",
      inputSchema: noInput,
      execute: async () => {
        const { candidates, funnel } = await ctx.candidates();
        const designated = candidates.filter((c) => c.kind === "designated").length;
        const usual = candidates.filter((c) => c.usualSpot).length;
        return {
          summary: funnel
            ? `${candidates.length} legal candidates from ${funnel.topCells} top taste cells (${designated} council sites, ${usual} at well-known hotspots; ${funnel.excluded} ruled out by the rules)`
            : "Busking rules unavailable: no pitch can be checked",
          funnel,
          designated,
          offTheUsualCircuit: candidates.length - usual,
          permit: ctx.request.permit,
        };
      },
    }),

    events: tool({
      description:
        "Ticketed events near the centre around the slot (crowds arriving or leaving), with how close each music event's crowd is to the performer's taste (Qloo affinity of the headliner).",
      inputSchema: noInput,
      execute: async () => {
        const [events, taste] = await Promise.all([ctx.events(), ctx.eventTaste()]);
        return {
          summary: `${events.length} events around the slot${taste.size ? `; ${taste.size} matched to your taste in Qloo` : ""}`,
          events: events.slice(0, 8).map((e) => ({
            name: e.name,
            venue: e.venue.name,
            localStart: e.localTime,
            segment: e.segment,
            endEstimated: e.endEstimated,
            crowdTasteMatch: taste.get(e.id) ?? null,
          })),
        };
      },
    }),

    weather: tool({
      description: "Hourly forecast for the slot.",
      inputSchema: noInput,
      execute: async () => {
        const weather = await ctx.weather();
        if (!weather) return { summary: "No forecast available (weather ignored)", hours: [] };
        const maxRain = Math.max(0, ...weather.hours.map((h) => h.precipitationProbability ?? 0));
        return {
          summary: `Rain chance up to ${maxRain}%`,
          hours: weather.hours.map((h) => ({ time: formatHour(h.hour), tempC: h.temperatureC, rainChance: h.precipitationProbability, windKmh: h.windKmh })),
        };
      },
    }),

    local_artists: tool({
      description: "Artists this city's crowd likes, given the performer's taste, with which of the performer's artists explain each (Qloo explainability).",
      inputSchema: noInput,
      execute: async () => {
        const artists = await ctx.localArtists();
        const resolved = await ctx.artists();
        const nameOf = (id: string) => resolved.find((r) => r.entity?.id === id)?.entity?.name ?? null;
        return {
          summary: `${artists.length} artists liked by this crowd`,
          artists: artists.slice(0, 8).map((a) => ({
            name: a.name,
            affinity: r2(a.affinity),
            because: a.explanation.slice(0, 2).flatMap((e) => {
              const name = e.name ?? nameOf(e.entityId);
              return name ? [{ name, explainability: r2(e.score) }] : [];
            }),
          })),
        };
      },
    }),

    rising: tool({
      description: "Momentum of the crowd's favourite artists over recent weeks (Qloo trending).",
      inputSchema: noInput,
      execute: async () => {
        const rows = await ctx.rising();
        const locals = await ctx.localArtists();
        const nameOf = (id: string) => locals.find((a) => a.id === id)?.name ?? id;
        return {
          summary: `${rows.filter((r) => (r.percentDelta ?? 0) > 0).length} rising artists`,
          artists: rows.map((r) => ({ name: nameOf(r.entityId), percentDelta: r2(r.percentDelta) })),
        };
      },
    }),

    crowd_profile: tool({
      description: "Age and gender lean of fans of the performer's artists (Qloo demographics). Use it for tone, never to target individuals.",
      inputSchema: noInput,
      execute: async () => {
        const profile = await ctx.crowdProfile();
        if (!profile) return { summary: "No demographic data", age: {}, gender: {} };
        const lean = Object.entries(profile.age).sort((a, b) => b[1] - a[1])[0];
        return { summary: lean ? `Leans ${lean[0].replaceAll("_", " ")}` : "No clear age lean", age: profile.age, gender: profile.gender };
      },
    }),

    score_pitches: tool({
      description:
        "Score every legal candidate pitch with the deterministic engine and return the top three (with ids) plus the evidence. The final plan must use these pitch ids.",
      inputSchema: noInput,
      execute: async () => {
        const top = await ctx.topPitches();
        return {
          summary: top.length ? `Top pitch: ${top[0].name} (${top[0].score}/100)` : "No legal pitch found",
          weights: ctx.weights,
          pitches: top.map((p) => ({
            pitchId: p.id,
            name: p.name,
            score: p.score,
            kind: p.kind,
            discovery: p.discovery,
            usualSpot: p.usualSpot,
            tasteCellRank: p.cell?.rank ?? null,
            factors: { taste: r2(p.factors.taste), footfall: r2(p.factors.footfall), places: r2(p.factors.places), events: r2(p.factors.events), weatherPenalty: r2(p.factors.weatherPenalty), discovery: r2(p.factors.discovery) },
            footfallSource: p.footfallSource,
            sensor: p.evidence.sensor,
            nearbyPlaces: p.evidence.places.slice(0, 3).map((pl) => ({ name: pl.name, liveMusic: pl.liveMusic ?? null, goodFor: pl.goodFor?.slice(0, 2) ?? [], reviewKeywords: pl.keywords?.slice(0, 3) ?? [] })),
            events: p.evidence.events.map((e) => ({
              name: e.name,
              moment: e.moment,
              endEstimated: e.endEstimated,
              crowdTasteMatch: e.tasteMatch ? { headliner: e.tasteMatch.artist, qlooAffinity: r2(e.tasteMatch.affinity) } : null,
            })),
            cautions: p.cautions,
          })),
        };
      },
    }),

    build_setlists: tool({
      description:
        "Order the performer's songs for each top pitch by the crowd's affinity for each artist at that pitch (Qloo), song popularity (Last.fm) and era fit (release year vs the crowd's age lean from Qloo demographics), and suggest songs to learn (Qloo audience growth).",
      inputSchema: noInput,
      execute: async () => {
        const top = await ctx.topPitches();
        const setlists = await Promise.all(
          top.map(async (p) => ({
            pitchId: p.id,
            first: (await ctx.setlistFor(p)).slice(0, 4).map((s) => ({ song: `${s.title} (${s.artist}${s.year ? `, ${s.year}` : ""})`, why: s.reason })),
          })),
        );
        const learn = await ctx.learn();
        return {
          summary: `Setlists for ${setlists.length} pitches; ${learn.length} songs to learn`,
          setlists,
          learnThese: learn.map((l) => ({ artist: l.artist, title: l.title, why: l.reason })),
        };
      },
    }),
  };
}

export type PlanTools = ReturnType<typeof createTools>;
