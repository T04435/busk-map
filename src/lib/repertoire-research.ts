import { z } from "zod";
import { spotifyArtistInputSchema } from "./playlist-schema";
import type { QlooCandidateView } from "./qloo-match";
import type { FilledBy, NotOnQVia } from "./notonq";

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
  /** Last.fm's similar artists the Hive found for the act when Qloo confirmed none of them: step 4's "who you sound like". */
  similar?: { name: string; spotifyId?: string; image?: string }[];
  /** A genre the performer picked when nothing else was found; kept for this link so a refresh uses it again. */
  genrePick?: string;
  /** "notonq": Qloo lacks the act and NotOnQ filled it in (lib/notonq.ts); its taste answers then come through stand-ins. Missing: null. */
  filledBy?: FilledBy;
};

/** The signal came from "Artists you sound like", not from the act (set on the steps that used it). */
export type BasedOn = {
  basedOn?: "soundsLike" | "genres" | "none";
  /** basedOn "genres": the genres the step used, by name, for its line ("Based on Dembow and Reggaeton"). */ byGenres?: string[];
  /** NotOnQ answered the step's Qloo calls through stand-ins for an act Qloo lacks (lib/notonq.ts). Missing: Qloo answered alone. */
  via?: NotOnQVia;
};
export type ResearchArtistOut = { name: string; qlooId: string; spotifyId?: string; image?: string; tags?: string[]; affinity: number | null; because?: string[]; /** "notonq": NotOnQ filled this artist in. Missing: null. */ filledBy?: FilledBy };
/** What the run waits for on a paused step: how many times it has asked (at most RESEARCH_MAX_ASKS), and what Qloo didn't know. */
export type ResearchAsk = { asks: number; tried: { artists: string[]; genres: string[] }; suggest?: ResearchSuggest };
/**
 * What the ask starts from, so the performer confirms rather than starts empty: the sound-alikes the research already found (with
 * their Spotify id and photo when known), and genres as Qloo tags: the ones both the research and the Hive suggested, the
 * research's, then the Hive's. `picked` genres start selected (at most MAX_RESEARCH_GENRES). Optional: asks saved before it lack it.
 */
export type ResearchSuggest = {
  artists: { name: string; spotifyId?: string; image?: string }[];
  genres: { id: string; name: string; from: "act" | "alikes" | "hive"; picked: boolean; /** The Hive suggested it too. */ agreed?: boolean }[];
  /** Who named the "hive" genres (one small model call): Claude, or the test model offline. */
  hiveBy?: "claude" | "mock";
};
export type SoundsLikeOutput = BasedOn & {
  summary: string;
  /** qlooId is absent for a Last.fm sound-alike Qloo doesn't know (QlooOutput.similar). */
  artists: (Omit<ResearchArtistOut, "qlooId"> & { qlooId?: string })[];
  /** True when they were saved as your "Artists you sound like" (only when that list was empty). */
  saved: boolean;
  /** The run is paused here: Qloo has no taste signal for the act, so the step asks for artists you sound like, or a genre. */
  waiting?: ResearchAsk;
  /** Asked RESEARCH_MAX_ASKS times and still nothing Qloo knows: the run finished without taste data. */
  gaveUp?: boolean;
};
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

/** "waiting": the run is paused on this step for the performer's input (ResearchSnapshot.waiting). */
export type StoredStep<K extends ResearchStepKey = ResearchStepKey> = { status: "done" | "failed" | "skipped" | "waiting"; output: StepOutputs[K] | null };

/** How many times a paused run asks for input before it finishes without taste data. */
export const RESEARCH_MAX_ASKS = 3;

/**
 * A run paused for input (end code needs_sounds_like): the step it waits on, that step's stream id, the ask, and what was tried.
 * POST /api/playlist/research/<runId>/input carries on from here, in the same run.
 */
export type ResearchWaiting = ResearchAsk & {
  step: ResearchStepKey;
  stepId: string;
  message: string;
  /** The Hive's genre call made while asking: its usage is added to the run's when it carries on. */
  hiveUsage?: { inputTokens: number; outputTokens: number; reasoningTokens: number; steps: number; ms: number; stoppedBy: string } | null;
};

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
  /** Set while the run waits for the performer's input; the steps before it are done and kept. */
  waiting?: ResearchWaiting | null;
};

/** The busk local scene's optional input: the act's genre tags (step 8), at most this many. */
export const MAX_ACT_GENRES = 6;

/**
 * The act's genre tags from a snapshot, for the busk form: the genres the performer answered when Qloo doesn't know the act
 * (step 3's genreTags) first, then step 8's, once each by id.
 */
export function actGenresOf(snapshot: ResearchSnapshot | null | undefined): { id: string; name: string }[] {
  const qloo = snapshot?.steps.qloo?.output;
  const answered = qloo && !qloo.matched ? (qloo.genreTags ?? []) : [];
  const tags = [...answered, ...(snapshot?.steps.genres?.output?.tags ?? [])];
  return tags
    .filter((t, i) => t.id && t.name && tags.findIndex((u) => u.id === t.id) === i)
    .slice(0, MAX_ACT_GENRES)
    .map((t) => ({ id: t.id, name: t.name }));
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
  /** A genre the performer picked ("Your genre") when the Hive found nothing: the first genre text looked up as a Qloo tag. Only with a link. */
  genre: z.string().trim().min(2).max(40).optional(),
});
export type ResearchRequest = z.infer<typeof researchRequestSchema>;

/**
 * POST /api/playlist/research/<runId>/input: the answer to a paused run. Artists you sound like (1 to 10, from the picker, with
 * their Spotify id when it has one) or a genre; at least one.
 */
/**
 * The ask's genres in order, up to MAX_RESEARCH_GENRES of them picked (the performer can unpick any): the ones both the research
 * and the Hive suggested, then the research's (in its order, by weight), then the Hive's own.
 */
export function preselectGenres(genres: readonly ResearchSuggest["genres"][number][]): ResearchSuggest["genres"] {
  const order = [...genres.filter((g) => g.agreed), ...genres.filter((g) => !g.agreed && g.from !== "hive"), ...genres.filter((g) => g.from === "hive")];
  return order.map((g, i) => ({ ...g, picked: i < MAX_RESEARCH_GENRES }));
}

/** Genres a performer can pick while the research waits. */
export const MAX_RESEARCH_GENRES = 3;
/** Artists a performer can send while the research waits (the found sound-alikes come prefilled): the "Artists you sound like" cap. */
export const MAX_RESEARCH_ARTISTS = 10;
export const researchInputSchema = z
  .object({
    artists: z
      .array(z.object({ name: z.string().trim().min(1).max(80), spotifyId: z.string().regex(/^[A-Za-z0-9]{22}$/).optional(), image: z.string().max(500).regex(/^https:\/\//).optional() }))
      .min(1)
      .max(MAX_RESEARCH_ARTISTS)
      .optional(),
    /** Up to three genres. The old single `genre` is still accepted and read as one more. */
    genres: z.array(z.string().trim().min(2).max(40)).min(1).max(MAX_RESEARCH_GENRES).optional(),
    genre: z.string().trim().min(2).max(40).optional(),
  })
  .refine((v) => Boolean(v.artists?.length || v.genres?.length || v.genre), { message: "artists or genre" })
  .transform(({ genre, genres, ...rest }) => {
    const all = [...new Set([...(genres ?? []), ...(genre ? [genre] : [])])].slice(0, MAX_RESEARCH_GENRES);
    return { ...rest, ...(all.length ? { genres: all } : {}) };
  });
export type ResearchInput = z.infer<typeof researchInputSchema>;

/**
 * Offline test mode only (the 3210 server, e2e): an artist the local mocks know end to end, so the full nine-step flow
 * runs on synthetic data. The id is the Qloo mock catalogue's Spotify-shaped id for this name (qloo-mock/catalog.ts:
 * mockSpotifyId); tests/unit/research/view.test.ts keeps them equal. Never shown on a live server.
 */
export const OFFLINE_TEST_ARTIST = { name: "Julia Jacklin", spotifyId: "IBaXCJ49QlTYT2jOrEp66p" } as const;

/**
 * Offline test mode only: two well-known artists a performer picks from the Spotify search in the waiting step (the v1.0.1 live
 * case: Mariah Carey and Celia Cruz). Qloo knows both, by Spotify id and by name, with a photo of its own.
 */
export const OFFLINE_PICKED_ARTISTS = {
  /** Spotify's search result has a photo; Qloo's is the fallback. */
  mariah: { name: "Mariah Carey", spotifyId: "MockPickedArtist000001", spotifyImage: "https://i.scdn.co/image/offline-mariah-carey", qlooImage: "https://images.qloo.test/mariah-carey.jpg" },
  /** Spotify's search result has no photo: the Qloo one shows. */
  celia: { name: "Celia Cruz", spotifyId: "MockPickedArtist000002", spotifyImage: null, qlooImage: "https://images.qloo.test/celia-cruz.jpg" },
} as const;

/**
 * Offline test mode only: deterministic test acts for each way Qloo can (not) know a performer. Julia Jacklin above is the exact
 * Spotify-id match. The profile fixture (adapters/repertoire/fixtures) and the Qloo mock (qloo-mock/catalog.ts: SCENARIO_ARTISTS)
 * both read these; tests/unit/qloo-mock/scenarios.test.ts keeps them in step.
 * - variant: Qloo has "Zelia Marquez" (no id link), found by the name without accent and "feat." part.
 * - candidates: Qloo has "Mara Ellison" and "Maria Ellis", neither certain, so the user confirms.
 * - unknown (Yomil, the real act Qloo Support was asked about): Qloo has nothing; Last.fm has similar artists (Qloo knows three of them), which become the artists the performer sounds like.
 * - unresolved: Qloo has nothing and knows none of Last.fm's similar artists, so the act's Spotify genres, as Qloo genre tags, are the signal.
 * - lastfmTags: Qloo has nothing, Last.fm has no similar artists but tags the act (Spotify sends no genres): the tags become Qloo genre tags.
 * - otherId: a Qloo artist with the act's name but a different Spotify id: not the act, so it is rejected.
 * - weak: Qloo has an artist of the act's name with no music-genre tag, so it isn't taken alone: the Hive's sound-alikes stand in.
 * - secondHop: Last.fm's similar artists are unknown to Qloo, but theirs are known: the Hive goes one step further.
 * - nothing: no similar artists and no genre tag either; the run still finishes, with the Qloo steps marked as having no taste data yet.
 */
export const OFFLINE_TEST_ACTS = {
  variant: { name: "Zélia Marquez (feat. Ro Dias)", spotifyId: "MockVariantAct0000001a", qlooName: "Zelia Marquez", genres: ["indie folk"] },
  candidates: { name: "Mara Ellis", spotifyId: "MockCandidates00000002", qlooNames: ["Mara Ellison", "Maria Ellis"], genres: ["synthetic ambient"] },
  unknown: { name: "Yomil", spotifyId: "0U0oUxOfhtjkfoJ3ZNWEfU", genres: ["synthetic noise"], similar: ["Paul Kelly", "Courtney Barnett", "Missy Higgins", "Qzv Nobody"] },
  /** Last.fm has similar artists, Qloo knows none of them: the act's Spotify genres are the signal. */
  unresolved: { name: "Vyx Faraway", spotifyId: "MockUnresolvedAct00004", genres: ["indie folk", "synthetic noise"], similar: ["Qzv Nobody", "Xyl Ghost"] },
  lastfmTags: { name: "Brk Tagonly", spotifyId: "MockLastfmTagsAct00006", genres: [], similar: [], tags: ["folk", "seen live", "australian"] },
  otherId: { name: "Ishan Echo", spotifyId: "MockOtherIdAct00000007", genres: ["synthetic noise"], similar: [], tags: [], qlooSpotifyId: "ZzDifferentArtist00001" },
  weak: { name: "Wea Kgenre", spotifyId: "MockWeakGenreAct000008", genres: ["synthetic noise"], similar: ["Paul Kelly", "Courtney Barnett", "Missy Higgins"] },
  secondHop: { name: "Nxq Hopper", spotifyId: "MockSecondHopAct000009", genres: ["synthetic noise"], similar: ["Hop Ghost One", "Hop Ghost Two"] },
  /** Nothing anywhere: no similar artists and no genre Qloo has a tag for. */
  nothing: { name: "Wqk Nothing", spotifyId: "MockNothingAct00000005", genres: ["synthetic noise"], similar: [] },
  /** Like Victoria Queen (live, 20 Oct): Qloo doesn't know her, Last.fm has no similar artists or tags, Spotify sends no genres. */
  silent: { name: "Vqn Silent", spotifyId: "MockVictoriaQueen00010", genres: [], similar: [], tags: [] },
  /**
   * Like Wow Popy (live, 25 Oct): Qloo doesn't know the act or its Last.fm sound-alikes (Spotify does, with photos), and the act has
   * no tags; the sound-alikes are tagged with specific genres Qloo has only as its own tags (OFFLINE_ALIKE_TAGS). The run asks.
   */
  taggedAlikes: { name: "Wpy Popi", spotifyId: "MockTaggedAlikes000011", genres: [], similar: ["Dny Omy", "Lkm Kimi"], tags: [] },
  /**
   * NotOnQ (lib/notonq.ts): Qloo doesn't know the act, and the Qloo mock answers as the NotOnQ proxy would (qloo-mock/notonq.ts):
   * /search adds a filled-in artist with the act's exact name, and taste questions about it are answered through two stand-ins
   * Qloo knows. Its research is labelled "Filled by NotOnQ" and "Via NotOnQ stand-ins: …".
   */
  notonq: { name: "Nqo Filled", spotifyId: "MockNotOnQFilledAct012", genres: ["indie folk"], similar: [], tags: [], standIns: ["Paul Kelly", "Courtney Barnett"] },
  /**
   * Like Victoria Queen through NotOnQ (live, 30 Oct): NotOnQ fills the act in but has no stand-ins for it (it found no similar
   * artists Qloo knows, `notonq:standIns` absent), and its taste answers are empty. The run asks, as for an act Qloo lacks.
   */
  notonqEmpty: { name: "Nqe Empty", spotifyId: "MockNotOnQEmptyAct0013", genres: [], similar: [], tags: [] },
} as const;

/**
 * Offline test mode only: artists Spotify's search knows (id and photo) and Qloo's mock doesn't: the taggedAlikes act's sound-alikes.
 * Their Last.fm tags (invented) are specific genres Qloo's mock has only as its own tags (urn:tag:genre:qloo:…).
 */
export const OFFLINE_SPOTIFY_ONLY_ARTISTS = {
  "Dny Omy": { spotifyId: "MockSpotifyOnlyArt0001", image: "https://i.scdn.co/image/offline-dny-omy" },
  "Lkm Kimi": { spotifyId: "MockSpotifyOnlyArt0002", image: "https://i.scdn.co/image/offline-lkm-kimi" },
} as const;
export const OFFLINE_ALIKE_TAGS: Record<string, readonly string[]> = {
  "Dny Omy": ["dembow", "reggaeton", "seen live"],
  "Lkm Kimi": ["reggaeton", "cuban urban"],
};

/**
 * Offline test mode only: what the test model answers for the Hive's genre suggestions, per act name: an agreed genre (Reggaeton),
 * one of its own (Funk), a place (dropped) and one Qloo's mock has no tag for (dropped). Any other act: none.
 */
export const OFFLINE_HIVE_GENRES: Record<string, readonly string[]> = {
  "Wpy Popi": ["reggaeton", "funk", "Cuba", "polka"],
};

/** Offline: an artist name Qloo's mock doesn't know (a performer's sound-alike that resolves to nothing). */
export const OFFLINE_UNKNOWN_ARTIST = "Qzv Nobody";
/** Offline: a genre from the genre buttons that Qloo's mock has no tag for. */
export const OFFLINE_UNTAGGED_GENRE = "Latin";

/** Offline Last.fm: the similar artists of the second-hop test act's similar artists (names the Qloo mock knows). */
export const OFFLINE_SIMILAR_HOPS: Record<string, readonly string[]> = {
  "Hop Ghost One": ["Paul Kelly", "Courtney Barnett"],
  "Hop Ghost Two": ["Missy Higgins", "Wea Kgenre"],
};

/** Whether the saved research is paused on a question for the user: "choice" (is one of these you?), "input" (artists or a genre), or null. */
export function researchWaiting(snapshot: Pick<ResearchSnapshot, "steps" | "waiting"> | null | undefined): "choice" | "input" | null {
  if (snapshot?.waiting) return "input";
  return snapshot?.steps.qloo?.output?.waiting === "choice" ? "choice" : null;
}

/** Whether the saved research can build on (the "Find more songs to learn" button): the act was found, or a stand-in signal was used. */
export function researchUsable(snapshot: Pick<ResearchSnapshot, "steps" | "waiting"> | null | undefined): boolean {
  const q = snapshot?.steps.qloo?.output;
  return Boolean(q && !q.waiting && !snapshot?.waiting && (q.matched || q.fallback === "soundsLike" || q.fallback === "genres"));
}

/**
 * Step 9's line, in the Hive's voice (U11): "We ranked 6 songs". The model is credited only by the AI chip;
 * offline the test model is named (B-049), and without a model the line says the data did it.
 */
export function summaryLine(by: "claude" | "mock" | "template" | string, picks: number): string {
  const songs = `${picks} ${picks === 1 ? "song" : "songs"}`;
  return by === "claude" ? `We ranked ${songs}` : by === "mock" ? `The test model ranked ${songs}` : `We ranked ${songs} from the data, without the Hive`;
}
