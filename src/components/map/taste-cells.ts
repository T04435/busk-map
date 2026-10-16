import type { Plan } from "@/lib/plan-schema";

/**
 * The shared map treatment (F02, F03, F05): only the orange cells draw, so the streets show through the rest. Orange is steps 3 to 5
 * of the taste ramp, which start at this affinity (the plan's affinity runs 0 to 1 against the performer's best cell). An empty
 * heat list, or one with nothing this strong, draws no taste at all: NoMatch shows a street map, never a field.
 */
export const ORANGE_FROM = 0.48;

export const orangeCells = <T extends { affinity: number }>(cells: readonly T[]): T[] => cells.filter((c) => c.affinity >= ORANGE_FROM);

/** The default framing on every map: zoomed out enough that the streets read around the pins. */
export const MAP_FRAME = { maxZoom: 14.2, padding: 90 } as const;

/** What the map actually draws, so the legend lists only that. */
export function drawn(plan: Pick<Plan, "tasteCells" | "others">): { taste: boolean; others: boolean } {
  return { taste: orangeCells(plan.tasteCells).length > 0, others: plan.others.length > 0 };
}
