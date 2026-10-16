import "server-only";
import type { BBox } from "@/lib/geo";
import type { TrendRow } from "@/server/adapters/qloo";
import { ageLabel } from "@/lib/age";
import { addDays, ANY_TIME_DAY, anyTimeWindowsLeft, DEFAULT_SLOT_HOURS, isAnyTime, slotUtcRange, weekdayOf, zonedHourToUtc, type Slot, type TimeWindow } from "@/lib/slot";
import { nameKey, trackKey } from "@/lib/text";
import type { PlanRequest } from "@/lib/plan-schema";
import type { AdapterContext, AdapterName, AdapterResult } from "@/server/adapters/core";
import { getEvents, getEventsBetween, EVENTS_LOOKBACK_HOURS } from "@/server/adapters/events";
import { getFootfall, getTypicalFootfall, type FootfallData } from "@/server/adapters/footfall";
import { getPitches } from "@/server/adapters/pitches";
import * as qloo from "@/server/adapters/qloo";
import { findReleaseYears } from "@/server/adapters/repertoire";
import { getSongs } from "@/server/adapters/songs";
import { getWeather } from "@/server/adapters/weather";
import { CITIES } from "@/server/cities";
import { PUBLIC_SPOTS, USUAL_HOTSPOTS } from "@/server/data/spots";
import {
  buildCandidatesWithFunnel,
  buildSetlist,
  DEFAULT_MAX_SONGS,
  learnThese,
  normalizeWeights,
  pickTopPitches,
  rankPitches,
  rankPitchesAnyTime,
  scorePitch,
  scorePitchAnyTime,
  typicalForSlot,
  footfallReferenceOf,
  type AnyTimeBase,
  type Candidate,
  type RepertoireSong,
  type ScoreInputs,
  type ScoredPitch,
  type Weights,
} from "@/server/scoring";
import { serverLocalNow, serverToday } from "@/server/clock";
import { LEARN_MAX_PER_ARTIST, SUGGEST_ARTISTS_PER_PITCH, SUGGEST_CATALOGUE_LOOKUPS, SUGGEST_RELATED_TAKE } from "@/server/playlist/config";
import { fillAsRepertoire, mergeFillArtists, pickFillSongs, rankFillArtists, type FillArtist } from "@/server/scoring/fill";
import { catalogueOf } from "@/server/songs/catalogue";

/** Search radius for busy places, from the city centre. Covers the planning area. */
export const PLACES_RADIUS_M = 2000;
/** Radius of "the crowd at this pitch" for per-pitch artist affinity. */
export const PITCH_CROWD_RADIUS_M = 400;
export const LOCAL_ARTISTS_TAKE = 20;
/** A trending window that ends longer ago than this is called out in the plan. */
export const TRENDING_STALE_DAYS = 14;
export const WIDEN_FACTOR = 2;
/** Radius of "the crowd" at a pitch for genre analysis, and around the busiest hotspot for the contrast. */
export const CROWD_RADIUS_M = 400;
export const HOTSPOT_CROWD_TAKE = 10;
/** Event headliners matched against the performer's taste per plan (one Qloo search each, cached). */
export const EVENT_ARTISTS_MAX = 6;
/** Most entity ids one per-pitch affinity call may carry (Qloo's `take` cap); the act's own artists come first, then the fill's candidates. */
export const AFFINITY_IDS_MAX = 50;
/** Upper bound for the ordering pass of a set with suggested songs (the act's 60 songs); trimmed afterwards. */
const MAX_REPERTOIRE_SET = 60;

function widen(box: BBox, factor: number): BBox {
  const dLat = ((box.north - box.south) * (factor - 1)) / 2;
  const dLon = ((box.east - box.west) * (factor - 1)) / 2;
  return { south: box.south - dLat, north: box.north + dLat, west: box.west - dLon, east: box.east + dLon };
}

/**
 * Qloo calls the plan can do without. When one fails, the plan says so in a
 * note and keeps Qloo's status; only the core calls (resolving the artists,
 * the taste map) make a plan "Qloo unavailable".
 */
const OPTIONAL_QLOO: [prefix: string, feature: string][] = [
  ["places", "busy places nearby"],
  ["localArtists", "the crowd's favourite artists"],
  ["trendWindow", "trends"],
  ["rising", "trends"],
  ["crowd", "the crowd's age and gender lean"],
  ["genres:", "the genres at the top pitch"],
  ["hotspotCrowd", "the contrast with the usual crowd"],
  ["compare", "the contrast with the usual crowd"],
  ["relatedArtists", "related artists for the suggested songs"],
  ["affinity:", "the suggested set order by local taste"],
  ["songArtists", "the suggested set order by local taste"],
  ["eventArtists", "how well event crowds match your taste"],
  ["eventTaste", "how well event crowds match your taste"],
  ["agent:", "one of the agent's extra looks"],
];

export function optionalQlooFeature(key: string): string | null {
  return OPTIONAL_QLOO.find(([prefix]) => key === prefix || (prefix.endsWith(":") && key.startsWith(prefix)) || key === `${prefix}:wide`)?.[1] ?? null;
}

type Status = { adapter: AdapterName; source: string; mode: AdapterResult<unknown>["mode"]; reason?: string };

/**
 * Everything one plan needs, loaded lazily and at most once per request.
 * Tools call into this; so does the final assembly, which means a plan is
 * complete even if the model skipped a tool.
 */
export class PlanContext {
  readonly request: PlanRequest;
  readonly adapters: AdapterContext;
  readonly today: string;
  readonly city;
  readonly weights: Weights;
  private readonly memo = new Map<string, Promise<unknown>>();
  private readonly statuses = new Map<string, Status>();
  /** Things the plan should tell the performer, e.g. that a search was widened. */
  readonly notes: string[] = [];

  /** The city's current hour, for dropping any-time windows that have started (only matters on today's date). */
  private readonly nowHour: number;

  constructor(request: PlanRequest, adapters: AdapterContext, today?: string, nowHour?: number) {
    this.request = request;
    this.adapters = adapters;
    this.city = CITIES[request.city];
    this.today = today ?? serverToday(this.city.timeZone);
    this.nowHour = nowHour ?? serverLocalNow(this.city.timeZone).hour;
    this.weights = normalizeWeights(request.weights);
  }

  /** Whether the request is "any time": the engine picks each pitch's window (plan-inputs-architecture.md 2). */
  get isAnyTime(): boolean {
    return isAnyTime(this.request.slot);
  }

  /** The any-time windows still ahead on the request's date (D2). Empty for a fixed slot. */
  windows(): TimeWindow[] {
    return isAnyTime(this.request.slot) ? anyTimeWindowsLeft(this.request.slot.date, this.today, this.nowHour) : [];
  }

  /** The fixed slot of a fixed request. Any-time code must not call it. */
  private fixedSlot(): Slot {
    if (isAnyTime(this.request.slot)) throw new Error("fixedSlot() on an any-time request");
    return this.request.slot;
  }

  /** The slot a pitch is played in: its best window for any time, else the request's slot. */
  slotFor(pitch: { window?: { startHour: number; endHour: number } }): Slot {
    if (!isAnyTime(this.request.slot)) return this.request.slot;
    const w = pitch.window ?? DEFAULT_SLOT_HOURS;
    return { date: this.request.slot.date, startHour: w.startHour, endHour: w.endHour };
  }

  private once<T>(key: string, load: () => Promise<T>): Promise<T> {
    if (!this.memo.has(key)) this.memo.set(key, load());
    return this.memo.get(key) as Promise<T>;
  }

  /** Run an adapter call once and record how its data was produced. */
  private track<T>(key: string, load: () => Promise<AdapterResult<T>>): Promise<T> {
    return this.once(key, async () => {
      const result = await load();
      const extra = optionalQlooFeature(key);
      if (result.adapter === "qloo" && result.mode === "fallback" && extra && !this.qlooFailed()) {
        // A Qloo extra that failed (often a slow call timing out) leaves the rest of the plan intact: say so, don't call Qloo down.
        const note = `Qloo didn't answer in time for ${extra}, so this plan goes without it.`;
        if (!this.notes.includes(note)) this.notes.push(note);
        return result.data;
      }
      const previous = this.statuses.get(result.adapter);
      // Keep the worst status per adapter: fallback beats synthetic beats live.
      const rank = { live: 0, synthetic: 1, fallback: 2 } as const;
      if (!previous || rank[result.mode] > rank[previous.mode]) {
        this.statuses.set(result.adapter, { adapter: result.adapter, source: result.source, mode: result.mode, reason: result.reason });
      }
      return result.data;
    });
  }

  /** An extra Qloo call (the agent's own looks), tracked and memoised like the engine's. Keys start with "agent:". */
  trackQloo<T>(key: `agent:${string}`, load: () => Promise<AdapterResult<T>>): Promise<T> {
    return this.track(key, load);
  }

  /**
   * The slot weekday's 24-hour foot traffic at each sensor, for the details sheet's sparkline (display only: never scored, and its
   * failure never marks the sensors down). Empty when the typical counts are unavailable.
   */
  hourlyProfiles(): Promise<Map<number, (number | null)[]>> {
    return this.once("footfallHourly", async () => {
      try {
        const typical = await getTypicalFootfall(this.request.city, 0, 24, this.adapters, this.today);
        const out = new Map<number, (number | null)[]>();
        if (typical.data.level !== "city-sensors") return out;
        for (const sensor of typical.data.sensors) {
          const day = sensor.byWeekdayHour[this.weekday];
          if (day) out.set(sensor.id, Array.from({ length: 24 }, (_, h) => (day[h] === undefined ? null : Math.round(day[h]))));
        }
        return out;
      } catch {
        return new Map<number, (number | null)[]>();
      }
    });
  }

  /** Typical foot traffic by weekday and hour (for the agent's footfall_at), loaded once. */
  trackFootfallTypical<T>(load: () => Promise<AdapterResult<T>>): Promise<T> {
    return this.track("footfallTypical", load);
  }

  dataStatus(): Status[] {
    return [...this.statuses.values()];
  }

  qlooFailed(): boolean {
    return this.statuses.get("qloo")?.mode === "fallback";
  }

  get weekday() {
    return weekdayOf(this.request.slot.date);
  }

  // ---- Data ---------------------------------------------------------------

  artists() {
    return this.track("artists", () => qloo.resolveArtists(this.request.performer.artists, this.adapters, this.request.performer.spotifyArtists));
  }

  async entityIds(): Promise<string[]> {
    return (await this.artists()).flatMap((a) => (a.entity ? [a.entity.id] : []));
  }

  /**
   * Taste heatmap over the planning area. If Qloo returns nothing, retry once
   * over a wider area and say so in the plan.
   */
  tasteCells() {
    return this.once("tasteCells", async () => {
      const ids = await this.entityIds();
      if (ids.length === 0) return [];
      const cells = await this.track("taste", () => qloo.tasteMap(ids, this.city.bbox, this.adapters));
      if (cells.length > 0 || this.qlooFailed()) return cells;
      const wider = await this.track("taste:wide", () => qloo.tasteMap(ids, widen(this.city.bbox, WIDEN_FACTOR), this.adapters));
      this.notes.push(
        wider.length > 0
          ? "Qloo had no taste data for the city centre alone, so the taste map uses a wider area."
          : "Qloo had no taste data for this area, so taste affinity was left out of the scores.",
      );
      return wider;
    });
  }

  /** Busy places open on the slot's weekday, widening the search once if empty. */
  places() {
    return this.once("placesWithRetry", async () => {
      const ids = await this.entityIds();
      if (ids.length === 0) return [];
      const found = await this.track("places", () => qloo.busyPlaces(ids, this.city.center, PLACES_RADIUS_M, this.weekday, this.adapters));
      if (found.length > 0 || this.qlooFailed()) return found;
      const wider = await this.track("places:wide", () =>
        qloo.busyPlaces(ids, this.city.center, PLACES_RADIUS_M * WIDEN_FACTOR, this.weekday, this.adapters),
      );
      this.notes.push(
        wider.length > 0
          ? "Qloo found no matching places open near the centre, so the search was widened."
          : "Qloo found no matching places open that day, so busy places were left out of the scores.",
      );
      return wider;
    });
  }

  /** What this city's crowd likes given the performer's artists, with Qloo's explainability. */
  private async localCrowd(): Promise<qloo.LocalArtists> {
    const ids = await this.entityIds();
    if (ids.length === 0) return { artists: [], impact: [] };
    return this.track("localArtists", () => qloo.localArtists(ids, this.city.bbox, LOCAL_ARTISTS_TAKE, this.adapters));
  }

  async localArtists(): Promise<qloo.QlooEntity[]> {
    return (await this.localCrowd()).artists;
  }

  /** Each input artist's average effect on the crowd's top picks (Qloo's top-level explainability). */
  async localImpact(): Promise<qloo.Impact[]> {
    return (await this.localCrowd()).impact;
  }

  /**
   * Momentum of the crowd's top artists. Live Qloo trending has no data for
   * recent weeks, so the window is the latest one with data (probed back a
   * quarter at a time, up to a year). Rows with no movement at all count as
   * no momentum data; the songs to learn then rank by affinity and Last.fm.
   */
  rising(): Promise<TrendRow[]> {
    return this.once("risingWithWindow", async () => {
      const locals = (await this.localArtists()).slice(0, 5);
      if (locals.length === 0) return [];
      // "Songs to learn" ranks by Qloo's audience growth first; trends and the fallback only matter without it.
      const growing = locals.some((a) => (a.audienceGrowth ?? 0) !== 0);
      const fallback = (why: string) => {
        if (!growing && !this.qlooFailed()) this.notes.push(`Qloo shows no audience growth for these artists and ${why}, so the songs to learn are ranked by Qloo affinity and Last.fm listeners instead.`);
      };
      const window = await this.track("trendWindow", () => qloo.trendingWindow(locals[0].id, this.today, this.adapters));
      if (!window) {
        fallback("has no trending data for the last year");
        return [];
      }
      const rows = await this.track("rising", () => qloo.rising(locals.map((a) => a.id), window.start, window.end, this.adapters));
      const moving = rows.some((r) => (r.percentDelta ?? 0) !== 0 || (r.windowChange ?? 0) !== 0);
      if (!moving) {
        fallback(`its latest trending data (to ${window.end}) shows no movement`);
        return [];
      }
      if (window.end < addDays(this.today, -TRENDING_STALE_DAYS)) this.notes.push(`Trends are from Qloo's latest trending data, which ends ${window.end}.`);
      return rows;
    });
  }

  async crowdProfile() {
    const ids = await this.entityIds();
    if (ids.length === 0) return null;
    return this.track("crowd", () => qloo.crowdProfile(ids, this.adapters));
  }

  /** Typical foot traffic by weekday and hour, loaded once (the agent's footfall_at and any time's windows share it). */
  typicalFootfall() {
    return this.trackFootfallTypical(() => getTypicalFootfall(this.request.city, 0, 24, this.adapters, this.today));
  }

  footfall(): Promise<FootfallData> {
    if (isAnyTime(this.request.slot)) {
      // Any time: the sensors with their typical average over the 10 am to 10 pm day (one sensor request, shared with footfall_at).
      return this.once("footfallDay", async () => {
        const typical = await this.typicalFootfall();
        return {
          level: typical.level,
          baselineDates: [],
          liveAsOf: null,
          sensors: typical.sensors.map((s) => ({ id: s.id, name: s.name, lat: s.lat, lon: s.lon, avgHourly: typicalForSlot(s, this.weekday, ANY_TIME_DAY.startHour, ANY_TIME_DAY.endHour), samples: 0, liveLastHour: null })),
        };
      });
    }
    return this.track("footfall", () => getFootfall(this.request.city, this.fixedSlot(), this.adapters, this.today));
  }

  pitchData() {
    return this.track("pitches", () => getPitches(this.request.city, this.adapters));
  }

  events() {
    if (isAnyTime(this.request.slot)) {
      // The whole day: events starting from the lookback before 10 am to an hour past the last window's end.
      const { date } = this.request.slot;
      const from = zonedHourToUtc(date, ANY_TIME_DAY.startHour - EVENTS_LOOKBACK_HOURS, this.city.timeZone).toISOString();
      const to = zonedHourToUtc(date, ANY_TIME_DAY.endHour + 1, this.city.timeZone).toISOString();
      return this.track("events", () => getEventsBetween(this.request.city, from, to, this.adapters));
    }
    return this.track("events", () => getEvents(this.request.city, this.fixedSlot(), this.adapters));
  }

  /**
   * Event crowds matched to the performer's taste: each music event's
   * headliners are resolved in Qloo, then scored against the performer's
   * artists (Qloo affinity). Per event, the best-matching headliner.
   */
  eventTaste(): Promise<Map<string, { artist: string; affinity: number }>> {
    return this.once("eventTasteByEvent", async () => {
      const out = new Map<string, { artist: string; affinity: number }>();
      const [events, ids] = await Promise.all([this.events(), this.entityIds()]);
      const names = [...new Map(events.flatMap((e) => e.artists.map((a) => [nameKey(a.name), a.name] as const))).values()].slice(0, EVENT_ARTISTS_MAX);
      if (names.length === 0 || ids.length === 0 || this.qlooFailed()) return out;
      const resolved = await this.track("eventArtists", () => qloo.resolveArtists(names, this.adapters));
      const idOf = new Map(resolved.flatMap((r) => (r.entity ? [[nameKey(r.query), r.entity] as const] : [])));
      const own = new Set(ids);
      const others = [...new Set([...idOf.values()].map((e) => e.id).filter((id) => !own.has(id)))];
      const affinity = others.length > 0 ? await this.track("eventTaste", () => qloo.tasteMatch(others, ids, this.adapters)) : {};
      for (const event of events) {
        for (const artist of event.artists) {
          const entity = idOf.get(nameKey(artist.name));
          if (!entity) continue;
          // A headliner the performer listed as "sounds like" is a perfect match.
          const value = own.has(entity.id) ? 1 : affinity[entity.id];
          if (value === undefined) continue;
          const best = out.get(event.id);
          if (!best || value > best.affinity) out.set(event.id, { artist: entity.name, affinity: Math.round(value * 1000) / 1000 });
        }
      }
      return out;
    });
  }

  weather() {
    // Any time: the day's hours, 10 am to 10 pm.
    const slot = isAnyTime(this.request.slot) ? { date: this.request.slot.date, ...ANY_TIME_DAY } : this.fixedSlot();
    return this.track("weather", () => getWeather(this.request.city, slot, this.adapters, this.today));
  }

  /** Last.fm top tracks for the repertoire's artists and the rising artists. */
  async songs() {
    const repertoireArtists = this.request.performer.songs.map((s) => s.artist);
    const risingNames = (await this.localArtists()).slice(0, 5).map((a) => a.name);
    return this.track("songs", () => getSongs([...repertoireArtists, ...risingNames], this.adapters));
  }

  // ---- Scoring ------------------------------------------------------------

  /** Candidates from the data: top taste cells snapped to public spots and sensors, plus council sites, legality-filtered. */
  candidates() {
    return this.once("candidates", async () => {
      const [pitchData, footfall, cells] = await Promise.all([this.pitchData(), this.footfall(), this.tasteCells()]);
      if (this.statuses.get("pitches")?.mode === "fallback") {
        // Without the council's layers nothing can be checked against the rules: recommend nothing.
        this.notes.push("The council's busking rules are unavailable right now, so Busk Map can't check which spots are allowed. Try again later.");
        return { candidates: [], funnel: null };
      }
      return buildCandidatesWithFunnel({
        sites: pitchData.sites,
        zones: pitchData.zones,
        sensors: footfall.sensors,
        spots: PUBLIC_SPOTS,
        cells,
        hotspots: USUAL_HOTSPOTS,
        permit: this.request.permit,
      });
    });
  }

  /** Genres that characterise the crowd around a point (Qloo urn:tag). */
  async crowdGenres(point: { lat: number; lon: number }) {
    const ids = await this.entityIds();
    if (ids.length === 0) return [];
    return this.track(`genres:${point.lat.toFixed(4)},${point.lon.toFixed(4)}`, () => qloo.crowdTags(ids, point, CROWD_RADIUS_M, 6, this.adapters));
  }

  /**
   * What the crowd at the city's busiest busking hotspot likes, with no
   * performer signal: the "usual crowd" the performer's fans are compared with.
   */
  hotspotCrowd() {
    const [hotspot] = USUAL_HOTSPOTS;
    const d = 0.004;
    const box = { south: hotspot.lat - d, north: hotspot.lat + d, west: hotspot.lon - d, east: hotspot.lon + d };
    return this.track("hotspotCrowd", () => qloo.localArtists([], box, HOTSPOT_CROWD_TAKE, this.adapters)).then(({ artists }) => ({ hotspot: hotspot.name, artists }));
  }

  /** How the performer's fans differ from the usual hotspot crowd, by genre (Qloo compare). */
  contrast() {
    return this.once("contrast", async () => {
      const [ids, crowd] = await Promise.all([this.entityIds(), this.hotspotCrowd()]);
      if (ids.length === 0 || crowd.artists.length === 0) return null;
      const rows = await this.track("compare", () => qloo.compareGenres(ids, crowd.artists.map((a) => a.id), this.adapters));
      if (rows.length === 0) return null;
      const byDelta = [...rows].sort((a, b) => b.a - b.b - (a.a - a.b));
      return {
        hotspot: crowd.hotspot,
        more: byDelta.filter((r) => r.a - r.b >= 0.15).slice(0, 3).map((r) => r.name),
        less: byDelta.reverse().filter((r) => r.b - r.a >= 0.15).slice(0, 3).map((r) => r.name),
      };
    });
  }

  /** The engine's inputs for the fixed slot. */
  async scoreInputs(): Promise<ScoreInputs> {
    const slot = this.fixedSlot();
    const [cells, footfall, places, rawEvents, weather, eventTaste] = await Promise.all([
      this.tasteCells(),
      this.footfall(),
      this.places(),
      this.events(),
      this.weather(),
      this.eventTaste(),
    ]);
    const events = rawEvents.map((e) => ({ ...e, tasteMatch: eventTaste.get(e.id) ?? null }));
    const { start, end } = slotUtcRange(slot, this.city.timeZone);
    return {
      cells,
      sensors: footfall.sensors,
      places,
      events,
      weather: weather?.hours ?? null,
      weekday: this.weekday,
      startHour: slot.startHour,
      endHour: slot.endHour,
      slotStartMs: start.getTime(),
      slotEndMs: end.getTime(),
    };
  }

  /** Any time: the day's data every window is scored from. */
  anyTimeBase(): Promise<AnyTimeBase> {
    return this.once("anyTimeBase", async () => {
      const date = this.request.slot.date;
      const [cells, typical, places, rawEvents, weather, eventTaste] = await Promise.all([
        this.tasteCells(),
        this.typicalFootfall(),
        this.places(),
        this.events(),
        this.weather(),
        this.eventTaste(),
      ]);
      const base: AnyTimeBase = {
        weekday: this.weekday,
        cells,
        sensors: typical.sensors,
        places,
        events: rawEvents.map((e) => ({ ...e, tasteMatch: eventTaste.get(e.id) ?? null })),
        weather: weather?.hours ?? null,
        hourMs: (hour) => zonedHourToUtc(date, hour, this.city.timeZone).getTime(),
      };
      return base;
    });
  }

  /** The foot-traffic scale shared by every window of the day. */
  async footfallReference(): Promise<number> {
    return footfallReferenceOf(await this.anyTimeBase());
  }

  /** One candidate scored as the engine scores its pool: at the fixed slot, or at its best window for any time. */
  async scoreCandidate(candidate: Candidate): Promise<ScoredPitch | null> {
    if (isAnyTime(this.request.slot)) return scorePitchAnyTime(candidate, await this.anyTimeBase(), this.windows(), this.weights);
    return scorePitch(candidate, await this.scoreInputs(), this.weights);
  }

  ranked(): Promise<ScoredPitch[]> {
    return this.once("ranked", async () => {
      if (isAnyTime(this.request.slot)) {
        const [{ candidates }, base] = await Promise.all([this.candidates(), this.anyTimeBase()]);
        const windows = this.windows();
        if (windows.length === 0) this.notes.push("No busking hours are left on that day, so nothing was scored. Plan again for another day.");
        return rankPitchesAnyTime(candidates, base, windows, this.weights);
      }
      const [{ candidates }, inputs] = await Promise.all([this.candidates(), this.scoreInputs()]);
      return rankPitches(candidates, inputs, this.weights);
    });
  }

  async funnel() {
    return (await this.candidates()).funnel;
  }

  async topPitches(): Promise<ScoredPitch[]> {
    return pickTopPitches(await this.ranked(), 3);
  }

  /**
   * The performer's songs with each artist's Qloo entity. Artists the performer
   * also listed under "sounds like" reuse that match; any other song artist is
   * resolved here, for the setlist only (they don't change the taste signals).
   */
  repertoire = (): Promise<RepertoireSong[]> =>
    this.once("repertoire", async () => {
      const artists = await this.artists();
      const byName = new Map<string, string | null>();
      for (const a of artists) {
        byName.set(nameKey(a.query), a.entity?.id ?? null);
        if (a.entity && !byName.get(nameKey(a.entity.name))) byName.set(nameKey(a.entity.name), a.entity.id);
      }
      const songs = this.request.performer.songs;
      const missing = [...new Map(songs.filter((s) => !s.own && !byName.has(nameKey(s.artist))).map((s) => [nameKey(s.artist), s.artist])).values()];
      if (missing.length > 0 && !this.qlooFailed()) {
        const extra = await this.track("songArtists", () => qloo.resolveArtists(missing, this.adapters));
        for (const a of extra) byName.set(nameKey(a.query), a.entity?.id ?? null);
      }
      return songs.map((song, i) => ({
        id: `song-${i}`,
        title: song.title,
        artist: song.artist,
        artistEntityId: byName.get(nameKey(song.artist)) ?? null,
        own: song.own,
        durationMs: song.durationMs ?? null,
      }));
    });

  /** First release year of each song the performer picked (Spotify), for era matching. */
  releaseYears() {
    const songs = this.request.performer.songs.filter((s) => !s.own);
    if (songs.length === 0) return Promise.resolve({} as Record<string, number>);
    return this.track("years", () => findReleaseYears(songs, this.city.countryCode, this.adapters));
  }

  /** Suggested songs asked for (docs/plan-inputs-architecture.md D4); 0 when the act asked for none. */
  get fillCount(): number {
    return this.request.performer.fillSuggested ?? 0;
  }

  /**
   * Artists that could supply suggested songs (§3.1 steps 1–2): the city crowd's own artists (already fetched) plus the
   * artists related to the act's (taste_artists, +1 Qloo call cold), without artists whose songs are already in the set.
   * A failed related-artists call leaves the city crowd alone, with a plan note (OPTIONAL_QLOO).
   */
  fillArtists(): Promise<FillArtist[]> {
    return this.once("fillArtists", async () => {
      const [ids, crowd, resolved] = await Promise.all([this.entityIds(), this.localArtists(), this.artists()]);
      if (ids.length === 0) return [];
      const related = this.qlooFailed() ? [] : (await this.track("relatedArtists", () => qloo.tasteArtists(ids, SUGGEST_RELATED_TAKE, this.adapters))).artists;
      const names = new Map(resolved.flatMap((r) => (r.entity ? [[r.entity.id, r.entity.name] as const] : [])));
      const toFill = (e: qloo.QlooEntity): FillArtist => ({
        id: e.id,
        name: e.name,
        growth: e.audienceGrowth,
        listeners: e.lastfmListeners,
        because: [...e.explanation]
          .sort((a, b) => b.score - a.score)
          .flatMap((x) => {
            const name = x.name ?? names.get(x.entityId);
            return name ? [name] : [];
          }),
      });
      const inSet = new Set(this.request.performer.songs.map((s) => nameKey(s.artist)));
      return mergeFillArtists([crowd.map(toFill), related.map(toFill)], inSet);
    });
  }

  /** An artist's songs, looked up once per busk and within SUGGEST_CATALOGUE_LOOKUPS lookups (Spotify, Last.fm as backup; not Qloo quota). */
  private catalogueLookups = 0;
  private catalogue(artist: string) {
    const key = `catalogue:${nameKey(artist)}`;
    if (!this.memo.has(key)) {
      if (this.catalogueLookups >= SUGGEST_CATALOGUE_LOOKUPS) return Promise.resolve(null);
      this.catalogueLookups++;
    }
    return this.once(key, () => catalogueOf(artist, this.city.countryCode, this.adapters));
  }

  /**
   * Setlist for one pitch: per-pitch crowd affinity, Last.fm popularity and era fit with the crowd's age lean. With
   * `fillSuggested`, the same per-pitch affinity call also scores the fill's candidate artists, and the best of them
   * supply suggested songs (never one the act has or removed for this busk), ordered together with the act's own.
   */
  setlistFor(pitch: { id: string; lat: number; lon: number }) {
    return this.once(`setlist:${pitch.id}`, async () => {
      const fill = this.fillCount;
      const [repertoire, songs, years, profile, candidates] = await Promise.all([
        this.repertoire(),
        this.songs(),
        this.releaseYears(),
        this.crowdProfile(),
        fill ? this.fillArtists() : Promise.resolve([] as FillArtist[]),
      ]);
      const candidateIds = candidates.map((c) => c.id);
      const own = [...new Set(repertoire.flatMap((s) => (s.artistEntityId ? [s.artistEntityId] : [])))];
      const ids = fill ? [...new Set([...own.slice(0, Math.max(0, AFFINITY_IDS_MAX - candidateIds.length)), ...candidateIds])].slice(0, AFFINITY_IDS_MAX) : own;
      const affinity = ids.length
        ? await this.track(`affinity:${pitch.id}`, () => qloo.artistAffinityAt(ids, pitch, PITCH_CROWD_RADIUS_M, this.adapters))
        : {};
      const playcounts: Record<string, number> = {};
      const addPlaycounts = (list: Record<string, { title: string; artist: string; playcount: number }[]>) => {
        for (const tracks of Object.values(list)) for (const t of tracks) playcounts[trackKey(t.artist, t.title)] = t.playcount;
        // Last.fm may autocorrect the artist name; also key by the name we asked for.
        for (const [asked, tracks] of Object.entries(list)) for (const t of tracks) playcounts[trackKey(asked, t.title)] ??= t.playcount;
      };
      addPlaycounts(songs);
      const currentYear = Number(this.today.slice(0, 4));
      if (!fill) return buildSetlist(repertoire, affinity, playcounts, undefined, { years, ageLean: profile?.age ?? null, currentYear, ageLabel });

      const have = new Set(repertoire.map((s) => trackKey(s.artist, s.title)));
      const skip = new Set((this.request.performer.skipSongs ?? []).map((s) => trackKey(s.artist, s.title)));
      const picks = await pickFillSongs(rankFillArtists(candidates, affinity), fill, LEARN_MAX_PER_ARTIST, SUGGEST_ARTISTS_PER_PITCH, have, skip, async (a) => {
        const found = await this.catalogue(a.name);
        return found && found.tracks.length > 0 ? found : null;
      });
      const suggested = fillAsRepertoire(picks, affinity);
      const eraYears = { ...years };
      for (const p of picks) if (p.track.year !== null) eraYears[trackKey(p.track.artist, p.track.title)] = p.track.year;
      const artistNames = [...new Set(picks.map((p) => p.track.artist))].sort();
      if (artistNames.length > 0) addPlaycounts(await this.track(`songsFill:${artistNames.join("|")}`, () => getSongs(artistNames, this.adapters)));
      // Room for all the suggested songs on top of the act's own 12, so a long Repertoire can't push them out.
      const ordered = buildSetlist([...repertoire, ...suggested], affinity, playcounts, MAX_REPERTOIRE_SET + fill, { years: eraYears, ageLean: profile?.age ?? null, currentYear, ageLabel });
      let ownKept = 0;
      return ordered.filter((e) => e.origin === "suggested" || ownKept++ < DEFAULT_MAX_SONGS);
    });
  }

  async learn() {
    const [locals, trends, songs, repertoire] = await Promise.all([this.localArtists(), this.rising(), this.songs(), this.repertoire()]);
    const trendById = new Map(trends.map((t) => [t.entityId, t]));
    return learnThese(
      locals.slice(0, 5).map((a) => ({
        entityId: a.id,
        name: a.name,
        affinity: a.affinity,
        percentDelta: trendById.get(a.id)?.percentDelta ?? null,
        listeners: a.lastfmListeners,
        audienceGrowth: a.audienceGrowth,
      })),
      songs,
      repertoire,
    );
  }
}
