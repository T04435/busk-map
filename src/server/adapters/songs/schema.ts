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

export type TopTrack = {
  title: string;
  artist: string;
  playcount: number;
  listeners: number;
  url: string | null;
};

/** Top tracks keyed by the artist name we asked for. */
export type SongsData = Record<string, TopTrack[]>;
