import { testSwitches } from "@/server/env";
import { loadWeek } from "@/server/week";

/**
 * GET /api/week/<id>: the week behind /w/<id> and its run's steps (the record, each ready day read from its plan). The page
 * polls it while a run it didn't start is still going. A read: no Qloo or model call. 404 for an unknown id.
 */
export async function GET(_request: Request, { params }: RouteContext<"/api/week/[id]">) {
  const { id } = await params;
  const loaded = await loadWeek(id, testSwitches().offline).catch(() => undefined);
  if (loaded === undefined) return Response.json({ error: { code: "internal", message: "The week couldn't be read. Please try again." } }, { status: 500 });
  if (!loaded) return Response.json({ error: { code: "not_found", message: "There's no week at this link." } }, { status: 404, headers: { "Cache-Control": "no-store" } });
  return Response.json({ week: loaded.week, events: loaded.events }, { headers: { "Cache-Control": "no-store" } });
}
