// SYNTHETIC FIXTURE: an invented Overpass answer for offline mode and tests. Not OpenStreetMap data.
//
// The offline Qloo mock draws its taste field over central Melbourne and moves it to offline mode's second city (Tokyo,
// server/offline-city.ts). So the synthetic public spaces sit where Melbourne's curated spots sit, moved the same way,
// which keeps them near the moved taste cells. Names are made up ("Synthetic OSM …"), ids are invented, and the answer
// carries what a real one does: ways with a centre, unnamed features and a long street split in two pieces.
import { MELBOURNE, type City } from "@/lib/city";
import { PUBLIC_SPOTS, type SpotKind } from "@/server/data/spots";
import { fromMockFrame, OFFLINE_METRO_HUBS, offlineRegionAt } from "@/server/offline-city";

const TAGS: Record<SpotKind, (name: string) => Record<string, string>> = {
  square: (name) => ({ place: "square", name }),
  "pedestrian-street": (name) => ({ highway: "pedestrian", name }),
  laneway: (name) => ({ highway: "pedestrian", name }),
  bridge: (name) => ({ highway: "pedestrian", bridge: "yes", name }),
  promenade: (name) => ({ highway: "footway", name: `${name} Promenade` }),
  forecourt: (name) => ({ railway: "station", name }),
  "park-edge": (name) => ({ leisure: "park", name }),
};

const LABEL: Record<SpotKind, string> = {
  square: "Square",
  "pedestrian-street": "Street",
  laneway: "Lane",
  bridge: "Bridge",
  promenade: "Riverside",
  forecourt: "Station",
  "park-edge": "Park",
};

type El = { type: "node" | "way"; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> };

/** The synthetic Overpass answer for a city: spots in an offline region (Tokyo), none anywhere else. */
export function syntheticOverpass(city: Pick<City, "center">): { elements: El[] } {
  const region = offlineRegionAt(city.center);
  if (!region || region.id === MELBOURNE.id) return { elements: [] };
  const elements: El[] = PUBLIC_SPOTS.map((spot, i): El => {
    const point = fromMockFrame({ lat: spot.lat, lon: spot.lon }, region);
    const tags = TAGS[spot.kind](`Synthetic OSM ${LABEL[spot.kind]} ${i + 1}`);
    return i % 2 === 0 ? { type: "node", id: 9_000_000 + i, lat: point.lat, lon: point.lon, tags } : { type: "way", id: 8_000_000 + i, center: point, tags };
  });
  // A second piece of the first street, 120 m on: one place, so it is dropped.
  const first = elements.find((e) => e.tags?.highway === "pedestrian")!;
  const at = first.center ?? { lat: first.lat!, lon: first.lon! };
  elements.push({ type: "way", id: 8_999_001, center: { lat: at.lat + 0.0011, lon: at.lon }, tags: first.tags });
  // An unnamed pedestrian area away from the others, and a row with no position (dropped).
  elements.push({ type: "way", id: 8_999_002, center: { lat: region.center.lat + 0.0125, lon: region.center.lon - 0.019 }, tags: { highway: "pedestrian", area: "yes" } });
  elements.push({ type: "way", id: 8_999_003, tags: { place: "square", name: "Synthetic OSM no position" } });
  // Offline mode's large metro: a square, a pedestrian street and a park at each taste hub 4 to 5 km out (offline-city.ts).
  OFFLINE_METRO_HUBS.forEach((hub, h) => {
    const near = (dLat: number, dLon: number) => fromMockFrame({ lat: hub.lat + dLat, lon: hub.lon + dLon }, region);
    const id = 7_000_000 + h * 10;
    elements.push({ type: "node", id, ...near(0.0004, 0.0003), tags: TAGS.square(`Synthetic OSM ${hub.label} Square`) });
    elements.push({ type: "way", id: id + 1, center: near(-0.003, -0.0015), tags: TAGS["pedestrian-street"](`Synthetic OSM ${hub.label} Street`) });
    elements.push({ type: "way", id: id + 2, center: near(0.0025, -0.004), tags: TAGS["park-edge"](`Synthetic OSM ${hub.label} Park`) });
  });
  return { elements };
}
