import type { Plan } from "@/lib/plan-schema";

/**
 * The shared map treatment (F02, F03, F05, F28): only the orange cells draw, so the streets show through the rest. Orange is steps 3 to 5
 * of the taste ramp, as in the DS TasteMap `bare`, which start at this affinity (the plan's affinity runs 0 to 1 against the performer's best cell). An empty
 * heat list, or one with nothing this strong, draws no taste at all: NoMatch shows a street map, never a field.
 */
export const ORANGE_FROM = 0.48;

/** Where steps 4 and 5 begin (DS TasteMap: step 3 from 0.48, 4 from 0.68, 5 from 0.88). Below ORANGE_FROM nothing draws. */
export const TASTE_STEP_FROM = { 4: 0.68, 5: 0.88 } as const;

export const orangeCells = <T extends { affinity: number }>(cells: readonly T[]): T[] => cells.filter((c) => c.affinity >= ORANGE_FROM);

/** The default framing on every map: zoomed out enough that the streets read around the pins. */
export const MAP_FRAME = { maxZoom: 14.2, padding: 90 } as const;

/** Map interaction: one finger and plain wheel scroll go to the page; two fingers or ctrl/cmd + wheel move the map (B-227). MapLibre draws its own hint. */
export const MAP_GESTURES = { cooperativeGestures: true } as const;

/** What the map actually draws, so the legend lists only that. */
export function drawn(plan: Pick<Plan, "tasteCells" | "others"> & { zones?: Plan["zones"] }): { taste: boolean; others: boolean; zones: boolean } {
  return { taste: orangeCells(plan.tasteCells).length > 0, others: plan.others.length > 0, zones: (plan.zones ?? []).length > 0 };
}
