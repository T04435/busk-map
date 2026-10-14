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
  taste: 0.35,
  footfall: 0.3,
  places: 0.2,
  events: 0.15,
  weather: 0.3,
  discovery: 0.08,
};

export const WEIGHT_LABELS: Record<keyof Weights, string> = {
  taste: "Taste affinity (Qloo heatmap)",
  footfall: "Foot traffic for the slot (city sensors)",
  places: "Busy places open nearby (Qloo)",
  events: "Event crowds arriving or leaving (Ticketmaster)",
  weather: "Weather penalty (Open-Meteo)",
  discovery: "Discovery bonus: strong taste fit off the usual busking spots",
};

/** Clamp each weight to 0–1, filling gaps from the defaults. */
export function normalizeWeights(input: Partial<Weights> | undefined): Weights {
  const out = { ...DEFAULT_WEIGHTS };
  for (const key of Object.keys(DEFAULT_WEIGHTS) as (keyof Weights)[]) {
    const value = input?.[key];
    if (typeof value === "number" && Number.isFinite(value)) out[key] = Math.min(1, Math.max(0, value));
  }
  return out;
}
