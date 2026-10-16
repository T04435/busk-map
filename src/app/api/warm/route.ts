import { warmExamples } from "@/server/agent/preload";
import { adapterContextFor } from "@/server/request";

export const maxDuration = 60;

/**
 * POST /api/warm: fetch the example presets' data (Qloo, sensors, rules, events, weather) into the data caches, so
 * the agent's first run on a preset doesn't wait on cold sources. Free (no model calls) and idempotent. It serves no
 * plan: a preset click always starts a fresh agent run. Cold, it makes about 20 Qloo calls per example, one example
 * at a time and paced under Qloo's 5-a-second limit (adapters/qloo/client.ts), which takes 20–40 s.
 */
export async function POST() {
  const result = await warmExamples(adapterContextFor(null));
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
