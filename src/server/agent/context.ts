import "server-only";
import { distanceM, inBBox, type BBox, type LatLon } from "@/lib/geo";
import { boxAround, isMetro } from "@/lib/city";
import type { TrendRow } from "@/server/adapters/qloo";
import { ageLabel } from "@/lib/age";
import { ANY_TIME_DAY, anyTimeWindowsLeft, DEFAULT_SLOT_HOURS, isAnyTime, slotUtcRange, weekdayOf, zonedHourToUtc, type Slot, type TimeWindow } from "@/lib/slot";
import { nameKey, trackKey } from "@/lib/text";
import { suburbsOfPlaces } from "@/lib/venue";
import type { PlanRequest } from "@/lib/plan-schema";
import type { AdapterContext, AdapterName, AdapterResult } from "@/server/adapters/core";
import { getEvents, getEventsBetween, EVENTS_LOOKBACK_HOURS } from "@/server/adapters/events";
import { getPitches } from "@/server/adapters/pitches";
import { getOsmSpots, mergeOsmResults, OSM_UNNAMED } from "@/server/adapters/osm";
import { findNamedAreas, type AreasSource } from "@/server/adapters/areas";
import * as qloo from "@/server/adapters/qloo";
import { findReleaseYears } from "@/server/adapters/repertoire";
import { getSongs } from "@/server/adapters/songs";
import { boundSongs, PLAN_SONGS_CONSIDERED } from "@/lib/plan-songs-bound";
import { getWeather } from "@/server/adapters/weather";
import { cityLevels, cityOf, hotspotsFor, isMelbourne, pitchesFor, rulesFor, spotifyMarket, type City } from "@/server/cities";
import {
  activityEstimate,
  buildCandidatesWithFunnel,
  buildSetlist,
  DEFAULT_MAX_SONGS,
  districtOf,
  districtsFromAreas,
  findDistricts,
  rankAreas,
  pickAreas,
  topCells,
  CELL_NAME_RADIUS_M,
  TELL_APART_RADIUS_M,
  type NamedArea,
  type RankedArea,
  MAX_PICKS_PER_DISTRICT,
  nameDistricts,
  type District,
  type DistrictSpread,
  GLOBAL_POP_TAKE,
  learnThese,
  normalizeWeights,
  overIndexGenres,
  preferActGenres,
  pickTopPitches,
  rankPitches,
  rankSceneActs,
  rankPitchesAnyTime,
  sceneAffinityById,
  SCENE_TAKE,
  scorePitch,
  scorePitchAnyTime,
  USUAL_CROWD_TAKE,
  type ActivityHour,
  type AnyTimeBase,
  type Candidate,
  type LocalScene,
  type RepertoireSong,
  type ScoreInputs,
  type ScoredPitch,
  type Weights,
} from "@/server/scoring";
import { serverLocalNow, serverToday } from "@/server/clock";
import type { CandidateInputs } from "@/server/scoring/candidates";

type ScoreLegality = Pick<CandidateInputs, "sites" | "zones" | "hotspots" | "permit" | "generalRules">;
import { LEARN_MAX_PER_ARTIST, SUGGEST_ARTISTS_PER_PITCH, SUGGEST_CATALOGUE_LOOKUPS, SUGGEST_RELATED_TAKE } from "@/server/playlist/config";
import { fillAsRepertoire, mergeFillArtists, pickFillSongs, rankFillArtists, type FillArtist } from "@/server/scoring/fill";
import { catalogueOf, displayKey, spotifyDisplay, type SpotifyDisplay } from "@/server/songs/catalogue";

/** Search radius for busy places, from the city centre. Covers the planning area. */
export const PLACES_RADIUS_M = 2000;
/** Radius of "the crowd at this pitch" for per-pitch artist affinity. */
export const PITCH_CROWD_RADIUS_M = 400;
export const LOCAL_ARTISTS_TAKE = 20;
export const WIDEN_FACTOR = 2;
/** Radius of "the crowd" at a pitch for genre analysis, and around the busiest hotspot for the contrast. */
export const CROWD_RADIUS_M = 400;
/** The usual crowd's artists the contrast with the performer's fans compares (the first of the USUAL_CROWD_TAKE read). */
export const HOTSPOT_CROWD_TAKE = 10;
/** Event headliners matched against the performer's taste per plan (one Qloo search each, cached). */
export const EVENT_ARTISTS_MAX = 6;
/** Most entity ids one per-pitch affinity call may carry (Qloo's `take` cap); the act's own artists come first, then the fill's candidates. */
export const AFFINITY_IDS_MAX = 50;
/** Upper bound for the ordering pass of a set with suggested songs (the act's songs, bounded to PLAN_SONGS_CONSIDERED); trimmed afterwards. */
const MAX_REPERTOIRE_SET = PLAN_SONGS_CONSIDERED;

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
  ["ownFans", "who your fans are"],
  ["genres:", "the genres at the top pitch"],
  ["hotspotCrowd", "the contrast with the usual crowd"],
  ["compare", "the contrast with the usual crowd"],
  ["scene:", "the local scene (acts local to this city)"],
  ["taste:soft", "the taste map with your own artist"],
  ["taste:district:", "the close-up taste map of one district"],
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
/**
 * Adapter loads that depend on the day or the slot (the weekday's open places, the slot's events and their artists, the
 * weather): never shared between the days of a week (PlanContext `shared`). Every other tracked load depends only on the act,
 * the city and today, so a week's seven day contexts make it once.
 */
const DAY_KEYS = ["places", "places:wide", "events", "eventArtists", "eventTaste", "weather", "agent:places:"];
export const sharedAcrossDays = (key: string) => !DAY_KEYS.some((k) => (k.endsWith(":") ? key.startsWith(k) : key === k));

/** Qloo place lookups around unnamed strong taste cells, per plan (or week): each names the spots near it. */
export const NAMING_LOOKUPS = 10;

export class PlanContext {
  readonly request: PlanRequest;
  /** The Repertoire the engine works on: the request's songs, bounded (lib/plan-songs-bound.ts). The request itself keeps every song. */
  readonly songs$: PlanRequest["performer"]["songs"];
  readonly adapters: AdapterContext;
  readonly today: string;
  readonly city: City;
  readonly weights: Weights;
  private readonly memo = new Map<string, Promise<unknown>>();
  private readonly statuses = new Map<string, Status>();
  /** Things the plan should tell the performer, e.g. that a search was widened. */
  readonly notes: string[] = [];

  /** The city's current hour, for dropping any-time windows that have started (only matters on today's date). */
  private readonly nowHour: number;

  /** A week's loads shared by its day contexts (adapter results by key, sharedAcrossDays only); null for a single busk. */
  private readonly shared: Map<string, Promise<unknown>> | null;

  constructor(request: PlanRequest, adapters: AdapterContext, today?: string, nowHour?: number, shared?: Map<string, Promise<unknown>>) {
    this.request = request;
    this.shared = shared ?? null;
    this.songs$ = boundSongs(request.performer.songs, PLAN_SONGS_CONSIDERED);
    this.adapters = adapters;
    this.city = cityOf(request);
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
      const result = await this.sharedLoad(key, load);
      const extra = optionalQlooFeature(key);
      if (result.adapter === "qloo" && result.mode === "fallback" && extra && !this.qlooFailed()) {
        // A Qloo extra that failed (often a slow call timing out) leaves the rest of the plan intact: say so, don't call Qloo down.
        // "In time" only for a timeout; a refused or failed call just says Qloo couldn't answer.
        const note = `Qloo ${result.reason === "timeout" ? "didn't answer in time" : "couldn't answer"} for ${extra}, so this plan goes without it.`;
        if (!this.notes.includes(note)) this.notes.push(note);
        return result.data;
      }
      const previous = this.statuses.get(result.adapter);
      // Keep the worst status per adapter: fallback beats synthetic beats live.
      const rank = { live: 0, synthetic: 1, fallback: 2 } as const;
      if (!previous || rank[result.mode] > rank[previous.mode]) {
        // A reason is why a source fell back; a skipped call with nothing to signal (no_signal) is not a fallback and shows none.
        this.statuses.set(result.adapter, { adapter: result.adapter, source: result.source, mode: result.mode, ...(result.mode === "fallback" ? { reason: result.reason } : {}) });
      }
      return result.data;
    });
  }

  /** A load the week's other days may already have made (same act, city and today): made once, each day records its status. */
  private sharedLoad<T>(key: string, load: () => Promise<AdapterResult<T>>): Promise<AdapterResult<T>> {
    if (!this.shared || !sharedAcrossDays(key)) return load();
    if (!this.shared.has(key)) this.shared.set(key, load());
    return this.shared.get(key) as Promise<AdapterResult<T>>;
  }

  /** An extra Qloo call (the agent's own looks), tracked and memoised like the engine's. Keys start with "agent:". */
  trackQloo<T>(key: `agent:${string}`, load: () => Promise<AdapterResult<T>>): Promise<T> {
    return this.track(key, load);
  }

  /** The activity levels of the engine's scored pool, for the words that read a pitch's level against its peers. */
  async activityLevels(): Promise<number[]> {
    return (await this.ranked()).filter((p) => p.activityBasis !== "none").map((p) => p.evidence.activity.level);
  }

  /**
   * The activity estimate hour by hour across the whole day at a point, for the details sheet's chart (display only: the same
   * Qloo places and heatmap the score used, and it adds no call). Null when Qloo gave nothing to estimate from.
   */
  async activityDay(point: LatLon): Promise<ActivityHour[] | null> {
    const [cells, places] = await Promise.all([this.tasteCells(), this.places()]);
    const day = activityEstimate(point, { cells, places, weekday: this.weekday }, 0, 24);
    return day.basis === "none" ? null : day.curve;
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

  /** The artists you sound like, as Qloo entity ids (the signal before your own artist joins it). */
  private async soundsLikeIds(): Promise<string[]> {
    return (await this.artists()).flatMap((a) => (a.entity ? [a.entity.id] : []));
  }

  /**
   * The act's own Qloo artist, when the request carries one. Mock ids (4D4F434B-) mean nothing to live Qloo, so an example that
   * carries one is ignored there instead of sending an id Qloo can't know.
   */
  ownArtist(): { qlooId: string; name: string } | null {
    const own = this.request.performer.ownArtist;
    if (!own) return null;
    if (qloo.qlooMode(this.adapters) === "live" && /^4D4F434B-/i.test(own.qlooId)) return null;
    return own;
  }

  /**
   * The act's genres as Qloo tag ids (`signal.interests.tags`), only when Qloo doesn't know the act (no own artist): beside the
   * artists you sound like in the taste reads, so a genres-only answer still gives a taste signal. Empty otherwise, and then
   * every call is the one it always was (same params, same cache key).
   */
  signalTags(): string[] {
    if (this.ownArtist()) return [];
    return qloo.sceneTags((this.request.performer.genreTags ?? []).map((g) => g.id));
  }

  /** The signal as Qloo gets it: own artist first (see ownWeight), then the artists you sound like. */
  private withOwn(soft: string[]): string[] {
    const own = this.ownArtist();
    return own ? [own.qlooId, ...soft.filter((id) => id !== own.qlooId)] : soft;
  }

  /**
   * The taste signal for every Qloo read: the act's own artist (when present and not dropped by the taste map) FIRST, then the
   * artists you sound like. Qloo's `signal.interests.entities` takes no weights (the client sends none), so "weight" is position
   * and inclusion: the own entity leads, and Qloo's explainability reports how much it drove each pick ("from your music").
   * If the heatmap found nothing with the own entity but something without it, tasteCells() drops it for the whole plan.
   */
  async entityIds(): Promise<string[]> {
    const soft = await this.soundsLikeIds();
    if (!this.ownArtist()) return soft;
    await this.tasteCells();
    return this.ownDropped ? soft : this.withOwn(soft);
  }

  /** Set when Qloo's heatmap was empty with the own artist in the signal but not without it. */
  private ownDropped = false;

  /** Name of any entity in the signal (the artists you sound like, and the act's own artist). */
  entityName(entityId: string, artists: { entity: { id: string; name: string } | null }[]): string | null {
    const own = this.ownArtist();
    if (own && own.qlooId === entityId) return own.name;
    return artists.find((r) => r.entity?.id === entityId)?.entity?.name ?? null;
  }

  /**
   * Who the act's own fans are (Qloo demographics signalled with the own artist alone). ONE call per busk, shared by every
   * pitch, cached per own artist like the other demographics reads. Null without an own artist or when Qloo has no audience data.
   */
  ownFans() {
    return this.once("ownFans", async () => {
      const own = this.ownArtist();
      if (!own || this.qlooFailed()) return null;
      const profile = await this.track("ownFans", () => qloo.crowdProfile([own.qlooId], this.adapters));
      if (!profile && !this.qlooFailed()) this.notes.push(`Qloo has no audience data for ${own.name}, so "who your fans are" shows the artists you sound like only.`);
      return profile;
    });
  }

  /** Whether this plan covers a metro area in districts (lib/city.ts isMetro, scoring/districts.ts). Never Melbourne. */
  get metro(): boolean {
    return isMetro(this.city);
  }

  /**
   * The taste cells the plan scores with. A CBD-sized city: the heatmap over the planning area (areaCells). A metro: the
   * close-up heatmap of each district (one Qloo call each, cached per district box), each district's cells weighted by its
   * strength in the whole-area read; a district whose close-up read is empty keeps its cells from the whole-area read.
   */
  tasteCells() {
    return this.once("tasteCells", async () => {
      const [area, districts] = await Promise.all([this.areaCells(), this.districts()]);
      if (districts.length === 0) return area;
      const soft = await this.soundsLikeIds();
      const ids = this.ownDropped ? soft : this.withOwn(soft);
      const tags = this.ownDropped ? [] : this.signalTags();
      const zoomed = await Promise.all(districts.map((d) => this.track(`taste:district:${d.id}`, () => qloo.tasteMap(ids, d.bbox, this.adapters, undefined, tags))));
      const top = districts[0].affinity || 1;
      const out = new Map<string, qloo.HeatCell>();
      districts.forEach((d, i) => {
        const weight = Math.min(1, d.affinity / top);
        const cells = zoomed[i].length > 0 ? zoomed[i].map((c) => ({ ...c, affinity: Math.round(c.affinity * weight * 1e6) / 1e6 })) : area.filter((c) => inBBox(c, d.bbox));
        for (const c of cells) {
          const key = c.geohash ?? `${c.lat},${c.lon}`;
          if (!out.has(key)) out.set(key, c);
        }
      });
      return [...out.values()];
    });
  }

  /**
   * A metro's districts, strongest first: its best named areas (scoring/areas.ts), else the whole-area heatmap's peaks
   * (scoring/districts.ts). Empty for a CBD-sized city, and when the whole-area read has no cells inside the area. Peaks are
   * named "Area N" here; namedDistricts() names them.
   */
  districts(): Promise<District[]> {
    return this.once("districts", async () => {
      if (!this.metro) return [];
      const [all, ranked] = await Promise.all([this.areaCells(), this.rankedAreas()]);
      if (this.qlooFailed()) return [];
      // Seeded by the named areas (the strongest, spread apart); at the heatmap's peaks when fewer than two areas have taste.
      const fromAreas = districtsFromAreas(ranked, this.city.bbox);
      if (fromAreas.length >= 2) return fromAreas;
      return findDistricts(
        all.filter((c) => inBBox(c, this.city.bbox)),
        this.city.bbox,
      );
    });
  }

  /**
   * A metro's named areas (adapters/areas): the city itself, then up to 9 suburbs, towns and neighbourhoods inside the planning
   * area, from one Overpass query (else one geocoder search). None for a CBD-sized city.
   */
  namedAreas(): Promise<{ areas: NamedArea[]; source: AreasSource | "qloo" }> {
    return this.once("namedAreas", async () => {
      if (!this.metro) return { areas: [], source: "none" as const };
      const found = await findNamedAreas(this.city, this.adapters);
      if (found.areas.length > 1) return found;
      // Overpass and the geocoder found no suburbs (Overpass is often down; the geocoder only searches the city's name): the
      // suburbs in the addresses of Qloo's places across the area.
      const areas = pickAreas(
        suburbsOfPlaces(await this.namingPlaces()).map((s) => ({ name: s.name, lat: s.lat, lon: s.lon, kind: "suburb" as const, population: null })),
        this.city,
      );
      return areas.length > 1 ? { areas, source: "qloo" as const } : found;
    });
  }

  /**
   * Qloo's places for naming, any day (no opening-hours filter, so a week's days share them): across a metro's whole area, else
   * the centre. Only outside Melbourne, whose spots are named already.
   */
  namingPlaces(): Promise<qloo.QlooPlace[]> {
    return this.once("namingPlaces", async () => {
      if (isMelbourne(this.city)) return [];
      const ids = await this.entityIds();
      const tags = this.signalTags();
      if (ids.length === 0 && tags.length === 0) return [];
      const radiusM = this.metro ? this.city.radiusKm * 1000 : PLACES_RADIUS_M;
      return this.track("naming:places", () => qloo.busyPlaces(ids, this.city.center, radiusM, null, this.adapters, tags));
    });
  }

  /**
   * The named areas ranked by taste (and activity) sampled from the one coarse whole-area heatmap: no Qloo call of their own.
   * Empty for a CBD-sized city, and when no area besides the city itself was found.
   */
  rankedAreas(): Promise<RankedArea[]> {
    return this.once("rankedAreas", async () => {
      if (!this.metro) return [];
      const [{ areas }, cells] = await Promise.all([this.namedAreas(), this.areaCells()]);
      if (areas.length < 2) return [];
      return rankAreas(
        areas,
        cells.filter((c) => inBBox(c, this.city.bbox)),
      );
    });
  }

  /**
   * The cells the plan's map draws: the scored cells and, for a metro, the coarse whole-area read outside the zoomed districts
   * too, so the taste across the whole area shows (close-up cells only where the plan zoomed in).
   */
  mapCells(): Promise<qloo.HeatCell[]> {
    return this.once("mapCells", async () => {
      const [cells, districts] = await Promise.all([this.tasteCells(), this.districts()]);
      if (districts.length === 0) return cells;
      // Each coarse cell once, and none over a close-up cell (a coarse geohash holding a close-up one's).
      const under = new Set(cells.flatMap((c) => (c.geohash ? Array.from({ length: c.geohash.length - 1 }, (_, i) => c.geohash!.slice(0, i + 1)) : [])));
      const seen = new Set(cells.map((c) => c.geohash ?? `${c.lat},${c.lon}`));
      const coarse = (await this.areaCells()).filter((c) => {
        const key = c.geohash ?? `${c.lat},${c.lon}`;
        if (seen.has(key) || (c.geohash && under.has(c.geohash)) || !inBBox(c, this.city.bbox) || districts.some((d) => inBBox(c, d.bbox))) return false;
        seen.add(key);
        return true;
      });
      return [...cells, ...coarse];
    });
  }

  /** The districts named after their named area, else the nearest OpenStreetMap spot or Qloo place (for the plan's copy and the agent's tools). */
  namedDistricts(): Promise<District[]> {
    return this.once("namedDistricts", async () => {
      const districts = await this.districts();
      if (districts.length === 0) return [];
      if (districts.every((d) => d.area)) return districts;
      const [spots, places] = await Promise.all([this.spots(), this.places()]);
      return nameDistricts(districts, spots, places);
    });
  }

  /** The 2-per-district rule for the top pitches of a metro; undefined for a CBD-sized city (no rule, as before). */
  async spread(): Promise<DistrictSpread | undefined> {
    const districts = await this.districts();
    if (districts.length < 2) return undefined;
    return { districtOf: (point) => districtOf(point, districts), maxPerDistrict: MAX_PICKS_PER_DISTRICT };
  }

  /**
   * Taste heatmap over the planning area. If Qloo returns nothing, retry once
   * over a wider area and say so in the plan.
   */
  private areaCells() {
    return this.once("areaCells", async () => {
      const soft = await this.soundsLikeIds();
      const ids = this.withOwn(soft);
      const tags = this.signalTags();
      if (ids.length === 0 && tags.length === 0) return [];
      let cells = await this.track("taste", () => qloo.tasteMap(ids, this.city.bbox, this.adapters, undefined, tags));
      if (cells.length === 0 && !this.qlooFailed() && ids.length > soft.length && soft.length > 0) {
        // Qloo found nothing usable with the own artist: fall back to the artists you sound like only (the extra read costs one call).
        const fallback = await this.track("taste:soft", () => qloo.tasteMap(soft, this.city.bbox, this.adapters));
        if (fallback.length > 0) {
          this.ownDropped = true;
          this.notes.push(`Qloo had no taste data for ${this.ownArtist()!.name}, so the taste map uses the artists you sound like only.`);
          cells = fallback;
        }
      }
      if (cells.length > 0 || this.qlooFailed()) return cells;
      const useIds = this.ownDropped ? soft : ids;
      const wider = await this.track("taste:wide", () => qloo.tasteMap(useIds, widen(this.city.bbox, WIDEN_FACTOR), this.adapters, undefined, tags));
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
      const tags = this.signalTags();
      if (ids.length === 0 && tags.length === 0) return [];
      // A metro: one search over the whole area (per district would cost a Qloo call each).
      const radiusM = this.metro ? this.city.radiusKm * 1000 : PLACES_RADIUS_M;
      const found = await this.track("places", () => qloo.busyPlaces(ids, this.city.center, radiusM, this.weekday, this.adapters, tags));
      if (found.length > 0 || this.qlooFailed()) return found;
      const wider = await this.track("places:wide", () => qloo.busyPlaces(ids, this.city.center, radiusM * WIDEN_FACTOR, this.weekday, this.adapters, tags));
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
    const tags = this.signalTags();
    if (ids.length === 0 && tags.length === 0) return { artists: [], impact: [] };
    return this.track("localArtists", () => qloo.localArtists(ids, this.city.bbox, LOCAL_ARTISTS_TAKE, this.adapters, tags));
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
      // "Songs to learn" ranks by Qloo's audience growth first; trends only matter without it.
      const window = await this.track("trendWindow", () => qloo.trendingWindow(locals[0].id, this.today, this.adapters));
      if (!window) return [];
      const rows = await this.track("rising", () => qloo.rising(locals.map((a) => a.id), window.start, window.end, this.adapters));
      const moving = rows.some((r) => (r.percentDelta ?? 0) !== 0 || (r.windowChange ?? 0) !== 0);
      return moving ? rows : [];
    });
  }

  async crowdProfile() {
    const ids = await this.entityIds();
    const tags = this.signalTags();
    if (ids.length === 0 && tags.length === 0) return null;
    return this.track("crowd", () => qloo.crowdProfile(ids, this.adapters, tags));
  }

  /** The council's busking layers. A city with no council data gets none, and no "pitches" source at all (cityLevels().rules). */
  pitchData() {
    if (rulesFor(this.city).level !== "local") return this.once("pitches:none", async () => ({ sites: [], zones: [] }) as Awaited<ReturnType<typeof getPitches>>["data"]);
    return this.track("pitches", () => getPitches(this.city, this.adapters));
  }

  /** What decides whether a point can be a pitch here: the council's layers (Melbourne), the hotspots, the permit, the rules line. */
  legality(pitchData: { sites: ScoreLegality["sites"]; zones: ScoreLegality["zones"] }): ScoreLegality {
    return { sites: pitchData.sites, zones: pitchData.zones, hotspots: hotspotsFor(this.city), permit: this.request.permit, generalRules: rulesFor(this.city).general };
  }

  /** How much each signal knows about this city (lib/city.ts). Pitches from OpenStreetMap read as worldwide data. */
  get levels() {
    const levels = cityLevels(this.city);
    return this.osmPitches && levels.pitches === "none" ? { ...levels, pitches: "global" as const } : levels;
  }

  /** Whether this plan's pitches stand at OpenStreetMap spots (set once candidates() has run). */
  private osmPitches = false;

  /**
   * Walkable public spots pitches snap to: Melbourne's curated list, else OpenStreetMap's public spaces in the planning area
   * (V2 2.3). None when Overpass fails or finds nothing: the taste cells stand as pitches then.
   */
  spots() {
    if (isMelbourne(this.city)) return Promise.resolve(pitchesFor(this.city));
    if (!this.metro) return this.track("osm", () => getOsmSpots(this.city, this.adapters));
    // A metro: one Overpass query per district's small box, side by side (each within the 15 s deadline, cached per box),
    // never one metro-wide query. No districts (no taste data to find them): the CBD-sized box at the centre.
    return this.track("osm", async () => {
      const districts = await this.districts();
      const boxes = districts.length > 0 ? districts : [{ bbox: boxAround(this.city.center), center: this.city.center }];
      return mergeOsmResults(await Promise.all(boxes.map((b) => getOsmSpots(b, this.adapters, { rotate: boxes.length > 1 }))));
    });
  }

  events() {
    if (isAnyTime(this.request.slot)) {
      // The whole day: events starting from the lookback before 10 am to an hour past the last window's end.
      const { date } = this.request.slot;
      const from = zonedHourToUtc(date, ANY_TIME_DAY.startHour - EVENTS_LOOKBACK_HOURS, this.city.timeZone).toISOString();
      const to = zonedHourToUtc(date, ANY_TIME_DAY.endHour + 1, this.city.timeZone).toISOString();
      return this.track("events", () => getEventsBetween(this.city, from, to, this.adapters));
    }
    return this.track("events", () => getEvents(this.city, this.fixedSlot(), this.adapters));
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
    return this.track("weather", () => getWeather(this.city, slot, this.adapters, this.today));
  }

  /** Last.fm top tracks for the repertoire's artists and the rising artists. */
  async songs() {
    const repertoireArtists = this.songs$.map((s) => s.artist);
    const risingNames = (await this.localArtists()).slice(0, 5).map((a) => a.name);
    return this.track("songs", () => getSongs([...repertoireArtists, ...risingNames], this.adapters));
  }

  // ---- Scoring ------------------------------------------------------------

  /** Candidates from the data: top taste cells snapped to public spots, plus council sites, legality-filtered. */
  candidates() {
    return this.once("candidates", async () => {
      const [pitchData, cells, spots] = await Promise.all([this.pitchData(), this.tasteCells(), this.spots()]);
      if (this.statuses.get("pitches")?.mode === "fallback") {
        // Without the council's layers nothing can be checked against the rules: recommend nothing.
        this.notes.push("The council's busking rules are unavailable right now, so Busk Map can't check which spots are allowed. Try again later.");
        return { candidates: [], funnel: null };
      }
      const build = async (pool: typeof spots) => {
        // No walkable spots for this city (OpenStreetMap failed or found none): the strongest taste cells stand as pitches, named
        // by their area and the nearest Qloo place (tasteSpotName).
        const naming = pool.length === 0 && cells.length > 0 ? await this.tasteNaming() : { venues: [], areas: [], streets: [], city: this.city.name, cityCenter: this.city.center };
        return buildCandidatesWithFunnel({
          sites: pitchData.sites,
          zones: pitchData.zones,
          spots: pool,
          cells,
          hotspots: hotspotsFor(this.city),
          permit: this.request.permit,
          generalRules: rulesFor(this.city).general,
          cellNames: naming.venues,
          areas: naming.areas,
          city: naming.city,
          cityCenter: naming.cityCenter,
          streets: naming.streets,
        });
      };
      if (isMelbourne(this.city)) return build(spots);
      const fromOsm = spots.length > 0 ? await build(spots) : null;
      // OpenStreetMap spots none of the top taste cells reach: the taste cells themselves, as with no spots at all.
      if (fromOsm && fromOsm.candidates.length > 0) {
        this.osmPitches = true;
        return fromOsm;
      }
      return build([]);
    });
  }

  /**
   * What names a taste spot (scoring/candidates.ts tasteSpotName): a metro's named areas, Qloo's busy places and the city. The
   * same for the pitches and the agent's tools, so the cards, the map and the steps agree. No call of its own: the places are
   * the scoring's, the areas a metro's (none for a CBD-sized city).
   */
  tasteNaming() {
    return this.once("tasteNaming", async () => {
      const [dayVenues, areas, spots, named] = await Promise.all([this.places(), this.rankedAreas(), this.spots(), this.namingPlaces()]);
      const venues = [...dayVenues, ...named, ...(await this.venuesNearTopCells([...dayVenues, ...named]))];
      // OpenStreetMap's named streets and spaces (an unnamed one shows its kind, "Pedestrian street"), to tell spots apart.
      const streets = isMelbourne(this.city) ? [] : spots.filter((s) => !OSM_UNNAMED.has(s.name)).map((s) => ({ name: s.name, lat: s.lat, lon: s.lon }));
      return { venues, areas: areas.map((a) => ({ name: a.name, lat: a.lat, lon: a.lon })), streets, city: this.city.name, cityCenter: this.city.center };
    });
  }

  /**
   * Outside Melbourne: Qloo's places around the strongest taste cells that no known place names (NAMING_LOOKUPS at most, one
   * Qloo call each, shared by a week's days), so a taste spot is "Near <venue>", never just "<City> taste spot".
   */
  private async venuesNearTopCells(known: readonly LatLon[]): Promise<qloo.QlooPlace[]> {
    if (isMelbourne(this.city)) return [];
    const ids = await this.entityIds();
    const tags = this.signalTags();
    if (ids.length === 0 && tags.length === 0) return [];
    // The cells that stand as pitches (scoring/candidates.ts topCells), strongest first.
    const cells = topCells(await this.tasteCells());
    const lonely: LatLon[] = [];
    for (const c of cells) {
      if (lonely.length >= NAMING_LOOKUPS) break;
      if (known.some((v) => distanceM(v, c) <= CELL_NAME_RADIUS_M) || lonely.some((l) => distanceM(l, c) <= TELL_APART_RADIUS_M)) continue;
      lonely.push(c);
    }
    const found = await Promise.all(
      lonely.map((c) => this.track(`naming:near:${c.lat.toFixed(3)},${c.lon.toFixed(3)}`, () => qloo.busyPlaces(ids, { lat: c.lat, lon: c.lon }, TELL_APART_RADIUS_M, null, this.adapters, tags))),
    );
    return found.flat();
  }

  /** Genres that characterise the crowd around a point (Qloo urn:tag). */
  async crowdGenres(point: { lat: number; lon: number }) {
    const ids = await this.entityIds();
    if (ids.length === 0) return [];
    return this.track(`genres:${point.lat.toFixed(4)},${point.lon.toFixed(4)}`, () => qloo.crowdTags(ids, point, CROWD_RADIUS_M, 6, this.adapters));
  }

  /**
   * What the crowd at the city's busiest busking hotspot likes, with no
   * performer signal: the "usual crowd" the performer's fans are compared with. It reads USUAL_CROWD_TAKE artists in one
   * call: the first HOTSPOT_CROWD_TAKE are the contrast's group, all of them are the local scene's step 1 (genre over-index).
   */
  hotspotCrowd() {
    // A city with no known hotspots reads the crowd at its centre.
    const hotspot = hotspotsFor(this.city)[0] ?? { name: `central ${this.city.name}`, ...this.city.center };
    const d = 0.004;
    const box = { south: hotspot.lat - d, north: hotspot.lat + d, west: hotspot.lon - d, east: hotspot.lon + d };
    return this.track("hotspotCrowd", () => qloo.localArtists([], box, USUAL_CROWD_TAKE, this.adapters)).then(({ artists }) => ({ hotspot: hotspot.name, artists }));
  }

  /** How the performer's fans differ from the usual hotspot crowd, by genre (Qloo compare). */
  contrast() {
    return this.once("contrast", async () => {
      const [ids, crowd] = await Promise.all([this.entityIds(), this.hotspotCrowd()]);
      if (ids.length === 0 || crowd.artists.length === 0) return null;
      const rows = await this.track("compare", () => qloo.compareGenres(ids, crowd.artists.slice(0, HOTSPOT_CROWD_TAKE).map((a) => a.id), this.adapters));
      if (rows.length === 0) return null;
      const byDelta = [...rows].sort((a, b) => b.a - b.b - (a.a - a.b));
      return {
        hotspot: crowd.hotspot,
        more: byDelta.filter((r) => r.a - r.b >= 0.15).slice(0, 3).map((r) => r.name),
        less: byDelta.reverse().filter((r) => r.b - r.a >= 0.15).slice(0, 3).map((r) => r.name),
      };
    });
  }

  /**
   * The local scene (+3 cacheable Qloo calls on a cold city, plus the global-pop reference shared by all cities):
   *  1. city over-index: /v2/analysis/compare of the usual crowd's top 20 (the existing hotspotCrowd read) against Qloo's
   *     global-pop artists gives the genres this city over-indexes on (1–7);
   *  2. local scene: location plus those genre tags (signal.interests.tags) gives the local artists, which are then
   *     re-scored for the act's fans (the same affinity read as the event headliners, #7).
   * Any step that fails or finds nothing leaves null (today's behaviour) and the plan says why (OPTIONAL_QLOO).
   */
  localScene(): Promise<LocalScene | null> {
    return this.once("localScene", async () => {
      const [ids, usual] = await Promise.all([this.entityIds(), this.hotspotCrowd()]);
      if (ids.length === 0 || usual.artists.length === 0 || this.qlooFailed()) return null;
      const none = (what: string) => {
        // A failed call already left its own note (track); an answer with no data says so here.
        const note = `Qloo had no ${what}, so the plan goes without a local scene.`;
        if (!this.qlooFailed() && !this.notes.some((n) => /^Qloo (didn't answer in time|couldn't answer) for the local scene/.test(n)) && !this.notes.includes(note)) this.notes.push(note);
        return null;
      };
      const global = await this.track("scene:global", () => qloo.globalArtists(GLOBAL_POP_TAKE, this.adapters));
      if (global.length === 0) return none("global reference artists");
      const rows = await this.track("scene:compare", () => qloo.compareGenres(usual.artists.map((a) => a.id), global.map((a) => a.id), this.adapters));
      const preferred = preferActGenres(overIndexGenres(rows), this.request.performer.genreTags);
      const handles = preferred.handles;
      if (handles.length === 0) return none("genres this city leans to");
      // Qloo refuses a tag signal with nothing valid in it, so a city whose handles are not usable tag ids skips the call.
      if (qloo.sceneTags(handles.map((h) => h.id)).length === 0) return none("usable genre tags for this city");
      const own = new Set(ids);
      const scene = (await this.track("scene:artists", () => qloo.sceneArtists(handles.map((h) => h.id), this.city.bbox, SCENE_TAKE, this.adapters))).filter((a) => !own.has(a.id));
      if (scene.length === 0) return none("local artists for those genres");
      const affinity = await this.track("scene:taste", () => qloo.tasteMatch(scene.map((a) => a.id), ids, this.adapters));
      if (Object.keys(affinity).length === 0) return none("score of local artists for your fans");
      return { genres: handles, acts: rankSceneActs(scene, affinity, own), ...(preferred.yours.length ? { yours: preferred.yours } : {}) };
    });
  }

  /** The engine's inputs for the fixed slot. */
  async scoreInputs(): Promise<ScoreInputs> {
    const slot = this.fixedSlot();
    const [cells, places, rawEvents, weather, eventTaste] = await Promise.all([
      this.tasteCells(),
      this.places(),
      this.events(),
      this.weather(),
      this.eventTaste(),
    ]);
    const events = rawEvents.map((e) => ({ ...e, tasteMatch: eventTaste.get(e.id) ?? null }));
    const { start, end } = slotUtcRange(slot, this.city.timeZone);
    return {
      cells,
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
      const [cells, places, rawEvents, weather, eventTaste] = await Promise.all([
        this.tasteCells(),
        this.places(),
        this.events(),
        this.weather(),
        this.eventTaste(),
      ]);
      const base: AnyTimeBase = {
        weekday: this.weekday,
        cells,
        places,
        events: rawEvents.map((e) => ({ ...e, tasteMatch: eventTaste.get(e.id) ?? null })),
        weather: weather?.hours ?? null,
        hourMs: (hour) => zonedHourToUtc(date, hour, this.city.timeZone).getTime(),
      };
      return base;
    });
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

  /** The engine's top 3: spaced apart and, for a metro, at most MAX_PICKS_PER_DISTRICT from one district. */
  async topPitches(): Promise<ScoredPitch[]> {
    const [ranked, spread] = await Promise.all([this.ranked(), this.spread()]);
    return pickTopPitches(ranked, 3, undefined, spread);
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
      const songs = this.songs$;
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
    const songs = this.songs$.filter((s) => !s.own);
    if (songs.length === 0) return Promise.resolve({} as Record<string, number>);
    return this.track("years", () => findReleaseYears(songs, spotifyMarket(this.city), this.adapters));
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
      const [ids, crowd, resolved, scene] = await Promise.all([this.entityIds(), this.localArtists(), this.artists(), this.localScene()]);
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
      const inSet = new Set(this.songs$.map((s) => nameKey(s.artist)));
      // Local acts your fans would like (the local scene) are fill candidates too: the plan's songs are then local, not only global pop.
      const local = (scene?.acts ?? []).filter((a) => a.affinity !== null).map((a): FillArtist => ({ id: a.id, name: a.name, growth: null, listeners: null, because: [], local: { fit: a.affinity } }));
      return mergeFillArtists([crowd.map(toFill), related.map(toFill), local], inSet);
    });
  }

  /** An artist's songs, looked up once per busk and within SUGGEST_CATALOGUE_LOOKUPS lookups (Last.fm only: build_setlist shows them to the model; not Qloo quota). */
  private catalogueLookups = 0;
  private catalogue(artist: string) {
    const key = `catalogue:${nameKey(artist)}`;
    if (!this.memo.has(key)) {
      if (this.catalogueLookups >= SUGGEST_CATALOGUE_LOOKUPS) return Promise.resolve(null);
      this.catalogueLookups++;
    }
    return this.once(key, () => catalogueOf(artist, spotifyMarket(this.city), this.adapters));
  }

  /**
   * Setlist for one pitch: per-pitch crowd affinity, Last.fm popularity and era fit with the crowd's age lean. With
   * `fillSuggested`, the same per-pitch affinity call also scores the fill's candidate artists, and the best of them
   * supply suggested songs (never one the act has or removed for this busk), ordered together with the act's own.
   */
  setlistFor(pitch: { id: string; lat: number; lon: number }) {
    return this.once(`setlist:${pitch.id}`, async () => {
      const fill = this.fillCount;
      const [repertoire, songs, years, profile, candidates, localScene] = await Promise.all([
        this.repertoire(),
        this.songs(),
        this.releaseYears(),
        this.crowdProfile(),
        fill ? this.fillArtists() : Promise.resolve([] as FillArtist[]),
        this.localScene(),
      ]);
      const scene = localScene ? sceneAffinityById(localScene) : null;
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
      const photos = new Map<string, string>();
      for (const e of [...(await this.artists()).flatMap((r) => (r.entity ? [r.entity] : [])), ...(await this.localArtists())]) if (e.image && /^https:\/\//.test(e.image) && !photos.has(nameKey(e.name))) photos.set(nameKey(e.name), e.image);
      // The artists' photos from entities already fetched (the act's, the crowd's): a song with no cover shows its artist.
      const withArtistPhotos = (entries: ReturnType<typeof buildSetlist>) => entries.map((e) => (photos.has(nameKey(e.artist)) ? { ...e, artistImage: photos.get(nameKey(e.artist))! } : e));
      if (!fill) return withArtistPhotos(buildSetlist(repertoire, affinity, playcounts, undefined, { years, ageLean: profile?.age ?? null, currentYear, ageLabel }, scene));

      const have = new Set(repertoire.map((s) => trackKey(s.artist, s.title)));
      const skip = new Set((this.request.performer.skipSongs ?? []).map((s) => trackKey(s.artist, s.title)));
      const picks = await pickFillSongs(rankFillArtists(candidates, affinity), fill, LEARN_MAX_PER_ARTIST, SUGGEST_ARTISTS_PER_PITCH, have, skip, async (a) => {
        const found = await this.catalogue(a.name);
        return found && found.tracks.length > 0 ? found : null;
      });
      // Spotify's id, link, cover, length and year join the picked songs here, for display and era fit only: build_setlist
      // shows the model the title, artist and Last.fm-based words, never these fields (tools.ts:setlistForModel).
      const display = picks.length ? await this.once(`display:${picks.map((p) => displayKey(p.track.artist, p.track.title)).join("~")}`, () => spotifyDisplay(picks.map((p) => p.track), spotifyMarket(this.city), this.adapters).catch(() => new Map<string, SpotifyDisplay>())) : new Map<string, SpotifyDisplay>();
      for (const p of picks) {
        const d = display.get(displayKey(p.track.artist, p.track.title));
        if (d) Object.assign(p, { source: "spotify" as const, track: { ...p.track, spotifyTrackId: d.spotifyTrackId, url: d.url, image: d.image, year: d.year, durationMs: d.durationMs } });
      }
      const suggested = fillAsRepertoire(picks, affinity);
      const eraYears = { ...years };
      for (const p of picks) if (p.track.year !== null) eraYears[trackKey(p.track.artist, p.track.title)] = p.track.year;
      const artistNames = [...new Set(picks.map((p) => p.track.artist))].sort();
      if (artistNames.length > 0) addPlaycounts(await this.track(`songsFill:${artistNames.join("|")}`, () => getSongs(artistNames, this.adapters)));
      // Room for all the suggested songs on top of the act's own 12, so a long Repertoire can't push them out.
      const ordered = buildSetlist([...repertoire, ...suggested], affinity, playcounts, MAX_REPERTOIRE_SET + fill, { years: eraYears, ageLean: profile?.age ?? null, currentYear, ageLabel }, scene);
      let ownKept = 0;
      // The artists' photos from entities already fetched (the act's, the crowd's), so a song can show its artist when it has no cover.
      return withArtistPhotos(ordered.filter((e) => e.origin === "suggested" || ownKept++ < DEFAULT_MAX_SONGS));
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
