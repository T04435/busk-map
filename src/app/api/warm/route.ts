import { warmExamples } from "@/server/agent/preload";
import { adapterContextFor } from "@/server/request";

export const maxDuration = 60;

/**
 * POST /api/warm: build the example plans so the first click on one is
 * instant. Free (no model calls) and idempotent: plans are memoised and the
 * data sources cached, so repeat calls cost almost nothing. Cold, it makes
 * about 20 Qloo calls per example, one example at a time and paced under
 * Qloo's 5-a-second limit (adapters/qloo/client.ts), which takes 20–40 s.
 */
export async function POST() {
  const result = await warmExamples(adapterContextFor(null));
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
