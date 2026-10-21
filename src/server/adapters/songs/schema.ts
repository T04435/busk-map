import { z } from "zod";

/** Last.fm artist.getTopTracks. Errors come back as HTTP 200 with an `error` code. */

const count = z.union([z.string(), z.number()]).transform((v) => Number(v)).pipe(z.number().nonnegative());

export const topTracksSchema = z.union([
  z.object({
    toptracks: z.object({
      // Last.fm returns a bare object instead of an array when there is one track.
      track: z.union([z.array(z.unknown()), z.unknown().transform((t) => [t])]),
    }),
  }),
  z.object({ error: z.number(), message: z.string() }),
]);

export const trackSchema = z.object({
  name: z.string().min(1),
  playcount: count,
  listeners: count,
  url: z.url().optional(),
  artist: z.object({ name: z.string() }),
});

/** Last.fm artist.getInfo, read only for the listener count. */
export const artistInfoSchema = z.union([
  z.object({ artist: z.object({ name: z.string(), stats: z.object({ listeners: count }) }) }),
  z.object({ error: z.number(), message: z.string() }),
]);

/** Last.fm listeners keyed by the artist name we asked for; null when Last.fm doesn't know the artist. */
export type ListenersData = Record<string, number | null>;

export type TopTrack = {
  title: string;
  artist: string;
  playcount: number;
  listeners: number;
  url: string | null;
};

/** Top tracks keyed by the artist name we asked for. */
export type SongsData = Record<string, TopTrack[]>;

/** Last.fm artist.getSimilar: the artists listeners of this one also play, best first. Errors come back as HTTP 200 with an `error` code. */
export const similarSchema = z.union([
  z.object({
    similarartists: z.object({
      // Last.fm returns a bare object instead of an array when there is one artist.
      artist: z.union([z.array(z.unknown()), z.unknown().transform((t) => [t])]).default([]),
    }),
  }),
  z.object({ error: z.number(), message: z.string() }),
]);

export const similarArtistSchema = z.object({ name: z.string().min(1), match: count.optional() });

export type SimilarArtist = { name: string; match: number };

/** Last.fm artist.getTopTags: the tags listeners gave this artist, most used first. Names are noisy ("seen live", places, years). */
export const topTagsSchema = z.union([
  z.object({
    toptags: z.object({
      // Last.fm returns a bare object instead of an array when there is one tag.
      tag: z.union([z.array(z.unknown()), z.unknown().transform((t) => [t])]).default([]),
    }),
  }),
  z.object({ error: z.number(), message: z.string() }),
]);

export const topTagSchema = z.object({ name: z.string().min(1), count: count.optional() });

export type TopTag = { name: string; count: number };
