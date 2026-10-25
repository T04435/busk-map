import "server-only";
import { rulesFor, type City } from "@/server/cities";
import { runAdapter, type AdapterContext, type AdapterResult } from "../core";
import { fetchPitchData } from "./client";
import { syntheticPitches } from "./fixtures/synthetic";
import type { PitchData } from "./schema";

export type { BuskingSite, BuskingZone, PermitCategory, PitchData } from "./schema";

export const PITCHES_FALLBACK: PitchData = { sites: [], zones: [] };

/**
 * Busking sites and zones (the council's layers: Melbourne only). Fallback: no rules data, and the UI says
 * "Rules not available for this city" with a link to the council's page. A city with no council data
 * (rulesFor(city).level "none") never calls this: see PlanContext.pitchData.
 */
export async function getPitches(city: Pick<City, "id">, context: AdapterContext): Promise<AdapterResult<PitchData>> {
  return runAdapter({
    adapter: "pitches",
    source: "melbourne-busking",
    context,
    configured: rulesFor(city).level === "local",
    fallback: PITCHES_FALLBACK,
    synthetic: syntheticPitches,
    live: fetchPitchData,
  });
}
