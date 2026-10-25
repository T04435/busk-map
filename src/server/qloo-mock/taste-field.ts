// SYNTHETIC FIXTURE (Qloo mock model, not Qloo data).
// A hand-made, deterministic "taste field" over central Melbourne. Each music
// genre has a few Gaussian anchors at plausible neighbourhoods (for example the
// jazz bars around Bennetts Lane, the Southbank arts precinct, the laneway
// cafes, the market and the university fringe). It is a test model with no
// claim to be true: real Qloo heatmaps replace it the day the key arrives.
// Offline mode's second city (Tokyo, server/offline-city.ts) reads the same field, moved onto its centre.
import { distanceM, type LatLon } from "@/lib/geo";
import { OFFLINE_METRO_HUB_SIGMA_M, OFFLINE_METRO_HUBS, offlineRegionAt, toMockFrame } from "@/server/offline-city";
import { GENRES, unit, type Genre } from "./catalog";

type Anchor = { at: LatLon; sigmaM: number; weight: number };

const P = {
  degraves: { lat: -37.8172, lon: 144.9656 },
  hardwareLane: { lat: -37.8138, lon: 144.9613 },
  queenVicMarket: { lat: -37.807, lon: 144.9575 },
  lincolnSquare: { lat: -37.8024, lon: 144.9628 },
  argyleSquare: { lat: -37.8025, lon: 144.966 },
  birrarungMarr: { lat: -37.819, lon: 144.9735 },
  fitzroyGardensEdge: { lat: -37.813, lon: 144.9785 },
  flindersLaneEast: { lat: -37.8163, lon: 144.9697 },
  chinatown: { lat: -37.8113, lon: 144.9685 },
  bennettsLane: { lat: -37.8104, lon: 144.9706 },
  artsPrecinct: { lat: -37.821, lon: 144.9685 },
  recitalCentre: { lat: -37.824, lon: 144.968 },
  docklandsHarbour: { lat: -37.818, lon: 144.943 },
  swanstonNorth: { lat: -37.808, lon: 144.964 },
  bourkeMall: { lat: -37.8137, lon: 144.9645 },
  southgate: { lat: -37.82, lon: 144.966 },
  fedSquare: { lat: -37.8178, lon: 144.9693 },
  melbourneCentral: { lat: -37.81, lon: 144.963 },
  northMelbourne: { lat: -37.8015, lon: 144.9505 },
  flagstaff: { lat: -37.8105, lon: 144.9545 },
  crown: { lat: -37.8235, lon: 144.9585 },
  southernCross: { lat: -37.818, lon: 144.9525 },
  springStreet: { lat: -37.811, lon: 144.9735 },
  acdcLane: { lat: -37.8156, lon: 144.9713 },
  collinsWest: { lat: -37.818, lon: 144.956 },
} satisfies Record<string, LatLon>;

const A = (at: LatLon, weight: number, sigmaM: number): Anchor => ({ at, weight, sigmaM });

export const GENRE_ANCHORS: Record<Genre, Anchor[]> = {
  folk: [A(P.queenVicMarket, 0.95, 450), A(P.hardwareLane, 0.6, 350), A(P.lincolnSquare, 0.85, 450), A(P.birrarungMarr, 0.45, 450), A(P.northMelbourne, 0.65, 600), A(P.fitzroyGardensEdge, 0.55, 500)],
  indie_folk: [A(P.degraves, 0.45, 350), A(P.argyleSquare, 0.9, 450), A(P.lincolnSquare, 0.6, 400), A(P.birrarungMarr, 0.4, 450), A(P.flagstaff, 0.55, 400), A(P.hardwareLane, 0.5, 350)],
  americana: [A(P.northMelbourne, 0.85, 600), A(P.queenVicMarket, 0.6, 450), A(P.hardwareLane, 0.45, 350)],
  singer_songwriter: [A(P.flindersLaneEast, 0.9, 350), A(P.degraves, 0.6, 350), A(P.fedSquare, 0.45, 350), A(P.springStreet, 0.55, 450), A(P.argyleSquare, 0.4, 450)],
  acoustic: [A(P.degraves, 0.55, 350), A(P.southgate, 0.5, 450), A(P.birrarungMarr, 0.4, 450), A(P.flagstaff, 0.35, 400)],
  indie_rock: [A(P.swanstonNorth, 0.9, 450), A(P.argyleSquare, 0.6, 450), A(P.flindersLaneEast, 0.5, 350), A(P.fitzroyGardensEdge, 0.6, 500)],
  rock: [A(P.acdcLane, 0.85, 350), A(P.melbourneCentral, 0.5, 450), A(P.springStreet, 0.35, 400)],
  pop: [A(P.bourkeMall, 0.95, 400), A(P.melbourneCentral, 0.8, 400), A(P.southgate, 0.6, 450), A(P.crown, 0.7, 500), A(P.docklandsHarbour, 0.5, 600)],
  soul: [A(P.chinatown, 0.8, 400), A(P.artsPrecinct, 0.8, 450), A(P.recitalCentre, 0.6, 400), A(P.southernCross, 0.35, 500), A(P.collinsWest, 0.45, 450)],
  funk: [A(P.bennettsLane, 0.75, 400), A(P.collinsWest, 0.55, 450), A(P.docklandsHarbour, 0.45, 500), A(P.crown, 0.4, 500)],
  neo_soul: [A(P.bennettsLane, 0.85, 350), A(P.artsPrecinct, 0.5, 450), A(P.northMelbourne, 0.45, 500)],
  jazz: [A(P.bennettsLane, 1, 300), A(P.recitalCentre, 0.9, 400), A(P.artsPrecinct, 0.6, 450), A(P.springStreet, 0.4, 400)],
  rnb: [A(P.crown, 0.7, 500), A(P.melbourneCentral, 0.6, 400), A(P.docklandsHarbour, 0.5, 600)],
  blues: [A(P.acdcLane, 0.8, 350), A(P.northMelbourne, 0.5, 600), A(P.queenVicMarket, 0.3, 450)],
  hip_hop: [A(P.melbourneCentral, 0.7, 400), A(P.southernCross, 0.5, 500), A(P.docklandsHarbour, 0.4, 600)],
  electronic: [A(P.crown, 0.6, 500), A(P.docklandsHarbour, 0.6, 600), A(P.southernCross, 0.4, 500)],
};

/** General busyness: the retail core, the stations and the river. */
const DENSITY: Anchor[] = [
  A(P.bourkeMall, 1, 500),
  A(P.fedSquare, 0.9, 450),
  A(P.melbourneCentral, 0.8, 400),
  A(P.southgate, 0.7, 450),
  A(P.queenVicMarket, 0.5, 400),
  A(P.crown, 0.6, 500),
  A(P.southernCross, 0.6, 400),
  A(P.chinatown, 0.5, 400),
  A(P.docklandsHarbour, 0.3, 700),
];

/** Where the mock has data at all: Greater Melbourne's inner suburbs. */
export const MOCK_COVERAGE = { south: -37.87, west: 144.89, north: -37.76, east: 145.03 };

function field(anchors: Anchor[], point: LatLon): number {
  const p = toMockFrame(point);
  let sum = 0;
  for (const { at, sigmaM, weight } of anchors) sum += weight * Math.exp(-((distanceM(p, at) / sigmaM) ** 2));
  return Math.min(1, sum);
}

/** Offline mode's large metro (offline-city.ts OFFLINE_METRO_HUBS): taste for every genre at the hubs, in an offline region only. */
const METRO_HUB_ANCHORS: Anchor[] = OFFLINE_METRO_HUBS.map((hub) => A(hub, hub.weight, OFFLINE_METRO_HUB_SIGMA_M));

export function genreField(genre: Genre, point: LatLon): number {
  const own = field(GENRE_ANCHORS[genre], point);
  return offlineRegionAt(point) ? Math.min(1, own + field(METRO_HUB_ANCHORS, point)) : own;
}

export function density(point: LatLon): number {
  return Math.min(1, 0.08 + field(DENSITY, point));
}

export type GenreVector = Partial<Record<Genre, number>>;

/** Weighted genre mix of a set of artists (or tags). */
export function mixGenres(profiles: GenreVector[]): GenreVector {
  const out: GenreVector = {};
  for (const profile of profiles) for (const [g, w] of Object.entries(profile) as [Genre, number][]) out[g] = (out[g] ?? 0) + w;
  return out;
}

/** Taste concentration for a genre mix at a point, 0–1. */
export function tasteAt(mix: GenreVector, point: LatLon): number {
  let weighted = 0;
  let total = 0;
  for (const [g, w] of Object.entries(mix) as [Genre, number][]) {
    weighted += w * genreField(g, point);
    total += w;
  }
  return total === 0 ? 0 : weighted / total;
}

/**
 * Heatmap "lift": taste concentration minus a share of plain busyness, so
 * quiet pockets with the right crowd can outrank the busiest corner. Small
 * deterministic noise keeps neighbouring cells from looking machine-made.
 */
export function liftAt(mix: GenreVector, point: LatLon, noiseKey: string): number {
  return tasteAt(mix, point) - 0.25 * density(point) + 0.08 * (unit(noiseKey) - 0.5);
}

export function cosine(a: GenreVector, b: GenreVector): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const g of Object.keys(GENRES) as Genre[]) {
    const x = a[g] ?? 0;
    const y = b[g] ?? 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  return na === 0 || nb === 0 ? 0 : dot / Math.sqrt(na * nb);
}

/** Demographic lean per genre: age bands (24-, 25–29, 30–34, 35–44, 45–54, 55+) and male−female. */
export const GENRE_DEMOGRAPHICS: Record<Genre, { age: [number, number, number, number, number, number]; male: number }> = {
  folk: { age: [-0.2, -0.05, 0.05, 0.15, 0.2, 0.25], male: 0 },
  indie_folk: { age: [0.05, 0.25, 0.2, 0.05, -0.15, -0.3], male: -0.08 },
  americana: { age: [-0.1, 0, 0.1, 0.15, 0.15, 0.1], male: 0.05 },
  singer_songwriter: { age: [-0.1, 0.05, 0.1, 0.15, 0.1, 0.05], male: -0.1 },
  acoustic: { age: [0.1, 0.15, 0.1, 0, -0.1, -0.15], male: -0.05 },
  indie_rock: { age: [0.15, 0.3, 0.2, 0, -0.25, -0.35], male: 0.05 },
  rock: { age: [-0.15, -0.05, 0, 0.1, 0.2, 0.2], male: 0.2 },
  pop: { age: [0.4, 0.2, 0, -0.15, -0.25, -0.3], male: -0.15 },
  soul: { age: [-0.15, 0, 0.1, 0.15, 0.15, 0.2], male: 0 },
  funk: { age: [-0.1, 0.05, 0.15, 0.15, 0.1, 0.05], male: 0.1 },
  neo_soul: { age: [0.1, 0.3, 0.25, 0.05, -0.2, -0.3], male: -0.05 },
  jazz: { age: [-0.2, 0, 0.1, 0.15, 0.15, 0.25], male: 0.1 },
  rnb: { age: [0.3, 0.25, 0.1, -0.1, -0.2, -0.25], male: -0.1 },
  blues: { age: [-0.25, -0.1, 0, 0.1, 0.2, 0.3], male: 0.15 },
  hip_hop: { age: [0.45, 0.3, 0.05, -0.2, -0.3, -0.35], male: 0.15 },
  electronic: { age: [0.35, 0.3, 0.05, -0.15, -0.25, -0.3], male: 0.1 },
};
