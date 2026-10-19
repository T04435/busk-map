import "server-only";
import { EXAMPLES } from "@/lib/examples";
import { planRequestSchema, type Plan, type PlanRequest } from "@/lib/plan-schema";
import { nextSlotDate } from "@/lib/slot";
import type { AdapterContext } from "@/server/adapters/core";
import { CITIES } from "@/server/cities";
import { processMap } from "@/server/memo";
import { assemblePlan } from "./assemble";
import { PlanContext } from "./context";
import { serverLocalNow, serverToday } from "@/server/clock";

/**
 * The engine's plan without the model: instant, free, and shown first. The
 * live agent (POST /api/plan) then adds Claude's explanations.
 *
 * Plans are memoised in this server instance for a few minutes (the
 * baseline and run=0 reuse them). The adapters below are cached for longer
 * ('use cache: remote'). No example plan is cached: presets are inputs only.
 */
export const PLAN_MEMO_TTL_MS = 10 * 60_000;
/** A plan built while a source was down is kept briefly, so a flaky source doesn't slow every view, then retried. */
export const DEGRADED_PLAN_TTL_MS = 60_000;
const MEMO_MAX = 100;
const memo = processMap<string, { at: number; ttl: number; plan: Promise<Plan> }>("engine-plans");

function memoKey(request: PlanRequest, adapters: AdapterContext, today: string) {
  return JSON.stringify([request, adapters.offline, [...adapters.faults].sort(), today]);
}

/** A plan built while a source (other than a deliberate test fault) was down. */
const degraded = (plan: Plan) => plan.dataStatus.some((s) => s.mode === "fallback" && s.reason !== "missing_key" && s.reason !== "fault_injected");

const contexts = processMap<string, { at: number; context: PlanContext }>("engine-contexts");

/**
 * The engine's PlanContext for a request, shared within this instance: the
 * plan and the plain-AI baseline comparison read the same data once.
 */
export function engineContext(request: PlanRequest, adapters: AdapterContext, today?: string): PlanContext {
  const day = today ?? serverToday(CITIES[request.city].timeZone);
  const key = memoKey(request, adapters, day);
  const hit = contexts.get(key);
  // A plan built while a source was down is retried sooner (see buildEnginePlan); so is its context.
  const ttl = memo.get(key)?.ttl ?? PLAN_MEMO_TTL_MS;
  if (hit && Date.now() - hit.at < ttl) return hit.context;
  const context = new PlanContext(request, adapters, day);
  contexts.set(key, { at: Date.now(), context });
  if (contexts.size > MEMO_MAX) contexts.delete(contexts.keys().next().value!);
  return context;
}

async function assembleEnginePlan(request: PlanRequest, adapters: AdapterContext, day: string): Promise<Plan> {
  const context = engineContext(request, adapters, day);
  await context.artists();
  return assemblePlan(context, null);
}

/**
 * The example preset this request's performer is (as the landing page fills it in), or null. Presets are inputs
 * only: a click on one always starts a fresh agent run, never a stored or cached plan (api/plan).
 */
export function presetIdFor(request: Pick<PlanRequest, "performer">): string | null {
  const json = JSON.stringify(request.performer);
  return EXAMPLES.find((example) => JSON.stringify(planRequestSchema.shape.performer.parse(example.performer)) === json)?.id ?? null;
}

export async function buildEnginePlan(request: PlanRequest, adapters: AdapterContext, today?: string): Promise<Plan> {
  const day = today ?? serverToday(CITIES[request.city].timeZone);
  const key = memoKey(request, adapters, day);
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < hit.ttl) return hit.plan;
  const plan = assembleEnginePlan(request, adapters, day);
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

/** The example requests as the landing page links them (next matching weekday). */
export function exampleRequests(now: { today: string; hour: number }): PlanRequest[] {
  return EXAMPLES.map((example) =>
    planRequestSchema.parse({
      city: "melbourne",
      slot: { date: nextSlotDate(example.weekday, example.startHour, example.endHour, now.today, now.hour), startHour: example.startHour, endHour: example.endHour },
      performer: example.performer,
    }),
  );
}

/**
 * Fetch the examples' data in the background (Qloo, rules, events, weather), so the agent's first run on a
 * preset doesn't wait on cold sources. No model calls, and no plan is served from it: a preset click always starts
 * a fresh agent run. The data-level caches it fills are what keep Qloo quota and latency sane.
 */
export async function warmExamples(adapters: AdapterContext): Promise<{ plans: number; ms: number }> {
  const started = Date.now();
  const now = serverLocalNow(CITIES.melbourne.timeZone);
  const today = now.today;
  // One at a time: the first warms the shared sources (rules), the rest reuse them.
  let plans = 0;
  for (const request of exampleRequests(now)) {
    try {
      await buildEnginePlan(request, adapters, today);
      plans++;
    } catch {
      // Warming is best effort.
    }
  }
  return { plans, ms: Date.now() - started };
}
