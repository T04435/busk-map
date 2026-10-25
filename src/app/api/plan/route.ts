import { issuePaths } from "@/lib/form-errors";
import { isAnyTime } from "@/lib/slot";
import { rejectBots } from "@/server/bot";
import { FRESH_HEADER, isPlanId, PLAN_ID_HEADER } from "@/lib/plan-id";
import { planRequestSchema, type PlanStreamEvent } from "@/lib/plan-schema";
import { QlooUnavailableError, runPlanAgent } from "@/server/agent/agent";
import { baselineFor } from "@/server/agent/baseline";
import { LIMITS } from "@/server/agent/models";
import { planKey, planStore } from "@/server/agent/plan-store";
import { engineContext, presetIdFor } from "@/server/agent/preload";
import { AgentRun, hasSharedRun, RUN_TTL_MS, sharedRun, sharedRunWithStore } from "@/server/agent/runs";
import { agentRecord, comparisonStore, recordAgentRun } from "@/server/comparisons/store";
import { cityOf } from "@/server/cities";
import { cityStore, recordCityUse } from "@/server/cities-store";
import { testSwitches } from "@/server/env";
import { log } from "@/server/log";
import { freshRunsAllowed, saveRunSnapshot } from "@/server/plans";
import { recordBuskForRepertoire } from "@/server/playlist/usual";
import { freshRunGate, refundPlanRun } from "@/server/rate-limit";
import { adapterContextFor, clientIp, FAULTS_HEADER, freshLimitFaultRequested, qlooBudgetFaultRequested } from "@/server/request";
import { QLOO_BUDGET_MESSAGE, qlooBudgetSpent } from "@/server/adapters/qloo/budget";

/** Agent runs take 20–60 s; the agent itself times out at 90 s, then the engine's plan is assembled. */
export const maxDuration = 120;

function jsonError(status: number, code: string, message: string, headers: HeadersInit = {}, extra: Record<string, unknown> = {}) {
  return Response.json({ error: { code, message, ...extra } }, { status, headers });
}

/**
 * POST /api/plan: run the planning agent and stream its steps as NDJSON
 * (one PlanStreamEvent per line), ending with a `plan` or an `error` event.
 * The same request joins a run in flight or replays a recent one (from this
 * instance or the plan store). Example presets are inputs only: they never
 * reuse another click's run, only their own short link's run in flight, so
 * every click is a fresh agent run. The agent starts first: nothing is
 * computed before the stream opens.
 *
 * Fresh runs are limited to 30 an hour per IP (per instance; replays and
 * joined runs are free). A refusal is a 429 with Retry-After and
 * `{ error: { code: "rate_limited", message, retryAt, retryAfterS } }`.
 * The test fault `x-buskmap-faults: fresh-limit` forces it (never in production).
 *
 * With the x-buskmap-plan header (a short link's id), the finished run is kept
 * on that plan, so the link opens at once next time. With x-buskmap-fresh: 1
 * (developer path, never in production builds) a new run starts even if one
 * is stored; it is still rate limited.
 */
export async function POST(request: Request) {
  const blocked = await rejectBots("/api/plan");
  if (blocked) return blocked;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "invalid_json", "The request body must be JSON.");
  }
  const parsed = planRequestSchema.safeParse(body);
  if (!parsed.success) {
    const fields = [...new Set(issuePaths(parsed.error.issues))];
    return jsonError(400, "invalid_request", `Check these fields: ${fields.join(", ")}`);
  }

  const adapters = adapterContextFor(request.headers.get(FAULTS_HEADER));
  // The engine's shared context for this request: the agent's tools load the data once, and the baseline then reuses it.
  const context = engineContext(parsed.data, adapters);
  const storeKey = planKey(parsed.data, adapters.offline, context.today);
  const store = planStore(adapters.offline);
  const ttl = RUN_TTL_MS;
  const fresh = request.headers.get(FRESH_HEADER) === "1";
  if (fresh && !freshRunsAllowed()) return jsonError(403, "fresh_not_allowed", "Fresh runs are for development only.");
  const planId = request.headers.get(PLAN_ID_HEADER);
  const presetId = presetIdFor(parsed.data);
  // A preset shares a run only with its own short link (a reload while it runs); without a link, never.
  const shareKey = presetId
    ? JSON.stringify(["preset", isPlanId(planId) ? planId : crypto.randomUUID(), adapters.offline])
    : JSON.stringify([parsed.data, adapters.offline, context.today]);
  // Joining or replaying a run costs no model call: not counted. Presets never replay from the plan store.
  const reused = adapters.faults.length === 0 && !fresh && (await hasSharedRun(shareKey, presetId ? undefined : storeKey, ttl, presetId ? undefined : store));
  const ip = clientIp(request.headers);
  const offline = testSwitches().offline;
  const gate = freshRunGate({
    reused,
    offline,
    ip,
    forced: freshLimitFaultRequested(request.headers.get(FAULTS_HEADER)),
  });
  if (!gate.ok) {
    // Relative message (any time zone); retryAt and retryAfterS let a client show its own local time.
    return jsonError(429, "rate_limited", gate.message, { "Retry-After": String(gate.retryAfterS), "Cache-Control": "no-store" }, { retryAt: gate.retryAt, retryAfterS: gate.retryAfterS });
  }
  // Only a run whose own request recorded a hit can give one back (B-043).
  const counted = !reused && !offline;
  const budgetFault = qlooBudgetFaultRequested(request.headers.get(FAULTS_HEADER));
  const requestId = crypto.randomUUID();
  const encoder = new TextEncoder();

  const start = async (run: AgentRun, signal: AbortSignal) => {
    run.push({ type: "status", message: "Planning started" });
    if (budgetFault) {
      run.push({ type: "error", code: "qloo_budget_spent", message: QLOO_BUDGET_MESSAGE });
      return;
    }
    // A plan runs in this city: keep its row (cities table) up to date. Replays and joined runs never get here.
    void recordCityUse(cityStore(adapters.offline), context.city);
    try {
      const { plan, usage, engineTop, agentTop } = await runPlanAgent(
        context,
        {
          onNote: (e) => run.push({ type: "note", ...e }),
          onToolStart: (e) => run.push({ type: "tool-start", ...e }),
          onToolEnd: (e) => run.push({ type: "tool-end", ...e }),
          onTotals: (totals) => run.push({ type: "totals", totals }),
        },
        signal,
      );
      log.info("plan served", { requestId, usage, qloo: plan.qlooMode, explanations: plan.explanations, differs: plan.agent?.differs ?? null });
      // Only Claude's plans are replayed: a plan whose reasons fell back to templates is retried on the next view.
      if (plan.explanations !== "ai") run.noReplay = true;
      if (usage) run.push({ type: "usage", ...usage });
      // The plan's own totals last (an engine-only plan's only totals event), so the stream ends on the stored numbers.
      if (plan.researchTotals) run.push({ type: "totals", totals: plan.researchTotals });
      run.push({ type: "plan", plan });
      if (agentTop && adapters.faults.length === 0) {
        // Engine-only top 3 vs Claude's, on the plan's comparison row (the baseline fills in the plain AI's picks).
        const slot = isAnyTime(parsed.data.slot) ? `${parsed.data.slot.date} any` : `${parsed.data.slot.date} ${parsed.data.slot.startHour}-${parsed.data.slot.endHour}`;
        const performerKey = presetId ?? "custom";
        void recordAgentRun(comparisonStore(adapters.offline), agentRecord(storeKey, performerKey, parsed.data.city, slot, engineTop, agentTop));
      }
      // The plain-AI baseline starts once the agent's data is loaded, so the two don't race for Qloo's rate limit.
      void baselineFor(parsed.data, adapters, context.today);
    } catch (error) {
      if (error instanceof QlooUnavailableError && qlooBudgetSpent()) {
        // Today's Qloo budget is spent: say so and offer the examples (cached data), not a generic outage.
        run.push({ type: "error", code: "qloo_budget_spent", message: QLOO_BUDGET_MESSAGE });
        if (counted) refundPlanRun("qloo_unavailable", ip);
      } else if (error instanceof QlooUnavailableError) {
        run.push({ type: "error", code: "qloo_unavailable", message: "Qloo, our taste data source, is not responding. Please try again shortly." });
        if (counted) refundPlanRun("qloo_unavailable", ip);
      } else {
        log.error("plan failed", { requestId, error: error instanceof Error ? error.message : "unknown" });
        run.push({ type: "error", code: "internal", message: "Something went wrong while planning. Please try again." });
      }
    }
  };

  // Runs with simulated outages (tests) are never shared. Shared runs keep going if this viewer leaves,
  // so a reload replays the result instead of paying for another model run (see agent/runs.ts).
  let run: AgentRun;
  let joined = false;
  if (adapters.faults.length > 0) {
    run = new AgentRun();
    void start(run, AbortSignal.any([request.signal, AbortSignal.timeout(LIMITS.agentTimeoutMs + 20_000)])).finally(() => run.finish());
  } else {
    // The agent applies its own 90 s timeout; this outer one only stops a stuck assembly.
    const begin = (r: AgentRun) => start(r, AbortSignal.timeout(LIMITS.agentTimeoutMs + 20_000));
    // Presets: in memory only, keyed by their link, never stored by request.
    ({ run, reused: joined } = presetId ? sharedRun(shareKey, ttl, begin) : await sharedRunWithStore(shareKey, storeKey, ttl, begin, store, Date.now(), fresh));
    // Keep the finished run (new, joined or replayed) on the short link's plan.
    if (isPlanId(planId)) {
      const finished = run;
      finished.follow(
        () => {},
        () => void saveRunSnapshot(planId, parsed.data, finished, storeKey, context.today, fresh),
      );
    }
  }

  let unfollow = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: PlanStreamEvent) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        // The viewer's own cookie decides (a shared run reaches many devices). Examples never touch a Repertoire.
        if (event.type === "plan") void recordBuskForRepertoire(request.headers.get("cookie"), parsed.data, event.plan, storeKey, { example: Boolean(presetId) });
      };
      if (joined) {
        const at = new Intl.DateTimeFormat("en-AU", { hour: "numeric", minute: "2-digit", timeZone: cityOf(parsed.data).timeZone }).format(run.startedAt);
        send(
          run.done
            ? { type: "status", message: `Researched at ${at}. Showing that research: nothing new was asked.`, replay: true }
            : { type: "status", message: "Joining the agent's run in progress" },
        );
      }
      unfollow = run.follow(send, () => controller.close());
    },
    cancel() {
      unfollow();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Request-Id": requestId,
    },
  });
}
