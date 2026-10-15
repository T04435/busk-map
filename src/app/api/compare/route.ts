import { rejectBots } from "@/server/bot";
import { planRequestSchema } from "@/lib/plan-schema";
import { baselineFor, hasBaseline } from "@/server/agent/baseline";
import { testSwitches } from "@/server/env";
import { compareLimiter } from "@/server/rate-limit";
import { adapterContextFor, clientIp, FAULTS_HEADER } from "@/server/request";

export const maxDuration = 45;

/**
 * POST /api/compare: the plain-AI baseline for a plan (no tools, no data),
 * matched to the plan's pitches. The plan page starts it in parallel with the
 * plan, so this usually returns a result that is already there.
 */
export async function POST(request: Request) {
  const blocked = await rejectBots("/api/compare");
  if (blocked) return blocked;
  const parsed = planRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: { code: "invalid_request", message: "Invalid comparison request." } }, { status: 400 });
  }
  const adapters = adapterContextFor(request.headers.get(FAULTS_HEADER));
  // Offline test mode spends nothing, and a baseline the plan page already started costs no model call: neither is rate limited.
  const free = testSwitches().offline || hasBaseline(parsed.data, adapters);
  const limit = free ? { ok: true, retryAfterS: 0 } : compareLimiter.check(clientIp(request.headers));
  if (!limit.ok) {
    return Response.json({ error: { code: "rate_limited", message: "Too many requests. Try again in a few minutes." } }, { status: 429 });
  }
  const result = await baselineFor(parsed.data, adapters);
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
