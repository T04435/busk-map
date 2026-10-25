// SYNTHETIC FIXTURE support (offline mode, BUSKMAP_OFFLINE): not provider data.
/**
 * Offline mode's second city. Every synthetic source (the Qloo mock's taste field and places, the events fixture) is drawn
 * over central Melbourne. For Tokyo (and any city the e2e tests pick) the same synthetic data is moved by the offset between
 * the two centres, so an offline plan there has taste cells, places and events around the right point.
 *
 * The Qloo mock only sees coordinates, so it maps the regions listed in OFFLINE_REGIONS back onto Melbourne's field
 * (toMockFrame) and its answers forward again (fromMockFrame).
 */
import { cityFromPlace, MELBOURNE, type City } from "@/lib/city";
import { distanceM, type LatLon } from "@/lib/geo";

export const TOKYO: City = cityFromPlace("tokyo-jp", { name: "Tokyo", country: "Japan", countryCode: "JP", lat: 35.6895, lon: 139.6917, timeZone: "Asia/Tokyo" });

/**
 * Offline mode's large metro: Tokyo picked from the geocoder plans its suburbs too (lib/city.ts radiusForPlace), so the
 * synthetic data needs taste beyond the centre. These hubs, in Melbourne's frame 4 to 5 km out from its centre (east, south
 * and north), add taste for every genre in an offline region only (never Melbourne's own field), and the synthetic Overpass
 * answer has public spaces at each. Invented points, no claim about any real place.
 */
export const OFFLINE_METRO_HUBS: readonly (LatLon & { label: string; weight: number })[] = [
  { label: "East", lat: -37.815, lon: 145.015, weight: 0.95 },
  { label: "South", lat: -37.855, lon: 144.975, weight: 0.9 },
  { label: "North", lat: -37.772, lon: 144.96, weight: 0.85 },
];
/** How far a hub's taste reaches (the Gaussian's sigma, metres). */
export const OFFLINE_METRO_HUB_SIGMA_M = 500;

/** Regions the offline Qloo mock answers for besides Melbourne. */
export const OFFLINE_REGIONS: readonly City[] = [TOKYO];

/** How far from a region's centre the mock still maps a point onto Melbourne's field. */
const REGION_RADIUS_M = 60_000;

const r6 = (n: number) => Math.round(n * 1e6) / 1e6;

function shift<T extends LatLon>(point: T, from: LatLon, to: LatLon): T {
  return { ...point, lat: r6(point.lat - from.lat + to.lat), lon: r6(point.lon - from.lon + to.lon) };
}

/** The offline region a point lies in, or null (Melbourne and everywhere else). */
export function offlineRegionAt(point: LatLon): City | null {
  return OFFLINE_REGIONS.find((r) => distanceM(point, r.center) <= REGION_RADIUS_M) ?? null;
}

/** A point in an offline region, as the matching point over Melbourne. Unchanged elsewhere. */
export function toMockFrame<T extends LatLon>(point: T): T {
  const region = offlineRegionAt(point);
  return region ? shift(point, region.center, MELBOURNE.center) : point;
}

/** A point over Melbourne, moved into `region` (unchanged for Melbourne or no region). */
export function fromMockFrame<T extends LatLon>(point: T, region: Pick<City, "center"> | null): T {
  return region ? shift(point, MELBOURNE.center, region.center) : point;
}

/** The synthetic events (drawn over Melbourne) moved to the plan's city. */
export function offlineEvents<E extends { venue: LatLon }>(events: E[], city: Pick<City, "id" | "center">): E[] {
  if (city.id === MELBOURNE.id) return events;
  return events.map((event) => ({ ...event, venue: shift(event.venue, MELBOURNE.center, city.center) }));
}
