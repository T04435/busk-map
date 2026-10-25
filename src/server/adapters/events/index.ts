import "server-only";
import { slotUtcRange, type Slot } from "@/lib/slot";
import type { City } from "@/server/cities";
import { offlineEvents } from "@/server/offline-city";
import { providerStatus } from "@/server/env";
import { runAdapter, type AdapterContext, type AdapterResult } from "../core";
import { fetchCityEvents } from "./client";
import { syntheticEvents } from "./fixtures/synthetic";
import type { CrowdEvent } from "./schema";

export type { CrowdEvent } from "./schema";
export { ASSUMED_EVENT_HOURS } from "./client";

/** Search radius around the city centre (Melbourne's covers the CBD, Southbank, Docklands and the sports precinct): City.radiusKm. */
export const EVENTS_RADIUS_KM = 3;
/** Look back this far before the slot, to catch events that let out during it. */
export const EVENTS_LOOKBACK_HOURS = 4;
/** One cached fetch covers yesterday (for the lookback) through the next 8 days. */
const WINDOW_DAYS = 9;

/** Start of the UTC day before `now`, so the cache key changes once a day, not once a slot. */
function windowStart(now = new Date()): string {
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return new Date(day.getTime() - 86_400_000).toISOString();
}

/** The city's events for the whole window, filtered to those starting between two instants. */
async function cityEventsBetween(city: City, fromIso: string, toIso: string): Promise<CrowdEvent[]> {
  const all = await fetchCityEvents(city.center, city.radiusKm, windowStart(), WINDOW_DAYS);
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);
  return all.filter((event) => {
    const start = Date.parse(event.start);
    return start >= from && start <= to;
  });
}

/**
 * Events near the city centre that are in or around the slot. Fallback: no
 * events, and the UI hides the section.
 */
export async function getEvents(
  city: City,
  slot: Slot,
  context: AdapterContext,
): Promise<AdapterResult<CrowdEvent[]>> {
  const { start, end } = slotUtcRange(slot, city.timeZone);
  const from = new Date(start.getTime() - EVENTS_LOOKBACK_HOURS * 3_600_000).toISOString();
  return runAdapter({
    adapter: "events",
    source: "ticketmaster",
    context,
    configured: providerStatus().ticketmaster,
    fallback: [],
    synthetic: () => offlineEvents(syntheticEvents(), city),
    live: () => cityEventsBetween(city, from, end.toISOString()),
  });
}

/** Events near the city centre between two instants (the week planner's whole week). */
export async function getEventsBetween(
  city: City,
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
    synthetic: () => offlineEvents(syntheticEvents(), city),
    live: () => cityEventsBetween(city, startIso, endIso),
  });
}
