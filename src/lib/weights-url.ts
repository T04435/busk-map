import type { PlanRequest } from "./plan-schema";

type Weights = NonNullable<PlanRequest["weights"]>;
/** `wa=taste,activity,events,weather[,discovery]`: the weights since the activity estimate replaced foot traffic and busy places. */
const ORDER = ["taste", "activity", "events", "weather", "discovery"] as const;
/** `w=taste,footfall,places,events,weather[,discovery]`: links made before it. They still work: footfall and places count together as the activity weight (normalizeWeights). */
const LEGACY_ORDER = ["taste", "footfall", "places", "events", "weather", "discovery"] as const;

function parse(value: string | undefined, order: readonly string[], lengths: number[]): Weights | undefined {
  const numbers = value?.split(",").map(Number);
  if (!numbers || !lengths.includes(numbers.length) || !numbers.every(Number.isFinite)) return undefined;
  return Object.fromEntries(numbers.map((n, i) => [order[i], n])) as Weights;
}

/** The weights a link carries: `wa` (current), else `w` (older: five or six values). */
export function parseWeightsParam(current: string | undefined, legacy?: string): Weights | undefined {
  return parse(current, ORDER, [4, 5]) ?? parse(legacy, LEGACY_ORDER, [5, 6]);
}

/**
 * The query pair that carries the weights, or null. Only a complete set is written; partial sets fall back to the defaults.
 * A request that still holds the older `footfall` and `places` weights (an old link) is written back the old way, unchanged.
 */
export function weightsParam(weights: Weights | undefined): [key: string, value: string] | null {
  if (!weights) return null;
  const values = ORDER.map((key) => weights[key]);
  if (values.slice(0, 4).every((v) => typeof v === "number")) return ["wa", (typeof values[4] === "number" ? values : values.slice(0, 4)).join(",")];
  const old = LEGACY_ORDER.map((key) => weights[key]);
  if (old.slice(0, 5).some((v) => typeof v !== "number")) return null;
  return ["w", (typeof old[5] === "number" ? old : old.slice(0, 5)).join(",")];
}
