// SYNTHETIC FIXTURE: invented catalogue for tests and offline mode. Not Spotify data.
import { OFFLINE_TEST_ACTS } from "@/lib/repertoire-research";
import { CATALOG, GENRES, normalizeName } from "@/server/qloo-mock/catalog";
import type { ArtistProfileRaw, CatalogueArtist, CatalogueTrack } from "../schema";

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** A made-up Spotify-shaped id (22 base-62 characters), stable per seed, so offline picks pass spotifyIdSchema. */
export function syntheticSpotifyId(seed: string): string {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  let id = "";
  for (let i = 0; i < 22; i++) {
    // xorshift32 over the seed's FNV-1a hash.
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    h >>>= 0;
    id += BASE62[h % 62];
  }
  return id;
}

export function syntheticTrackSearch(query: string): CatalogueTrack[] {
  return [1, 2, 3].map((n) => ({
    id: `syn-track-${n}`,
    title: `${query} (synthetic result ${n})`,
    artists: [{ id: syntheticSpotifyId(`Synthetic Artist ${n}`), name: `Synthetic Artist ${n}` }],
    album: "Synthetic Album",
    image: null,
    durationMs: 150_000 + n * 37_000,
    url: null,
    year: 2000 + n,
  }));
}

/**
 * A scoped search ("track:… artist:…"): one made-up version of the song by that
 * artist, with the mock's Spotify-shaped id when the artist is in its catalogue.
 */
export function syntheticScopedTrackSearch(query: string, artist: string): CatalogueTrack[] {
  const known = CATALOG.find((a) => normalizeName(a.name) === normalizeName(artist));
  const slug = normalizeName(`${artist} ${query}`).replace(/\s+/g, "-");
  return [
    {
      id: `syn-scoped-${slug}`,
      title: query,
      artists: [{ id: known?.spotifyId ?? syntheticSpotifyId(normalizeName(artist)), name: known?.name ?? artist }],
      album: "Synthetic Album",
      image: null,
      durationMs: 200_000,
      url: null,
      year: 1990,
    },
  ];
}

/**
 * An artist's songs: six made-up tracks with Spotify-shaped ids (stable per artist), so offline learn runs have
 * songs to filter against the history and a second run still finds new ones. Titles say they are synthetic.
 */
export function syntheticArtistTracks(artist: string): CatalogueTrack[] {
  const known = CATALOG.find((a) => normalizeName(a.name) === normalizeName(artist));
  const artistId = known?.spotifyId ?? syntheticSpotifyId(normalizeName(artist));
  return [1, 2, 3, 4, 5, 6].map((n) => ({
    id: syntheticSpotifyId(`${normalizeName(artist)}|track|${n}`),
    title: `Synthetic track ${n}`,
    artists: [{ id: artistId, name: known?.name ?? artist }],
    album: "Synthetic Album",
    image: null,
    durationMs: 170_000 + n * 11_000,
    url: null,
    year: 1985 + n * 4,
  }));
}

/**
 * Artists from the Qloo mock's catalogue whose name contains the query, with the
 * mock's Spotify-shaped ids, so offline plans resolve them through Qloo's
 * external-id lookup like live ones. Unknown queries get one made-up artist.
 */
export function syntheticArtistSearch(query: string): CatalogueArtist[] {
  const q = normalizeName(query);
  const matches = q ? CATALOG.filter((a) => normalizeName(a.name).includes(q)).slice(0, 10) : [];
  if (matches.length === 0) return [{ id: syntheticSpotifyId(`${q} (synthetic)`), name: `${query} (synthetic)`, image: null, releases: null, url: null }];
  return matches.map((a) => ({ id: a.spotifyId, name: a.name, image: null, releases: null, url: null }));
}

/** Invented release count, stable per id. */
export function syntheticReleaseCount(id: string): number {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return 3 + (hash % 40);
}

/**
 * The performer's own songs. An artist in the Qloo mock's catalogue (the offline research artist) gets its own name and
 * Spotify-shaped ids, so the research run's own-song rows look real; any other id keeps "Synthetic Performer".
 */
export function syntheticCatalogue(artistId: string): CatalogueTrack[] {
  const known = CATALOG.find((a) => a.spotifyId === artistId);
  return [1, 2, 3, 4].map((n) => ({
    id: known ? syntheticSpotifyId(`${known.spotifyId}|own|${n}`) : `syn-own-${n}`,
    title: `Synthetic original ${n}`,
    artists: [{ id: artistId, name: known?.name ?? "Synthetic Performer" }],
    album: "Synthetic EP",
    image: null,
    durationMs: 200_000 + n * 11_000,
    url: null,
    year: 2020 + n,
  }));
}

/** Invented first-release year, stable per song: 1965–2024. */
export function syntheticReleaseYear(title: string, artist: string): number {
  let hash = 0;
  for (const ch of `${artist}|${title}`.toLowerCase()) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return 1965 + (hash % 60);
}

export const SYNTHETIC_RAW = {
  token: { access_token: "synthetic-token", token_type: "Bearer", expires_in: 3600 },
  search: {
    tracks: {
      items: [
        {
          id: "t1",
          name: "Synthetic Track",
          artists: [{ id: "a1", name: "Synthetic Artist" }],
          duration_ms: 215_000,
          album: {
            name: "Synthetic Album",
            release_date: "1999-05-01",
            images: [
              { url: "https://i.scdn.co/image/syn-640", width: 640, height: 640 },
              { url: "https://i.scdn.co/image/syn-300", width: 300, height: 300 },
              { url: "https://i.scdn.co/image/syn-64", width: 64, height: 64 },
            ],
          },
          external_urls: { spotify: "https://open.spotify.com/track/t1" },
        },
        null,
      ],
    },
    artists: {
      items: [
        {
          id: "a1",
          name: "Synthetic Artist",
          images: [{ url: "https://i.scdn.co/image/syn-artist-320", width: 320, height: 320 }, { url: "https://i.scdn.co/image/syn-artist-160", width: 160, height: 160 }],
          external_urls: { spotify: "https://open.spotify.com/artist/a1" },
        },
        { id: "a2", name: "Synthetic Two", images: [] },
        null,
      ],
    },
  },
  albumsTotal: { a1: { href: "https://api.spotify.com/v1/artists/a1/albums", items: [], limit: 1, next: null, offset: 0, total: 27 } },
  albumsPage1: {
    items: [
      { id: "al1", name: "Synthetic LP", album_type: "album", images: [{ url: "https://i.scdn.co/image/syn-lp", width: null, height: null }] },
      { id: "al2", name: "Synthetic Single", album_type: "single" },
    ],
    next: "https://api.spotify.com/v1/artists/a1/albums?offset=10&limit=10",
  },
  albumsPage2: { items: [{ id: "al3", name: "Synthetic LP (Deluxe)", album_type: "album" }], next: null },
  tracks: {
    al1: { items: [{ id: "x1", name: "Synthetic Original", duration_ms: 181_000, artists: [{ id: "a1", name: "Synthetic Artist" }] }, { id: "x2", name: "Second Song", artists: [{ id: "a1", name: "Synthetic Artist" }] }] },
    al2: { items: [{ id: "x3", name: "Synthetic Original - Radio Edit", artists: [{ id: "a1", name: "Synthetic Artist" }] }] },
    al3: { items: [{ id: "x4", name: "Second Song (Remastered 2026)", artists: [{ id: "a1", name: "Synthetic Artist" }] }, { id: "x5", name: "Third Song", artists: [{ id: "a1", name: "Synthetic Artist" }] }] },
  },
};

/**
 * A made-up artist profile for offline mode. An artist in the Qloo mock's catalogue keeps its name and genres (so the
 * mock also knows it and offers "sounds like" suggestions); any other id is "Synthetic Performer". No photo, so the
 * hex mark with initials shows.
 */
export function syntheticArtistProfile(artistId: string): ArtistProfileRaw {
  // The Repertoire research test acts (lib/repertoire-research.ts): a name and genres Qloo's mock knows only through name variants.
  const act = Object.values(OFFLINE_TEST_ACTS).find((t) => t.spotifyId === artistId);
  if (act) return { name: act.name, images: [], genres: [...act.genres], followers: 1_200 };
  const known = CATALOG.find((a) => a.spotifyId === artistId);
  if (!known) return { name: "Synthetic Performer", images: [], genres: ["synthetic folk", "test data"] };
  const genres = Object.entries(known.genres)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .slice(0, 3)
    .map(([key]) => GENRES[key as keyof typeof GENRES].toLowerCase());
  return { name: known.name, images: [], genres, followers: Math.round(known.popularity * 50_000) };
}
