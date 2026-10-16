import { rejectBots } from "@/server/bot";
import { planPath } from "@/lib/plan-id";
import { planRequestSchema } from "@/lib/plan-schema";
import { resolvePlanLink } from "@/server/plans";
import { clientIp } from "@/server/request";

/**
 * POST /api/plans: the short link for a plan request (the landing form).
 * Body: a plan request. The same request on the same Melbourne day gets the
 * same id. Answers { id, path }, or { id: null, reason } when no link could be
 * made (rate limited, no durable store): the form then opens the long URL.
 */
export async function POST(request: Request) {
  const blocked = await rejectBots("/api/plans");
  if (blocked) return blocked;
  const parsed = planRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: { code: "invalid_request", message: "Invalid plan request." } }, { status: 400 });
  }
  // The form only sends custom acts.
  const link = await resolvePlanLink(parsed.data, null, clientIp(request.headers));
  if (link.id === null) {
    return Response.json({ id: null, reason: link.reason }, { status: link.reason === "rate_limited" ? 429 : 200, headers: { "Cache-Control": "no-store" } });
  }
  return Response.json({ id: link.id, path: planPath(link.id) }, { headers: { "Cache-Control": "no-store" } });
}
