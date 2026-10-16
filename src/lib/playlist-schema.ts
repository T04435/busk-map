/** Client-safe schemas and wire types for the Repertoire (docs/playlist-architecture.md §1.2, §3.6). */
import { z } from "zod";
import { nameKey, songKey } from "./text";
import { spotifyIdSchema } from "./plan-schema";

export const SONG_STATES = ["can_sing", "learned"] as const;
export type SongState = (typeof SONG_STATES)[number];
export const SONG_SOURCES = ["spotify", "lastfm", "typed", "suggested"] as const;
export type SongSource = (typeof SONG_SOURCES)[number];

/** Single-line text: control characters become spaces, runs of space collapse, then trimmed and bounded. */
const line = (max: number) =>
  z
    .string()
    .transform((s) => s.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim())
    .pipe(z.string().min(1).max(max));

/** A song to add. It always starts as "can sing"; `suggested` rows are made by the server only. */
export const addSongSchema = z.object({
  title: line(120),
  artist: line(80),
  own: z.boolean().default(false),
  source: z.enum(["spotify", "lastfm", "typed"]).default("typed"),
  spotifyTrackId: spotifyIdSchema.optional(),
  year: z.number().int().min(1900).max(2100).optional(),
  durationMs: z.number().int().positive().max(3_600_000).optional(),
});
export type AddSongInput = z.infer<typeof addSongSchema>;

export const songStateSchema = z.object({ state: z.enum(SONG_STATES) });

export const soundsLikeSchema = z.array(z.object({ name: line(80), spotifyId: spotifyIdSchema.optional(), qlooId: z.string().max(80).optional() })).max(10);
export const usualPitchesSchema = z.array(z.object({ name: line(80), lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) })).max(3);

/**
 * PATCH /api/playlist: needs the revision the client last saw. `songs` is the whole set of songs you can sing
 * after the edit (the busk form's "Save these changes"): songs missing from it are removed, new ones added, and
 * a song already there keeps its row.
 */
export const patchPlaylistSchema = z
  .object({
    revision: z.number().int().min(1),
    actName: line(80).nullable().optional(),
    soundsLike: soundsLikeSchema.optional(),
    usualPitches: usualPitchesSchema.optional(),
    songs: z.array(addSongSchema).max(60).optional(),
  })
  .refine((v) => v.actName !== undefined || v.soundsLike !== undefined || v.usualPitches !== undefined || v.songs !== undefined, { message: "Nothing to change." });

/** POST /api/playlist may seed a new Repertoire ("Save these songs as your Repertoire"); an existing one is returned as it is. */
export const createPlaylistSchema = z.object({
  actName: line(80).nullable().optional(),
  soundsLike: soundsLikeSchema.optional(),
  songs: z.array(addSongSchema).max(60).optional(),
});
export type CreatePlaylistInput = z.infer<typeof createPlaylistSchema>;

/** Text cut to a bound instead of refused: a plan's reason line can be longer than the column. */
const clipped = (max: number) =>
  z
    .string()
    .transform((s) => s.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim())
    .transform((s) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s))
    .pipe(z.string().min(1));

/** POST /api/playlist/learn/suggestions: "Add to Repertoire" on a plan's Songs to learn (docs §3.3). */
export const addPlanSuggestionSchema = z.object({
  title: line(120),
  artist: line(80),
  reason: clipped(240),
  growth: z.number().finite().nullable().optional(),
});
export type AddPlanSuggestionInput = z.infer<typeof addPlanSuggestionSchema>;
export type PatchPlaylistInput = z.infer<typeof patchPlaylistSchema>;

export type SoundsLike = z.infer<typeof soundsLikeSchema>[number];
export type UsualPitch = z.infer<typeof usualPitchesSchema>[number];

/** A song as the API returns it. The id is a string; it is not the song key. */
export type PlaylistSongView = {
  id: string;
  title: string;
  artist: string;
  own: boolean;
  state: SongState;
  source: SongSource;
  spotifyTrackId: string | null;
  year: number | null;
  durationMs: number | null;
  addedAt: string;
};

/** A suggestion as the Learn list returns it (docs §7.3). Plan suggestions have no run, rank, year, art or link. */
export type LearnSuggestionView = {
  id: string;
  runId: string | null;
  runNumber: number | null;
  rank: number | null;
  title: string;
  artist: string;
  year: number | null;
  durationMs: number | null;
  image: string | null;
  songSource: "spotify" | "lastfm" | "plan";
  sourceUrl: string | null;
  reason: string;
  /** Plain words from Qloo explainability, or null. */
  because: string | null;
  basedOn: { kind: "learned" | "repertoire" | "crowd" | "soundsLike"; name: string }[];
  growth: number | null;
  /** Percentile points gained over the trending window (see learn-schema.ts). */
  trendDelta: number | null;
  isNew: boolean;
  status: "pending" | "learned" | "dismissed";
  suggestedAt: string;
  learnedAt: string | null;
  dismissedAt: string | null;
};

export type PlaylistView = {
  revision: number;
  actName: string | null;
  soundsLike: SoundsLike[];
  usualPitches: UsualPitch[];
  city: string;
  songs: PlaylistSongView[];
  maxSongs: number;
};

/** The error body: `{ error: { code, message } }` (the plan route's shape). */
export type PlaylistErrorBody = { error: { code: string; message: string } };

/**
 * The dedupe key of a song: the same as lib/text.ts:trackKey (artist and title, case, punctuation and "Remastered"-style
 * suffixes ignored). A part that normalises to nothing (a title of "!!!") falls back to its lowercase text,
 * so two such songs don't collapse into one.
 */
export function playlistSongKey(artist: string, title: string): string {
  const a = nameKey(artist) || artist.trim().toLowerCase();
  const t = songKey(title) || title.trim().toLowerCase();
  return `${a}|${t}`;
}

/** "Title - Artist" (and an optional trailing "(own)") from the typed box, as the landing form reads it. */
export function parseTypedSong(text: string): { title: string; artist: string; own: boolean } | null {
  const own = /\(own\)\s*$/i.test(text);
  const body = text.replace(/\(own\)\s*$/i, "").trim();
  const [title, ...rest] = body.split(/\s+[-–]\s+/);
  const artist = rest.join(" - ").trim();
  if (!title?.trim() || !artist) return null;
  return { title: title.trim(), artist, own };
}
