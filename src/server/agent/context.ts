import "server-only";
import type { BBox } from "@/lib/geo";
import { addDays, localToday, slotUtcRange, weekdayOf } from "@/lib/slot";
import { trackKey } from "@/lib/text";
import type { PlanRequest } from "@/lib/plan-schema";
import type { AdapterContext, AdapterName, AdapterResult } from "@/server/adapters/core";
import { getEvents } from "@/server/adapters/events";
import { getFootfall } from "@/server/adapters/footfall";
import { getPitches } from "@/server/adapters/pitches";
import * as qloo from "@/server/adapters/qloo";
import { getSongs } from "@/server/adapters/songs";
import { getWeather } from "@/server/adapters/weather";
import { CITIES } from "@/server/cities";
import { PUBLIC_SPOTS, USUAL_HOTSPOTS } from "@/server/data/spots";
import {
  buildCandidatesWithFunnel,
  buildSetlist,
  learnThese,
  normalizeWeights,
  pickTopPitches,
  rankPitches,
  type RepertoireSong,
  type ScoreInputs,
  type ScoredPitch,
  type Weights,
} from "@/server/scoring";

/** Search radius for busy places, from the city centre. Covers the planning area. */
export const PLACES_RADIUS_M = 2000;
/** Radius of "the crowd at this pitch" for per-pitch artist affinity. */
export const PITCH_CROWD_RADIUS_M = 400;
export const LOCAL_ARTISTS_TAKE = 20;
export const TRENDING_WEEKS = 6;
export const WIDEN_FACTOR = 2;
/** Radius of "the crowd" at a pitch for genre analysis, and around the busiest hotspot for the contrast. */
export const CROWD_RADIUS_M = 400;
export const HOTSPOT_CROWD_TAKE = 10;

function widen(box: BBox, factor: number): BBox {
  const dLat = ((box.north - box.south) * (factor - 1)) / 2;
  const dLon = ((box.east - box.west) * (factor - 1)) / 2;
  return { south: box.south - dLat, north: box.north + dLat, west: box.west - dLon, east: box.east + dLon };
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

  constructor(request: PlanRequest, adapters: AdapterContext, today?: string) {
    this.request = request;
    this.adapters = adapters;
    this.city = CITIES[request.city];
    this.today = today ?? localToday(this.city.timeZone);
    this.weights = normalizeWeights(request.weights);
  }

  private once<T>(key: string, load: () => Promise<T>): Promise<T> {
    if (!this.memo.has(key)) this.memo.set(key, load());
    return this.memo.get(key) as Promise<T>;
  }

  /** Run an adapter call once and record how its data was produced. */
  private track<T>(key: string, load: () => Promise<AdapterResult<T>>): Promise<T> {
    return this.once(key, async () => {
      const result = await load();
      const previous = this.statuses.get(result.adapter);
      // Keep the worst status per adapter: fallback beats synthetic beats live.
      const rank = { live: 0, synthetic: 1, fallback: 2 } as const;
      if (!previous || rank[result.mode] > rank[previous.mode]) {
        this.statuses.set(result.adapter, { adapter: result.adapter, source: result.source, mode: result.mode, reason: result.reason });
      }
      return result.data;
    });
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
    return this.track("artists", () => qloo.resolveArtists(this.request.performer.artists, this.adapters));
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

  async localArtists() {
    const ids = await this.entityIds();
    if (ids.length === 0) return [];
    return this.track("localArtists", () => qloo.localArtists(ids, this.city.bbox, LOCAL_ARTISTS_TAKE, this.adapters));
  }

  async rising() {
    const locals = (await this.localArtists()).slice(0, 5);
    if (locals.length === 0) return [];
    return this.track("rising", () =>
      qloo.rising(locals.map((a) => a.id), addDays(this.today, -7 * TRENDING_WEEKS), addDays(this.today, -1), this.adapters),
    );
  }

  async crowdProfile() {
    const ids = await this.entityIds();
    if (ids.length === 0) return null;
    return this.track("crowd", () => qloo.crowdProfile(ids, this.adapters));
  }

  footfall() {
    return this.track("footfall", () => getFootfall(this.request.city, this.request.slot, this.adapters, this.today));
  }

  pitchData() {
    return this.track("pitches", () => getPitches(this.request.city, this.adapters));
  }

  events() {
    return this.track("events", () => getEvents(this.request.city, this.request.slot, this.adapters));
  }

  weather() {
    return this.track("weather", () => getWeather(this.request.city, this.request.slot, this.adapters, this.today));
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
    return this.track("hotspotCrowd", () => qloo.localArtists([], box, HOTSPOT_CROWD_TAKE, this.adapters)).then((artists) => ({ hotspot: hotspot.name, artists }));
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

  async scoreInputs(): Promise<ScoreInputs> {
    const [cells, footfall, places, events, weather] = await Promise.all([
      this.tasteCells(),
      this.footfall(),
      this.places(),
      this.events(),
      this.weather(),
    ]);
    const { start, end } = slotUtcRange(this.request.slot, this.city.timeZone);
    return {
      cells,
      sensors: footfall.sensors,
      places,
      events,
      weather: weather?.hours ?? null,
      weekday: this.weekday,
      startHour: this.request.slot.startHour,
      endHour: this.request.slot.endHour,
      slotStartMs: start.getTime(),
      slotEndMs: end.getTime(),
    };
  }

  ranked(): Promise<ScoredPitch[]> {
    return this.once("ranked", async () => {
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

  repertoire = async (): Promise<RepertoireSong[]> => {
    const artists = await this.artists();
    const byName = new Map(artists.map((a) => [a.query.toLowerCase(), a.entity?.id ?? null]));
    return this.request.performer.songs.map((song, i) => ({
      id: `song-${i}`,
      title: song.title,
      artist: song.artist,
      artistEntityId: byName.get(song.artist.toLowerCase()) ?? null,
      own: song.own,
    }));
  };

  /** Setlist for one pitch: per-pitch crowd affinity plus Last.fm popularity. */
  setlistFor(pitch: { id: string; lat: number; lon: number }) {
    return this.once(`setlist:${pitch.id}`, async () => {
      const [repertoire, songs] = await Promise.all([this.repertoire(), this.songs()]);
      const ids = [...new Set(repertoire.flatMap((s) => (s.artistEntityId ? [s.artistEntityId] : [])))];
      const affinity = ids.length
        ? await this.track(`affinity:${pitch.id}`, () => qloo.artistAffinityAt(ids, pitch, PITCH_CROWD_RADIUS_M, this.adapters))
        : {};
      const playcounts: Record<string, number> = {};
      for (const tracks of Object.values(songs)) for (const t of tracks) playcounts[trackKey(t.artist, t.title)] = t.playcount;
      // Last.fm may autocorrect the artist name; also key by the name we asked for.
      for (const [asked, tracks] of Object.entries(songs)) for (const t of tracks) playcounts[trackKey(asked, t.title)] ??= t.playcount;
      return buildSetlist(repertoire, affinity, playcounts);
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
      })),
      songs,
      repertoire,
    );
  }
}
