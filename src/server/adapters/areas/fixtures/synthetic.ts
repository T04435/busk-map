// SYNTHETIC FIXTURE: an invented Overpass answer of named place nodes for offline mode and tests. Not OpenStreetMap data.
//
// Offline mode's large metro (Tokyo with its suburbs, server/offline-city.ts) gets named areas at its taste hubs, one with no
// taste, and a neighbourhood too close to a hub to count as its own area, in Melbourne's frame moved to the region like every
// other synthetic source. Names are made up ("Synthetic …"), ids are invented, and the answer carries what a real one does:
// an English name beside the local one, a population tag with separators, and rows that are dropped (no name, no position).
import { MELBOURNE, type City } from "@/lib/city";
import { fromMockFrame, OFFLINE_METRO_AREAS, offlineRegionAt } from "@/server/offline-city";

type El = { type: "node"; id: number; lat?: number; lon?: number; tags?: Record<string, string> };

/** The synthetic answer for a metro: place nodes in an offline region (Tokyo), none anywhere else. */
export function syntheticAreas(city: Pick<City, "center">): { elements: El[] } {
  const region = offlineRegionAt(city.center);
  if (!region || region.id === MELBOURNE.id) return { elements: [] };
  const elements: El[] = OFFLINE_METRO_AREAS.map((area, i) => {
    const point = fromMockFrame({ lat: area.lat, lon: area.lon }, region);
    const tags: Record<string, string> = { place: area.place, name: `${area.name} (local)`, "name:en": area.name };
    if (area.population !== undefined) tags.population = area.population.toLocaleString("en-US");
    return { type: "node", id: 6_000_000 + i, lat: point.lat, lon: point.lon, tags };
  });
  elements.push({ type: "node", id: 6_999_001, lat: region.center.lat + 0.01, lon: region.center.lon, tags: { place: "suburb" } });
  elements.push({ type: "node", id: 6_999_002, tags: { place: "town", name: "Synthetic no position" } });
  return { elements };
}
