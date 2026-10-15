import { rejectBots } from "@/server/bot";
import { planRequestSchema, type PlanStreamEvent } from "@/lib/plan-schema";
import { QlooUnavailableError, runPlanAgent } from "@/server/agent/agent";
import { PlanContext } from "@/server/agent/context";
import { LIMITS } from "@/server/agent/models";
import { isExampleRequest } from "@/server/agent/preload";
import { AgentRun, EXAMPLE_RUN_TTL_MS, hasSharedRun, RUN_TTL_MS, sharedRun } from "@/server/agent/runs";
import { CITIES } from "@/server/cities";
import { testSwitches } from "@/server/env";
import { log } from "@/server/log";
import { planLimiter } from "@/server/rate-limit";
import { adapterContextFor, clientIp, FAULTS_HEADER } from "@/server/request";

/** Agent runs take 20–60 s; the agent itself times out at 75 s. */
export const maxDuration = 90;

function jsonError(status: number, code: string, message: string, headers: HeadersInit = {}) {
  return Response.json({ error: { code, message } }, { status, headers });
}

/**
 * POST /api/plan: run the planning agent and stream its steps as NDJSON
 * (one PlanStreamEvent per line), ending with a `plan` or an `error` event.
 * The same request joins a run in flight or replays a recent one.
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
    const fields = [...new Set(parsed.error.issues.map((i) => i.path.join(".") || "(body)"))];
    return jsonError(400, "invalid_request", `Check these fields: ${fields.join(", ")}`);
  }

  const adapters = adapterContextFor(request.headers.get(FAULTS_HEADER));
  const context = new PlanContext(parsed.data, adapters);
  const shareKey = JSON.stringify([parsed.data, adapters.offline, context.today]);
  // Offline test mode spends nothing, and joining or replaying a shared run costs no model call: neither is rate limited.
  const free = testSwitches().offline || (adapters.faults.length === 0 && hasSharedRun(shareKey));
  const limit = free ? { ok: true, retryAfterS: 0 } : planLimiter.check(clientIp(request.headers));
  if (!limit.ok) {
    return jsonError(429, "rate_limited", "Too many plans in a short time. Try again in a few minutes.", {
      "Retry-After": String(limit.retryAfterS),
    });
  }
  const requestId = crypto.randomUUID();
  const encoder = new TextEncoder();

  const start = async (run: AgentRun, signal: AbortSignal) => {
    run.push({ type: "status", message: "Planning started" });
    try {
      const { plan, usage } = await runPlanAgent(
        context,
        {
          onToolStart: (e) => run.push({ type: "tool-start", ...e }),
          onToolEnd: (e) => run.push({ type: "tool-end", ...e }),
        },
        signal,
      );
      log.info("plan served", { requestId, usage, qloo: plan.qlooMode, explanations: plan.explanations });
      run.push({ type: "plan", plan });
    } catch (error) {
      if (error instanceof QlooUnavailableError) {
        run.push({ type: "error", code: "qloo_unavailable", message: "Qloo, our taste data source, is not responding. Please try again shortly." });
      } else {
        log.error("plan failed", { requestId, error: error instanceof Error ? error.message : "unknown" });
        run.push({ type: "error", code: "internal", message: "Something went wrong while planning. Please try again." });
      }
    }
  };

  // Runs with simulated outages (tests) are never shared. Shared runs keep going if this viewer leaves,
  // so a reload replays the result instead of paying for another model run (see agent/runs.ts).
  let run: AgentRun;
  let reused = false;
  if (adapters.faults.length > 0) {
    run = new AgentRun();
    void start(run, AbortSignal.any([request.signal, AbortSignal.timeout(LIMITS.agentTimeoutMs)])).finally(() => run.finish());
  } else {
    const key = shareKey;
    const ttl = isExampleRequest(parsed.data, context.today) ? EXAMPLE_RUN_TTL_MS : RUN_TTL_MS;
    ({ run, reused } = sharedRun(key, ttl, (r) => start(r, AbortSignal.timeout(LIMITS.agentTimeoutMs))));
  }

  let unfollow = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: PlanStreamEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      if (reused) {
        const at = new Intl.DateTimeFormat("en-AU", { hour: "numeric", minute: "2-digit", timeZone: CITIES[parsed.data.city].timeZone }).format(run.startedAt);
        send({ type: "status", message: run.done ? `Replaying the agent's run from ${at} (cached, no new model call)` : "Joining the agent's run in progress" });
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
