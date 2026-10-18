// SYNTHETIC FIXTURE (Qloo mock server, not Qloo data).
/**
 * A local mock of the Qloo hackathon API's HTTP contract, for development and
 * tests while the key is pending. It implements the endpoints and parameters
 * Busk Map uses, as documented at docs.qloo.com (checked 2026-10-15):
 *
 *   GET /search                 query, types, take, page
 *   GET /entities               entity_ids, external.spotify.ids
 *   GET /v2/insights            filter.type = urn:entity:artist | urn:entity:place |
 *                               urn:heatmap | urn:demographics | urn:tag
 *   GET /v2/trending            signal.interests.entities, filter.type, filter.start_date, filter.end_date
 *   GET /v2/analysis/compare    a.signal.interests.entities, b.signal.interests.entities
 *   GET /v2/tags                filter.query (music genres only)
 *
 * Behaviour copied from the docs: the X-Api-Key header is required (401
 * otherwise), only GET exists (404 for other methods), parameters that are not
 * valid for a filter.type are silently ignored (per the Entity Type Parameter
 * Guide), and "no data" is a 200 with an empty list. Response shapes match
 * live hackathon API responses checked on 2026-10-15 (explainability
 * aggregate, lowercase place hours past midnight, geohash-7 heatmap cells,
 * string trending ranks, compare's per-group tag counts, `tag_id` on
 * /search and /entities tags): see docs/qloo-mock.md.
 *
 * All data is deterministic: the same request always gets the same answer.
 */
import {
  distanceM,
  geohashCenter,
  geohashEncode,
  geohashesInBBox,
  inBBox,
  parseWkt,
  pointInRing,
  ringBBox,
  round,
  type BBox,
  type LatLon,
} from "@/lib/geo";
import {
  CATALOG,
  GENRES,
  artistById,
  fnv1a,
  genreTagId,
  isMockId,
  mockId,
  normalizeName,
  unit,
  type CatalogArtist,
  type Genre,
} from "./catalog";
import { DAYS, MOCK_PLACES, PLACE_BY_ID, categoryTag, placeFit, type MockPlace } from "./places";
import { WORLD_PLACES } from "@/lib/world-places";
import { GENRE_DEMOGRAPHICS, MOCK_COVERAGE, cosine, density, liftAt, mixGenres, tasteAt, type GenreVector } from "./taste-field";

const r3 = (n: number) => Math.round(n * 1000) / 1000;
const r2 = (n: number) => Math.round(n * 100) / 100;

// ---- HTTP plumbing ----------------------------------------------------------

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const REASONS: Record<number, string> = { 400: "Bad Request", 403: "Forbidden", 404: "Not Found" };

function error(status: number, message: string): Response {
  return json({ code: status, reason: REASONS[status] ?? "Error", message }, status);
}

/** Deterministic, plausible processing time for the `duration` field. */
const duration = (key: string) => 30 + (fnv1a(key) % 90);

function ok(results: unknown, key: string, extra: Record<string, unknown> = {}): Response {
  return json({ success: true, results, ...extra, duration: duration(key) });
}

class Params {
  constructor(private readonly search: URLSearchParams) {}
  get(name: string): string | null {
    const value = this.search.get(name);
    return value === null || value.trim() === "" ? null : value.trim();
  }
  list(name: string): string[] {
    return (this.get(name) ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  number(name: string): number | null {
    const value = this.get(name);
    if (value === null) return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  bool(name: string): boolean {
    return this.get(name)?.toLowerCase() === "true";
  }
}

class BadRequest extends Error {}

/** take (default 20, max 50) and page/offset, as documented for /v2/insights. */
function paginate<T>(items: T[], params: Params, { max = 50, fallback = 20 } = {}): T[] {
  const take = params.number("take") ?? fallback;
  if (!Number.isInteger(take) || take < 1) throw new BadRequest("take must be a positive integer");
  if (take > max) throw new BadRequest(`take must be less than or equal to ${max}`);
  const page = params.number("page");
  const offset = params.number("offset") ?? (page && page > 1 ? (page - 1) * take : 0);
  return items.slice(Math.max(0, offset), Math.max(0, offset) + take);
}

// ---- Locations -------------------------------------------------------------

type Locality = { id: string; name: string; aliases: string[]; bbox: BBox; disambiguation: string; popularity: number };

const LOCALITIES: Locality[] = [
  { name: "Melbourne", aliases: ["melbourne", "melbourne cbd", "cbd", "melbourne vic", "melbourne australia"], bbox: { south: -37.8265, west: 144.9365, north: -37.7985, east: 144.9845 }, disambiguation: "Melbourne, Victoria, Australia", popularity: 0.98 },
  { name: "Southbank", aliases: ["southbank"], bbox: { south: -37.8325, west: 144.951, north: -37.8185, east: 144.975 }, disambiguation: "Southbank, Victoria, Australia", popularity: 0.8 },
  { name: "Docklands", aliases: ["docklands"], bbox: { south: -37.83, west: 144.928, north: -37.81, east: 144.952 }, disambiguation: "Docklands, Victoria, Australia", popularity: 0.7 },
  { name: "Carlton", aliases: ["carlton"], bbox: { south: -37.806, west: 144.96, north: -37.79, east: 144.976 }, disambiguation: "Carlton, Victoria, Australia", popularity: 0.72 },
  { name: "Fitzroy", aliases: ["fitzroy"], bbox: { south: -37.809, west: 144.974, north: -37.794, east: 144.987 }, disambiguation: "Fitzroy, Victoria, Australia", popularity: 0.78 },
  { name: "North Melbourne", aliases: ["north melbourne"], bbox: { south: -37.806, west: 144.935, north: -37.79, east: 144.958 }, disambiguation: "North Melbourne, Victoria, Australia", popularity: 0.6 },
].map((l) => ({ ...l, id: mockId("locality", l.name) }));

type Area =
  | { kind: "point"; point: LatLon; radiusM: number }
  | { kind: "polygon"; rings: [number, number][][] }
  | { kind: "locality"; locality: Locality; padM: number };

function localityByQuery(query: string): Locality | null {
  const q = normalizeName(query);
  return LOCALITIES.find((l) => l.aliases.includes(q) || normalizeName(l.name) === q) ?? null;
}

/**
 * Parse a location parameter: "lat,lon", WKT (POINT/POLYGON/MULTIPOLYGON,
 * longitude first) or a locality id. Unreadable values are ignored, as Qloo
 * ignores invalid parameters.
 */
function parseArea(value: string | null, query: string | null, radiusM: number | null, defaultRadiusM: number): { area: Area | null; locality: Locality | null } {
  if (value) {
    const pair = /^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/.exec(value);
    if (pair) return { area: { kind: "point", point: { lat: Number(pair[1]), lon: Number(pair[2]) }, radiusM: radiusM ?? defaultRadiusM }, locality: null };
    const wkt = parseWkt(value);
    if (wkt?.type === "point") return { area: { kind: "point", point: wkt.point, radiusM: radiusM ?? defaultRadiusM }, locality: null };
    if (wkt?.type === "polygon") return { area: { kind: "polygon", rings: wkt.rings }, locality: null };
    const byId = LOCALITIES.find((l) => l.id.toLowerCase() === value.toLowerCase());
    if (byId) return { area: { kind: "locality", locality: byId, padM: radiusM ?? 1000 }, locality: byId };
    return { area: null, locality: null };
  }
  if (query) {
    const locality = localityByQuery(query);
    if (locality) return { area: { kind: "locality", locality, padM: radiusM ?? 1000 }, locality };
  }
  return { area: null, locality: null };
}

const M_PER_DEG_LAT = 111_320;

function padBBox(box: BBox, metres: number): BBox {
  const dLat = metres / M_PER_DEG_LAT;
  const dLon = metres / (M_PER_DEG_LAT * Math.cos((((box.north + box.south) / 2) * Math.PI) / 180));
  return { south: box.south - dLat, north: box.north + dLat, west: box.west - dLon, east: box.east + dLon };
}

function areaBBox(area: Area): BBox {
  switch (area.kind) {
    case "point":
      return padBBox({ south: area.point.lat, north: area.point.lat, west: area.point.lon, east: area.point.lon }, area.radiusM);
    case "polygon": {
      const boxes = area.rings.map(ringBBox);
      return { south: Math.min(...boxes.map((b) => b.south)), north: Math.max(...boxes.map((b) => b.north)), west: Math.min(...boxes.map((b) => b.west)), east: Math.max(...boxes.map((b) => b.east)) };
    }
    case "locality":
      return padBBox(area.locality.bbox, area.padM);
  }
}

function contains(area: Area, point: LatLon): boolean {
  switch (area.kind) {
    case "point":
      return distanceM(area.point, point) <= area.radiusM;
    case "polygon":
      return area.rings.some((ring) => pointInRing(point, ring));
    case "locality":
      return inBBox(point, padBBox(area.locality.bbox, area.padM));
  }
}

/** A handful of points that stand for an area, for location-weighted taste. */
function samplePoints(area: Area): LatLon[] {
  if (area.kind === "point") return [area.point];
  const box = areaBBox(area);
  const points: LatLon[] = [];
  for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) points.push({ lat: box.south + ((i + 0.5) / 5) * (box.north - box.south), lon: box.west + ((j + 0.5) / 5) * (box.east - box.west) });
  const inside = points.filter((p) => contains(area, p));
  return inside.length > 0 ? inside : points;
}

const covered = (point: LatLon) => inBBox(point, MOCK_COVERAGE);

function localityPayload(locality: Locality) {
  const lat = (locality.bbox.south + locality.bbox.north) / 2;
  const lon = (locality.bbox.west + locality.bbox.east) / 2;
  return {
    entity_id: locality.id,
    name: locality.name,
    subtype: "urn:entity:locality",
    // The docs' heatmap example carries longitude in `lat` and latitude in `lng`; mirrored here.
    location: { lat: lon, lng: lat },
    popularity: locality.popularity,
    disambiguation: locality.disambiguation,
  };
}

// ---- Signals -----------------------------------------------------------------

type Signals = {
  entities: CatalogArtist[];
  entityIds: string[];
  tags: Genre[];
  mix: GenreVector;
  area: Area | null;
};

const GENRE_BY_TAG = new Map((Object.keys(GENRES) as Genre[]).map((g) => [genreTagId(g), g]));

/** Normalise each artist's genre weights to sum to 1, so no input dominates by tagging. */
function unitMix(genres: GenreVector): GenreVector {
  const total = Object.values(genres).reduce((s, w) => s + (w ?? 0), 0);
  return Object.fromEntries(Object.entries(genres).map(([g, w]) => [g, (w ?? 0) / (total || 1)]));
}

function readSignals(params: Params, { location }: { location: boolean }): Signals {
  const entityIds = params.list("signal.interests.entities");
  const entities = entityIds.flatMap((id) => {
    const artist = artistById(id);
    return artist ? [artist] : [];
  });
  const tags = params.list("signal.interests.tags").flatMap((t) => {
    const genre = GENRE_BY_TAG.get(t);
    return genre ? [genre] : [];
  });
  const mix = mixGenres([...entities.map((e) => unitMix(e.genres)), ...tags.map((g) => ({ [g]: 1 }) as GenreVector)]);
  const area = location
    ? parseArea(params.get("signal.location"), params.get("signal.location.query"), params.number("signal.location.radius"), 5000).area
    : null;
  return { entities, entityIds: entities.map((e) => e.id), tags, mix, area };
}

const hasMix = (mix: GenreVector) => Object.keys(mix).length > 0;

/** Per-result explainability: each input entity's share of the match (≥ 0.1 kept, as documented). */
function explain(inputs: CatalogArtist[], target: GenreVector) {
  const raw = inputs.map((input) => ({ entity_id: input.id, raw: Math.max(0, cosine(input.genres, target)) }));
  const total = raw.reduce((s, r) => s + r.raw, 0);
  return raw
    .map((r) => ({ entity_id: r.entity_id, score: total === 0 ? 0 : r3(r.raw / total) }))
    .filter((r) => r.score >= 0.1)
    .sort((a, b) => b.score - a.score);
}

/**
 * Top-level aggregate (live shape): each input entity's average score over
 * the top 3, 5, 10 and all results.
 */
function aggregateExplainability(inputs: CatalogArtist[], perResult: { entity_id: string; score: number }[][]) {
  const effect = (n: number) =>
    inputs.map((input) => {
      const rows = perResult.slice(0, n);
      const avg = rows.length === 0 ? 0 : rows.reduce((s, row) => s + (row.find((r) => r.entity_id === input.id)?.score ?? 0), 0) / rows.length;
      return { entity_id: input.id, avg_score: r3(avg) };
    });
  return {
    "signal.interests.entities": {
      effect_on_top3_recs: effect(3),
      effect_on_top5_recs: effect(5),
      effect_on_top10_recs: effect(10),
      effect_on_all_recs: effect(perResult.length),
    },
  };
}

// ---- Entity payloads -------------------------------------------------------

/** Insights results tag with `id`; /search and /entities with `tag_id` and `value` (live). */
function genreTags(genres: GenreVector, style: "insights" | "lookup") {
  return (Object.entries(genres) as [Genre, number][])
    .sort((a, b) => b[1] - a[1])
    .map(([g]) =>
      style === "insights"
        ? { id: genreTagId(g), name: GENRES[g], type: "urn:tag:genre:music" }
        : { name: GENRES[g], tag_id: genreTagId(g), type: "urn:tag:genre:music", value: genreTagId(g) },
    );
}

/** Invented Last.fm listener count, from the mock popularity. */
const mockListeners = (artist: CatalogArtist) => Math.round(2_000 + artist.popularity ** 3 * 2_500_000 * (0.6 + 0.8 * unit(`listeners:${artist.id}`)));

/**
 * Live shapes differ by endpoint: /search and /entities send `types: [...]`
 * and `properties.external` objects; insights results send `type`/`subtype`
 * and a top-level `external` of lists.
 */
function artistPayload(artist: CatalogArtist, query?: Record<string, unknown>, style: "insights" | "lookup" = "insights") {
  const listeners = mockListeners(artist);
  return {
    name: artist.name,
    entity_id: artist.id,
    ...(style === "insights" ? { type: "urn:entity", subtype: "urn:entity:artist" } : { types: ["urn:entity:artist"] }),
    properties: {
      short_description: "Musical artist (Qloo mock test entity)",
      akas: (artist.aka ?? []).map((value) => ({ value, languages: ["en"] })),
      ...(style === "lookup" ? { external: { spotify: { id: artist.spotifyId }, lastfm: { id: encodeURIComponent(artist.name.toLowerCase()), listeners } } } : {}),
    },
    popularity: artist.popularity,
    tags: genreTags(artist.genres, style),
    ...(query ? { query } : {}),
    disambiguation: artist.local ? "Australian artist (mock)" : "Artist (mock)",
    ...(style === "insights" ? { external: { spotify: [{ id: artist.spotifyId }], lastfm: [{ id: encodeURIComponent(artist.name.toLowerCase()), listeners }] } } : {}),
  };
}

/** Live hours: lowercase weekdays, "THH:MM:SS", `closed`, and closing past midnight as an earlier time. */
function liveHours(hours: MockPlace["hours"]) {
  const seconds = (t: string) => (/^T\d{2}:\d{2}$/.test(t) ? `${t}:00` : t);
  return Object.fromEntries(
    DAYS.map((day) => {
      const ranges = hours[day] ?? [];
      return [
        day.toLowerCase(),
        ranges.length > 0 ? ranges.map((r) => ({ opens: seconds(r.opens), closed: false, closes: seconds(r.closes) })) : [{ opens: null, closed: true, closes: null }],
      ];
    }),
  );
}

const LIVE_MUSIC_CATEGORIES = new Set(["bar", "pub", "theatre", "arts_centre", "nightclub"]);
const MOCK_KEYWORDS: Record<string, string[]> = {
  bar: ["cocktails", "live music", "happy hour"],
  pub: ["bands", "beer garden", "trivia"],
  nightclub: ["dancing", "dj", "late night"],
  theatre: ["shows", "musicals", "matinee"],
  market: ["fresh produce", "street food", "buskers"],
  cafe: ["coffee", "brunch", "outdoor seating"],
  record_store: ["vinyl", "second-hand records", "staff picks"],
};

function placePayload(place: MockPlace, query?: Record<string, unknown>) {
  return {
    name: place.name,
    entity_id: place.id,
    type: "urn:entity",
    subtype: "urn:entity:place",
    location: { lat: place.lat, lon: place.lon, geohash: place.geohash },
    properties: {
      ...(place.address ? { address: `${place.address}, Melbourne VIC` } : {}),
      geocode: { name: "Melbourne", admin1_region: "Victoria", admin2_region: "Melbourne City", country_code: "AU" },
      hours: liveHours(place.hours),
      // Live shape (2026-10-16): live_music, good_for [{id, name, type, weight}], keywords [{name, count}]. Invented here.
      live_music: LIVE_MUSIC_CATEGORIES.has(place.category),
      good_for: [{ id: `urn:tag:genre:place:${place.category}`, name: place.categoryLabel, type: "urn:tag:genre:place", weight: 0.99 }],
      keywords: (MOCK_KEYWORDS[place.category] ?? []).map((name, i) => ({ name, count: 40 - i * 9 })),
      description: `${place.categoryLabel} (name and location from OpenStreetMap; popularity and audience are Qloo mock test data)`,
      ...(place.hoursFromOsm ? {} : { mock_hours: true }),
    },
    popularity: place.popularity,
    tags: [categoryTag(place)],
    ...(query ? { query } : {}),
    disambiguation: place.address ? `${place.address}, Melbourne` : "Melbourne",
    external: { osm: [{ id: place.osmRef }] },
  };
}

// ---- /v2/insights ----------------------------------------------------------

// Each handler below reads only the parameters the Entity Type Parameter Guide
// lists for its filter.type (plus take/page/offset, feature.explainability and
// the location signal), so anything else is ignored, as Qloo does.
const SUPPORTED_TYPES = new Set(["urn:entity:artist", "urn:entity:place", "urn:heatmap", "urn:demographics", "urn:tag"]);
const KNOWN_TYPES = new Set([
  ...SUPPORTED_TYPES,
  "urn:entity:book",
  "urn:entity:brand",
  "urn:entity:destination",
  "urn:entity:locality",
  "urn:entity:movie",
  "urn:entity:person",
  "urn:entity:podcast",
  "urn:entity:tv_show",
  "urn:entity:video_game",
  "urn:entity:videogame",
]);

function insights(params: Params, key: string): Response {
  const type = params.get("filter.type");
  if (!type) throw new BadRequest("filter.type is required");
  if (!KNOWN_TYPES.has(type)) {
    if (type.startsWith("urn:entity:")) return error(403, `You do not have permission to access ${type}`);
    throw new BadRequest(`Invalid filter.type: ${type}`);
  }
  switch (type) {
    case "urn:heatmap":
      return heatmap(params, key);
    case "urn:entity:place":
      return places(params, key);
    case "urn:entity:artist":
      return artists(params, key);
    case "urn:demographics":
      return demographics(params, key);
    case "urn:tag":
      return tags(params, key);
    default:
      // A valid type the mock has no data for: the documented "200 with empty entities".
      return ok({ entities: [] }, key);
  }
}

function requireSignal(signals: Signals, params: Params) {
  const sentAny = params.get("signal.interests.entities") !== null || params.get("signal.interests.tags") !== null;
  if (sentAny && !hasMix(signals.mix)) throw new BadRequest("at least one valid signal or filter is required");
}

/** Live heatmaps over a city-centre polygon come back at geohash precision 7 (about 150 m cells). */
const HEATMAP_PRECISION = 7;

let coverageLifts: { key: string; lifts: number[] } | null = null;

/** An area wider than this (degrees) is "the world" to the heatmap mock. */
const WORLD_SPAN_DEG = 60;
/** The cities the world heatmap puts synthetic clusters in (names from the world gazetteer). */
const WORLD_CLUSTERS = ["Havana", "Miami", "Mexico City", "Bogota", "Buenos Aires", "Sao Paulo", "Madrid", "Barcelona", "Lisbon", "London", "Paris", "Berlin", "New York", "Los Angeles", "Toronto", "Lagos", "Johannesburg", "Mumbai", "Tokyo", "Seoul", "Singapore", "Sydney", "Auckland"];

/** Cells for a world-sized area: the Melbourne taste field (its strongest cells) and a 5 x 5 cluster of cells in each cluster city. */
function worldCells(area: Area, box: BBox, mix: GenreVector, mixKey: string): { geohash: string; center: LatLon; lift: number }[] {
  const local = geohashesInBBox(MOCK_COVERAGE, HEATMAP_PRECISION)
    .map((geohash) => ({ geohash, center: geohashCenter(geohash) }))
    .filter((c) => contains(area, c.center))
    .map((c) => ({ ...c, lift: liftAt(mix, c.center, `${c.geohash}:${mixKey}`) }))
    .sort((a, b) => b.lift - a.lift)
    .slice(0, 60);
  const out = [...local];
  for (const name of WORLD_CLUSTERS) {
    const city = WORLD_PLACES.find((w) => w.name === name);
    if (!city) continue;
    const strength = 0.25 + 0.7 * unit(`world:${name}:${mixKey}`);
    for (let i = -2; i <= 2; i++) {
      for (let j = -2; j <= 2; j++) {
        const center = { lat: round(city.lat + i * 0.012, 6), lon: round(city.lon + j * 0.012, 6) };
        if (!inBBox(center, box) || !contains(area, center)) continue;
        const geohash = geohashEncode(center, HEATMAP_PRECISION);
        out.push({ geohash, center, lift: strength * (1 - 0.12 * (Math.abs(i) + Math.abs(j))) + 0.05 * (unit(`${geohash}:${mixKey}`) - 0.5) });
      }
    }
  }
  return out;
}

function heatmap(params: Params, key: string): Response {
  const signals = readSignals(params, { location: false });
  requireSignal(signals, params);
  if (!hasMix(signals.mix)) throw new BadRequest("at least one valid signal or filter is required");
  const { area, locality } = parseArea(params.get("filter.location"), params.get("filter.location.query"), params.number("filter.location.radius"), 15000);
  if (!area) {
    if (params.get("filter.location") === null && params.get("filter.location.query") === null) throw new BadRequest("filter.location or filter.location.query is required for urn:heatmap");
    return ok({ heatmap: [] }, key);
  }
  const mixKey = JSON.stringify(Object.entries(signals.mix).sort());
  const box = areaBBox(area);
  // A world-sized area (the Repertoire's "Where your fans are") can't be walked cell by cell: the mock answers with the local
  // Melbourne field plus a few synthetic clusters in cities around the world, so the global map has somewhere to point.
  const worldwide = box.east - box.west > WORLD_SPAN_DEG || box.north - box.south > WORLD_SPAN_DEG;
  const cells = (worldwide ? worldCells(area, box, signals.mix, mixKey) : geohashesInBBox(box, HEATMAP_PRECISION)
    .map((geohash) => ({ geohash, center: geohashCenter(geohash) }))
    .filter((c) => contains(area, c.center) && covered(c.center))
    .map((c) => ({ ...c, lift: liftAt(signals.mix, c.center, `${c.geohash}:${mixKey}`) })))
    .sort((a, b) => b.lift - a.lift || a.geohash.localeCompare(b.geohash));

  // affinity_rank: percentile against every cell the mock covers (a city-wide baseline).
  if (coverageLifts?.key !== mixKey) {
    const all = geohashesInBBox(MOCK_COVERAGE, HEATMAP_PRECISION).map((g) => liftAt(signals.mix, geohashCenter(g), `${g}:${mixKey}`));
    coverageLifts = { key: mixKey, lifts: all.sort((a, b) => a - b) };
  }
  const baseline = coverageLifts.lifts;
  const percentile = (value: number) => baseline.filter((v) => v <= value).length / baseline.length;

  const n = cells.length;
  const rows = cells.map((c, i) => ({
    location: { latitude: round(c.center.lat, 6), longitude: round(c.center.lon, 6), geohash: c.geohash },
    query: {
      affinity: n <= 1 ? 1 : 1 - i / n,
      affinity_rank: percentile(c.lift),
      popularity: r3(Math.min(1, density(c.center) * 0.9 + 0.1 * unit(`pop:${c.geohash}`))),
      entity_artist_affinity: n <= 1 ? 1 : 1 - i / n,
      entity_artist_affinity_rank: percentile(c.lift),
    },
  }));
  const take = params.number("take");
  const limited = take === null ? rows : paginate(rows, params, { max: 5000, fallback: rows.length });
  return ok({ heatmap: limited }, key, locality ? { query: { localities: { filter: localityPayload(locality) } } } : {});
}

function places(params: Params, key: string): Response {
  const signals = readSignals(params, { location: true });
  requireSignal(signals, params);
  const { area } = parseArea(params.get("filter.location"), params.get("filter.location.query"), params.number("filter.location.radius"), 15000);
  const weekday = params.get("filter.hours");
  const day = weekday ? weekday[0].toUpperCase() + weekday.slice(1).toLowerCase() : null; // case-insensitive, as live
  const tagFilter = params.list("filter.tags");
  const popMin = params.number("filter.popularity.min");
  const popMax = params.number("filter.popularity.max");
  const only = new Set(params.list("filter.results.entities").map((s) => s.toUpperCase()));
  const exclude = new Set(params.list("filter.exclude.entities").map((s) => s.toUpperCase()));
  const center = area?.kind === "point" ? area.point : null;

  const found = MOCK_PLACES.filter((p) => {
    if (area && !contains(area, p)) return false;
    // filter.hours: invalid day names are ignored, like any invalid parameter.
    if (day && ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].includes(day) && !(p.hours[day as keyof typeof p.hours]?.length)) return false;
    if (tagFilter.length && !tagFilter.includes(categoryTag(p).id)) return false;
    if (popMin !== null && p.popularity < popMin) return false;
    if (popMax !== null && p.popularity > popMax) return false;
    if (only.size && !only.has(p.id)) return false;
    return !exclude.has(p.id);
  });

  const withMix = hasMix(signals.mix);
  const scored = found.map((p) => {
    const fit = withMix ? placeFit(p, signals.mix) : null;
    const affinity = fit === null ? null : r3(Math.min(0.99, 0.15 + 0.8 * (0.8 * fit + 0.2 * p.popularity)));
    return { place: p, affinity };
  });
  const sortBy = params.get("sort_by");
  scored.sort((a, b) => {
    if (sortBy === "distance" && center) return distanceM(center, a.place) - distanceM(center, b.place);
    if (a.affinity !== null && b.affinity !== null && sortBy !== "popularity") return b.affinity - a.affinity || a.place.id.localeCompare(b.place.id);
    return b.place.popularity - a.place.popularity || a.place.id.localeCompare(b.place.id);
  });

  const page = paginate(scored, params);
  const explainability = params.bool("feature.explainability") && signals.entities.length > 0;
  const perResult = page.map((s) => (explainability ? explain(signals.entities, s.place.lean) : []));
  const entities = page.map((s, i) =>
    placePayload(s.place, {
      ...(s.affinity !== null ? { affinity: s.affinity } : {}),
      ...(center ? { distance: Math.round(distanceM(center, s.place)) } : {}),
      ...(explainability ? { explainability: { "signal.interests.entities": perResult[i] } } : {}),
    }),
  );
  return ok({ entities }, key, explainability ? { query: { explainability: aggregateExplainability(signals.entities, perResult) } } : {});
}

function artists(params: Params, key: string): Response {
  const signals = readSignals(params, { location: true });
  requireSignal(signals, params);
  const only = new Set(params.list("filter.results.entities").map((s) => s.toUpperCase()));
  const exclude = new Set(params.list("filter.exclude.entities").map((s) => s.toUpperCase()));
  const tagFilter = params.list("filter.tags").flatMap((t) => (GENRE_BY_TAG.get(t) ? [GENRE_BY_TAG.get(t)!] : []));
  const popMin = params.number("filter.popularity.min");
  const popMax = params.number("filter.popularity.max");
  const inputIds = new Set(signals.entityIds);

  // Ids outside the catalogue are unknown to the mock, as they would be to Qloo.
  const pool: CatalogArtist[] = only.size
    ? [...only].flatMap((id) => {
        const artist = artistById(id);
        return artist ? [artist] : [];
      })
    : CATALOG.filter((artist) => !inputIds.has(artist.id));

  const withMix = hasMix(signals.mix);
  const area = signals.area;
  const inMelbourne = area ? samplePoints(area).some(covered) : false;
  const sample = area ? samplePoints(area).filter(covered) : [];

  const scored = pool
    .filter((artist) => {
      if (exclude.has(artist.id)) return false;
      // Live Qloo leaves some artists out of location-signalled results (see MockArtist.noLocalScore).
      if (area && artist.noLocalScore) return false;
      if (tagFilter.length && !tagFilter.some((g) => (artist.genres[g] ?? 0) >= 0.5)) return false;
      if (popMin !== null && artist.popularity < popMin) return false;
      return popMax === null || artist.popularity <= popMax;
    })
    .map((artist) => {
      const similarity = withMix ? cosine(artist.genres, signals.mix) : null;
      // How strongly the artist's genres concentrate in the area, relative to the city.
      const local = area
        ? (sample.length ? sample.reduce((s, p) => s + tasteAt(artist.genres, p), 0) / sample.length : 0) * 1.6 + (artist.local && inMelbourne ? 0.25 : 0)
        : null;
      const noise = 0.03 * (unit(`artist:${artist.id}:${signals.entityIds.join(",")}:${signals.tags.join(",")}`) - 0.5);
      let score: number;
      if (similarity !== null && local !== null) score = 0.6 * similarity + 0.3 * Math.min(1, local) + 0.1 * artist.popularity;
      else if (similarity !== null) score = 0.85 * similarity + 0.15 * artist.popularity;
      else if (local !== null) score = 0.8 * Math.min(1, local) + 0.2 * artist.popularity;
      else score = artist.popularity;
      return { artist, affinity: r3(Math.max(0.01, Math.min(0.99, score + noise))) };
    })
    .sort((a, b) => b.affinity - a.affinity || a.artist.id.localeCompare(b.artist.id));

  const page = paginate(scored, params);
  const explainability = params.bool("feature.explainability") && signals.entities.length > 0;
  const perResult = page.map((s) => (explainability ? explain(signals.entities, s.artist.genres) : []));
  const entities = page.map((s, i) =>
    artistPayload(s.artist, {
      affinity: s.affinity,
      // Live sends audience_growth on every artist result; it was 0 for every artist checked (2026-10-16).
      measurements: { audience_growth: 0 },
      ...(explainability ? { explainability: { "signal.interests.entities": perResult[i] } } : {}),
    }),
  );
  return ok({ entities }, key, explainability ? { query: { explainability: aggregateExplainability(signals.entities, perResult) } } : {});
}

const AGE_BANDS = ["24_and_younger", "25_to_29", "30_to_34", "35_to_44", "45_to_54", "55_and_older"] as const;

function demographicsFor(mix: GenreVector, noiseKey: string) {
  const total = Object.values(mix).reduce((s, w) => s + (w ?? 0), 0) || 1;
  const age = AGE_BANDS.map(() => 0);
  let male = 0;
  for (const [g, w] of Object.entries(mix) as [Genre, number][]) {
    GENRE_DEMOGRAPHICS[g].age.forEach((v, i) => (age[i] += (v * w) / total));
    male += (GENRE_DEMOGRAPHICS[g].male * w) / total;
  }
  const jitter = (k: string) => 0.04 * (unit(`${noiseKey}:${k}`) - 0.5);
  const m = r2(male + jitter("g"));
  return {
    age: Object.fromEntries(AGE_BANDS.map((band, i) => [band, r2(age[i] + jitter(band))])),
    gender: { male: m, female: r2(-m) },
  };
}

function demographics(params: Params, key: string): Response {
  const signals = readSignals(params, { location: false });
  if (!hasMix(signals.mix)) throw new BadRequest("at least one valid signal or filter is required");
  const rows = [
    ...signals.tags.map((g) => ({ entity_id: genreTagId(g), query: demographicsFor({ [g]: 1 }, genreTagId(g)) })),
    ...signals.entities.map((e) => ({ entity_id: e.id, query: demographicsFor(e.genres, e.id) })),
  ];
  return ok({ demographics: rows }, key);
}

function tags(params: Params, key: string): Response {
  const signals = readSignals(params, { location: true });
  const tagTypes = params.list("filter.tag.types");
  const parents = params.list("filter.parents.types");
  if (tagTypes.length && !tagTypes.some((t) => "urn:tag:genre:music".startsWith(t) || t.startsWith("urn:tag:genre:music"))) return ok({ tags: [] }, key);
  if (parents.length && !parents.includes("urn:entity:artist")) return ok({ tags: [] }, key);
  const area = signals.area;
  const sample = area ? samplePoints(area).filter(covered) : [];
  const rows = (Object.keys(GENRES) as Genre[])
    .map((g) => {
      const fromSignal = hasMix(signals.mix) ? cosine({ [g]: 1 }, signals.mix) : null;
      const fromArea = sample.length ? sample.reduce((s, p) => s + tasteAt({ [g]: 1 }, p), 0) / sample.length : null;
      const parts = [fromSignal, fromArea].filter((v): v is number => v !== null);
      const affinity = parts.length ? r3(Math.min(0.99, parts.reduce((s, v) => s + v, 0) / parts.length)) : null;
      return { g, affinity };
    })
    .sort((a, b) => (b.affinity ?? 0) - (a.affinity ?? 0) || a.g.localeCompare(b.g));
  const page = paginate(rows, params);
  return ok(
    {
      tags: page.map(({ g, affinity }) => ({
        tag_id: genreTagId(g),
        // Live names can arrive padded and lowercase (" indie") next to title case ("Alternative Rock");
        // the mock sends two that way so clients keep trimming and casing them.
        name: g === "indie_rock" ? ` ${GENRES[g]}` : g === "acoustic" || g === "soul" ? GENRES[g].toLowerCase() : GENRES[g],
        types: ["urn:entity:artist"],
        popularity: r3(0.5 + 0.5 * unit(`tagpop:${g}`)),
        subtype: "urn:tag:genre:music",
        tag_value: genreTagId(g),
        query: affinity === null ? {} : { affinity },
      })),
    },
    key,
  );
}

// ---- /search, /entities, /v2/tags --------------------------------------------

function searchArtists(query: string): CatalogArtist[] {
  const q = normalizeName(query);
  if (!q) return [];
  const names = (artist: CatalogArtist) => [artist.name, ...(artist.aka ?? [])].map(normalizeName);
  const exact = CATALOG.filter((artist) => names(artist).includes(q));
  // Partial matches need four characters, so "the" or "jo" don't match half the catalogue.
  const partial = q.length < 4 ? [] : CATALOG.filter((artist) => !exact.includes(artist) && names(artist).some((n) => n.includes(q) || q.includes(n)));
  // Like real Qloo, an artist outside the graph is no match (the caller answers 404 "No results").
  return [...exact, ...partial];
}

function search(params: Params, key: string): Response {
  const query = params.get("query");
  if (!query) throw new BadRequest("query is required");
  const types = params.list("types");
  const wantArtists = types.length === 0 || types.includes("urn:entity:artist");
  const wantPlaces = types.length === 0 || types.includes("urn:entity:place");
  const q = normalizeName(query);
  const results = [
    ...(wantArtists ? searchArtists(query).map((a) => artistPayload(a, undefined, "lookup")) : []),
    ...(wantPlaces ? MOCK_PLACES.filter((p) => normalizeName(p.name).includes(q)).map((p) => placePayload(p)) : []),
  ];
  const page = paginate(results, params, { max: 199 });
  if (page.length === 0) return error(404, "No results");
  return ok(page, key);
}

/** Invented "audience character" words per genre, for /entities by id (Repertoire research step 3). Not Qloo data. */
const MOCK_CHARACTER: Record<Genre, string> = {
  folk: "Heartfelt",
  indie_folk: "Dreamy",
  americana: "Rootsy",
  singer_songwriter: "Storytelling",
  acoustic: "Mellow",
  indie_rock: "Youthful",
  rock: "Energetic",
  pop: "Upbeat",
  soul: "Soulful",
  funk: "Groovy",
  neo_soul: "Smooth",
  jazz: "Sophisticated",
  rnb: "Smooth",
  blues: "Gritty",
  hip_hop: "Bold",
  electronic: "Energetic",
};

/**
 * An artist looked up by Qloo id: the lookup payload plus the extra an id lookup carries in the mock, typed character tags
 * (`urn:tag:audience:qloo`, an assumed type: unverified live) and a description. Only `entity_ids` lookups get them, so
 * /search and the Spotify-id match are unchanged.
 */
function artistDetailPayload(artist: CatalogArtist) {
  const base = artistPayload(artist, undefined, "lookup");
  const ranked = (Object.entries(artist.genres) as [Genre, number][]).sort((x, y) => y[1] - x[1]);
  const words = [...new Set(ranked.map(([g]) => MOCK_CHARACTER[g]))].slice(0, 3);
  const top = ranked.slice(0, 2).map(([g]) => GENRES[g].toLowerCase());
  return {
    ...base,
    properties: { ...base.properties, description: `${artist.name} makes ${top.join(" and ")} music (Qloo mock test description, not Qloo data).` },
    tags: [...base.tags, ...words.map((w) => ({ name: w, tag_id: mockId("audience", w), type: "urn:tag:audience:qloo", value: mockId("audience", w) }))],
  };
}

function entities(params: Params, key: string): Response {
  const ids = params.list("entity_ids");
  const spotify = params.list("external.spotify.ids");
  if (ids.length === 0 && spotify.length === 0) throw new BadRequest("entity_ids must be specified.");
  const found = [
    ...ids.flatMap((id): unknown[] => {
      const place = PLACE_BY_ID.get(id.toUpperCase());
      if (place) return [placePayload(place)];
      const artist = isMockId(id) ? artistById(id) : null;
      return artist ? [artistDetailPayload(artist)] : [];
    }),
    ...spotify.flatMap((sid): unknown[] => {
      const artist = CATALOG.find((a) => a.spotifyId === sid);
      return artist ? [artistPayload(artist, undefined, "lookup")] : [];
    }),
  ];
  if (found.length === 0) return error(404, "No results");
  return ok(found, key);
}

function tagSearch(params: Params, key: string): Response {
  const q = normalizeName(params.get("filter.query") ?? "");
  const rows = (Object.keys(GENRES) as Genre[])
    .filter((g) => !q || normalizeName(GENRES[g]).includes(q) || g.includes(q.replace(/ /g, "_")))
    .map((g) => ({ id: genreTagId(g), name: GENRES[g], type: "urn:tag:genre:music", popularity: r3(0.5 + 0.5 * unit(`tagpop:${g}`)), parents: [{ type: "urn:entity:artist" }] }));
  return ok({ tags: paginate(rows, params) }, key);
}

// ---- /v2/trending --------------------------------------------------------------

const DAY_MS = 86_400_000;
const isoDate = /^\d{4}-\d{2}-\d{2}$/;
/**
 * Like live Qloo (checked 2026-10-15), trending has no data for recent weeks:
 * the mock's series ends on this date, and windows after it are empty.
 */
export const MOCK_TRENDING_LATEST = "2026-05-13";

function trending(params: Params, key: string): Response {
  const type = params.get("filter.type");
  const start = params.get("filter.start_date");
  const end = params.get("filter.end_date");
  if (!type) throw new BadRequest("filter.type is required");
  if (!start || !end || !isoDate.test(start) || !isoDate.test(end)) throw new BadRequest("filter.start_date and filter.end_date are required (YYYY-MM-DD)");
  const entities = params.list("signal.interests.entities").flatMap((id) => {
    const artist = artistById(id);
    return artist ? [artist] : [];
  });
  if (entities.length === 0 || type !== "urn:entity:artist") return ok({ trending: [] }, key);

  // Weekly rows, newest first (docs: "ordered by date in descending order").
  const startMs = Date.parse(`${start}T00:00:00Z`);
  const endMs = Math.min(Date.parse(`${end}T00:00:00Z`), Date.parse(`${MOCK_TRENDING_LATEST}T00:00:00Z`));
  const dates: number[] = [];
  for (let t = endMs; t >= startMs && dates.length < 260; t -= 7 * DAY_MS) dates.push(t);

  // One series per request: several entities are averaged (the docs describe a single entity).
  const series = (t: number) => {
    const weeks = Math.floor(t / (7 * DAY_MS));
    return (
      entities.reduce((sum, e) => {
        const base = 35 + 55 * e.popularity;
        const rising = (e.local ? 0.35 : 0) + ((e.genres.neo_soul ?? 0) + (e.genres.indie_folk ?? 0)) * 0.25;
        const slope = (unit(`slope:${e.id}`) - 0.45) * 0.9 + rising;
        const wobble = 1.5 * Math.sin(weeks * 0.9 + unit(`phase:${e.id}`) * 6);
        return sum + Math.max(1, Math.min(99.5, base + slope * (weeks % 52) * 0.25 + wobble));
      }, 0) / entities.length
    );
  };
  const rows = dates.map((t) => {
    const now = series(t);
    const before = series(t - 7 * DAY_MS);
    const rank = Math.max(1, Math.round((100 - now) * 120));
    const previousRank = Math.max(1, Math.round((100 - before) * 120));
    // Live: the percentile is a 0–1 fraction and the rank a string.
    return {
      date: new Date(t).toISOString().slice(0, 10),
      population_percentile: Math.round(now * 100) / 10_000,
      population_rank: String(rank),
      population_rank_velocity: previousRank - rank,
      velocity_fold_change: r3(now / before),
      population_percent_delta: r2(((now - before) / before) * 100),
    };
  });
  return ok({ trending: paginate(rows, params, { fallback: 50 }) }, key);
}

// ---- /v2/analysis/compare --------------------------------------------------------

/**
 * Live shape (checked 2026-10-15): `results.a` and `results.b` list the tags
 * of each group's entities with `query.count` (a string: how many of the
 * group's entities carry it), and `results.tags` the shared tags with a
 * similarity `query.score`. `filter.subtype` and `take` are ignored. The mock
 * tags an artist with every genre it leans on by at least 0.3.
 */
function compare(params: Params, key: string): Response {
  const groupA = params.list("a.signal.interests.entities").flatMap((id) => (artistById(id) ? [artistById(id)!] : []));
  const groupB = params.list("b.signal.interests.entities").flatMap((id) => (artistById(id) ? [artistById(id)!] : []));
  if (params.list("a.signal.interests.entities").length === 0 || params.list("b.signal.interests.entities").length === 0) {
    throw new BadRequest("a.signal.interests.entities and b.signal.interests.entities are required");
  }
  const counts = (group: CatalogArtist[]) => {
    const out = new Map<Genre, number>();
    for (const artist of group) for (const [g, w] of Object.entries(artist.genres) as [Genre, number][]) if (w >= 0.3) out.set(g, (out.get(g) ?? 0) + 1);
    return out;
  };
  const tagRow = (g: Genre, query: Record<string, unknown>) => ({
    tag_id: genreTagId(g),
    name: GENRES[g],
    type: "urn:tag",
    subtype: "urn:tag:genre:music",
    entity_id: mockId("tag", g),
    popularity: r3(0.5 + 0.5 * unit(`tagpop:${g}`)),
    query,
  });
  const a = counts(groupA);
  const b = counts(groupB);
  const list = (m: Map<Genre, number>) => [...m.entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0])).map(([g, n]) => tagRow(g, { count: String(n) }));
  const ref = (group: CatalogArtist[]) => group.map((e) => ({ entity_id: e.id, name: e.name, subtype: "urn:entity:artist", disambiguation: e.name }));
  const shared = [...a.keys()]
    .filter((g) => b.has(g))
    .map((g) => ({ g, score: r3(Math.min(a.get(g)! / groupA.length, b.get(g)! / groupB.length)) }))
    .sort((x, y) => y.score - x.score || x.g.localeCompare(y.g))
    .map(({ g, score }) => tagRow(g, { score, "a.signal.interests.entities": ref(groupA), "b.signal.interests.entities": ref(groupB) }));
  return json({ duration: duration(key), results: { tags: shared, a: list(a), b: list(b), matchEntities: [] } });
}

// ---- Entry point ---------------------------------------------------------------

/** Handle one request against the mock. `request.url` may use any origin; only the path and query matter. */
export async function handleQlooMock(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  if (request.method !== "GET") return error(404, "No path matching request parameters");
  if (!request.headers.get("x-api-key")?.trim()) return json({ message: "No API key found in request" }, 401);
  const params = new Params(url.searchParams);
  const key = `${path}?${[...url.searchParams.entries()].sort().map(([k, v]) => `${k}=${v}`).join("&")}`;
  try {
    switch (path) {
      case "/":
        return json({ name: "Qloo API (Busk Map local mock)", version: "2.0", mock: true });
      case "/search":
        return search(params, key);
      case "/entities":
        return entities(params, key);
      case "/v2/insights":
        return insights(params, key);
      case "/v2/trending":
        return trending(params, key);
      case "/v2/analysis/compare":
        return compare(params, key);
      case "/v2/tags":
        return tagSearch(params, key);
      default:
        return error(404, "No path matching request parameters");
    }
  } catch (caught) {
    if (caught instanceof BadRequest) return error(400, caught.message);
    throw caught;
  }
}

export const MOCK_LOCALITIES = LOCALITIES;
