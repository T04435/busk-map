import type { Weights } from "./types";

/**
 * Default weights (shown in the UI). Score =
 *   Σ wᵢ·factorᵢ / Σ wᵢ   over the factors we have data for
 *   + w_discovery · discovery bonus (a strong hidden gem's taste fit)
 *   − w_weather · weather penalty
 * clamped to 0–1. A missing source drops out of both sums, so it lowers
 * precision without dragging the score down.
 */
export const DEFAULT_WEIGHTS: Weights = {
  taste: 0.4,
  activity: 0.45,
  events: 0.15,
  weather: 0.3,
  discovery: 0.08,
};

export const WEIGHT_LABELS: Record<keyof Weights, string> = {
  taste: "Taste affinity (Qloo heatmap)",
  activity: "Activity estimate for the slot (Qloo: popular places open nearby, where activity concentrates)",
  events: "Event crowds arriving or leaving (Ticketmaster)",
  weather: "Weather penalty (Open-Meteo)",
  discovery: "Discovery bonus: strong taste fit off the usual busking spots",
};

/** Weights as a request or an old link may carry them: `footfall` and `places` are the two weights the activity estimate replaced. */
export type WeightsInput = Partial<Weights> & { footfall?: number; places?: number };

const LEGACY_FOOTFALL_WEIGHT = 0.25;
const LEGACY_PLACES_WEIGHT = 0.2;

/**
 * Clamp each weight to 0–1, filling gaps from the defaults. Requests stored before the activity estimate carry `footfall` and
 * `places` (foot traffic and busy places, 0.25 + 0.2 by default): together they are the activity weight, so a saved plan keeps
 * its balance of taste against crowd.
 */
export function normalizeWeights(input: WeightsInput | undefined): Weights {
  const out = { ...DEFAULT_WEIGHTS };
  for (const key of Object.keys(DEFAULT_WEIGHTS) as (keyof Weights)[]) {
    const value = input?.[key];
    if (typeof value === "number" && Number.isFinite(value)) out[key] = Math.min(1, Math.max(0, value));
  }
  if (typeof input?.activity !== "number" && (typeof input?.footfall === "number" || typeof input?.places === "number")) {
    const footfall = typeof input.footfall === "number" ? input.footfall : LEGACY_FOOTFALL_WEIGHT;
    const places = typeof input.places === "number" ? input.places : LEGACY_PLACES_WEIGHT;
    out.activity = Math.min(1, Math.max(0, footfall + places));
  }
  return out;
}
