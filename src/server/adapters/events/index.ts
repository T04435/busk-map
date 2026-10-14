import "server-only";
import { slotUtcRange, type Slot } from "@/lib/slot";
import { CITIES, type CityId } from "@/server/cities";
import { providerStatus } from "@/server/env";
import { runAdapter, type AdapterContext, type AdapterResult } from "../core";
import { fetchEvents } from "./client";
import { syntheticEvents } from "./fixtures/synthetic";
import type { CrowdEvent } from "./schema";

export type { CrowdEvent } from "./schema";
export { ASSUMED_EVENT_HOURS } from "./client";

/** Search radius around the city centre. Covers the CBD, Southbank, Docklands and the sports precinct. */
export const EVENTS_RADIUS_KM = 3;
/** Look back this far before the slot, to catch events that let out during it. */
export const EVENTS_LOOKBACK_HOURS = 4;

/**
 * Events near the city centre that are in or around the slot. Fallback: no
 * events, and the UI hides the section.
 */
export async function getEvents(
  cityId: CityId,
  slot: Slot,
  context: AdapterContext,
): Promise<AdapterResult<CrowdEvent[]>> {
  const city = CITIES[cityId];
  const { start, end } = slotUtcRange(slot, city.timeZone);
  const from = new Date(start.getTime() - EVENTS_LOOKBACK_HOURS * 3_600_000).toISOString();
  return runAdapter({
    adapter: "events",
    source: "ticketmaster",
    context,
    configured: providerStatus().ticketmaster,
    fallback: [],
    synthetic: syntheticEvents,
    live: () => fetchEvents(city.center, EVENTS_RADIUS_KM, from, end.toISOString()),
  });
}

/** Events near the city centre between two instants (the week planner's whole week). */
export async function getEventsBetween(
  cityId: CityId,
  startIso: string,
  endIso: string,
  context: AdapterContext,
): Promise<AdapterResult<CrowdEvent[]>> {
  return runAdapter({
    adapter: "events",
    source: "ticketmaster",
    context,
    configured: providerStatus().ticketmaster,
    fallback: [],
    synthetic: syntheticEvents,
    live: () => fetchEvents(CITIES[cityId].center, EVENTS_RADIUS_KM, startIso, endIso),
  });
}
