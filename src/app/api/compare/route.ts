import { planRequestSchema } from "@/lib/plan-schema";
import { plainLlmSuggestion } from "@/server/agent/compare";
import { testSwitches } from "@/server/env";
import { compareLimiter } from "@/server/rate-limit";
import { clientIp, adapterContextFor } from "@/server/request";

export const maxDuration = 45;

const compareRequestSchema = planRequestSchema.pick({ city: true, slot: true, performer: true });

/** POST /api/compare: the plain-LLM answer (no tools, no data), for the comparison panel. */
export async function POST(request: Request) {
  // Offline test mode spends nothing, so it is not rate limited.
  const limit = testSwitches().offline ? { ok: true, retryAfterS: 0 } : compareLimiter.check(clientIp(request.headers));
  if (!limit.ok) {
    return Response.json({ error: { code: "rate_limited", message: "Too many requests. Try again in a few minutes." } }, { status: 429 });
  }
  const parsed = compareRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: { code: "invalid_request", message: "Invalid comparison request." } }, { status: 400 });
  }
  const { offline } = adapterContextFor(null);
  const result = await plainLlmSuggestion(parsed.data, offline);
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
