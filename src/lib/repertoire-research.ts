import { z } from "zod";
import { spotifyArtistInputSchema } from "./playlist-schema";
import type { QlooCandidateView } from "./qloo-match";

/**
 * Repertoire research (hackathons/qloo-2026/repertoire-research-spec.md, approved 17 Oct): one Spotify artist link starts a
 * streamed run of nine steps. Client-safe: the step keys, the tool names the stream uses, each step's output shape (the
 * `tool-end` output, which is also what the saved snapshot keeps), and the snapshot itself.
 *
 * The stream is the learn stream (lib/learn-schema.ts), event for event: run, status, note, tool-start, tool-end, totals,
 * suggestion, usage, end. A research run is a learn run row (`inputs.kind` says which), so it shares the run limit, the
 * history, the no-repeat rule and the replay.
 */

export const RESEARCH_STEPS = ["profile", "songs", "qloo", "soundsLike", "fans", "fansMap", "fansLove", "learn", "genres", "summary"] as const;
export type ResearchStepKey = (typeof RESEARCH_STEPS)[number];

/** The steps "Find more songs to learn" reruns (6, 7 and 9); the rest stay as the last full run left them. */
export const MORE_STEPS: readonly ResearchStepKey[] = ["fansLove", "learn", "summary"];

/** The tool name each step streams under (`tool-start` / `tool-end`). */
export const RESEARCH_TOOLS: Record<ResearchStepKey, string> = {
  profile: "research_profile",
  songs: "research_songs",
  qloo: "research_qloo",
  soundsLike: "research_sounds_like",
  fans: "research_fans",
  fansMap: "research_fans_map",
  fansLove: "research_fans_love",
  learn: "research_learn",
  genres: "research_genres",
  summary: "research_summary",
};

export const RESEARCH_STEP_OF: Record<string, ResearchStepKey> = Object.fromEntries(RESEARCH_STEPS.map((k) => [RESEARCH_TOOLS[k], k]));

/** The plain-words card title of each step (the spec's table), used as the stream label. */
export const RESEARCH_LABELS: Record<ResearchStepKey, string> = {
  profile: "Reading your Spotify profile",
  songs: "Loading your songs",
  qloo: "Finding you on Qloo",
  soundsLike: "Finding who you sound like",
  fans: "Learning who your fans are",
  fansMap: "Finding where your fans are",
  fansLove: "Finding what your fans also love",
  learn: "Finding songs your fans would stop for",
  genres: "Tagging your sound in genres",
  summary: "Ranking songs to learn",
};

/** The data call behind each step, shown under Raw data. */
export const RESEARCH_SOURCES: Record<ResearchStepKey, string> = {
  profile: "Spotify artist profile (name, photo, genres, followers)",
  songs: "Spotify: your releases and top tracks; Last.fm top tracks as backup",
  qloo: "Qloo /entities by Spotify id (name search as backup), then /entities by id for tags and description; when Qloo doesn't know the act: Last.fm artist.getSimilar confirmed on Qloo /search, else the Spotify genres as Qloo /v2/tags",
  soundsLike: "Qloo /v2/insights · urn:entity:artist signalled by your artist (or the artists like you the Hive found on Last.fm)",
  fans: "Qloo /v2/insights · urn:demographics signalled by your artist",
  fansMap: "Qloo /v2/insights · urn:heatmap signalled by your artist and your sound-alikes, worldwide",
  fansLove: "Qloo /v2/insights · urn:entity:artist signalled by you and your sound-alikes, with explainability; they are left out",
  learn: "Spotify top tracks of those artists (Last.fm as backup); songs you sing, were offered or dismissed are left out",
  genres: "Qloo /v2/insights · urn:tag (music genres) signalled by your artist",
  summary: "The Hive ranks the songs found and says why; it never adds a song",
};

export type ResearchMode = "full" | "more";

// --- Step outputs (the tool-end `output`; every one has a one-line `summary`) ---

export type ProfileOutput = { summary: string; spotifyId: string; name: string; image: string | null; genres: string[]; followers: number | null; href: string };
export type ResearchSongOut = { id: string | null; title: string; artist: string; year: number | null; durationMs: number | null; album: string | null; image: string | null; href: string | null };
export type SongsOutput = { summary: string; source: "spotify" | "lastfm" | "none"; songs: ResearchSongOut[]; added: number; already: number; /** Set when Spotify gave no catalogue: "limited" (rate-limited) or "down"; the songs then come from Last.fm (U34). */ spotifyDown?: "limited" | "down"; /** Retired (U16: no Repertoire limit); stored runs may still carry it. */ full?: boolean };
export type QlooOutput = {
  summary: string;
  matched: boolean;
  qlooId: string | null;
  name: string | null;
  description: string | null;
  /** Qloo genre tags of the artist entity. */
  genres: string[];
  /** Qloo's other descriptive tags on the entity (the audience character: "Youthful", "Energetic"). */
  audience: string[];
  popularity: number | null;
  /** The act's photo (Spotify profile), for the inline mention in the step card. Optional: older saved runs lack it. */
  image?: string | null;
  /** How the act was found: Qloo's Spotify-id lookup, a name search the confidence rule accepted, the user's pick, or the id saved on the Repertoire. */
  by?: "id" | "name" | "chosen" | "saved";
  /** The run is paused on this step: "choice" (the candidates below wait for the user). "soundsLike" is retired (runs saved before the Hive found sound-alikes itself may carry it). */
  waiting?: "choice" | "soundsLike";
  /** Up to three plausible artists to confirm, when no name was certain. */
  candidates?: QlooCandidateView[];
  /** The user said none of the candidates is them; remembered for this link so they are not asked again. */
  declined?: boolean;
  /**
   * Qloo doesn't know the act, so the later steps use something else as the signal: "soundsLike" (artists like the act: the
   * performer's own, else the ones the Hive found on Last.fm), "genres" (the act's Spotify genres as Qloo genre tags), or "none"
   * (nothing to go on: the Qloo steps say there is no taste data yet).
   */
  fallback?: "soundsLike" | "genres" | "none";
  /** fallback "soundsLike": the artists were found by the Hive (Last.fm similar artists confirmed on Qloo), not set by the performer. */
  foundByHive?: boolean;
  /** fallback "genres": the Qloo genre tags used as the signal. */
  genreTags?: { id: string; name: string }[];
};

/** The signal came from "Artists you sound like", not from the act (set on the steps that used it). */
export type BasedOn = { basedOn?: "soundsLike" | "genres" | "none" };
export type ResearchArtistOut = { name: string; qlooId: string; spotifyId?: string; image?: string; tags?: string[]; affinity: number | null; because?: string[] };
export type SoundsLikeOutput = { summary: string; artists: ResearchArtistOut[]; /** True when they were saved as your "Artists you sound like" (only when that list was empty). */ saved: boolean };
export type LeanOut = { key: string; label: string; lean: number };
export type FansOutput = BasedOn & { summary: string; age: LeanOut[]; gender: LeanOut[]; ageLean: string | null };
/** One heat cell of "Where your fans are": `affinity` is relative to the strongest cell (0 to 1). BRAND's FansMap takes these as `cells`. */
export type FansMapCell = { lat: number; lng: number; affinity: number };
/**
 * Step 5b, "Where your fans are": the Qloo heatmap (urn:heatmap) of the act and its sound-alikes over the whole world. `areas` are up to
 * three plain-text place names (distinct cities), strongest first; `planCity` is the Busk Map city id of the top place when we cover it.
 * Optional in saved runs: snapshots from before this step lack it. `city` is retired (the map was per city until U30); old snapshots
 * still carry it and it is ignored.
 */
/** U40: a city the map labels: named after the strongest cell of a cluster of strong cells; `affinity` is relative to the strongest cell (0 to 1). */
export type FansMapCity = { name: string; lat: number; lng: number; affinity: number };
export type FansMapOutput = BasedOn & { summary: string; cells: FansMapCell[]; areas: string[]; planCity?: string | null; /** Up to 8, strongest first. Optional: snapshots from before U40 lack it. */ cities?: FansMapCity[]; signalledBy: string[]; /** Retired. */ city?: unknown };
export type FansLoveOutput = BasedOn & { summary: string; artists: ResearchArtistOut[]; signalledBy: string[]; excluded: number };
export type LearnOutput = {
  summary: string;
  songs: { songId: string; title: string; artist: string; artistId: string; year: number | null; durationMs: number | null; source: "spotify" | "lastfm"; popularity: number | null; /** The artist's Qloo photo, when Qloo gave one. */ artistImage?: string }[];
  checked: number;
  skipped: { alreadySuggested: number; dismissed: number; canSing: number };
  overRepresented: string[];
  noSongs: string[];
  lookedUp: string[];
};
export type GenreOut = { id: string; name: string; affinity: number | null };
export type GenresOutput = BasedOn & { summary: string; tags: GenreOut[] };
export type SummaryOutput = { summary: string; /** Retired: the paragraph about the act. Old snapshots still carry it; it is ignored. */ text?: string; by: "claude" | "mock" | "template"; picks: number };

export type StepOutputs = {
  profile: ProfileOutput;
  songs: SongsOutput;
  qloo: QlooOutput;
  soundsLike: SoundsLikeOutput;
  fans: FansOutput;
  fansMap: FansMapOutput;
  fansLove: FansLoveOutput;
  learn: LearnOutput;
  genres: GenresOutput;
  summary: SummaryOutput;
};

export type StoredStep<K extends ResearchStepKey = ResearchStepKey> = { status: "done" | "failed" | "skipped"; output: StepOutputs[K] | null };

/**
 * The research snapshot saved on the Repertoire (playlists.research, migration 009). It keeps each step's last output, so
 * the page renders the done state without a run, and the busk form reads the genre tags from it. Songs you can sing and
 * songs to learn are NOT copied here: they live in their own tables (playlist_songs, learn_suggestions).
 */
export type ResearchSnapshot = {
  version: 1;
  spotifyArtistId: string;
  /** The last full run and the last run of any kind. */
  fullRunId: string;
  runId: string;
  runNumber: number;
  mode: ResearchMode;
  at: string;
  steps: { [K in ResearchStepKey]?: StoredStep<K> };
  /** The last run's final totals (Qloo calls, songs checked, new songs). */
  totals?: import("./learn-schema").LearnTotals;
};

/** The busk local scene's optional input: the act's genre tags (step 8), at most this many. */
export const MAX_ACT_GENRES = 6;

/** The act's genre tags from a snapshot (step 8, else the Qloo entity's genres by name), for the busk form. */
export function actGenresOf(snapshot: ResearchSnapshot | null | undefined): { id: string; name: string }[] {
  const tags = snapshot?.steps.genres?.output?.tags ?? [];
  return tags.filter((t) => t.id && t.name).slice(0, MAX_ACT_GENRES).map((t) => ({ id: t.id, name: t.name }));
}

// --- POST /api/playlist/research ---

/**
 * The request: `link` (open.spotify.com/artist/<id>, a spotify:artist: URI or a bare id) starts a full run; it is refused
 * as `up_to_date` when the saved research is for the same link, unless `refresh` (the "Refresh my research" button).
 * `mode: "more"` ("Find more songs to learn") needs no link: it builds on the saved snapshot.
 */
export const researchRequestSchema = z.object({
  link: spotifyArtistInputSchema.optional(),
  mode: z.enum(["full", "more"]).default("full"),
  refresh: z.boolean().default(false),
  /** The user's answer to "Is one of these you?": a candidate's Qloo id, or none of them. Only with a link, only for a candidate the last run offered. */
  qlooChoice: z.union([z.object({ id: z.string().min(1).max(80) }), z.object({ none: z.literal(true) })]).optional(),
});
export type ResearchRequest = z.infer<typeof researchRequestSchema>;

/**
 * Offline test mode only (the 3210 server, e2e): an artist the local mocks know end to end, so the full nine-step flow
 * runs on synthetic data. The id is the Qloo mock catalogue's Spotify-shaped id for this name (qloo-mock/catalog.ts:
 * mockSpotifyId); tests/unit/research/view.test.ts keeps them equal. Never shown on a live server.
 */
export const OFFLINE_TEST_ARTIST = { name: "Julia Jacklin", spotifyId: "IBaXCJ49QlTYT2jOrEp66p" } as const;

/**
 * Offline test mode only: deterministic test acts for each way Qloo can (not) know a performer. Julia Jacklin above is the exact
 * Spotify-id match. The profile fixture (adapters/repertoire/fixtures) and the Qloo mock (qloo-mock/catalog.ts: SCENARIO_ARTISTS)
 * both read these; tests/unit/qloo-mock/scenarios.test.ts keeps them in step.
 * - variant: Qloo has "Zelia Marquez" (no id link), found by the name without accent and "feat." part.
 * - candidates: Qloo has "Mara Ellison" and "Maria Ellis", neither certain, so the user confirms.
 * - unknown (Yomil, the real act Qloo Support was asked about): Qloo has nothing; Last.fm has similar artists (Qloo knows three of them), which become the artists the performer sounds like.
 * - unresolved: Qloo has nothing and knows none of Last.fm's similar artists, so the act's Spotify genres, as Qloo genre tags, are the signal.
 * - nothing: no similar artists and no genre tag either; the run still finishes, with the Qloo steps marked as having no taste data yet.
 */
export const OFFLINE_TEST_ACTS = {
  variant: { name: "Zélia Marquez (feat. Ro Dias)", spotifyId: "MockVariantAct0000001a", qlooName: "Zelia Marquez", genres: ["indie folk"] },
  candidates: { name: "Mara Ellis", spotifyId: "MockCandidates00000002", qlooNames: ["Mara Ellison", "Maria Ellis"], genres: ["synthetic ambient"] },
  unknown: { name: "Yomil", spotifyId: "0U0oUxOfhtjkfoJ3ZNWEfU", genres: ["synthetic noise"], similar: ["Paul Kelly", "Courtney Barnett", "Missy Higgins", "Qzv Nobody"] },
  /** Last.fm has similar artists, Qloo knows none of them: the act's Spotify genres are the signal. */
  unresolved: { name: "Vyx Faraway", spotifyId: "MockUnresolvedAct00004", genres: ["indie folk", "synthetic noise"], similar: ["Qzv Nobody", "Xyl Ghost"] },
  /** Nothing anywhere: no similar artists and no genre Qloo has a tag for. */
  nothing: { name: "Wqk Nothing", spotifyId: "MockNothingAct00000005", genres: ["synthetic noise"], similar: [] },
} as const;

/** Whether the saved research is paused on a question for the user (null when it is not). */
export function researchWaiting(snapshot: Pick<ResearchSnapshot, "steps"> | null | undefined): "choice" | null {
  return snapshot?.steps.qloo?.output?.waiting === "choice" ? "choice" : null;
}

/** Whether the saved research can build on (the "Find more songs to learn" button): the act was found, or the run used the artists it sounds like. */
export function researchUsable(snapshot: Pick<ResearchSnapshot, "steps"> | null | undefined): boolean {
  const q = snapshot?.steps.qloo?.output;
  return Boolean(q && !q.waiting && (q.matched || q.fallback));
}

/**
 * Step 9's line, in the Hive's voice (U11): "We ranked 6 songs". The model is credited only by the AI chip;
 * offline the test model is named (B-049), and without a model the line says the data did it.
 */
export function summaryLine(by: "claude" | "mock" | "template" | string, picks: number): string {
  const songs = `${picks} ${picks === 1 ? "song" : "songs"}`;
  return by === "claude" ? `We ranked ${songs}` : by === "mock" ? `The test model ranked ${songs}` : `We ranked ${songs} from the data, without the Hive`;
}
