// SYNTHETIC FIXTURE: invented catalogue for tests and offline mode. Not Spotify data.
import { CATALOG, normalizeName } from "@/server/qloo-mock/catalog";
import type { CatalogueArtist, CatalogueTrack } from "../schema";

export function syntheticTrackSearch(query: string): CatalogueTrack[] {
  return [1, 2, 3].map((n) => ({
    id: `syn-track-${n}`,
    title: `${query} (synthetic result ${n})`,
    artists: [{ id: `syn-artist-${n}`, name: `Synthetic Artist ${n}` }],
    album: "Synthetic Album",
    image: null,
    durationMs: 150_000 + n * 37_000,
    url: null,
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
  if (matches.length === 0) return [{ id: "syn-artist-1", name: `${query} (synthetic)`, image: null, releases: null, url: null }];
  return matches.map((a) => ({ id: a.spotifyId, name: a.name, image: null, releases: null, url: null }));
}

/** Invented release count, stable per id. */
export function syntheticReleaseCount(id: string): number {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return 3 + (hash % 40);
}

export function syntheticCatalogue(artistId: string): CatalogueTrack[] {
  return [1, 2, 3, 4].map((n) => ({
    id: `syn-own-${n}`,
    title: `Synthetic original ${n}`,
    artists: [{ id: artistId, name: "Synthetic Performer" }],
    album: "Synthetic EP",
    image: null,
    durationMs: 200_000 + n * 11_000,
    url: null,
  }));
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
