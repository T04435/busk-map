import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { exampleHistory } from "@/lib/example-tips";
import { EXAMPLES } from "@/lib/examples";
import { planRequestSchema, type Plan, type PlanRequest } from "@/lib/plan-schema";
import { localToday, nextWeekday } from "@/lib/slot";
import type { AdapterContext } from "@/server/adapters/core";
import { CITIES } from "@/server/cities";
import { assemblePlan } from "./assemble";
import { PlanContext } from "./context";

/**
 * The engine's plan without the model: instant, free, and shown first. The
 * live agent (POST /api/plan) then adds Claude's explanations.
 *
 * Plans are memoised in this server instance for a few minutes, so the
 * examples (and any shared link) open instantly after the first view. The
 * adapters below are cached for longer ('use cache: remote').
 */
export const PLAN_MEMO_TTL_MS = 10 * 60_000;
/** A plan built while a source was down is kept briefly, so a flaky source doesn't slow every view, then retried. */
export const DEGRADED_PLAN_TTL_MS = 60_000;
const MEMO_MAX = 100;
const memo = new Map<string, { at: number; ttl: number; plan: Promise<Plan> }>();

function memoKey(request: PlanRequest, adapters: AdapterContext, today: string) {
  return JSON.stringify([request, adapters.offline, [...adapters.faults].sort(), today]);
}

/** A plan built while a source (other than a deliberate test fault) was down. */
const degraded = (plan: Plan) => plan.dataStatus.some((s) => s.mode === "fallback" && s.reason !== "missing_key" && s.reason !== "fault_injected");

async function assembleEnginePlan(request: PlanRequest, adapters: AdapterContext, day: string): Promise<Plan> {
  const context = new PlanContext(request, adapters, day);
  await context.artists();
  return assemblePlan(context, null);
}

/**
 * The example plans, in the shared remote cache: on Vercel the warm-up
 * (POST /api/warm) and the plan page can run on different instances, so the
 * in-memory memo alone would often miss. Only the examples are cached here:
 * their requests are fixed and hold no personal data (their tip log is the
 * example data). Plans with a failed source are kept briefly, then retried.
 */
async function cachedExamplePlan(requestJson: string, offline: boolean, day: string): Promise<Plan> {
  "use cache: remote";
  cacheTag("example-plans");
  const plan = await assembleEnginePlan(planRequestSchema.parse(JSON.parse(requestJson)), { offline, faults: [] }, day);
  if (degraded(plan)) cacheLife({ stale: 30, revalidate: 60, expire: 120 });
  else cacheLife({ stale: 300, revalidate: PLAN_MEMO_TTL_MS / 1000, expire: 3600 });
  return plan;
}

export function isExampleRequest(request: PlanRequest, day: string): boolean {
  const json = JSON.stringify(request);
  return exampleRequests(day).some((example) => JSON.stringify(example) === json);
}

export async function buildEnginePlan(request: PlanRequest, adapters: AdapterContext, today?: string): Promise<Plan> {
  const day = today ?? localToday(CITIES[request.city].timeZone);
  const key = memoKey(request, adapters, day);
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < hit.ttl) return hit.plan;
  const plan =
    adapters.faults.length === 0 && isExampleRequest(request, day)
      ? cachedExamplePlan(JSON.stringify(request), adapters.offline, day)
      : assembleEnginePlan(request, adapters, day);
  const entry = { at: Date.now(), ttl: PLAN_MEMO_TTL_MS, plan };
  memo.set(key, entry);
  // A failed build must not stick.
  plan.catch(() => memo.delete(key));
  // Plans with a source that failed are retried sooner.
  plan.then((p) => {
    if (degraded(p)) entry.ttl = DEGRADED_PLAN_TTL_MS;
  }, () => {});
  if (memo.size > MEMO_MAX) memo.delete(memo.keys().next().value!);
  return plan;
}

/** The example requests as the landing page links them (next matching weekday, with their example tip log). */
export function exampleRequests(today: string): PlanRequest[] {
  return EXAMPLES.map((example) =>
    planRequestSchema.parse({
      city: "melbourne",
      slot: { date: nextWeekday(example.weekday, today), startHour: example.startHour, endHour: example.endHour },
      performer: example.performer,
      history: exampleHistory(example.id),
    }),
  );
}

/** Build the example plans in the background, so a judge's first click is instant. No model calls. */
export async function warmExamples(adapters: AdapterContext): Promise<{ plans: number; ms: number }> {
  const started = Date.now();
  const today = localToday(CITIES.melbourne.timeZone);
  // One at a time: the first warms the shared sources (sensors, rules), the rest reuse them.
  let plans = 0;
  for (const request of exampleRequests(today)) {
    try {
      await buildEnginePlan(request, adapters, today);
      plans++;
    } catch {
      // Warming is best effort.
    }
  }
  return { plans, ms: Date.now() - started };
}
