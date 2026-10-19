// SYNTHETIC FIXTURE (Qloo mock reference data, not Qloo data).
// A small, hand-written artist catalogue for the local Qloo mock. Artist names
// are real public names; the genre weights, popularity and every id are
// invented for testing. Entity ids are deterministic UUIDs whose first block
// is 4D4F434B ("MOCK" in hex), so they can never be mistaken for Qloo ids.

import { OFFLINE_TEST_ACTS } from "@/lib/repertoire-research";

/** Music genre tags, in Qloo's tag-id style. */
export const GENRES = {
  folk: "Folk",
  indie_folk: "Indie Folk",
  americana: "Americana",
  singer_songwriter: "Singer-Songwriter",
  acoustic: "Acoustic",
  indie_rock: "Indie Rock",
  rock: "Rock",
  pop: "Pop",
  soul: "Soul",
  funk: "Funk",
  neo_soul: "Neo Soul",
  jazz: "Jazz",
  rnb: "R&B",
  blues: "Blues",
  hip_hop: "Hip Hop",
  electronic: "Electronic",
} as const;

export type Genre = keyof typeof GENRES;

export const genreTagId = (genre: Genre) => `urn:tag:genre:music:${genre}`;

export type MockArtist = {
  name: string;
  /** Genre weights, 0–1. */
  genres: Partial<Record<Genre, number>>;
  /** Global popularity, 0–1. */
  popularity: number;
  /** Melbourne or Australian act: stronger in location-based results here. */
  local?: boolean;
  /** Extra names /search should match. */
  aka?: string[];
  /**
   * Live Qloo (checked 2026-10-16) leaves some well-known artists, Stevie
   * Wonder among them, out of location-signalled insights even when they are
   * asked for by id (`filter.results.entities` with `signal.location`). The
   * mock does the same for artists flagged here.
   */
  noLocalScore?: boolean;
};

const a = (name: string, popularity: number, genres: MockArtist["genres"], extra: Partial<MockArtist> = {}): MockArtist => ({
  name,
  popularity,
  genres,
  ...extra,
});

export const ARTISTS: MockArtist[] = [
  // Australian singer-songwriters and indie
  a("Paul Kelly", 0.86, { singer_songwriter: 1, folk: 0.6, rock: 0.4, acoustic: 0.5 }, { local: true }),
  a("Courtney Barnett", 0.84, { indie_rock: 1, singer_songwriter: 0.7, rock: 0.4 }, { local: true }),
  a("Vance Joy", 0.9, { pop: 0.8, indie_folk: 0.6, acoustic: 0.6, singer_songwriter: 0.4 }, { local: true }),
  a("Missy Higgins", 0.82, { singer_songwriter: 1, pop: 0.5, acoustic: 0.5 }, { local: true }),
  a("Julia Jacklin", 0.66, { indie_folk: 0.8, singer_songwriter: 0.8, indie_rock: 0.4 }, { local: true }),
  a("Gordi", 0.58, { indie_folk: 0.9, singer_songwriter: 0.6, electronic: 0.2 }, { local: true }),
  a("Alex Lahey", 0.6, { indie_rock: 1, pop: 0.3 }, { local: true }),
  a("Camp Cope", 0.55, { indie_rock: 1, singer_songwriter: 0.4 }, { local: true }),
  a("Rolling Blackouts Coastal Fever", 0.62, { indie_rock: 1, rock: 0.5 }, { local: true }),
  a("The Smith Street Band", 0.58, { indie_rock: 0.8, rock: 0.6, folk: 0.2 }, { local: true }),
  a("Gang of Youths", 0.74, { rock: 0.8, indie_rock: 0.6 }, { local: true }),
  a("Josh Pyke", 0.6, { singer_songwriter: 0.9, indie_folk: 0.6, acoustic: 0.6 }, { local: true }),
  a("Holly Throsby", 0.45, { singer_songwriter: 0.8, folk: 0.7, acoustic: 0.6 }, { local: true }),
  a("Archie Roach", 0.62, { folk: 0.8, singer_songwriter: 0.8, blues: 0.3 }, { local: true }),
  a("Kasey Chambers", 0.7, { americana: 1, folk: 0.6, singer_songwriter: 0.5 }, { local: true }),
  a("Fanny Lumsden", 0.45, { americana: 0.9, folk: 0.5 }, { local: true }),
  a("Tash Sultana", 0.8, { neo_soul: 0.5, rock: 0.4, electronic: 0.4, singer_songwriter: 0.4 }, { local: true }),
  a("Dope Lemon", 0.7, { indie_rock: 0.6, indie_folk: 0.5, soul: 0.2 }, { local: true }),
  a("Ruby Fields", 0.55, { indie_rock: 0.9, singer_songwriter: 0.4 }, { local: true }),
  a("Thelma Plum", 0.6, { pop: 0.6, singer_songwriter: 0.7, indie_folk: 0.3 }, { local: true }),
  a("Hollow Coves", 0.6, { indie_folk: 1, acoustic: 0.8 }, { local: true }),
  // Australian folk
  a("Angus & Julia Stone", 0.8, { indie_folk: 1, folk: 0.7, acoustic: 0.6 }, { local: true, aka: ["Angus and Julia Stone"] }),
  a("The Paper Kites", 0.72, { indie_folk: 1, folk: 0.6, acoustic: 0.7 }, { local: true }),
  a("Boy & Bear", 0.66, { indie_folk: 0.9, folk: 0.5, rock: 0.3 }, { local: true, aka: ["Boy and Bear"] }),
  a("The Waifs", 0.55, { folk: 1, americana: 0.6, acoustic: 0.6 }, { local: true }),
  a("John Butler Trio", 0.7, { folk: 0.6, blues: 0.6, acoustic: 0.7, funk: 0.2 }, { local: true, aka: ["John Butler"] }),
  a("Mama Kin Spender", 0.38, { folk: 0.9, blues: 0.4 }, { local: true }),
  a("All Our Exes Live in Texas", 0.42, { folk: 1, americana: 0.6, acoustic: 0.6 }, { local: true }),
  a("Weddings Parties Anything", 0.4, { folk: 0.8, rock: 0.6 }, { local: true }),
  a("The Teskey Brothers", 0.74, { soul: 1, blues: 0.7, rock: 0.3 }, { local: true }),
  // Melbourne soul, funk, jazz
  a("Hiatus Kaiyote", 0.72, { neo_soul: 1, jazz: 0.6, funk: 0.5, soul: 0.5 }, { local: true }),
  a("The Bamboos", 0.6, { funk: 1, soul: 0.9 }, { local: true }),
  a("Cookin' on 3 Burners", 0.52, { funk: 1, soul: 0.6, jazz: 0.3 }, { local: true, aka: ["Cookin on 3 Burners"] }),
  a("Kylie Auldist", 0.42, { soul: 1, funk: 0.7 }, { local: true }),
  a("Emma Donovan & The Putbacks", 0.4, { soul: 1, funk: 0.6 }, { local: true }),
  a("Allysha Joy", 0.36, { neo_soul: 1, jazz: 0.6 }, { local: true }),
  a("30/70", 0.36, { neo_soul: 0.9, jazz: 0.6, hip_hop: 0.3 }, { local: true }),
  a("Karate Boogaloo", 0.32, { funk: 1, soul: 0.5 }, { local: true }),
  a("The Cat Empire", 0.7, { funk: 0.7, jazz: 0.4, rock: 0.3 }, { local: true }),
  a("Sampa the Great", 0.62, { hip_hop: 1, neo_soul: 0.5 }, { local: true }),
  a("Remi", 0.45, { hip_hop: 0.9, neo_soul: 0.4, jazz: 0.2 }, { local: true }),
  a("Jordan Rakei", 0.6, { neo_soul: 1, jazz: 0.5, rnb: 0.5 }, { local: true }),
  a("Ngaiire", 0.48, { neo_soul: 0.8, rnb: 0.6, electronic: 0.3 }, { local: true }),
  a("Vika and Linda", 0.45, { soul: 0.8, blues: 0.6, folk: 0.3 }, { local: true, aka: ["Vika & Linda"] }),
  a("Tower of Power", 0.5, { funk: 1, soul: 0.7 }),
  // International soul, funk, jazz
  a("Stevie Wonder", 0.95, { soul: 1, funk: 0.8, rnb: 0.6, pop: 0.4 }, { noLocalScore: true }),
  a("Amy Winehouse", 0.93, { soul: 1, jazz: 0.6, rnb: 0.5 }),
  a("Kamasi Washington", 0.7, { jazz: 1, funk: 0.4, soul: 0.3 }),
  a("Erykah Badu", 0.8, { neo_soul: 1, rnb: 0.6, jazz: 0.3 }),
  a("D'Angelo", 0.78, { neo_soul: 1, soul: 0.6, funk: 0.4 }, { aka: ["DAngelo"] }),
  a("Anderson .Paak", 0.8, { funk: 0.8, rnb: 0.7, hip_hop: 0.5, soul: 0.4 }, { aka: ["Anderson Paak"] }),
  a("Bill Withers", 0.88, { soul: 1, singer_songwriter: 0.4, folk: 0.2 }),
  a("Marvin Gaye", 0.9, { soul: 1, rnb: 0.6, funk: 0.4 }),
  a("Aretha Franklin", 0.9, { soul: 1, rnb: 0.5 }),
  a("Otis Redding", 0.85, { soul: 1, blues: 0.4 }),
  a("Al Green", 0.82, { soul: 1, rnb: 0.4 }),
  a("Leon Bridges", 0.72, { soul: 1, rnb: 0.4 }),
  a("Michael Kiwanuka", 0.72, { soul: 0.9, folk: 0.4, rock: 0.3 }),
  a("Nina Simone", 0.85, { jazz: 0.9, soul: 0.8, blues: 0.5 }),
  a("Norah Jones", 0.8, { jazz: 0.8, singer_songwriter: 0.6, acoustic: 0.4 }),
  a("Khruangbin", 0.75, { funk: 0.7, soul: 0.4, rock: 0.4 }),
  a("Jamiroquai", 0.8, { funk: 1, pop: 0.4, soul: 0.4 }),
  a("Earth, Wind & Fire", 0.85, { funk: 1, soul: 0.8 }, { aka: ["Earth Wind & Fire", "Earth Wind and Fire"] }),
  a("Prince", 0.9, { funk: 1, pop: 0.6, rock: 0.4 }),
  a("Vulfpeck", 0.62, { funk: 1, soul: 0.4 }),
  a("Snarky Puppy", 0.6, { jazz: 1, funk: 0.7 }),
  a("Tom Misch", 0.68, { neo_soul: 0.8, jazz: 0.6, electronic: 0.3 }),
  a("Masego", 0.6, { neo_soul: 0.8, jazz: 0.6, rnb: 0.5 }),
  a("Thundercat", 0.66, { funk: 0.8, jazz: 0.7, neo_soul: 0.4 }),
  a("Robert Glasper", 0.6, { jazz: 1, neo_soul: 0.6, hip_hop: 0.3 }),
  a("Ezra Collective", 0.58, { jazz: 1, funk: 0.5 }),
  a("BADBADNOTGOOD", 0.62, { jazz: 0.9, hip_hop: 0.4, funk: 0.3 }),
  a("Sade", 0.85, { soul: 0.8, rnb: 0.7, jazz: 0.4 }),
  a("Lianne La Havas", 0.62, { neo_soul: 0.8, soul: 0.6, singer_songwriter: 0.4 }),
  a("Charles Bradley", 0.6, { soul: 1, funk: 0.5 }),
  a("Sharon Jones & The Dap-Kings", 0.6, { soul: 1, funk: 0.8 }, { aka: ["Sharon Jones"] }),
  a("Bruno Mars", 0.94, { pop: 0.9, funk: 0.6, rnb: 0.6 }),
  a("Lauryn Hill", 0.85, { neo_soul: 0.8, hip_hop: 0.7, rnb: 0.6 }, { aka: ["Ms. Lauryn Hill"] }),
  // International folk and singer-songwriters
  a("Simon & Garfunkel", 0.9, { folk: 1, singer_songwriter: 0.7, acoustic: 0.6 }, { aka: ["Simon and Garfunkel"] }),
  a("Mumford & Sons", 0.85, { indie_folk: 0.9, folk: 0.8, rock: 0.3 }, { aka: ["Mumford and Sons"] }),
  a("Bob Dylan", 0.92, { folk: 1, singer_songwriter: 0.9, rock: 0.4 }),
  a("Joni Mitchell", 0.85, { folk: 1, singer_songwriter: 0.9 }),
  a("The Lumineers", 0.82, { indie_folk: 1, folk: 0.6, americana: 0.4 }),
  a("Fleet Foxes", 0.7, { indie_folk: 1, folk: 0.7 }),
  a("Bon Iver", 0.78, { indie_folk: 1, singer_songwriter: 0.6, electronic: 0.2 }),
  a("Iron & Wine", 0.62, { indie_folk: 0.9, folk: 0.8, acoustic: 0.7 }, { aka: ["Iron and Wine"] }),
  a("Lord Huron", 0.68, { indie_folk: 0.9, americana: 0.5 }),
  a("First Aid Kit", 0.65, { folk: 0.9, americana: 0.7, indie_folk: 0.5 }),
  a("Gillian Welch", 0.55, { americana: 1, folk: 0.8 }),
  a("Phoebe Bridgers", 0.8, { indie_folk: 0.7, singer_songwriter: 0.9, indie_rock: 0.5 }),
  a("Sufjan Stevens", 0.72, { indie_folk: 0.9, singer_songwriter: 0.6 }),
  a("Nick Drake", 0.66, { folk: 1, singer_songwriter: 0.7, acoustic: 0.8 }),
  a("Cat Stevens", 0.8, { folk: 0.9, singer_songwriter: 0.8 }, { aka: ["Yusuf / Cat Stevens", "Yusuf"] }),
  a("Joan Baez", 0.62, { folk: 1, singer_songwriter: 0.6 }),
  a("James Taylor", 0.75, { singer_songwriter: 1, folk: 0.6, acoustic: 0.6 }),
  a("Tracy Chapman", 0.8, { singer_songwriter: 1, folk: 0.7, acoustic: 0.6 }),
  a("Jeff Buckley", 0.75, { singer_songwriter: 0.9, rock: 0.5 }),
  a("Elliott Smith", 0.66, { singer_songwriter: 1, indie_folk: 0.6, acoustic: 0.6 }),
  a("Damien Rice", 0.66, { singer_songwriter: 0.9, indie_folk: 0.6, acoustic: 0.7 }),
  a("Glen Hansard", 0.55, { singer_songwriter: 0.9, folk: 0.6 }),
  a("José González", 0.6, { indie_folk: 0.9, acoustic: 0.9 }, { aka: ["Jose Gonzalez"] }),
  a("Ben Howard", 0.68, { indie_folk: 0.9, acoustic: 0.7, singer_songwriter: 0.5 }),
  a("Passenger", 0.75, { indie_folk: 0.7, acoustic: 0.8, singer_songwriter: 0.7, pop: 0.3 }),
  a("Hozier", 0.86, { indie_folk: 0.6, soul: 0.5, rock: 0.4, singer_songwriter: 0.5 }),
  a("Jack Johnson", 0.8, { acoustic: 1, singer_songwriter: 0.6, pop: 0.3 }),
  a("John Mayer", 0.82, { singer_songwriter: 0.7, blues: 0.5, pop: 0.5 }),
  a("Fleetwood Mac", 0.92, { rock: 0.9, pop: 0.5, singer_songwriter: 0.3 }),
  a("Noah Kahan", 0.8, { indie_folk: 0.8, americana: 0.4, pop: 0.4 }),
  a("Zach Bryan", 0.82, { americana: 1, folk: 0.5 }),
  a("Mitski", 0.78, { indie_rock: 0.8, singer_songwriter: 0.7 }),
  // Pop and rock (the obvious crowd-pleasers)
  a("Ed Sheeran", 0.96, { pop: 1, acoustic: 0.6, singer_songwriter: 0.4 }),
  a("Taylor Swift", 0.98, { pop: 1, singer_songwriter: 0.5, americana: 0.2 }),
  a("Billie Eilish", 0.94, { pop: 1, electronic: 0.4 }),
  a("Harry Styles", 0.93, { pop: 1, rock: 0.3 }),
  a("Dua Lipa", 0.93, { pop: 1, electronic: 0.5 }),
  a("Olivia Rodrigo", 0.9, { pop: 1, indie_rock: 0.3 }),
  a("Adele", 0.94, { pop: 0.9, soul: 0.5 }),
  a("Lewis Capaldi", 0.86, { pop: 1, singer_songwriter: 0.4 }),
  a("George Ezra", 0.8, { pop: 0.9, indie_folk: 0.3 }),
  a("Coldplay", 0.94, { pop: 0.8, rock: 0.6 }),
  a("Oasis", 0.9, { rock: 1, indie_rock: 0.5 }),
  a("The Beatles", 0.97, { rock: 1, pop: 0.8 }),
  a("Radiohead", 0.88, { rock: 0.8, indie_rock: 0.6, electronic: 0.3 }),
  a("Arctic Monkeys", 0.9, { indie_rock: 1, rock: 0.6 }),
  a("The Strokes", 0.8, { indie_rock: 1, rock: 0.5 }),
  a("Tame Impala", 0.86, { indie_rock: 0.7, electronic: 0.5, rock: 0.4 }, { local: true }),
  a("King Gizzard & The Lizard Wizard", 0.72, { rock: 0.9, indie_rock: 0.6 }, { local: true, aka: ["King Gizzard"] }),
  a("Vampire Weekend", 0.78, { indie_rock: 1, pop: 0.4 }),
  a("Fred again..", 0.82, { electronic: 1, pop: 0.3 }, { aka: ["Fred again"] }),
  a("Flume", 0.76, { electronic: 1 }, { local: true }),
  a("Kendrick Lamar", 0.95, { hip_hop: 1, rnb: 0.3 }),
  a("SZA", 0.9, { rnb: 1, neo_soul: 0.4, pop: 0.4 }),
];

/** FNV-1a 32-bit. */
export function fnv1a(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic 0–1 value for a key. */
export function unit(key: string): number {
  let t = fnv1a(key) + 0x6d2b79f5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const hex = (n: number, width: number) => (n >>> 0).toString(16).toUpperCase().padStart(8, "0").slice(-width);

/** Deterministic mock entity id: a UUID-shaped string starting with 4D4F434B ("MOCK"). */
export function mockId(kind: string, key: string): string {
  const k = `${kind}:${key.toLowerCase()}`;
  return `4D4F434B-${hex(fnv1a(`a${k}`), 4)}-${hex(fnv1a(`b${k}`), 4)}-${hex(fnv1a(`c${k}`), 4)}-${hex(fnv1a(`d${k}`), 8)}${hex(fnv1a(`e${k}`), 4)}`;
}

export const isMockId = (id: string) => /^4D4F434B-/i.test(id);

export const normalizeName = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/^the /, "");

export type CatalogArtist = MockArtist & { id: string; spotifyId: string };

/** Deterministic, Spotify-shaped (22 base62 chars) mock id for an artist name. */
export function mockSpotifyId(name: string): string {
  const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  let out = "";
  for (let i = 0; i < 22; i++) out += alphabet[fnv1a(`spotify:${i}:${normalizeName(name)}`) % 62];
  return out;
}

export const CATALOG: CatalogArtist[] = ARTISTS.map((artist) => ({
  ...artist,
  id: mockId("artist", artist.name),
  spotifyId: mockSpotifyId(artist.name),
}));

/**
 * Test acts for Repertoire research's matching paths (lib/repertoire-research.ts: OFFLINE_TEST_ACTS). They are NOT in CATALOG, so
 * no ranking, insight or count changes: only /search finds them (by the queries listed, exact after normalising) and an id lookup
 * resolves them. None carries the Spotify id of the matching test act, so the Spotify-id lookup never finds them: the matcher has
 * to work from names.
 */
export type ScenarioArtist = CatalogArtist & { searchOn: string[] };
const scenario = (name: string, popularity: number, genres: MockArtist["genres"], searchOn: string[]): ScenarioArtist => ({
  name,
  popularity,
  genres,
  id: mockId("artist", name),
  spotifyId: mockSpotifyId(name),
  searchOn: searchOn.map(normalizeName),
});
export const SCENARIO_ARTISTS: ScenarioArtist[] = [
  scenario(OFFLINE_TEST_ACTS.variant.qlooName, 0.41, { indie_folk: 0.9, singer_songwriter: 0.5 }, [OFFLINE_TEST_ACTS.variant.qlooName]),
  scenario(OFFLINE_TEST_ACTS.candidates.qlooNames[0], 0.52, { rock: 0.7, pop: 0.4 }, [OFFLINE_TEST_ACTS.candidates.name, OFFLINE_TEST_ACTS.candidates.qlooNames[0]]),
  scenario(OFFLINE_TEST_ACTS.candidates.qlooNames[1], 0.34, { folk: 0.6, acoustic: 0.4 }, [OFFLINE_TEST_ACTS.candidates.name, OFFLINE_TEST_ACTS.candidates.qlooNames[1]]),
];

export const ARTIST_BY_ID = new Map([...CATALOG, ...SCENARIO_ARTISTS].map((artist) => [artist.id, artist]));

/**
 * Profile for a mock artist id, or null for an id the catalogue doesn't hold.
 * Like real Qloo, the mock knows nothing about artists outside its graph.
 */
export function artistById(id: string): CatalogArtist | null {
  if (!isMockId(id)) return null;
  return ARTIST_BY_ID.get(id.toUpperCase()) ?? null;
}
