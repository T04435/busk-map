import { z } from "zod";

/**
 * Spotify Web API with app (client credentials) access: search, artist albums, album tracks.
 * Apps created after the 2024–2026 Web API changes get no followers, popularity or
 * preview_url, so nothing here reads them.
 */

export const tokenSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive(),
});

const artistRef = z.object({ id: z.string(), name: z.string() });

/** Spotify sends images largest first; width and height can be null. */
export const imageSchema = z.object({ url: z.url(), width: z.number().nullable().optional(), height: z.number().nullable().optional() });
const images = z.array(imageSchema).optional();

const trackItem = z.object({
  id: z.string(),
  name: z.string(),
  artists: z.array(artistRef).min(1),
  duration_ms: z.number().int().nonnegative().optional(),
  external_urls: z.object({ spotify: z.url() }).partial().optional(),
  album: z.object({ name: z.string(), images, release_date: z.string().optional() }).optional(),
});

export const searchSchema = z.object({
  tracks: z.object({ items: z.array(trackItem.nullable()) }).optional(),
  artists: z
    .object({
      items: z.array(
        z
          .object({
            id: z.string(),
            name: z.string(),
            images,
            external_urls: z.object({ spotify: z.url() }).partial().optional(),
          })
          .nullable(),
      ),
    })
    .optional(),
});

export const albumsSchema = z.object({
  items: z.array(z.object({ id: z.string(), name: z.string(), album_type: z.string(), release_date: z.string().optional(), images })),
  next: z.string().nullable(),
});

/** One page of an artist's albums, read only for `total` (the release count). */
export const albumsTotalSchema = z.object({ total: z.number().int().nonnegative() });

/** GET /artists/{id}: the profile header (name, photo, genres). `followers` is absent for apps created after the 2024 API changes. */
export const artistSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  images,
  genres: z.array(z.string()).optional(),
  followers: z.object({ total: z.number().int().nonnegative() }).partial().optional(),
});

export const albumTracksSchema = z.object({
  items: z.array(trackItem.omit({ album: true })),
});

export type CatalogueTrack = {
  /** Spotify track id. */
  id: string;
  title: string;
  artists: { id: string; name: string }[];
  album: string | null;
  /** Album cover, about 64 px when Spotify has that size. */
  image: string | null;
  durationMs: number | null;
  url: string | null;
  /** The album's release year ("1972" from "1972-10-24", "1972" or "1972-10"), when known. */
  year: number | null;
};

/** Year from a Spotify release_date (YYYY, YYYY-MM or YYYY-MM-DD). */
export function releaseYear(date: string | undefined): number | null {
  const match = /^(\d{4})/.exec(date ?? "");
  const year = match ? Number(match[1]) : null;
  return year !== null && year >= 1900 && year <= 2100 ? year : null;
}

export type CatalogueArtist = {
  /** Spotify artist id. */
  id: string;
  name: string;
  /** Artist photo, about 64 px when Spotify has that size. */
  image: string | null;
  /** Albums and singles on Spotify, when known. */
  releases: number | null;
  url: string | null;
};

/** The smallest image at least `minWidth` wide (Spotify lists largest first), else the largest. */
export function pickImage(list: z.infer<typeof imageSchema>[] | undefined, minWidth = 64): string | null {
  if (!list?.length) return null;
  const wide = list.filter((i) => (i.width ?? 0) >= minWidth).sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
  return (wide[0] ?? list[0]).url;
}

/** What the profile header needs from Spotify's artist (before the snapshot's fetchedAt is added). */
export type ArtistProfileRaw = {
  name: string;
  images: { url: string; width?: number | null; height?: number | null }[];
  genres: string[];
  followers?: number;
};
