import type { PlanRequest } from "./plan-schema";

type Weights = NonNullable<PlanRequest["weights"]>;
const ORDER = ["taste", "footfall", "places", "events", "weather", "discovery"] as const;

/** `w=taste,footfall,places,events,weather[,discovery]`; older five-value links still work. */
export function parseWeightsParam(value: string | undefined): Weights | undefined {
  const numbers = value?.split(",").map(Number);
  if (!numbers || (numbers.length !== 5 && numbers.length !== 6) || !numbers.every(Number.isFinite)) return undefined;
  return Object.fromEntries(numbers.map((n, i) => [ORDER[i], n])) as Weights;
}

/** Only a complete set is written; partial sets fall back to the defaults. */
export function weightsParam(weights: Weights | undefined): string | null {
  if (!weights) return null;
  const values = ORDER.map((key) => weights[key]);
  if (values.slice(0, 5).some((v) => typeof v !== "number")) return null;
  return (typeof values[5] === "number" ? values : values.slice(0, 5)).join(",");
}
