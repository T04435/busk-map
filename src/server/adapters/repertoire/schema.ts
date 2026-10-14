import { z } from "zod";

/** Spotify Web API with app (client credentials) access: search, artist albums, album tracks. */

export const tokenSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive(),
});

const artistRef = z.object({ id: z.string(), name: z.string() });

const trackItem = z.object({
  id: z.string(),
  name: z.string(),
  artists: z.array(artistRef).min(1),
  external_urls: z.object({ spotify: z.url() }).partial().optional(),
  album: z.object({ name: z.string() }).optional(),
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
            external_urls: z.object({ spotify: z.url() }).partial().optional(),
          })
          .nullable(),
      ),
    })
    .optional(),
});

export const albumsSchema = z.object({
  items: z.array(z.object({ id: z.string(), name: z.string(), album_type: z.string(), release_date: z.string().optional() })),
  next: z.string().nullable(),
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
  url: string | null;
};

export type CatalogueArtist = { id: string; name: string; url: string | null };
