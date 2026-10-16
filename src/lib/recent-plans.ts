/**
 * Recent plans: the acts and pitches of the busks this browser planned, kept in localStorage only (like the tip log) so
 * the tip log form can offer them as pitches to log takings against. A pitch id from a plan is what lets the takings
 * adjust later plans; a typed pitch is logged under a made-up id and never matches one. Nothing leaves the browser.
 */
import { z } from "zod";
import { performerKeyFor } from "@/lib/tips";

export const RECENT_PLANS_KEY = "buskmap.recent-plans.v1";
export const MAX_RECENT_PLANS = 6;

export const recentPlanSchema = z.object({
  /** performer key + slot: a plan opened again replaces its own entry. */
  key: z.string().min(1).max(200),
  performerKey: z.string().min(1).max(100),
  performerName: z.string().min(1).max(80),
  exampleId: z.string().max(60).nullable(),
  date: z.iso.date(),
  startHour: z.number().int().min(0).max(23),
  endHour: z.number().int().min(1).max(24),
  /** The top pitches first, then the others the plan scored. */
  pitches: z.array(z.object({ id: z.string().min(1).max(120), name: z.string().min(1).max(120) })).min(1).max(60),
});

export type RecentPlan = z.infer<typeof recentPlanSchema>;

export function loadRecentPlans(): RecentPlan[] {
  try {
    const raw = window.localStorage.getItem(RECENT_PLANS_KEY);
    if (!raw) return [];
    const data: unknown = JSON.parse(raw);
    return Array.isArray(data) ? data.flatMap((item) => (recentPlanSchema.safeParse(item).success ? [recentPlanSchema.parse(item)] : [])) : [];
  } catch {
    return [];
  }
}

/** Remember a plan, newest first. Silent when storage is blocked. */
export function rememberPlan(input: { performerName: string; exampleId: string | null; slot: { date: string; startHour: number; endHour: number }; pitches: { id: string; name: string }[] }): void {
  if (input.pitches.length === 0) return;
  const performerKey = performerKeyFor(input.performerName, input.exampleId);
  const entry: RecentPlan = {
    key: `${performerKey}|${input.slot.date}|${input.slot.startHour}-${input.slot.endHour}`,
    performerKey,
    performerName: input.performerName,
    exampleId: input.exampleId,
    date: input.slot.date,
    startHour: input.slot.startHour,
    endHour: input.slot.endHour,
    pitches: input.pitches.slice(0, 60),
  };
  if (!recentPlanSchema.safeParse(entry).success) return;
  try {
    const rest = loadRecentPlans().filter((p) => p.key !== entry.key);
    window.localStorage.setItem(RECENT_PLANS_KEY, JSON.stringify([entry, ...rest].slice(0, MAX_RECENT_PLANS)));
    window.dispatchEvent(new Event("buskmap:recent-plans"));
  } catch {
    // Storage blocked: the tip log form then asks for the pitch by name.
  }
}
