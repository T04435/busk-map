import { isPlanId } from "@/lib/plan-id";
import { rejectBots } from "@/server/bot";
import { serverNow } from "@/server/clock";
import { testSwitches } from "@/server/env";
import { weekIcsLimiter } from "@/server/rate-limit";
import { clientIp } from "@/server/request";
import { loadWeek, weekIcs } from "@/server/week";

/**
 * GET /api/week/ics?id=<week id>: the week's ready days as an .ics file for Google or Apple Calendar, built from the stored
 * day plans only (no Qloo or model call). Behind BotID and a per-IP limit.
 */
export async function GET(request: Request) {
  const blocked = await rejectBots("/api/week/ics");
  if (blocked) return blocked;
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!isPlanId(id)) return Response.json({ error: { code: "invalid_request", message: "Which week? The link is missing its id." } }, { status: 400 });
  if (!testSwitches().offline) {
    const limit = weekIcsLimiter.check(clientIp(request.headers));
    if (!limit.ok) return Response.json({ error: { code: "rate_limited", message: "Too many calendar downloads in a short time. Try again in a few minutes." } }, { status: 429, headers: { "Retry-After": String(limit.retryAfterS) } });
  }
  const loaded = await loadWeek(id, testSwitches().offline).catch(() => undefined);
  if (loaded === undefined) return Response.json({ error: { code: "internal", message: "The week couldn't be read. Please try again." } }, { status: 500 });
  if (!loaded) return Response.json({ error: { code: "not_found", message: "There's no week at this link." } }, { status: 404 });
  if (!loaded.week.days.some((d) => d.status === "ready" && d.planId)) return Response.json({ error: { code: "no_days", message: "This week has no day to add to a calendar yet." } }, { status: 409 });
  return new Response(weekIcs(loaded, url.origin, serverNow()), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="busk-map-week-${loaded.week.startDate}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
