import { planRequestSchema, type PlanStreamEvent } from "@/lib/plan-schema";
import { QlooUnavailableError, runPlanAgent } from "@/server/agent/agent";
import { PlanContext } from "@/server/agent/context";
import { LIMITS } from "@/server/agent/models";
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
 */
export async function POST(request: Request) {
  // Offline test mode spends nothing, so it is not rate limited.
  const limit = testSwitches().offline ? { ok: true, retryAfterS: 0 } : planLimiter.check(clientIp(request.headers));
  if (!limit.ok) {
    return jsonError(429, "rate_limited", "Too many plans in a short time. Try again in a few minutes.", {
      "Retry-After": String(limit.retryAfterS),
    });
  }

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

  const context = new PlanContext(parsed.data, adapterContextFor(request.headers.get(FAULTS_HEADER)));
  const requestId = crypto.randomUUID();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: PlanStreamEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      send({ type: "status", message: "Planning started" });
      try {
        const { plan, usage } = await runPlanAgent(
          context,
          {
            onToolStart: (e) => send({ type: "tool-start", ...e }),
            onToolEnd: (e) => send({ type: "tool-end", ...e }),
          },
          // Stop spending tokens if the browser goes away.
          AbortSignal.any([request.signal, AbortSignal.timeout(LIMITS.agentTimeoutMs)]),
        );
        log.info("plan served", { requestId, usage, qloo: plan.qlooMode, explanations: plan.explanations });
        send({ type: "plan", plan });
      } catch (error) {
        if (error instanceof QlooUnavailableError) {
          send({ type: "error", code: "qloo_unavailable", message: "Qloo, our taste data source, is not responding. Please try again shortly." });
        } else {
          log.error("plan failed", { requestId, error: error instanceof Error ? error.message : "unknown" });
          send({ type: "error", code: "internal", message: "Something went wrong while planning. Please try again." });
        }
      } finally {
        controller.close();
      }
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
