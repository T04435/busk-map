/**
 * The Repertoire research view model (BRAND's component contract, docs/repertoire-research.md): one pure mapper from what
 * the page has (the saved snapshot, the live stream's events, the Repertoire and its suggestions) to the steps, the totals
 * and the results the three page states render. Client-safe, no I/O.
 *
 * Every results field is null until its step has landed: that is what drives the skeletons.
 */
import { hiveProgressOfRepertoire } from "./agent-persona";
import type { LearnStreamEvent, LearnSuggestionEvent, LearnTotals } from "./learn-schema";
import { SPOTIFY_ARTIST_URL, SPOTIFY_TRACK_URL, spotifyHref, type MentionSource } from "./mention";
import { profilePhoto } from "./spotify-profile";
import { nameKey } from "./text";
import { playlistSongKey, type LearnSuggestionView, type PlaylistSongView, type PlaylistView } from "./playlist-schema";
import type { FansMapOutput } from "./repertoire-research";
import { MORE_STEPS, RESEARCH_STEP_OF, RESEARCH_STEPS, type ResearchSnapshot, type ResearchStepKey, type StepOutputs } from "./repertoire-research";

export type RepertoireStepStatus = "pending" | "running" | "done" | "failed" | "skipped";
export type RepertoireStep = { key: ResearchStepKey; status: RepertoireStepStatus; /** One plain-words line. */ found?: string; /** At most 6. */ cells?: { name: string; image?: string }[]; note?: string; /** The one source a step with a backup ran on, once known (songs: Spotify, or Last.fm when Spotify gave none). */ source?: MentionSource };
export type RepertoireTotals = { qlooCalls: number; songs: number; soundsLike: number; fanArtists: number; songsChecked: number; toLearn: number | null };
export type ResearchArtist = { name: string; image?: string; /** open.spotify.com/artist/<id> when the Spotify id is known; otherwise no link (U06). */ href?: string; source?: "spotify" | "qloo" | "typed"; tags?: string[] };
/**
 * `image` is the track's own image or its album art; `artistImage` the artist's photo (SongRow falls back image, then artistImage, then
 * the icon: U03). `href` is a Spotify track URL only (U06). `source` is where the song came from, for the logo.
 */
export type ResearchSong = { id: string; title: string; artist: string; year?: number; album?: string; image?: string; artistImage?: string; /** open.spotify.com/artist/<id> when the artist's Spotify id is known (U16). */ artistHref?: string; durationMs?: number; href?: string; source?: "spotify" | "lastfm" | "qloo"; own?: boolean };
export type LearnSong = ResearchSong & { reason: string; because?: ResearchArtist[]; status: "pending" | "learned" | "dismissed"; fresh?: boolean };
export type Lean = { label: string; lean: number };
export type RepertoireResults = {
  profile: { name: string; image?: string; genres: string[]; audience: string[]; followers?: number; href?: string } | null;
  summary: string | null;
  fans: { age: Lean[]; gender: Lean[] } | null;
  /** "Where your fans are" (U24): the step's output, as BRAND's FansMap takes it (lib/fans-map.ts: fansMapProps). Null until the step lands, and for research saved before it. */
  fansMap: FansMapOutput | null;
  soundsLike: ResearchArtist[] | null;
  fansLove: ResearchArtist[] | null;
  canSing: ResearchSong[] | null;
  toLearn: LearnSong[] | null;
  learned: ResearchSong[] | null;
};
export type RepertoirePhase = "empty" | "running" | "done";
export type RepertoireView = {
  phase: RepertoirePhase;
  /** "full" or "more" for the run on screen (or the last saved one). */
  mode: "full" | "more" | null;
  steps: RepertoireStep[];
  totals: RepertoireTotals;
  results: RepertoireResults;
  /** How many of the Hive mark's 7 cells are filled (0 to 7): see hiveProgressOfRepertoire in lib/agent-persona.ts. */
  hiveProgress: number;
  /** The run's `end`, live; null while running and for a saved snapshot. */
  end: Extract<LearnStreamEvent, { type: "end" }> | null;
};

export type ViewInput = {
  snapshot?: ResearchSnapshot | null;
  /** The live (or replayed) run's events, in order. */
  events?: readonly LearnStreamEvent[] | null;
  /** The Repertoire as GET /api/playlist returns it: the current songs and "Artists you sound like" (editable). */
  playlist?: Pick<PlaylistView, "songs" | "soundsLike"> & Partial<Pick<PlaylistView, "spotifyProfile" | "spotifyArtistId">> | null;
  /** The Learn list's suggestions (GET /api/playlist/learn); when given they are the To learn list. */
  suggestions?: readonly LearnSuggestionView[] | null;
};

type Outputs = { [K in ResearchStepKey]?: StepOutputs[K] | null };
const img = (url: string | null | undefined) => (url ? { image: url } : {});

function cellsOf(key: ResearchStepKey, o: Outputs): RepertoireStep["cells"] {
  const six = <T>(xs: T[]) => xs.slice(0, 6);
  switch (key) {
    case "profile":
      return o.profile ? [{ name: o.profile.name, ...img(o.profile.image) }] : undefined;
    case "songs":
      return o.songs ? six(o.songs.songs.map((s) => ({ name: s.title, ...img(s.image) }))) : undefined;
    case "qloo":
      return o.qloo ? six([...o.qloo.audience, ...o.qloo.genres].map((name) => ({ name }))) : undefined;
    case "soundsLike":
      return o.soundsLike ? six(o.soundsLike.artists.map((a) => ({ name: a.name, ...img(a.image) }))) : undefined;
    case "fansMap":
      return o.fansMap ? six(o.fansMap.areas.map((name) => ({ name }))) : undefined;
    case "fansLove":
      return o.fansLove ? six(o.fansLove.artists.map((a) => ({ name: a.name, ...img(a.image) }))) : undefined;
    case "learn":
      return o.learn ? six(o.learn.songs.map((s) => ({ name: s.title }))) : undefined;
    case "genres":
      return o.genres ? six(o.genres.tags.map((t) => ({ name: t.name }))) : undefined;
    default:
      return undefined;
  }
}

/** What the page already knows about songs and artists, by key, so a saved row (which stores no picture) still gets its photo. */
type Media = { trackImage: Map<string, string>; artistImage: Map<string, string>; artistHref: Map<string, string>; /** The act's own Spotify artist page. */ ownHref?: string };

/** Photos and Spotify links already fetched: the profile, "you sound like", "fans also love", this run's songs and the suggestions. */
function mediaOf(o: Outputs, playlist: ViewInput["playlist"], suggestions: readonly LearnSuggestionView[]): Media {
  const m: Media = { trackImage: new Map(), artistImage: new Map(), artistHref: new Map() };
  const artist = (name: string, image: string | null | undefined, spotifyId?: string | null) => {
    const k = nameKey(name);
    if (image && !m.artistImage.has(k)) m.artistImage.set(k, image);
    if (spotifyId && !m.artistHref.has(k)) m.artistHref.set(k, SPOTIFY_ARTIST_URL(spotifyId));
  };
  const ownId = playlist?.spotifyArtistId ?? o.profile?.spotifyId;
  if (ownId) m.ownHref = SPOTIFY_ARTIST_URL(ownId);
  if (o.profile) artist(o.profile.name, o.profile.image, o.profile.spotifyId);
  for (const a of o.soundsLike?.artists ?? []) artist(a.name, a.image, a.spotifyId);
  for (const a of o.fansLove?.artists ?? []) artist(a.name, a.image, a.spotifyId);
  for (const a of playlist?.soundsLike ?? []) artist(a.name, null, a.spotifyId);
  for (const s of o.songs?.songs ?? []) if (s.image) m.trackImage.set(playlistSongKey(s.artist, s.title), s.image);
  for (const s of suggestions) if (s.image) m.trackImage.set(playlistSongKey(s.artist, s.title), s.image);
  return m;
}

const songOf = (s: PlaylistSongView, m: Media, ownPhoto: string | undefined): ResearchSong => {
  // The saved cover first (migration 010), then this run's covers and photos.
  const image = s.image ?? m.trackImage.get(playlistSongKey(s.artist, s.title));
  const artistImage = s.artistImage ?? (s.own ? ownPhoto : undefined) ?? m.artistImage.get(nameKey(s.artist));
  const artistHref = (s.own ? m.ownHref : undefined) ?? m.artistHref.get(nameKey(s.artist));
  return {
    id: s.id,
    title: s.title,
    artist: s.artist,
    ...(s.year !== null ? { year: s.year } : {}),
    ...(s.durationMs !== null ? { durationMs: s.durationMs } : {}),
    ...(image ? { image } : {}),
    ...(artistImage ? { artistImage } : {}),
    ...(artistHref ? { artistHref } : {}),
    ...(s.spotifyTrackId ? { href: SPOTIFY_TRACK_URL(s.spotifyTrackId) } : {}),
    ...(s.source === "spotify" || s.source === "lastfm" ? { source: s.source } : {}),
    ...(s.own ? { own: true } : {}),
  };
};

const artistMedia = (m: Media, name: string): { image?: string; href?: string } => {
  const image = m.artistImage.get(nameKey(name));
  const href = m.artistHref.get(nameKey(name));
  return { ...(image ? { image } : {}), ...(href ? { href } : {}) };
};

type AnySuggestion = Pick<LearnSuggestionView, "id" | "title" | "artist" | "year" | "durationMs" | "image" | "songSource" | "sourceUrl" | "reason" | "basedOn" | "status" | "isNew">;
const learnOf = (s: AnySuggestion, m: Media): LearnSong => {
  const because = s.basedOn.filter((b) => b.kind === "soundsLike" || b.kind === "repertoire").map((b): ResearchArtist => ({ name: b.name, source: "qloo", ...artistMedia(m, b.name) }));
  const artistImage = m.artistImage.get(nameKey(s.artist));
  const artistHref = m.artistHref.get(nameKey(s.artist));
  return {
    id: s.id,
    title: s.title,
    artist: s.artist,
    ...(s.year !== null ? { year: s.year } : {}),
    ...(s.durationMs !== null ? { durationMs: s.durationMs } : {}),
    ...img(s.image),
    ...(artistImage ? { artistImage } : {}),
    ...(artistHref ? { artistHref } : {}),
    ...(spotifyHref(s.sourceUrl) ? { href: spotifyHref(s.sourceUrl)! } : {}),
    ...(s.songSource === "spotify" || s.songSource === "lastfm" ? { source: s.songSource } : {}),
    reason: s.reason,
    ...(because.length ? { because } : {}),
    status: s.status,
    ...(s.isNew ? { fresh: true } : {}),
  };
};

export function toRepertoireView(input: ViewInput): RepertoireView {
  const events = input.events ?? [];
  const run = events.find((e) => e.type === "run");
  const end = (events.findLast((e) => e.type === "end") as RepertoireView["end"] | undefined) ?? null;
  const liveMode = run?.type === "run" ? (run.inputs.kind === "more" ? "more" : "full") : null;
  const snapshot = input.snapshot ?? null;

  const status = new Map<ResearchStepKey, RepertoireStepStatus>();
  const found = new Map<ResearchStepKey, string>();
  const outputs: Outputs = {};
  // The saved snapshot is the base: all of it with no live run; for a live "more" run, the steps it doesn't rerun.
  const keep = (k: ResearchStepKey) => !run || (liveMode === "more" && !MORE_STEPS.includes(k));
  for (const k of RESEARCH_STEPS) {
    const s = snapshot?.steps[k];
    if (s && keep(k)) {
      status.set(k, s.status);
      (outputs as Record<string, unknown>)[k] = s.output;
      if (s.output) found.set(k, s.output.summary);
    }
  }
  let totals: LearnTotals | null = run ? null : (snapshot?.totals ?? null);
  const live: LearnSuggestionEvent[] = [];
  const ids = new Map<string, ResearchStepKey>();
  const via = new Map<ResearchStepKey, MentionSource>();
  for (const e of events) {
    if (e.type === "tool-start") {
      const k = RESEARCH_STEP_OF[e.tool];
      if (!k) continue;
      ids.set(e.id, k);
      status.set(k, "running");
    } else if (e.type === "tool-source") {
      const k = ids.get(e.id);
      if (k) via.set(k, e.source);
    } else if (e.type === "tool-end") {
      const k = ids.get(e.id) ?? RESEARCH_STEP_OF[e.tool];
      if (!k) continue;
      status.set(k, e.ok ? "done" : "failed");
      found.set(k, e.summary);
      (outputs as Record<string, unknown>)[k] = e.ok ? e.output : null;
    } else if (e.type === "totals") totals = e.totals;
    else if (e.type === "suggestion") live.push(e);
  }
  const ran = liveMode === "more" ? MORE_STEPS : RESEARCH_STEPS;
  const steps: RepertoireStep[] = RESEARCH_STEPS.map((key) => {
    let st = status.get(key) ?? (snapshot && !run ? "skipped" : "pending");
    // A live run that ended: a step it never started was skipped (or cut short, if it was still running).
    if (end && ran.includes(key) && (st === "pending" || st === "running")) st = st === "running" ? "failed" : "skipped";
    const f = found.get(key);
    const songsFrom = key === "songs" && st === "done" && outputs.songs && outputs.songs.source !== "none" ? outputs.songs.source : undefined;
    const source = via.get(key) ?? songsFrom;
    return { key, status: st, ...(source ? { source } : {}), ...(f && st === "done" ? { found: f } : {}), ...(st === "done" ? { cells: cellsOf(key, outputs) } : {}), ...(st === "failed" && f ? { note: f } : {}), ...(st === "skipped" ? { note: "Skipped" } : {}) };
  });
  const done = (k: ResearchStepKey) => steps.find((s) => s.key === k)?.status === "done";

  const o = outputs;
  const playlist = input.playlist ?? null;
  const media = mediaOf(o, playlist, input.suggestions ?? []);
  const ownPhoto = (playlist?.spotifyProfile ? profilePhoto(playlist.spotifyProfile.images) : null) ?? o.profile?.image ?? undefined;
  const tagsByName = new Map((o.soundsLike?.artists ?? []).map((a) => [a.name.toLowerCase(), a]));
  const soundsLike: ResearchArtist[] | null = done("soundsLike") || (playlist && !run && playlist.soundsLike.length > 0)
    ? playlist
      ? playlist.soundsLike.map((a) => {
          const q = tagsByName.get(a.name.toLowerCase());
          return { name: a.name, source: a.spotifyId ? "spotify" : a.qlooId ? "qloo" : "typed", ...img(q?.image), ...(a.spotifyId ? { href: SPOTIFY_ARTIST_URL(a.spotifyId) } : {}), ...(q?.tags ? { tags: q.tags } : {}) };
        })
      : (o.soundsLike?.artists ?? []).map((a) => ({ name: a.name, source: "qloo" as const, ...img(a.image), ...(a.spotifyId ? { href: SPOTIFY_ARTIST_URL(a.spotifyId) } : {}), ...(a.tags ? { tags: a.tags } : {}) }))
    : null;
  const songsLanded = done("songs") || (!run && !!playlist) || (liveMode === "more" && !!playlist);
  const canSing = songsLanded
    ? playlist
      ? playlist.songs.filter((s) => s.state === "can_sing").map((s) => songOf(s, media, ownPhoto))
      : (o.songs?.songs ?? []).filter((s) => s.id).map((s): ResearchSong => ({ id: s.id!, title: s.title, artist: s.artist, own: true, ...(s.year ? { year: s.year } : {}), ...(s.album ? { album: s.album } : {}), ...img(s.image), ...(ownPhoto ? { artistImage: ownPhoto } : {}), ...(media.ownHref ? { artistHref: media.ownHref } : {}), ...(spotifyHref(s.href) ? { href: spotifyHref(s.href)! } : {}), ...(o.songs!.source !== "none" ? { source: o.songs!.source } : {}), ...(s.durationMs ? { durationMs: s.durationMs } : {}) }))
    : null;
  // To learn: the Learn list when the page has it (current statuses); otherwise this run's suggestions once it ended.
  const toLearn = input.suggestions && (!run || end) ? input.suggestions.map((s) => learnOf(s, media)) : end ? live.map((s) => learnOf(s, media)) : null;

  const results: RepertoireResults = {
    profile: o.profile
      ? {
          name: o.profile.name,
          ...img(o.profile.image),
          genres: (o.qloo?.genres.length ? o.qloo.genres : o.profile.genres).slice(0, 6),
          audience: o.qloo?.audience ?? [],
          ...((o.profile.followers ?? 0) > 0 ? { followers: o.profile.followers! } : {}),
          href: o.profile.href,
        }
      : null,
    // The paragraph about the act is retired (the page has no such section); old snapshots' text is ignored.
    summary: null,
    fans: o.fans ? { age: o.fans.age.map(({ label, lean }) => ({ label, lean })), gender: o.fans.gender.map(({ label, lean }) => ({ label, lean })) } : null,
    fansMap: o.fansMap ?? null,
    soundsLike,
    fansLove: o.fansLove ? o.fansLove.artists.map((a) => ({ name: a.name, source: "qloo" as const, ...img(a.image), ...(a.spotifyId ? { href: SPOTIFY_ARTIST_URL(a.spotifyId) } : {}), ...(a.tags ? { tags: a.tags } : {}) })) : null,
    canSing,
    toLearn,
    learned: playlist ? playlist.songs.filter((s) => s.state === "learned").map((s) => songOf(s, media, ownPhoto)) : null,
  };

  const phase: RepertoirePhase = run ? (end ? "done" : "running") : snapshot ? "done" : "empty";
  const mode = liveMode ?? snapshot?.mode ?? null;
  return {
    phase,
    mode,
    hiveProgress: hiveProgressOfRepertoire({ phase, mode, steps }),
    steps,
    totals: {
      qlooCalls: totals?.qlooCalls ?? 0,
      songs: o.songs ? o.songs.added + o.songs.already : (canSing?.filter((s) => s.own).length ?? 0),
      soundsLike: o.soundsLike?.artists.length ?? 0,
      fanArtists: o.fansLove?.artists.length ?? 0,
      songsChecked: o.learn?.checked ?? totals?.songsChecked ?? 0,
      toLearn: end ? end.newCount : !run && totals ? totals.newSongs : null,
    },
    results,
    end,
  };
}
