/**
 * The retention rule as pure functions (see retention.ts): raw tool output in
 * stored steps is kept RAW_STEP_RETENTION_MS, then removed.
 */
import type { PlanStreamEvent } from "@/lib/plan-schema";

export const RAW_STEP_RETENTION_MS = 7 * 24 * 60 * 60_000;

/** Whether any step still holds raw output. */
export function hasRawStepData(events: PlanStreamEvent[]): boolean {
  return events.some((e) => e.type === "tool-end" && e.output !== undefined);
}

/** The events with every tool-end's raw output removed (marked pruned). Pure; already-stripped events are unchanged. */
export function stripStepOutputs(events: PlanStreamEvent[]): PlanStreamEvent[] {
  return events.map((e) => {
    if (e.type !== "tool-end" || e.output === undefined) return e;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { output, ...rest } = e;
    return { ...rest, pruned: true };
  });
}

/** Whether data finished at `finishedAt` is past retention at `now`. */
export const pastRetention = (finishedAt: number, now = Date.now()) => now - finishedAt >= RAW_STEP_RETENTION_MS;

