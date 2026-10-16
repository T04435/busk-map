import "server-only";
import { isPlanId, planPath } from "@/lib/plan-id";
import { planRequestSchema, type PlanRequest, type PlanStreamEvent } from "@/lib/plan-schema";
import type { ParsedPlanUrl } from "@/lib/plan-url";
import { serverNow } from "@/server/clock";
import { localToday, slotUtcRange, type Slot } from "@/lib/slot";
import { planKey } from "@/server/agent/plan-store";
import { withFinalTotals } from "@/server/agent/runs";
import { CITIES } from "@/server/cities";
import { testSwitches } from "@/server/env";
import { log } from "@/server/log";
import { planLinkLimiter } from "@/server/rate-limit";
import { canonicalJson, createPlanId, findPlanId, linksDurable, shortPlanStore, storedRequestOf, type PlanSnapshot, type StoredPlan } from "./store";

export type PlanLink = { id: string } | { id: null; reason: "rate_limited" | "not_durable" | "error" };

/**
 * The short id for a plan request: the one made today for the same request,
 * or a new one. An example preset always gets a new id: every click is its own
 * fresh agent run, never another click's plan. New ids are limited per IP
 * (reused ones are free). Never throws: without an id the caller keeps the
 * long /plan?… URL.
 */
export async function resolvePlanLink(request: PlanRequest, exampleId: string | null, ip: string, now = serverNow()): Promise<PlanLink> {
  const offline = testSwitches().offline;
  const store = shortPlanStore(offline);
  if (!linksDurable(store)) return { id: null, reason: "not_durable" };
  const day = localToday(CITIES[request.city].timeZone, now);
  try {
    const found = exampleId ? null : await findPlanId(store, request, exampleId, day);
    if (found) return { id: found };
    // Offline test mode creates rows in memory only: not limited (the e2e tests share one IP).
    if (!offline && !planLinkLimiter.check(ip).ok) return { id: null, reason: "rate_limited" };
    return { id: await createPlanId(store, request, exampleId, day) };
  } catch (error) {
    log.warn("plan link not made", { store: store.kind, error: error instanceof Error ? error.message : "unknown" });
    return { id: null, reason: "error" };
  }
}

/** Query parameters carried from a long URL to its short link (view state, not the request). */
const CARRIED = ["pitch", "run", "fresh"] as const;

/**
 * Where a long plan URL (/plan?name=…, /plan?example=…) redirects: its short
 * link, with the view parameters kept (pitch, run=0, fresh). Null keeps the
 * long URL: an unreadable request, simulated outages (tests), or no link.
 */
export async function longUrlTarget(
  parsed: ParsedPlanUrl,
  params: Record<string, string | string[] | undefined>,
  faults: readonly string[],
  ip: string,
  now = serverNow(),
): Promise<string | null> {
  if (!parsed.ok || faults.length > 0) return null;
  const link = await resolvePlanLink(parsed.request, parsed.exampleId, ip, now);
  if (!link.id) return null;
  const carried = new URLSearchParams();
  for (const key of CARRIED) {
    const value = params[key];
    if (typeof value === "string" && !(key === "run" && value !== "0")) carried.set(key, value);
  }
  const query = carried.toString();
  return `${planPath(link.id)}${query ? `?${query}` : ""}`;
}

/** The stored plan for a well-formed id, or null. A store error throws (it is not a missing plan). */
export async function loadStoredPlan(id: string): Promise<StoredPlan | null> {
  if (!isPlanId(id)) return null;
  return shortPlanStore(testSwitches().offline).get(id);
}

/** The stored request, validated again. A legacy `history` in an old stored request is dropped by the schema. */
export function viewerRequest(stored: StoredPlan): PlanRequest | null {
  const parsed = planRequestSchema.safeParse(stored.request);
  return parsed.success ? parsed.data : null;
}

/** The stored run, if it was made for this request as the viewer sees it. */
export function snapshotFor(stored: StoredPlan, request: PlanRequest, offline: boolean): PlanSnapshot | null {
  const s = stored.snapshot;
  return s && planKey(request, offline, s.runDay) === s.runKey ? s : null;
}

/** The snapshot's events as a replay stream (the plan event last). */
export function snapshotEvents(s: PlanSnapshot): PlanStreamEvent[] {
  // A snapshot stored before the totals events still ends on the plan's totals, when the plan has them.
  return withFinalTotals([...s.events, { type: "plan", plan: s.plan }]);
}

/** Whether the slot has ended (city time). */
export function slotPassed(slot: Slot, timeZone: string, now = serverNow().getTime()): boolean {
  return slotUtcRange(slot, timeZone).end.getTime() <= now;
}

/** The developer path `?fresh=1` (a new agent run, bypassing the stored one): never in production builds. */
export function freshRunsAllowed(): boolean {
  return process.env.NODE_ENV !== "production";
}

/**
 * Keep a finished run on its plan, so the link shows it at once. Only for the
 * request the plan was made for.
 * Never throws.
 */
export async function saveRunSnapshot(
  planId: string,
  request: PlanRequest,
  run: { events: PlanStreamEvent[]; startedAt: number; finishedAt: number | null; ok: boolean },
  runKey: string,
  runDay: string,
  overwrite: boolean,
): Promise<boolean> {
  if (!isPlanId(planId) || !run.ok || run.finishedAt === null) return false;
  const planEvent = run.events.find((e) => e.type === "plan");
  if (!planEvent || planEvent.type !== "plan" || planEvent.plan.explanations !== "ai") return false;
  const store = shortPlanStore(testSwitches().offline);
  try {
    const stored = await store.get(planId);
    if (!stored || canonicalJson(stored.request) !== canonicalJson(storedRequestOf(request))) return false;
    return await store.saveSnapshot(
      planId,
      {
        plan: planEvent.plan,
        events: run.events.filter((e) => e.type !== "plan"),
        explanations: planEvent.plan.explanations,
        runKey,
        runDay,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
      },
      overwrite,
    );
  } catch (error) {
    log.warn("plan snapshot not saved", { store: store.kind, error: error instanceof Error ? error.message : "unknown" });
    return false;
  }
}
