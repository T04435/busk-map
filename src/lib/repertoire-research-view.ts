/**
 * The Repertoire research view model (BRAND's component contract, docs/repertoire-research.md): one pure mapper from what
 * the page has (the saved snapshot, the live stream's events, the Repertoire and its suggestions) to the steps, the totals
 * and the results the three page states render. Client-safe, no I/O.
 *
 * Every results field is null until its step has landed: that is what drives the skeletons.
 */
import type { LearnStreamEvent, LearnSuggestionEvent, LearnTotals } from "./learn-schema";
import type { LearnSuggestionView, PlaylistSongView, PlaylistView } from "./playlist-schema";
import { MORE_STEPS, RESEARCH_STEP_OF, RESEARCH_STEPS, type ResearchSnapshot, type ResearchStepKey, type StepOutputs } from "./repertoire-research";

export type RepertoireStepStatus = "pending" | "running" | "done" | "failed" | "skipped";
export type RepertoireStep = { key: ResearchStepKey; status: RepertoireStepStatus; /** One plain-words line. */ found?: string; /** At most 6. */ cells?: { name: string; image?: string }[]; note?: string };
export type RepertoireTotals = { qlooCalls: number; songs: number; soundsLike: number; fanArtists: number; songsChecked: number; toLearn: number | null };
export type ResearchArtist = { name: string; image?: string; source?: "spotify" | "qloo" | "typed"; tags?: string[] };
export type ResearchSong = { id: string; title: string; artist: string; year?: number; album?: string; image?: string; durationMs?: number; href?: string; own?: boolean };
export type LearnSong = ResearchSong & { reason: string; because?: ResearchArtist[]; status: "pending" | "learned" | "dismissed"; fresh?: boolean };
export type Lean = { label: string; lean: number };
export type RepertoireResults = {
  profile: { name: string; image?: string; genres: string[]; audience: string[]; followers?: number; href?: string } | null;
  summary: string | null;
  fans: { age: Lean[]; gender: Lean[] } | null;
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
  /** The run's `end`, live; null while running and for a saved snapshot. */
  end: Extract<LearnStreamEvent, { type: "end" }> | null;
};

export type ViewInput = {
  snapshot?: ResearchSnapshot | null;
  /** The live (or replayed) run's events, in order. */
  events?: readonly LearnStreamEvent[] | null;
  /** The Repertoire as GET /api/playlist returns it: the current songs and "Artists you sound like" (editable). */
  playlist?: Pick<PlaylistView, "songs" | "soundsLike"> | null;
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

const songOf = (s: PlaylistSongView): ResearchSong => ({
  id: s.id,
  title: s.title,
  artist: s.artist,
  ...(s.year !== null ? { year: s.year } : {}),
  ...(s.durationMs !== null ? { durationMs: s.durationMs } : {}),
  ...(s.spotifyTrackId ? { href: `https://open.spotify.com/track/${s.spotifyTrackId}` } : {}),
  ...(s.own ? { own: true } : {}),
});

type AnySuggestion = Pick<LearnSuggestionView, "id" | "title" | "artist" | "year" | "durationMs" | "image" | "sourceUrl" | "reason" | "basedOn" | "status" | "isNew">;
const learnOf = (s: AnySuggestion): LearnSong => {
  const because = s.basedOn.filter((b) => b.kind === "soundsLike" || b.kind === "repertoire").map((b): ResearchArtist => ({ name: b.name, source: "qloo" }));
  return {
    id: s.id,
    title: s.title,
    artist: s.artist,
    ...(s.year !== null ? { year: s.year } : {}),
    ...(s.durationMs !== null ? { durationMs: s.durationMs } : {}),
    ...img(s.image),
    ...(s.sourceUrl ? { href: s.sourceUrl } : {}),
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
  for (const e of events) {
    if (e.type === "tool-start") {
      const k = RESEARCH_STEP_OF[e.tool];
      if (!k) continue;
      ids.set(e.id, k);
      status.set(k, "running");
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
    return { key, status: st, ...(f && st === "done" ? { found: f } : {}), ...(st === "done" ? { cells: cellsOf(key, outputs) } : {}), ...(st === "failed" && f ? { note: f } : {}), ...(st === "skipped" ? { note: "Skipped" } : {}) };
  });
  const done = (k: ResearchStepKey) => steps.find((s) => s.key === k)?.status === "done";

  const o = outputs;
  const playlist = input.playlist ?? null;
  const tagsByName = new Map((o.soundsLike?.artists ?? []).map((a) => [a.name.toLowerCase(), a]));
  const soundsLike: ResearchArtist[] | null = done("soundsLike") || (playlist && !run && playlist.soundsLike.length > 0)
    ? playlist
      ? playlist.soundsLike.map((a) => {
          const q = tagsByName.get(a.name.toLowerCase());
          return { name: a.name, source: a.spotifyId ? "spotify" : a.qlooId ? "qloo" : "typed", ...img(q?.image), ...(q?.tags ? { tags: q.tags } : {}) };
        })
      : (o.soundsLike?.artists ?? []).map((a) => ({ name: a.name, source: "qloo" as const, ...img(a.image), ...(a.tags ? { tags: a.tags } : {}) }))
    : null;
  const songsLanded = done("songs") || (!run && !!playlist) || (liveMode === "more" && !!playlist);
  const canSing = songsLanded
    ? playlist
      ? playlist.songs.filter((s) => s.state === "can_sing").map(songOf)
      : (o.songs?.songs ?? []).filter((s) => s.id).map((s) => ({ id: s.id!, title: s.title, artist: s.artist, own: true, ...(s.year ? { year: s.year } : {}), ...(s.album ? { album: s.album } : {}), ...img(s.image), ...(s.durationMs ? { durationMs: s.durationMs } : {}), ...(s.href ? { href: s.href } : {}) }))
    : null;
  // To learn: the Learn list when the page has it (current statuses); otherwise this run's suggestions once it ended.
  const toLearn = input.suggestions && (!run || end) ? input.suggestions.map(learnOf) : end ? live.map((s) => learnOf(s)) : null;

  const results: RepertoireResults = {
    profile: o.profile
      ? {
          name: o.profile.name,
          ...img(o.profile.image),
          genres: (o.qloo?.genres.length ? o.qloo.genres : o.profile.genres).slice(0, 6),
          audience: o.qloo?.audience ?? [],
          ...(o.profile.followers !== null ? { followers: o.profile.followers } : {}),
          href: o.profile.href,
        }
      : null,
    summary: o.summary?.text ?? null,
    fans: o.fans ? { age: o.fans.age.map(({ label, lean }) => ({ label, lean })), gender: o.fans.gender.map(({ label, lean }) => ({ label, lean })) } : null,
    soundsLike,
    fansLove: o.fansLove ? o.fansLove.artists.map((a) => ({ name: a.name, source: "qloo" as const, ...img(a.image), ...(a.tags ? { tags: a.tags } : {}) })) : null,
    canSing,
    toLearn,
    learned: playlist ? playlist.songs.filter((s) => s.state === "learned").map(songOf) : null,
  };

  const phase: RepertoirePhase = run ? (end ? "done" : "running") : snapshot ? "done" : "empty";
  return {
    phase,
    mode: liveMode ?? snapshot?.mode ?? null,
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
