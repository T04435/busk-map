import { connection } from "next/server";
import { testSwitches } from "@/server/env";

/**
 * GET /api/health: whether this server runs on offline fixtures and allows simulated faults.
 * Only the two booleans, never env values. The e2e global setup (tests/e2e/global-setup.ts)
 * refuses to run against a server that isn't offline, so tests can't call paid APIs by accident.
 */
export async function GET() {
  // Read the switches at request time: a prerendered response would freeze the build's env.
  await connection();
  const switches = testSwitches();
  return Response.json(
    { ok: true, offline: switches.offline, faults: switches.allowFaults },
    { headers: { "Cache-Control": "no-store" } },
  );
}
