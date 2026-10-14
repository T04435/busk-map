import { warmExamples } from "@/server/agent/preload";
import { adapterContextFor } from "@/server/request";

export const maxDuration = 30;

/**
 * POST /api/warm: build the example plans so the first click on one is
 * instant. Free (no model calls) and idempotent: plans are memoised and the
 * data sources cached, so repeat calls cost almost nothing.
 */
export async function POST() {
  const result = await warmExamples(adapterContextFor(null));
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
