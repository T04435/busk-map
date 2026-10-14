// SYNTHETIC FIXTURE: a deterministic generator that imitates the SHAPE of
// Qloo responses (per research/rules-and-api.md) while the hackathon key is
// pending. Every id starts with "syn-" and every name says "Synthetic". No
// real Qloo data is used or stored here. The UI labels this mode clearly.
import { distanceM, geohashEncode, type BBox, type LatLon } from "@/lib/geo";
import type { CrowdProfile, HeatCell, QlooEntity, QlooPlace, TrendRow } from "../schema";

/** FNV-1a string hash. */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic 0–1 value for a key. */
export function unit(key: string): number {
  let t = hash(key) + 0x6d2b79f5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "x";
const r3 = (n: number) => Math.round(n * 1000) / 1000;

export function synSearchArtist(name: string): QlooEntity {
  return {
    id: `syn-artist-${slug(name)}`,
    name,
    popularity: r3(0.4 + unit(`pop:${name}`) * 0.55),
    affinity: null,
    tags: [{ id: "syn-tag-genre", name: "Synthetic genre" }],
    explanation: [],
  };
}

/** Taste "hot spots" that move with the performer's artists. */
function hotSpots(entityIds: string[], area: BBox): (LatLon & { weight: number })[] {
  const seed = entityIds.slice().sort().join("|") || "none";
  return [0, 1, 2].map((i) => ({
    lat: area.south + (area.north - area.south) * (0.15 + 0.7 * unit(`lat:${seed}:${i}`)),
    lon: area.west + (area.east - area.west) * (0.15 + 0.7 * unit(`lon:${seed}:${i}`)),
    weight: 0.5 + 0.5 * unit(`w:${seed}:${i}`),
  }));
}

export function synHeatmap(entityIds: string[], area: BBox): HeatCell[] {
  const spots = hotSpots(entityIds, area);
  const rows = 10;
  const cols = 12;
  const cells: HeatCell[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lat = area.south + ((r + 0.5) / rows) * (area.north - area.south);
      const lon = area.west + ((c + 0.5) / cols) * (area.east - area.west);
      const affinity = Math.min(
        1,
        spots.reduce((sum, s) => sum + s.weight * Math.exp(-((distanceM({ lat, lon }, s) / 700) ** 2)), 0.05),
      );
      cells.push({ lat, lon, geohash: geohashEncode({ lat, lon }, 7), affinity: r3(affinity), affinityRank: null, popularity: r3(unit(`cellpop:${r}:${c}`)) });
    }
  }
  const ranked = [...cells].sort((a, b) => b.affinity - a.affinity);
  ranked.forEach((cell, i) => (cell.affinityRank = i + 1));
  return cells;
}

const PLACE_TEMPLATES: { name: string; lat: number; lon: number; tag: string }[] = [
  { name: "Synthetic place: station concourse", lat: -37.8180, lon: 144.9665, tag: "Transit station" },
  { name: "Synthetic place: laneway espresso bar", lat: -37.8158, lon: 144.9653, tag: "Cafe" },
  { name: "Synthetic place: rooftop bar", lat: -37.8127, lon: 144.9660, tag: "Bar" },
  { name: "Synthetic place: food market", lat: -37.8078, lon: 144.9570, tag: "Market" },
  { name: "Synthetic place: riverside restaurant", lat: -37.8199, lon: 144.9622, tag: "Restaurant" },
  { name: "Synthetic place: gallery", lat: -37.8226, lon: 144.9689, tag: "Museum" },
  { name: "Synthetic place: record store", lat: -37.8112, lon: 144.9622, tag: "Music store" },
  { name: "Synthetic place: live music pub", lat: -37.8133, lon: 144.9706, tag: "Pub" },
  { name: "Synthetic place: shopping arcade", lat: -37.8141, lon: 144.9635, tag: "Shopping" },
  { name: "Synthetic place: waterfront plaza", lat: -37.8188, lon: 144.9466, tag: "Plaza" },
  { name: "Synthetic place: library cafe", lat: -37.8095, lon: 144.9648, tag: "Cafe" },
  { name: "Synthetic place: theatre foyer", lat: -37.8150, lon: 144.9690, tag: "Theatre" },
];

export function synPlaces(entityIds: string[], center: LatLon, radiusM: number, weekday: string): QlooPlace[] {
  const seed = entityIds.slice().sort().join("|");
  return PLACE_TEMPLATES.filter((p) => distanceM(center, p) <= radiusM).map((p) => ({
    id: `syn-place-${slug(p.name)}`,
    name: p.name,
    lat: p.lat,
    lon: p.lon,
    address: null,
    hours: { [weekday]: [{ opens: "T10:00", closes: "T23:00" }] },
    popularity: r3(0.3 + 0.7 * unit(`ppop:${p.name}`)),
    affinity: r3(unit(`paff:${seed}:${p.name}`)),
    tags: [{ id: `syn-tag-${slug(p.tag)}`, name: p.tag }],
    explanation: entityIds.slice(0, 2).map((id, i) => ({ entityId: id, name: null, score: r3(0.8 - i * 0.3) })),
  }));
}

export function synLocalArtists(entityIds: string[], take: number): QlooEntity[] {
  const seed = entityIds.slice().sort().join("|");
  return Array.from({ length: Math.min(take, 10) }, (_, i) => ({
    id: `syn-local-${i + 1}`,
    name: `Synthetic local artist ${i + 1}`,
    popularity: r3(0.3 + 0.6 * unit(`lpop:${i}`)),
    affinity: r3(0.95 - i * 0.07),
    tags: [{ id: "syn-tag-genre", name: "Synthetic genre" }],
    explanation: entityIds.slice(0, 2).map((id, j) => ({ entityId: id, name: null, score: r3(0.4 + 0.5 * unit(`ex:${seed}:${i}:${j}`)) })),
  }));
}

export function synAffinityAt(entityIds: string[], point: LatLon): Record<string, number> {
  const key = `${point.lat.toFixed(3)},${point.lon.toFixed(3)}`;
  return Object.fromEntries(entityIds.map((id) => [id, r3(0.2 + 0.8 * unit(`aff:${id}:${key}`))]));
}

export function synTrending(entityIds: string[]): TrendRow[] {
  return entityIds.slice(0, 5).map((id) => ({
    entityId: id,
    percentDelta: r3((unit(`trend:${id}`) - 0.3) * 20),
    velocity: r3(unit(`vel:${id}`) * 3),
    percentile: r3(unit(`pct:${id}`)),
  }));
}

export function synDemographics(entityIds: string[]): CrowdProfile {
  const seed = entityIds.slice().sort().join("|");
  const v = (k: string) => r3(unit(`${seed}:${k}`) * 0.6 - 0.3);
  return {
    age: { "24_and_younger": v("a1"), "25_to_29": v("a2"), "30_to_34": v("a3"), "35_to_44": v("a4"), "45_to_54": v("a5"), "55_and_older": v("a6") },
    gender: { male: v("g1"), female: v("g2") },
  };
}

/** Raw API-shaped payloads, for client tests. */
export const SYNTHETIC_RAW = {
  search: {
    results: [
      { entity_id: "syn-raw-artist-1", name: "Synthetic Artist", types: ["urn:entity:artist"], popularity: 0.91, tags: [{ id: "urn:tag:genre:music:synthetic", name: "Synthetic", type: "urn:tag:genre:music" }] },
      { entity_id: "syn-raw-artist-2", name: "Synthetic Artist Tribute", popularity: 0.2 },
    ],
  },
  insightsArtists: {
    results: {
      entities: [
        {
          entity_id: "syn-raw-local-1",
          name: "Synthetic Local",
          popularity: 0.7,
          query: { affinity: 0.88, explainability: { "signal.interests.entities": [{ entity_id: "syn-raw-artist-1", name: "Synthetic Artist", score: 0.9 }, { entity_id: "syn-raw-artist-3", score: 0.35 }] } },
        },
        { entity_id: "syn-raw-local-2", name: "Synthetic Local Two", query: { affinity: 0.5 } },
        { name: "missing id" },
      ],
    },
  },
  places: {
    results: {
      entities: [
        { entity_id: "syn-raw-place-1", name: "Synthetic Bar", popularity: 0.8, location: { lat: -37.8158, lon: 144.9653 }, properties: { address: "1 Synthetic Lane", hours: { saturday: [{ opens: "T16:00", closes: "T23:00" }] } }, query: { affinity: 0.6 } },
        { entity_id: "syn-raw-place-2", name: "Synthetic Cafe", properties: { geocode: { latitude: -37.81, longitude: 144.96 } } },
        { entity_id: "syn-raw-place-3", name: "Synthetic Nowhere" },
      ],
    },
  },
  heatmap: {
    results: {
      heatmap: [
        { location: { latitude: -37.81, longitude: 144.96, geohash: "r1r0fs" }, query: { affinity: 0.9, affinity_rank: 1, popularity: 0.5 } },
        { location: { latitude: -37.82, longitude: 144.95 }, query: { affinity: 0.2 } },
      ],
    },
    query: { localities: [] },
  },
  heatmapEmpty: { results: { heatmap: [] } },
  trending: {
    results: {
      trending: [
        { entity_id: "syn-raw-local-1", date: "2026-10-01", population_percentile: 0.5, population_rank_velocity: 1, population_percent_delta: 2 },
        { entity_id: "syn-raw-local-1", date: "2026-10-08", population_percentile: 0.6, population_rank_velocity: 3, population_percent_delta: 6 },
        { date: "2026-10-08", velocity_fold_change: 1.5 },
      ],
    },
  },
  demographics: {
    results: {
      demographics: [
        { entity_id: "a", query: { age: { "24_and_younger": 0.2, "55_and_older": -0.1 }, gender: { male: 0.1, female: -0.1 } } },
        { entity_id: "b", query: { age: { "24_and_younger": 0.4 } } },
      ],
    },
  },
};
