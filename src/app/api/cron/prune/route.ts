import { timingSafeEqual } from "node:crypto";
import { connection } from "next/server";
import { env } from "@/server/env";
import { log } from "@/server/log";
import { pruneRawStepData } from "@/server/plans/retention";

/**
 * GET /api/cron/prune: the daily retention job (vercel.json "crons"). Raw
 * Qloo-derived step data is kept 7 days; plans and links persist. Strips the
 * raw tool output from stored plans and runs older than that and deletes
 * expired run rows. Idempotent.
 *
 * Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`. Without CRON_SECRET
 * configured the route refuses to run.
 */
function authorised(header: string | null, secret: string): boolean {
  const given = Buffer.from(header ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: Request) {
  await connection();
  const secret = env().CRON_SECRET;
  if (!secret) return Response.json({ error: { code: "not_configured", message: "CRON_SECRET is not set." } }, { status: 503 });
  if (!authorised(request.headers.get("authorization"), secret)) return Response.json({ error: { code: "unauthorised", message: "Unauthorised." } }, { status: 401 });
  try {
    const result = await pruneRawStepData();
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    log.error("prune failed", { error: error instanceof Error ? error.message : "unknown" });
    return Response.json({ error: { code: "unavailable", message: "Prune failed." } }, { status: 503 });
  }
}
