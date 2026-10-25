import { QLOO_BUDGET_MESSAGE, qlooBudgetSpent } from "@/server/adapters/qloo/budget";
import { rejectBots } from "@/server/bot";
import { weekRequestSchema } from "@/lib/week-schema";
import { buildWeekPlan, WeekQlooUnavailableError } from "@/server/agent/week";
import { knownCity } from "@/server/cities";
import { testSwitches } from "@/server/env";
import { log } from "@/server/log";
import { planLimiter } from "@/server/rate-limit";
import { adapterContextFor, clientIp, FAULTS_HEADER } from "@/server/request";
import { serverNow, serverToday } from "@/server/clock";

export const maxDuration = 60;

/** POST /api/week: the week plan with the model's explanations of the chosen sessions. */
export async function POST(request: Request) {
  const blocked = await rejectBots("/api/week");
  if (blocked) return blocked;
  const limit = testSwitches().offline ? { ok: true, retryAfterS: 0 } : planLimiter.check(clientIp(request.headers));
  if (!limit.ok) {
    return Response.json(
      { error: { code: "rate_limited", message: "Too many plans in a short time. Try again in a few minutes." } },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterS) } },
    );
  }
  const parsed = weekRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((i) => i.path.join(".") || "(body)"))];
    return Response.json({ error: { code: "invalid_request", message: `Check these fields: ${fields.join(", ")}` } }, { status: 400 });
  }
  try {
    const plan = await buildWeekPlan(
      parsed.data,
      adapterContextFor(request.headers.get(FAULTS_HEADER)),
      serverToday(knownCity(parsed.data.city).timeZone),
      true,
      serverNow(),
    );
    return Response.json({ plan }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof WeekQlooUnavailableError) {
      if (qlooBudgetSpent()) return Response.json({ error: { code: "qloo_budget_spent", message: QLOO_BUDGET_MESSAGE } }, { status: 503 });
      return Response.json({ error: { code: "qloo_unavailable", message: "Qloo, our taste data source, is not responding. Please try again shortly." } }, { status: 503 });
    }
    log.error("week plan failed", { error: error instanceof Error ? error.message : "unknown" });
    return Response.json({ error: { code: "internal", message: "Something went wrong while planning the week." } }, { status: 500 });
  }
}
