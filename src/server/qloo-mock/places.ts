// SYNTHETIC FIXTURE (Qloo mock model, not Qloo data).
// Turns the OpenStreetMap place extract into Qloo-shaped place entities. Names,
// coordinates, addresses and (where tagged) opening hours come from OSM
// (ODbL). Popularity, audience taste and the remaining opening hours are
// invented by the mock.
import { geohashEncode, type LatLon } from "@/lib/geo";
import { fromMockFrame, OFFLINE_REGIONS } from "@/server/offline-city";
import { mockId, unit, type Genre } from "./catalog";
import { OSM_PLACES } from "./data/osm-places";
import { density, mixGenres, tasteAt, type GenreVector } from "./taste-field";

export type DayHours = { opens: string; closes: string }[];
export type WeekHours = Partial<Record<(typeof DAYS)[number], DayHours>>;

export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

type Category = {
  label: string;
  /** Base popularity before location. */
  popularity: number;
  /** Which crowds this kind of place draws. */
  lean: GenreVector;
  /** Typical hours when OSM has none: [opens, closes] per weekday (null = closed). */
  hours: ([string, string] | null)[];
};

const every = (opens: string, closes: string) => DAYS.map(() => [opens, closes] as [string, string]);

const CATEGORIES: Record<string, Category> = {
  bar: { label: "Bar", popularity: 0.5, lean: { jazz: 0.4, soul: 0.35, indie_rock: 0.3, rock: 0.3, funk: 0.25 }, hours: [null, ["T16:00", "T23:00"], ["T16:00", "T23:30"], ["T16:00", "T01:00"], ["T15:00", "T02:00"], ["T14:00", "T02:00"], ["T14:00", "T23:00"]] },
  pub: { label: "Pub", popularity: 0.5, lean: { folk: 0.5, rock: 0.6, americana: 0.4, indie_rock: 0.4, blues: 0.4 }, hours: [["T11:30", "T23:00"], ["T11:30", "T23:00"], ["T11:30", "T23:00"], ["T11:30", "T00:00"], ["T11:30", "T01:00"], ["T11:30", "T01:00"], ["T12:00", "T22:00"]] },
  nightclub: { label: "Nightclub", popularity: 0.5, lean: { electronic: 0.8, hip_hop: 0.6, rnb: 0.5, pop: 0.4 }, hours: [null, null, null, ["T21:00", "T03:00"], ["T21:00", "T05:00"], ["T21:00", "T05:00"], null] },
  theatre: { label: "Theatre", popularity: 0.72, lean: { singer_songwriter: 0.5, jazz: 0.5, soul: 0.35, folk: 0.3 }, hours: [null, ["T10:00", "T23:00"], ["T10:00", "T23:00"], ["T10:00", "T23:00"], ["T10:00", "T23:00"], ["T10:00", "T23:00"], ["T11:00", "T21:00"]] },
  arts_centre: { label: "Arts centre", popularity: 0.68, lean: { jazz: 0.5, folk: 0.4, singer_songwriter: 0.5, neo_soul: 0.3 }, hours: every("T09:00", "T22:00") },
  library: { label: "Library", popularity: 0.6, lean: { folk: 0.4, singer_songwriter: 0.4, indie_folk: 0.4 }, hours: [["T10:00", "T20:00"], ["T10:00", "T20:00"], ["T10:00", "T20:00"], ["T10:00", "T20:00"], ["T10:00", "T18:00"], ["T10:00", "T18:00"], ["T10:00", "T18:00"]] },
  market: { label: "Market", popularity: 0.85, lean: { folk: 0.6, acoustic: 0.5, americana: 0.4, indie_folk: 0.4 }, hours: [null, ["T06:00", "T14:00"], null, ["T06:00", "T14:00"], ["T06:00", "T17:00"], ["T06:00", "T15:00"], ["T09:00", "T16:00"]] },
  cinema: { label: "Cinema", popularity: 0.6, lean: { indie_rock: 0.3, pop: 0.4, indie_folk: 0.2 }, hours: every("T10:00", "T23:00") },
  record_store: { label: "Record store", popularity: 0.35, lean: { indie_rock: 0.6, soul: 0.6, jazz: 0.6, folk: 0.5, funk: 0.5 }, hours: [["T11:00", "T18:00"], ["T11:00", "T18:00"], ["T11:00", "T18:00"], ["T11:00", "T19:00"], ["T11:00", "T19:00"], ["T10:00", "T17:00"], ["T11:00", "T17:00"]] },
  music_store: { label: "Music store", popularity: 0.3, lean: { folk: 0.5, acoustic: 0.6, jazz: 0.4, blues: 0.4 }, hours: [["T10:00", "T17:30"], ["T10:00", "T17:30"], ["T10:00", "T17:30"], ["T10:00", "T17:30"], ["T10:00", "T17:30"], ["T10:00", "T16:00"], null] },
  bookstore: { label: "Bookshop", popularity: 0.38, lean: { folk: 0.6, singer_songwriter: 0.6, indie_folk: 0.5 }, hours: [["T09:00", "T18:00"], ["T09:00", "T18:00"], ["T09:00", "T18:00"], ["T09:00", "T19:00"], ["T09:00", "T20:00"], ["T10:00", "T18:00"], ["T10:00", "T17:00"]] },
  second_hand: { label: "Second-hand shop", popularity: 0.3, lean: { folk: 0.4, indie_rock: 0.4, americana: 0.3 }, hours: [["T10:00", "T17:00"], ["T10:00", "T17:00"], ["T10:00", "T17:00"], ["T10:00", "T17:00"], ["T10:00", "T17:00"], ["T10:00", "T17:00"], null] },
  museum: { label: "Museum", popularity: 0.75, lean: { indie_folk: 0.3, jazz: 0.3, singer_songwriter: 0.4 }, hours: every("T10:00", "T17:00") },
  gallery: { label: "Gallery", popularity: 0.5, lean: { indie_folk: 0.4, jazz: 0.3, singer_songwriter: 0.4, neo_soul: 0.2 }, hours: [null, null, ["T11:00", "T17:00"], ["T11:00", "T17:00"], ["T11:00", "T18:00"], ["T11:00", "T17:00"], ["T12:00", "T17:00"]] },
  station: { label: "Train station", popularity: 0.9, lean: { pop: 0.6, hip_hop: 0.3, rnb: 0.2 }, hours: every("T05:00", "T00:00") },
  cafe: { label: "Cafe", popularity: 0.42, lean: { acoustic: 0.5, indie_folk: 0.5, singer_songwriter: 0.3, jazz: 0.2 }, hours: [["T07:00", "T16:00"], ["T07:00", "T16:00"], ["T07:00", "T16:00"], ["T07:00", "T16:00"], ["T07:00", "T16:00"], ["T08:00", "T15:00"], ["T08:00", "T15:00"]] },
};

export type MockPlace = LatLon & {
  id: string;
  osmRef: string;
  name: string;
  category: string;
  categoryLabel: string;
  address: string | null;
  hours: WeekHours;
  hoursFromOsm: boolean;
  popularity: number;
  /** The crowd this place draws: its category plus its neighbourhood. */
  lean: GenreVector;
  geohash: string;
};

const r3 = (n: number) => Math.round(n * 1000) / 1000;

function syntheticHours(category: Category, key: string): WeekHours {
  const out: WeekHours = {};
  DAYS.forEach((day, i) => {
    const slot = category.hours[i];
    // A few places of each kind keep different days: deterministic per place.
    if (slot && unit(`closed:${key}:${day}`) > 0.08) out[day] = [{ opens: slot[0], closes: slot[1] }];
  });
  return out;
}

function build(): MockPlace[] {
  return OSM_PLACES.flatMap(([osmRef, name, category, lat, lon, address, hours]) => {
    const kind = CATEGORIES[category];
    if (!kind) return [];
    const at = { lat, lon };
    const popularity = r3(Math.min(0.99, kind.popularity * (0.6 + 0.4 * density(at)) + 0.25 * (unit(`pop:${osmRef}`) - 0.3)));
    return [
      {
        id: mockId("place", osmRef),
        osmRef,
        name,
        category,
        categoryLabel: kind.label,
        address,
        hours: (hours as WeekHours | null) ?? syntheticHours(kind, osmRef),
        hoursFromOsm: hours !== null,
        popularity: Math.max(0.05, popularity),
        lean: kind.lean,
        geohash: geohashEncode(at, 12),
        lat,
        lon,
      },
    ];
  });
}

export const MOCK_PLACES: MockPlace[] = build();

/**
 * Offline mode's second city (server/offline-city.ts): every Melbourne place moved onto its centre, with a synthetic name
 * ("Synthetic Bar 3") and no address, so nothing in that city borrows a Melbourne venue's name.
 */
function regionPlaces(): MockPlace[] {
  return OFFLINE_REGIONS.flatMap((region) => {
    const count = new Map<string, number>();
    return MOCK_PLACES.map((place) => {
      const n = (count.get(place.category) ?? 0) + 1;
      count.set(place.category, n);
      const at = fromMockFrame({ lat: place.lat, lon: place.lon }, region);
      const osmRef = `${region.id}:${place.osmRef}`;
      return { ...place, ...at, id: mockId("place", osmRef), osmRef, name: `Synthetic ${place.categoryLabel} ${n}`, address: null, geohash: geohashEncode(at, 12) };
    });
  });
}

export const REGION_PLACES: MockPlace[] = regionPlaces();
export const PLACE_BY_ID = new Map([...MOCK_PLACES, ...REGION_PLACES].map((p) => [p.id, p]));

/** How well a place's crowd fits a genre mix, 0–1: its neighbourhood and its kind. */
export function placeFit(place: MockPlace, mix: GenreVector): number {
  const total = Object.values(mix).reduce((s, w) => s + (w ?? 0), 0);
  if (total === 0) return 0;
  let lean = 0;
  for (const [g, w] of Object.entries(mix) as [Genre, number][]) lean += w * (place.lean[g] ?? 0);
  lean /= total * 0.6;
  return Math.min(1, 0.55 * tasteAt(mix, place) + 0.45 * Math.min(1, lean) + 0.1 * (unit(`fit:${place.osmRef}:${JSON.stringify(mixGenres([mix]))}`) - 0.5));
}

export function categoryTag(place: MockPlace) {
  return { id: `urn:tag:category:place:${place.category}`, name: place.categoryLabel, type: "urn:tag:category:place" };
}
