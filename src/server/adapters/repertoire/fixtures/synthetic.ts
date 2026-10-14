// SYNTHETIC FIXTURE: invented catalogue for tests and offline mode. Not Spotify data.
import type { CatalogueArtist, CatalogueTrack } from "../schema";

export function syntheticTrackSearch(query: string): CatalogueTrack[] {
  return [1, 2, 3].map((n) => ({
    id: `syn-track-${n}`,
    title: `${query} (synthetic result ${n})`,
    artists: [{ id: `syn-artist-${n}`, name: `Synthetic Artist ${n}` }],
    album: "Synthetic Album",
    url: null,
  }));
}

export function syntheticArtistSearch(query: string): CatalogueArtist[] {
  return [{ id: "syn-artist-1", name: `${query} (synthetic)`, url: null }];
}

export function syntheticCatalogue(artistId: string): CatalogueTrack[] {
  return [1, 2, 3, 4].map((n) => ({
    id: `syn-own-${n}`,
    title: `Synthetic original ${n}`,
    artists: [{ id: artistId, name: "Synthetic Performer" }],
    album: "Synthetic EP",
    url: null,
  }));
}

export const SYNTHETIC_RAW = {
  token: { access_token: "synthetic-token", token_type: "Bearer", expires_in: 3600 },
  search: {
    tracks: {
      items: [
        { id: "t1", name: "Synthetic Track", artists: [{ id: "a1", name: "Synthetic Artist" }], album: { name: "Synthetic Album" }, external_urls: { spotify: "https://open.spotify.com/track/t1" } },
        null,
      ],
    },
    artists: { items: [{ id: "a1", name: "Synthetic Artist", external_urls: { spotify: "https://open.spotify.com/artist/a1" } }, null] },
  },
  albumsPage1: {
    items: [
      { id: "al1", name: "Synthetic LP", album_type: "album" },
      { id: "al2", name: "Synthetic Single", album_type: "single" },
    ],
    next: "https://api.spotify.com/v1/artists/a1/albums?offset=10&limit=10",
  },
  albumsPage2: { items: [{ id: "al3", name: "Synthetic LP (Deluxe)", album_type: "album" }], next: null },
  tracks: {
    al1: { items: [{ id: "x1", name: "Synthetic Original", artists: [{ id: "a1", name: "Synthetic Artist" }] }, { id: "x2", name: "Second Song", artists: [{ id: "a1", name: "Synthetic Artist" }] }] },
    al2: { items: [{ id: "x3", name: "Synthetic Original - Radio Edit", artists: [{ id: "a1", name: "Synthetic Artist" }] }] },
    al3: { items: [{ id: "x4", name: "Second Song (Remastered 2026)", artists: [{ id: "a1", name: "Synthetic Artist" }] }, { id: "x5", name: "Third Song", artists: [{ id: "a1", name: "Synthetic Artist" }] }] },
  },
};
