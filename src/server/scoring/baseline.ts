import { distanceM, inBBox, type BBox, type LatLon } from "@/lib/geo";
import { nameKey } from "@/lib/text";
import { candidateAt, type CandidateInputs } from "./candidates";
import { scorePitch, type ScoreInputs, type ScoredPitch } from "./pitch-score";
import type { Weights } from "./types";

/**
 * The plain-AI baseline, set against Busk Map's picks. The baseline is the
 * control: it is matched to the engine's pitches after scoring and never
 * feeds the engine. Agreement is a badge, never a score change.
 *
 * Matching a named place:
 * 1. by name, against the places Busk Map knows (public spots, council sites,
 *    sensor footpaths, the usual hotspots and their common names);
 * 2. else by the model's own coordinates, when they fall in the planning area.
 * A located place then matches a scored pitch within MATCH_RADIUS_M.
 */
export const MATCH_RADIUS_M = 150;
/** Name keys shorter than this never match by containment ("the", "mall"). */
const MIN_NAME_KEY = 5;

export type BaselineSpot = { name: string; why: string; lat?: number | null; lon?: number | null };

/** A place Busk Map knows by name. */
export type KnownPlace = LatLon & { name: string; aliases?: RegExp[] };

export type Located = LatLon & { via: "name" | "coordinates"; place: string | null };

const key = (name: string) => nameKey(name).replace(/\b(street|st)\b/g, "st").replace(/\s+/g, " ");

/** Where a baseline spot is, or null when Busk Map can't place it. */
export function locate(spot: BaselineSpot, places: KnownPlace[], area: BBox): Located | null {
  const text = spot.name;
  const spotKey = key(text);
  // Best match: the same name, then a known name inside the spot's (longest first), then the spot's name inside a known one, then an alias.
  let best: { place: KnownPlace; rank: number } | null = null;
  for (const place of places) {
    const placeKey = key(place.name);
    const rank =
      placeKey === spotKey
        ? 3000
        : placeKey.length >= MIN_NAME_KEY && spotKey.includes(placeKey)
          ? 1000 + placeKey.length
          : spotKey.length >= MIN_NAME_KEY && placeKey.includes(spotKey)
            ? 500
            : place.aliases?.some((alias) => alias.test(text))
              ? 100
              : 0;
    if (rank > 0 && (!best || rank > best.rank)) best = { place, rank };
  }
  if (best) return { lat: best.place.lat, lon: best.place.lon, via: "name", place: best.place.name };
  if (typeof spot.lat === "number" && typeof spot.lon === "number" && inBBox({ lat: spot.lat, lon: spot.lon }, area)) {
    return { lat: spot.lat, lon: spot.lon, via: "coordinates", place: null };
  }
  return null;
}

export type PlainPick = {
  name: string;
  why: string;
  /**
   * - "ours": the same place as one of Busk Map's top pitches (both agree);
   * - "scored": Busk Map scored it (an existing candidate or the spot itself);
   * - "not-legal": the council's layers rule it out;
   * - "no-data": Busk Map can't place it.
   */
  status: "ours" | "scored" | "not-legal" | "no-data";
  located: Located | null;
  /** The Busk Map pitch it matched, if any. */
  pitchId: string | null;
  pitchName: string | null;
  /** Busk Map's score for this spot, when it could score it. */
  score: number | null;
  /** Scored higher than at least one of Busk Map's top picks. */
  beatsOurs: boolean;
};

export type BaselineComparison = {
  /** Busk Map's top pitches the baseline also named: a badge on the pitch. */
  bothAgree: { pitchId: string; plainName: string }[];
  /** Busk Map's top pitches the baseline didn't name. */
  onlyBuskMap: string[];
  /** The baseline's spots that aren't among Busk Map's top pitches. */
  onlyPlainAi: PlainPick[];
  picks: PlainPick[];
};

export type BaselineInputs = {
  top: ScoredPitch[];
  ranked: ScoredPitch[];
  places: KnownPlace[];
  area: BBox;
  legality: Pick<CandidateInputs, "sites" | "zones" | "hotspots" | "permit">;
  scoreInputs: ScoreInputs;
  weights: Weights;
};

const nearest = (point: LatLon, pitches: ScoredPitch[]) =>
  pitches
    .map((p) => ({ p, d: distanceM(point, p) }))
    .filter((x) => x.d <= MATCH_RADIUS_M)
    .sort((a, b) => a.d - b.d)[0]?.p ?? null;

/** Match the baseline's spots to Busk Map's pitches and sort them into the three buckets. */
export function compareWithBaseline(spots: BaselineSpot[], inputs: BaselineInputs): BaselineComparison {
  const { top, ranked } = inputs;
  const lowestTop = top.length > 0 ? Math.min(...top.map((p) => p.score)) : null;
  const picks: PlainPick[] = spots.map((spot, i) => {
    const located = locate(spot, inputs.places, inputs.area);
    const base = { name: spot.name, why: spot.why, located, pitchId: null, pitchName: null, score: null, beatsOurs: false };
    if (!located) return { ...base, status: "no-data" };
    const ours = nearest(located, top);
    if (ours) return { ...base, status: "ours", pitchId: ours.id, pitchName: ours.name, score: ours.score };
    const known = nearest(located, ranked);
    const scored = known ?? scoreSpot(spot, located, i, inputs);
    if (!scored) return { ...base, status: "not-legal" };
    return {
      ...base,
      status: "scored",
      pitchId: known?.id ?? null,
      pitchName: known?.name ?? null,
      score: scored.score,
      beatsOurs: lowestTop !== null && scored.score > lowestTop,
    };
  });
  const agreed = new Map<string, string>();
  for (const pick of picks) if (pick.status === "ours" && !agreed.has(pick.pitchId!)) agreed.set(pick.pitchId!, pick.name);
  return {
    bothAgree: [...agreed].map(([pitchId, plainName]) => ({ pitchId, plainName })),
    onlyBuskMap: top.filter((p) => !agreed.has(p.id)).map((p) => p.id),
    onlyPlainAi: picks.filter((p) => p.status !== "ours"),
    picks,
  };
}

/** Score the baseline's own spot with the same engine and inputs, or null when the council's layers rule it out. */
function scoreSpot(spot: BaselineSpot, at: Located, index: number, inputs: BaselineInputs): ScoredPitch | null {
  const candidate = candidateAt({ id: `baseline:${index}`, name: at.place ?? spot.name, lat: at.lat, lon: at.lon }, inputs.legality);
  return candidate ? scorePitch(candidate, inputs.scoreInputs, inputs.weights) : null;
}

/**
 * One comparison, as recorded for the uniqueness stats. No personal data:
 * an example id (or "custom"), the slot, pitch ids and scores, the overlap.
 */
export type ComparisonRecord = {
  performerKey: string;
  city: string;
  slot: string;
  overlap: number;
  ours: { pitchId: string; score: number; agreed: boolean }[];
  plain: { status: PlainPick["status"]; score: number | null; pitchId: string | null }[];
};

export function comparisonRecord(comparison: BaselineComparison, top: ScoredPitch[], performerKey: string, city: string, slot: string): ComparisonRecord {
  const agreed = new Set(comparison.bothAgree.map((a) => a.pitchId));
  return {
    performerKey,
    city,
    slot,
    overlap: agreed.size,
    ours: top.map((p) => ({ pitchId: p.id, score: p.score, agreed: agreed.has(p.id) })),
    plain: comparison.picks.map((p) => ({ status: p.status, score: p.score, pitchId: p.pitchId })),
  };
}
