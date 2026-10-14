import "server-only";
import { CITIES, type CityId } from "@/server/cities";
import { runAdapter, type AdapterContext, type AdapterResult } from "../core";
import { fetchPitchData } from "./client";
import { syntheticPitches } from "./fixtures/synthetic";
import type { PitchData } from "./schema";

export type { BuskingSite, BuskingZone, PermitCategory, PitchData } from "./schema";

export const PITCHES_FALLBACK: PitchData = { sites: [], zones: [] };

/**
 * Busking sites and zones. Fallback: no rules data, and the UI says
 * "Rules not available for this city" with a link to the council's page.
 */
export async function getPitches(cityId: CityId, context: AdapterContext): Promise<AdapterResult<PitchData>> {
  return runAdapter({
    adapter: "pitches",
    source: "melbourne-busking",
    context,
    configured: CITIES[cityId].pitchRules === "machine-readable",
    fallback: PITCHES_FALLBACK,
    synthetic: syntheticPitches,
    live: fetchPitchData,
  });
}
