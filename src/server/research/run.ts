import "server-only";
import type { LanguageModel } from "ai";
import { ageLabel } from "@/lib/age";
import { skippedOf, ZERO_LEARN_TOTALS, type LearnStreamEvent, type LearnTotals, type StoredLearnStep } from "@/lib/learn-schema";
import type { MentionSource } from "@/lib/mention";
import type { CallRecord } from "@/lib/call-record";
import { andList, PLAYLIST_COPY } from "@/lib/playlist-copy";
import type { QlooCandidateView } from "@/lib/qloo-match";
import type { SoundsLike } from "@/lib/playlist-schema";
import {
  MORE_STEPS,
  RESEARCH_LABELS,
  MAX_RESEARCH_ARTISTS,
  MAX_RESEARCH_GENRES,
  RESEARCH_MAX_ASKS,
  RESEARCH_STEPS,
  RESEARCH_TOOLS,
  type FansLoveOutput,
  type FansMapOutput,
  type FansOutput,
  type GenresOutput,
  type ResearchAsk,
  type ResearchInput,
  type ResearchWaiting,
  type LearnOutput,
  type ProfileOutput,
  type QlooOutput,
  type ResearchMode,
  type ResearchSnapshot,
  type ResearchStepKey,
  type ResearchSuggest,
  type SongsOutput,
  type SoundsLikeOutput,
  type StepOutputs,
  type StoredStep,
  type SummaryOutput,
  summaryLine,
} from "@/lib/repertoire-research";
import { nameKey } from "@/lib/text";
import { recordCalls } from "@/server/adapters/call-log";
import type { AdapterContext } from "@/server/adapters/core";
import * as qloo from "@/server/adapters/qloo";
import { withQlooUsage, type QlooUsage } from "@/server/adapters/qloo/usage";
import { findArtists, getArtistCatalogue, getArtistProfile } from "@/server/adapters/repertoire";
import { qlooBudgetSpent } from "@/server/adapters/qloo/budget";
import { spotifyLimitedUntil } from "@/server/adapters/repertoire/pacer";
import { getSongs } from "@/server/adapters/songs";
import { knownCity, MELBOURNE } from "@/server/cities";
import { serverToday } from "@/server/clock";
import { log } from "@/server/log";
import { LearnContext } from "@/server/learn/context";
import { boundSteps } from "@/server/learn/run";
import { endOf, suggestionEvent } from "@/server/learn/replay";
import type { LearnRun } from "@/server/learn/runs";
import type { LearnStore } from "@/server/learn/store";
import { buildSuggestions, joinSpotifyDisplay, LearnState, runTopTracks } from "@/server/learn/tools";
import type { RunRecord } from "@/server/learn/types";
import {
  RESEARCH_FANS_LOVE_KEPT,
  RESEARCH_FANS_LOVE_TAKE,
  RESEARCH_GENRES_TAKE,
  RESEARCH_LEARN_ARTISTS,
  RESEARCH_LEARN_PER_ARTIST,
  RESEARCH_SIGNAL_SOUND_ALIKES,
  RESEARCH_TIMEOUTS,
  RESEARCH_SOUNDS_LIKE_SAVED,
} from "@/server/playlist/config";
import { fansMapFor } from "./fans-map";
import { isMusicGenreTag } from "@/lib/genre-tags";
import { normGenre } from "@/lib/qloo-match";
import { findOwnOnQloo, findSoundAlikes, resolveGenreTag, resolveSoundAlikes, soundsLikeFor, suggestGenres, titleGenre } from "@/server/playlist/own-artist";
import type { PlaylistRecord, PlaylistStore } from "@/server/playlist/store";

/** Live Qloo /entities (probe 17 Oct, Hopsin): genre tag types end ":genre" (older shapes: "urn:tag:genre:…"). */
export const isGenreTag = (type?: string | null) => Boolean(type && (type.startsWith("urn:tag:genre") || type.endsWith(":genre")));
/** Live Qloo /entities: the audience character tags (Loyal, Passionate, Youthful…) have types ending ":qloo". */
export const isAudienceTag = (type?: string | null) => Boolean(type && type.endsWith(":qloo") && !isGenreTag(type));
import { summarise, type SummaryFacts } from "./summary";

/**
 * One Repertoire research run (hackathons/qloo-2026/repertoire-research-spec.md): ten server steps streamed as tool calls on
 * the learn stream, then the songs to learn saved as learn suggestions and the snapshot saved on the Repertoire. A research
 * run is a learn_runs row (inputs.kind), so it shares the run limit (and the refund when Qloo is down), the history, the
 * no-repeat rule and the replay. Only the last step calls a model, once. Nothing here throws: the stream ends with one `end`.
 *
 * mode "full": every step, for the saved Spotify link. mode "more": fansLove, learn and summary only ("Find more songs to learn"),
 * from the saved snapshot and the current "Artists you sound like", knowing the history.
 */
export type ResearchRunArgs = {
  learn: LearnStore;
  playlists: PlaylistStore;
  playlist: PlaylistRecord;
  spotifyId: string;
  mode: ResearchMode;
  adapters: AdapterContext;
  record: RunRecord;
  run: LearnRun;
  signal?: AbortSignal;
  /** Tests swap the step-9 model. */
  model?: LanguageModel;
  /** Test fault `qloo-budget`: the first step ends the run as if today's Qloo budget were spent. */
  budgetFault?: boolean;
  /** Test fault `research-slow`: wait this long at the start of every step. */
  stepDelayMs?: number;
  /** Test fault `research-cut`: the run stops right after this step starts, with no `end` and the row left running (a stopped function). */
  cutAt?: ResearchStepKey;
  /** Tests shorten the step timeout and the run watchdog (RESEARCH_TIMEOUTS). */
  timeouts?: { stepMs: number; runMs: number };
  /** The performer's answer to "Is one of these you?": a candidate the last run offered, or none of them. */
  qlooChoice?: { id: string } | { none: true };
  /** A genre the performer picked ("Your genre"), used as the first Qloo genre tag when Qloo and Last.fm give the Hive nothing else. */
  genre?: string;
  /**
   * Carry on a run that waited for input (POST /api/playlist/research/<runId>/input): the same run (record), its snapshot (the
   * done steps and what it waits for) and its stored steps. The steps before the waiting one are reused, never fetched again.
   */
  resume?: { input: ResearchInput; snapshot: ResearchSnapshot; stored: StoredLearnStep[] };
};

/** The SoundsLike entries the run saves as the performer's own: at most this many in the list (playlist-schema). */
const SOUNDS_LIKE_MAX = 10;

/** A resumed run's stored steps: everything before the step it waited on (that step runs again with the input). */
export function keptSteps(stored: readonly StoredLearnStep[], stepId: string): StoredLearnStep[] {
  const at = stored.findIndex((e) => e.type === "tool-start" && e.id === stepId);
  return at >= 0 ? stored.slice(0, at) : [...stored];
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const r2 = (n: number | null | undefined) => (n === null || n === undefined || !Number.isFinite(n) ? null : Math.round(n * 100) / 100);
const SPOTIFY_ID = /^[A-Za-z0-9]{22}$/;

class QlooDown extends Error {
  constructor(message: string, readonly budget = false) {
    super(message);
  }
}
/** Test fault `research-cut`: the run is dropped as a stopped function would drop it. */
class RunCut extends Error {}
/** A step ran past RESEARCH_TIMEOUTS.stepMs: the step fails and the run ends (end code "timeout"). */
class StepTimeout extends Error {
  constructor(label: string) {
    super(`${label} took too long`);
  }
}

/** Why Qloo is down for this run: today's budget is spent (the page then offers the examples) or Qloo is not answering. */
const qlooEndCode = (forceBudget = false) => (forceBudget || qlooBudgetSpent() ? "qloo_budget_spent" : "qloo_unavailable") as "qloo_budget_spent" | "qloo_unavailable";

/** U31: the act name was filled in from the last link (or never set) rather than typed by the user, so a new link replaces it. */
export function actNameFollowsProfile(actName: string | null, previousProfileName: string | null | undefined): boolean {
  if (!actName) return true;
  return Boolean(previousProfileName) && nameKey(actName) === nameKey(previousProfileName as string);
}

/**
 * U31: a song's artist is the track's real Spotify artist: the one matching the linked artist id, else the track's first
 * artist; only a track with no artists falls back to the linked artist's name. `isOwn` is true when it is the linked artist.
 */
export function trackArtist(artists: readonly { id: string; name: string }[], linkedId: string, linkedName: string): { name: string; isOwn: boolean } {
  const own = artists.find((a) => a.id === linkedId);
  if (own) return { name: linkedName, isOwn: true };
  const first = artists.find((a) => a.name.trim());
  return first ? { name: first.name.trim(), isOwn: false } : { name: linkedName, isOwn: true };
}

/** U33: fills in the photo of saved sound-alikes that have none, by name, from the research's images. Returns null when nothing changed. */
export function fillSoundsLikeImages(list: readonly SoundsLike[], images: readonly { name: string; image?: string | null }[]): SoundsLike[] | null {
  const byName = new Map<string, string>();
  for (const i of images) if (i.image && /^https:\/\//.test(i.image) && i.image.length <= 500 && !byName.has(nameKey(i.name))) byName.set(nameKey(i.name), i.image);
  let changed = false;
  const next = list.map((a) => {
    const image = a.image ? undefined : byName.get(nameKey(a.name));
    if (!image) return a;
    changed = true;
    return { ...a, image };
  });
  return changed ? next : null;
}

/** The run's LearnTotals (the learn funnel's fields), from the step outputs so far. */
export function researchTotals(steps: ResearchSnapshot["steps"], usage: Pick<QlooUsage, "calls" | "cacheHits">, newSongs = 0): LearnTotals {
  const learn = steps.learn?.output;
  return {
    ...ZERO_LEARN_TOTALS,
    artists: (steps.qloo?.output?.matched ? 1 : 0) + (steps.soundsLike?.output?.artists.length ?? 0),
    liked: steps.fansLove?.output?.artists.length ?? 0,
    songsChecked: learn?.checked ?? 0,
    alreadySuggested: learn?.skipped.alreadySuggested ?? 0,
    dismissedSkipped: learn?.skipped.dismissed ?? 0,
    alreadyKnown: learn?.skipped.canSing ?? 0,
    newSongs,
    qlooCalls: usage.calls,
    qlooCacheHits: usage.cacheHits,
  };
}

export async function executeResearchRun(args: ResearchRunArgs): Promise<void> {
  const { learn, playlists, mode, adapters, record, run } = args;
  const resume = args.resume ?? null;
  const waitingBefore = resume?.snapshot.waiting ?? null;
  // A resumed run sends its kept steps again first, so the panel is the one the performer left, then carries on.
  const kept = resume && waitingBefore ? keptSteps(resume.stored, waitingBefore.stepId) : [];
  const stored: StoredLearnStep[] = [...kept];
  const timeouts = args.timeouts ?? RESEARCH_TIMEOUTS;
  /** Set once the run's `end` is on its way (by the steps, an error or the watchdog): nothing is pushed after it. */
  let ended = false;
  /** The step going on now, for the watchdog to close. */
  let openStep: { id: string; tool: string; key: ResearchStepKey; label: string } | null = null;
  const push = (event: LearnStreamEvent) => {
    if (ended) return;
    run.push(event);
    if (event.type === "status" || event.type === "note" || event.type === "tool-start" || event.type === "tool-end" || event.type === "totals") stored.push(event);
  };
  run.push({
    type: "run",
    runId: record.id,
    number: record.number,
    startedAt: new Date(record.startedAt).toISOString(),
    model: adapters.offline && !args.model ? "mock" : "claude",
    inputs: record.inputs,
    replay: false,
    stepsKept: true,
  });
  if (resume) for (const e of kept) run.push(e);
  else push({ type: "status", message: mode === "more" ? PLAYLIST_COPY.research.moreStarted : PLAYLIST_COPY.research.runStarted });

  const previous = args.playlist.research ?? null;
  // "more" starts from the saved snapshot; a full run starts empty and keeps nothing from the last one; a resumed run keeps the
  // steps before the one it waited on.
  const steps: ResearchSnapshot["steps"] = resume ? structuredClone(resume.snapshot.steps) : mode === "more" && previous ? structuredClone(previous.steps) : {};
  const rerun = resume ? RESEARCH_STEPS.slice(Math.max(0, RESEARCH_STEPS.indexOf(waitingBefore?.step ?? "soundsLike"))) : mode === "more" ? MORE_STEPS : RESEARCH_STEPS;
  for (const k of rerun) delete steps[k];
  let playlist = args.playlist;
  let n = kept.filter((e) => e.type === "tool-start").length;
  let lastStepId = "";
  /** The act's name for this run's summary: the saved one, or the new profile's when the name follows the profile. */
  let actLabel: string | null = args.playlist.actName;
  let usageNow: QlooUsage = { calls: 0, cacheHits: 0 };
  // A resumed run's Qloo counts carry on from the part before the pause.
  const base = resume?.snapshot.totals ?? null;
  const usageTotal = (): QlooUsage => ({ calls: usageNow.calls + (base?.qlooCalls ?? 0), cacheHits: usageNow.cacheHits + (base?.qlooCacheHits ?? 0) });

  const finish = async (end: { status: "done" | "failed" | "fallback"; endCode: RunRecord["endCode"]; saved: Awaited<ReturnType<LearnStore["insertSuggestions"]>>; usage: RunRecord["usage"]; waiting?: ResearchWaiting }) => {
    // One end per run: the steps, an error and the watchdog may race to it.
    if (ended) return;
    ended = true;
    // Steps never started this run are skipped (a full run that stopped early; "more" leaves the others as they were). A paused
    // run's are not started yet, so they stay out of the snapshot.
    if (!end.waiting) for (const k of mode === "more" ? MORE_STEPS : RESEARCH_STEPS) if (!steps[k]) (steps as Record<string, StoredStep>)[k] = { status: "skipped", output: null };
    const totals = researchTotals(steps, usageTotal(), end.saved.length);
    for (const s of end.saved) run.push(suggestionEvent(record.id, s));
    run.push({ type: "totals", totals });
    if (end.usage) run.push({ type: "usage", ...end.usage });
    const finished = { ...record, status: end.status, endCode: end.endCode, newCount: end.saved.length, skippedCount: skippedOf(totals), totals };
    run.push(endOf(finished));
    await learn.finishRun(record.id, { status: end.status, endCode: end.endCode, steps: boundSteps(stored), totals, usage: end.usage, newCount: end.saved.length, skippedCount: skippedOf(totals) });
    // The snapshot: saved whenever the profile was read (a run that couldn't read Spotify keeps the last snapshot).
    if (steps.profile?.status === "done" || mode === "more") {
      const snapshot: ResearchSnapshot = {
        version: 1,
        spotifyArtistId: args.spotifyId,
        fullRunId: mode === "full" ? record.id : (previous?.fullRunId ?? record.id),
        runId: record.id,
        runNumber: record.number,
        mode,
        at: new Date().toISOString(),
        steps,
        totals,
        ...(end.waiting ? { waiting: end.waiting } : {}),
      };
      await playlists.saveResearch(playlist.id, snapshot).catch((error) => log.warn("research snapshot not saved", { error: error instanceof Error ? error.message : "unknown" }));
    }
  };

  /** One step: tool-start, the work, tool-end, then the running totals. A thrown error is a failed step (and the run goes on). */
  async function step<K extends ResearchStepKey>(key: K, input: unknown, work: (via: (source: MentionSource) => void) => Promise<StepOutputs[K]>): Promise<StepOutputs[K] | null> {
    // The watchdog already ended the run: no further step starts.
    if (ended) throw new StepTimeout(RESEARCH_LABELS[key]);
    const id = `rs-${++n}`;
    lastStepId = id;
    const tool = RESEARCH_TOOLS[key];
    openStep = { id, tool, key, label: RESEARCH_LABELS[key] };
    push({ type: "tool-start", id, tool, label: RESEARCH_LABELS[key], input });
    if (args.cutAt === key) {
      ended = true;
      throw new RunCut();
    }
    // `via`: a step with a backup source says which one it is on now, so its running mark shows that source.
    const via = (source: MentionSource) => push({ type: "tool-source", id, source });
    // Every external call the step makes (provider, endpoint, params, status, count, ms, cached), for its RAW panel.
    const calls: CallRecord[] = [];
    const withCalls = () => (calls.length ? { calls } : {});
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      if (args.stepDelayMs) await new Promise((resolve) => setTimeout(resolve, args.stepDelayMs));
      if (args.budgetFault) throw new QlooDown("Today's Qloo budget is spent.", true);
      // The work can't be cancelled; past the step's time it is left behind and the run ends without it.
      const late = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new StepTimeout(RESEARCH_LABELS[key])), timeouts.stepMs);
      });
      const output = await Promise.race([recordCalls(calls, () => work(via)), late]);
      const waits = Boolean((output as { waiting?: unknown }).waiting);
      (steps as Record<string, StoredStep>)[key] = { status: waits ? "waiting" : "done", output };
      push({ type: "tool-end", id, tool, ok: true, summary: output.summary, output, ...withCalls() });
      return output;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      (steps as Record<string, StoredStep>)[key] = { status: "failed", output: null };
      push({ type: "tool-end", id, tool, ok: false, summary: message.slice(0, 300), output: { error: message.slice(0, 600) }, ...withCalls() });
      if (error instanceof QlooDown || error instanceof StepTimeout) throw error;
      return null;
    } finally {
      clearTimeout(timer);
      if (openStep?.id === id) openStep = null;
      push({ type: "totals", totals: researchTotals(steps, usageTotal()) });
    }
  }

  /** A Repertoire edit that must not lose to a stale revision: re-read, write, retry once. */
  async function patch(fields: Omit<Parameters<PlaylistStore["update"]>[1], "revision">) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const fresh = (await playlists.get(playlist.id)) ?? playlist;
      const result = await playlists.update(playlist.id, { ...fields, revision: fresh.revision } as Parameters<PlaylistStore["update"]>[1]);
      if (result.ok) {
        playlist = result.playlist;
        return true;
      }
    }
    return false;
  }

  /**
   * Sound-alikes the run found by itself (the Hive's Last.fm similar artists) saved as "Artists you sound like", marked as the
   * Hive's: merged after the ones already there, up to SOUNDS_LIKE_MAX, and only while the performer has picked none of their own.
   */
  async function saveHiveAlikes(list: readonly SoundsLike[]): Promise<boolean> {
    const fresh = (await playlists.get(playlist.id)) ?? playlist;
    if (fresh.soundsLike.some((a) => a.foundBy !== "hive")) return false;
    const have = new Set(fresh.soundsLike.map((a) => nameKey(a.name)));
    const added = list.filter((a) => !have.has(nameKey(a.name)) && have.add(nameKey(a.name))).map((a): SoundsLike => ({ ...a, name: a.name.slice(0, 80), foundBy: "hive" }));
    if (added.length === 0) return false;
    return patch({ soundsLike: [...fresh.soundsLike, ...added].slice(0, SOUNDS_LIKE_MAX) });
  }

  /** What stands in for the act when Qloo doesn't know it. alikes: artists like it (the performer's own, or found by the Hive); tags: its Spotify genres as Qloo tags; neither: no taste data. */
  const signalAlikes: { current: (SoundsLike & { qlooId: string })[] | null } = { current: null };
  const genreSignal: { tags: { id: string; name: string }[] } = { tags: [] };
  /** The sound-alikes the Qloo steps use: this run's (found by the Hive when the performer's list is empty or unresolved), else the saved list. */
  const alikesNow = (): (SoundsLike & { qlooId: string })[] => signalAlikes.current ?? (playlist.soundsLike.filter((a) => a.qlooId).slice(0, RESEARCH_SIGNAL_SOUND_ALIKES) as (SoundsLike & { qlooId: string })[]);
  const noTaste = (extra: { basedOn?: "soundsLike" | "genres" | "none" } = {}) => ({ summary: PLAYLIST_COPY.research.fallback.noTaste, basedOn: "none" as const, ...extra });

  /** "Artists you sound like" as Qloo signals: the saved ones that have a Qloo id, and (a cached /search each) the ones that lack it, up to the signal cap. */
  async function alikesWithQlooIds(): Promise<(SoundsLike & { qlooId: string })[]> {
    playlist = (await playlists.get(playlist.id)) ?? playlist;
    const room = RESEARCH_SIGNAL_SOUND_ALIKES - playlist.soundsLike.filter((a) => a.qlooId).length;
    const missing = playlist.soundsLike.filter((a) => !a.qlooId).slice(0, Math.max(0, room));
    if (missing.length > 0) {
      const res = await qloo.resolveArtists(missing.map((a) => a.name), adapters, missing.flatMap((a) => (a.spotifyId ? [{ name: a.name, id: a.spotifyId }] : [])));
      if (res.mode === "fallback") throw new QlooDown("Qloo didn't answer for the artists you sound like.");
      const byName = new Map(res.data.flatMap((r) => (r.entity ? [[nameKey(r.query), r.entity] as const] : [])));
      const next = playlist.soundsLike.map((a): SoundsLike => {
        const e = a.qlooId ? undefined : byName.get(nameKey(a.name));
        return e ? { ...a, qlooId: e.id, ...(!a.image && e.image && /^https:\/\//.test(e.image) && e.image.length <= 500 ? { image: e.image } : {}) } : a;
      });
      if (next.some((a, k) => a !== playlist.soundsLike[k])) await patch({ soundsLike: next });
    }
    return playlist.soundsLike.filter((a) => a.qlooId).slice(0, RESEARCH_SIGNAL_SOUND_ALIKES) as (SoundsLike & { qlooId: string })[];
  }

  // The run watchdog: before the function's maxDuration, a run still going is ended as failed (end code "timeout"), its open
  // step closed as too long, so the stream gets its `end` and the row never stays `running`.
  const watchdog = setTimeout(() => {
    if (ended) return;
    log.warn("research run ran out of time", { runId: record.id, step: openStep?.key ?? null });
    if (openStep) {
      const message = new StepTimeout(openStep.label).message;
      (steps as Record<string, StoredStep>)[openStep.key] = { status: "failed", output: null };
      push({ type: "tool-end", id: openStep.id, tool: openStep.tool, ok: false, summary: message, output: { error: message } });
      openStep = null;
    }
    void finish({ status: "failed", endCode: "timeout", saved: [], usage: null })
      .catch(() => undefined)
      .finally(() => {
        if (!run.done) run.finish();
      });
  }, timeouts.runMs);
  try {
    const today = serverToday(MELBOURNE.timeZone);
    await withQlooUsage(async (usage) => {
      usageNow = usage;
      const fromQloo = <T>(result: { mode: string; data: T }, what: string): T => {
        if (result.mode === "fallback") throw new QlooDown(`Qloo didn't answer for ${what}.`);
        return result.data;
      };

      // --- Steps 1–5 (full runs only) ---
      // `own` stays null when Qloo doesn't know the act: "Artists you sound like" are then the signal (the fallback).
      let own: { id: string; name: string } | null = null;
      const basedOn = (text: string) => `${PLAYLIST_COPY.research.fallback.basedOn}: ${text}`;
      /** The genre path's stand-ins: Qloo's artists for the genre tag (step 4), the signal for who and where the fans are. */
      let genreAlikes: { qlooId: string; name: string }[] = [];
      /** The act's own track titles from step 2 (for Last.fm track tags: a lookup, never a model input). */
      const ownTracks = () => {
        const me = nameKey(steps.profile?.output?.name ?? "");
        return (steps.songs?.output?.songs ?? []).filter((t) => !me || nameKey(t.artist) === me).map((t) => t.title);
      };
      /** The genre tags join the signal: Qloo's artists for them, after the sound-alikes already in it (never the act itself). */
      const addTagArtists = async (tags: readonly { id: string; name: string }[]) => {
        genreSignal.tags = [...tags];
        const more = fromQloo(await qloo.tagArtists(tags.map((t) => t.id), RESEARCH_SIGNAL_SOUND_ALIKES + 2, adapters), "artists in your genre");
        const have = signalAlikes.current ?? [];
        const self = new Set([nameKey(actLabel ?? ""), nameKey(playlist.spotifyProfile?.name ?? "")].filter(Boolean));
        const extra = more
          .filter((e) => !self.has(nameKey(e.name)) && !have.some((a) => a.qlooId === e.id))
          .map((e) => ({ name: e.name, qlooId: e.id, ...(e.spotifyId && SPOTIFY_ID.test(e.spotifyId) ? { spotifyId: e.spotifyId } : {}), ...(e.image && /^https:\/\//.test(e.image) ? { image: e.image } : {}) }));
        signalAlikes.current = [...have, ...extra].slice(0, RESEARCH_SIGNAL_SOUND_ALIKES);
      };
      /** A genre-based step's line names the genres it used: "Based on Dembow and Reggaeton". */
      const genreNamesNow = () => genreSignal.tags.map((t) => titleGenre(t.name));
      const basedOnGenres = (text: string) => `${PLAYLIST_COPY.research.fallback.basedOnGenres(genreNamesNow())}: ${text}`;

      /** Steps 1–3 of a full run. Null when the run has ended (Spotify unreadable, Qloo down, or a choice to make). */
      const firstSteps = async (): Promise<{ profile: ProfileOutput; found: QlooOutput } | null> => {
        // 1. The Spotify profile.
        const spotify: { code: "spotify_unavailable" | "spotify_not_found" } = { code: "spotify_unavailable" };
        const profile = await step("profile", { spotifyId: args.spotifyId }, async (): Promise<ProfileOutput> => {
          const res = await getArtistProfile(args.spotifyId, adapters);
          if (!res.data) {
            spotify.code = res.reason === "not_found" ? "spotify_not_found" : "spotify_unavailable";
            throw new Error(spotify.code === "spotify_not_found" ? "Spotify has no artist at that link" : "Spotify didn't answer");
          }
          const p = res.data;
          // The act name follows the new profile unless the user typed their own (U31): a name that is empty or still the previous profile's is auto-filled.
          const follows = actNameFollowsProfile(playlist.actName, playlist.spotifyProfile?.name);
          if (follows) actLabel = p.name.slice(0, 80);
          await patch({ spotifyArtistId: args.spotifyId, spotifyProfile: p, ...(follows ? { actName: p.name.slice(0, 80) } : {}) });
          const image = p.images.find((i) => (i.width ?? 0) >= 160)?.url ?? p.images[0]?.url ?? null;
          return {
            summary: `Read ${p.name} on Spotify${p.genres.length ? `: ${p.genres.slice(0, 3).join(", ")}` : ""}`,
            spotifyId: args.spotifyId,
            name: p.name,
            image,
            genres: p.genres,
            followers: p.followers ?? null,
            href: `https://open.spotify.com/artist/${args.spotifyId}`,
          };
        });
        if (!profile) {
          await finish({ status: "failed", endCode: spotify.code, saved: [], usage: null });
          return null;
        }

        // 2. Your songs, straight into Songs you can sing.
        await step("songs", { artist: profile.name }, async (via): Promise<SongsOutput> => {
          via("spotify");
          const market = knownCity(playlist.city).countryCode;
          const cat = await getArtistCatalogue(args.spotifyId, market, adapters);
          let source: SongsOutput["source"] = "spotify";
          // Spotify answered nothing: rate-limited (say so plainly) or just down. The songs then come from Last.fm.
          const spotifyDown = cat.mode === "fallback";
          const limited = spotifyDown ? Boolean(await spotifyLimitedUntil().catch(() => null)) : false;
          let tracks = (cat.mode === "fallback" ? [] : cat.data).map((t) => ({
            id: SPOTIFY_ID.test(t.id) ? t.id : null,
            title: t.title,
            // The track's real Spotify artist, never the act name blindly (U31).
            artist: trackArtist(t.artists, args.spotifyId, profile.name).name,
            own: trackArtist(t.artists, args.spotifyId, profile.name).isOwn,
            year: t.year,
            durationMs: t.durationMs,
            album: t.album ?? null,
            image: t.image,
            href: t.url ?? (SPOTIFY_ID.test(t.id) ? `https://open.spotify.com/track/${t.id}` : null),
          }));
          if (tracks.length === 0) {
            via("lastfm");
            const fm = await getSongs([profile.name], adapters);
            const top = fm.mode === "fallback" ? [] : (Object.values(fm.data)[0] ?? []);
            source = top.length ? "lastfm" : "none";
            tracks = top.map((t) => ({ id: null, title: t.title, artist: profile.name, own: true, year: null, durationMs: null, album: null, image: null, href: null }));
          }
          const out: SongsOutput = { summary: "", source, songs: [], added: 0, already: 0, ...(spotifyDown ? { spotifyDown: limited ? ("limited" as const) : ("down" as const) } : {}) };
          // All of the act's own songs (U16), written in one batch: one transaction per song took minutes for a big catalogue
          // and the function was stopped mid-step.
          const results = await playlists.addSongs(
            playlist.id,
            tracks.map((t) => ({
              title: t.title.slice(0, 120),
              artist: t.artist.slice(0, 80),
              own: true,
              source: source === "lastfm" ? "lastfm" : "spotify",
              ...(t.id ? { spotifyTrackId: t.id } : {}),
              ...(t.year && t.year >= 1900 && t.year <= 2100 ? { year: t.year } : {}),
              ...(t.durationMs && t.durationMs > 0 && t.durationMs <= 3_600_000 ? { durationMs: t.durationMs } : {}),
              // Covers persist (migration 010): the track or album art, and the act's own photo.
              ...(t.image && /^https:\/\//.test(t.image) && t.image.length <= 500 ? { image: t.image } : {}),
              ...(t.own && profile.image && /^https:\/\//.test(profile.image) && profile.image.length <= 500 ? { artistImage: profile.image } : {}),
            })),
          );
          for (const [i, t] of tracks.entries()) {
            const res = results[i];
            if (res.ok) out.added++;
            else if (res.reason === "duplicate") out.already++;
            else break;
            out.songs.push({ id: res.ok ? res.song.id : null, title: t.title, artist: t.artist, year: t.year, durationMs: t.durationMs, album: t.album, image: t.image, href: t.href });
          }
          const R = PLAYLIST_COPY.research;
          const why = limited ? R.spotifyLimited : spotifyDown ? R.spotifyDown : null;
          out.summary =
            source === "none"
              ? limited ? R.spotifyLimitedNone : spotifyDown ? R.spotifyDownNone : "Found none of your songs on Spotify or Last.fm"
              : `${why ? `${why}. ` : ""}Added ${out.added} of your songs to ${PLAYLIST_COPY.canSing}${out.already ? ` (${out.already} already there)` : ""}`;
          return out;
        });

        // 3. You on Qloo: the Spotify-id lookup, then name searches with variants the confidence rule accepts (lib/qloo-match.ts),
        // then the entity's own tags and description. When nothing is certain the run pauses here and asks; when Qloo doesn't know
        // the act at all, the later steps use "Artists you sound like" as the signal.
        const found = await step("qloo", { spotifyId: args.spotifyId, name: profile.name }, async (): Promise<QlooOutput> => {
          const R = PLAYLIST_COPY.research;
          const empty: QlooOutput = { summary: "", matched: false, qlooId: null, name: null, description: null, genres: [], audience: [], popularity: null, ...(profile.image ? { image: profile.image } : {}) };
          const sameAct = args.playlist.spotifyArtistId === args.spotifyId;
          const before = previous?.spotifyArtistId === args.spotifyId ? previous.steps.qloo?.output : undefined;
          const choice = args.qlooChoice;
          // Only a candidate the last run offered can be chosen.
          const chosenId = choice && "id" in choice && (before?.candidates ?? []).some((c) => c.qlooId === choice.id) ? choice.id : null;
          const declined = (choice && "none" in choice) || (!chosenId && before?.declined === true);
          const detailOf = async (id: string) => {
            const res = await qloo.artistDetail(id, adapters);
            if (res.mode === "fallback") throw new QlooDown("Qloo didn't answer, so your artist couldn't be found.");
            return res.data;
          };
          let entity: { id: string; name: string; popularity: number | null; genres: string[] } | null = null;
          // A name Qloo has but with no music-genre tag: not the taste signal alone, so the Hive's sound-alikes are tried first.
          let weak: { id: string; name: string; popularity: number | null; genres: string[]; by: "id" | "name" } | null = null;
          let detail: qloo.EntityDetail | null = null;
          let by: QlooOutput["by"];
          let candidates: QlooCandidateView[] = [];
          // The performer's pick, then the id already saved for this link, then a search.
          const known = chosenId ?? (!declined && sameAct ? args.playlist.qlooArtistId : null);
          if (known) {
            detail = await detailOf(known);
            if (detail) {
              by = chosenId ? "chosen" : "saved";
              entity = { id: detail.id, name: detail.name, popularity: detail.popularity, genres: [] };
            }
          }
          if (!entity && !declined) {
            const hit = await findOwnOnQloo(args.spotifyId, profile.name, adapters, { actName: actLabel, genres: profile.genres });
            if (hit.qloo === "unavailable") throw new QlooDown("Qloo didn't answer, so your artist couldn't be found.");
            if (hit.entity && hit.weak) weak = { id: hit.entity.id, name: hit.entity.name, popularity: hit.entity.popularity, genres: [], by: hit.by ?? "name" };
            else if (hit.entity) {
              by = hit.by ?? "name";
              entity = { id: hit.entity.id, name: hit.entity.name, popularity: hit.entity.popularity, genres: hit.entity.tags.map((t) => t.name) };
            } else candidates = hit.candidates;
          }
          const matchedOut = async (e: NonNullable<typeof entity>): Promise<QlooOutput> => {
            await patch({ qlooArtistId: e.id });
            if (!detail) {
              const res = await qloo.artistDetail(e.id, adapters);
              detail = res.mode === "fallback" ? null : res.data;
            }
            const genres = [...new Set((detail?.tags ?? e.genres.map((name) => ({ name, type: "urn:tag:genre:music" }))).filter((t) => isGenreTag(t.type)).map((t) => t.name))].slice(0, 8);
            const audience = [...new Set((detail?.tags ?? []).filter((t) => isAudienceTag(t.type)).map((t) => t.name))].slice(0, 6);
            return {
              summary: `Found ${e.name} on Qloo${audience.length ? `: ${audience.slice(0, 3).join(", ")}` : ""}`,
              matched: true,
              qlooId: e.id,
              name: e.name,
              description: detail?.description ?? null,
              genres,
              audience,
              popularity: r2(detail?.popularity ?? e.popularity),
              ...(by ? { by } : {}),
              ...(profile.image ? { image: profile.image } : {}),
            };
          };
          if (entity) return matchedOut(entity);
          await patch({ qlooArtistId: null });
          if (candidates.length > 0) return { ...empty, summary: R.candidates.summary, candidates, waiting: "choice" };
          // Qloo doesn't know the act, and the run never stops for that. The signal, in order: the performer's own "Artists you sound
          // like"; else the Hive finds some (Last.fm similar artists confirmed on Qloo); else the act's genres as Qloo tags; else none.
          const mine = await alikesWithQlooIds();
          const declinedMark = declined ? { declined: true } : {};
          if (mine.length > 0) return { ...empty, summary: R.fallback.label(mine.slice(0, 3).map((a) => a.name)), fallback: "soundsLike", ...declinedMark };
          const genrePick = (args.genre ?? (before?.genrePick && !before.matched ? before.genrePick : undefined))?.trim().slice(0, 40) || undefined;
          const genreMark = genrePick ? { genrePick } : {};
          const hive = await findSoundAlikes({ name: profile.name, actName: actLabel, genres: profile.genres, pick: genrePick ?? null, tracks: ownTracks(), spotifyId: args.spotifyId }, adapters);
          if (hive.source === "unavailable") throw new QlooDown("Qloo didn't answer, so artists like you couldn't be found.");
          if (hive.source === "lastfm") {
            const found = hive.alikes.map((a): SoundsLike & { qlooId: string } => ({ name: a.name, qlooId: a.qlooId, ...(a.spotifyId ? { spotifyId: a.spotifyId } : {}), ...(a.image ? { image: a.image } : {}), foundBy: "hive" }));
            signalAlikes.current = found;
            // Saved as "Artists you sound like" (marked as the Hive's) only when the performer has none of their own: theirs are never overwritten.
            await saveHiveAlikes(found.slice(0, RESEARCH_SOUNDS_LIKE_SAVED));
            return { ...empty, summary: R.fallback.label(found.slice(0, 3).map((a) => a.name)), fallback: "soundsLike", foundByHive: true, ...declinedMark, ...genreMark };
          }
          // Last.fm knows artists like the act but Qloo confirmed none of them by name: each is looked up on Spotify (an exact name
          // gives its id and photo), and a Spotify id is Qloo's certain lookup. Any Qloo knows that way are the signal, as above;
          // otherwise they are still who the act sounds like (step 4 lists them and they are saved) and the act's genres are the signal.
          const market = knownCity(playlist.city).countryCode;
          const similar: SoundsLike[] = [];
          for (const name of hive.similar.slice(0, RESEARCH_SOUNDS_LIKE_SAVED)) {
            const res = await findArtists(name, market, adapters).catch(() => null);
            const hit = res && res.mode !== "fallback" ? res.data.find((a) => nameKey(a.name) === nameKey(name)) : undefined;
            similar.push({
              name: name.slice(0, 80),
              ...(hit && SPOTIFY_ID.test(hit.id) && hit.id !== args.spotifyId ? { spotifyId: hit.id } : {}),
              ...(hit?.image && /^https:\/\//.test(hit.image) && hit.image.length <= 500 ? { image: hit.image } : {}),
            });
          }
          const byId = similar.filter((a) => a.spotifyId);
          const confirmed = byId.length ? await resolveSoundAlikes(byId, { name: profile.name, actName: actLabel, spotifyId: args.spotifyId }, adapters) : null;
          if (confirmed && !confirmed.unavailable && confirmed.found.length > 0) {
            const qlooOf = new Map(byId.flatMap((a, i) => (confirmed.matches[i] ? [[nameKey(a.name), confirmed.matches[i]!.qlooId] as const] : [])));
            const all = similar.map((a): SoundsLike => (qlooOf.has(nameKey(a.name)) ? { ...a, qlooId: qlooOf.get(nameKey(a.name)) } : a));
            signalAlikes.current = all.filter((a): a is SoundsLike & { qlooId: string } => Boolean(a.qlooId)).map((a) => ({ ...a, foundBy: "hive" as const }));
            await saveHiveAlikes(all);
            // The act's own genre tags, when it has some, join the sound-alikes Qloo knows by Spotify id in the signal.
            const tagMark = hive.source === "genres" && hive.tags.length ? { genreTags: hive.tags } : {};
            if (hive.source === "genres" && hive.tags.length) await addTagArtists(hive.tags);
            return { ...empty, summary: R.fallback.label(signalAlikes.current.slice(0, 3).map((a) => a.name)), fallback: "soundsLike", foundByHive: true, ...tagMark, ...declinedMark, ...genreMark };
          }
          const similarMark = similar.length ? { similar } : {};
          if (similar.length) await saveHiveAlikes(similar);
          if (hive.source === "genres") {
            genreSignal.tags = hive.tags;
            return { ...empty, summary: R.fallback.genresLabel(hive.tags.slice(0, 3).map((t) => t.name)), fallback: "genres", genreTags: hive.tags, ...declinedMark, ...genreMark, ...similarMark };
          }
          // Nothing else to go on: a weak match (a name Qloo has, with no genre) is better than no taste data at all.
          if (weak) {
            by = weak.by;
            return matchedOut(weak);
          }
          return { ...empty, summary: R.fallback.noneLabel, fallback: "none", ...declinedMark, ...genreMark, ...similarMark };
        });
        if (!found) {
          await finish({ status: "failed", endCode: qlooEndCode(), saved: [], usage: null });
          return null;
        }
        // "Is one of these you?": a likely match that needs the performer's yes. The run ends cleanly (it doesn't count), the answer starts the next one.
        if (found.waiting) {
          await finish({ status: "done", endCode: "needs_choice", saved: [], usage: null });
          return null;
        }
        if (!found.matched) push({ type: "status", message: found.summary });
        return { profile, found };
      };

      if (mode === "full") {
        // A resumed run reuses steps 1–3 as they are saved; nothing is fetched again.
        const first = resume && steps.profile?.output && steps.qloo?.output ? { profile: steps.profile.output, found: structuredClone(steps.qloo.output) } : resume ? null : await firstSteps();
        if (!first) {
          if (resume) await finish({ status: "failed", endCode: null, saved: [], usage: null });
          return;
        }
        const { profile, found } = first;
        if (found.matched && found.qlooId) own = { id: found.qlooId, name: found.name ?? profile.name };
        const R = PLAYLIST_COPY.research;
        const ask: ResearchAsk = { asks: waitingBefore?.asks ?? 0, tried: structuredClone(waitingBefore?.tried ?? { artists: [], genres: [] }) };

        /** The Qloo step's line follows the input: its kept event is sent again with the new summary (same step id), and the saved copy changes too. */
        const restateQloo = (out: QlooOutput) => {
          const started = kept.find((e) => e.type === "tool-start" && e.tool === RESEARCH_TOOLS.qloo);
          const startId = started?.type === "tool-start" ? started.id : null;
          const at = stored.findIndex((e) => e.type === "tool-end" && e.id === startId);
          if (at < 0) return;
          const prior = stored[at] as Extract<StoredLearnStep, { type: "tool-end" }>;
          const next = { ...prior, summary: out.summary, output: structuredClone(out) } as typeof prior;
          stored[at] = next;
          run.push(next);
        };

        /** The performer's answer: artists saved as theirs and resolved on Qloo, or a genre as a Qloo tag. Returns the next ask's line ("" when found). */
        const applyInput = async (input: ResearchInput): Promise<string> => {
          let line: string = R.ask.first;
          let usedArtists: string[] = [];
          let usedGenres: string[] = [];
          let unmatchedArtists: string[] = [];
          const unmatched: string[] = [];
          const artists = (input.artists ?? []).filter((a, i, all) => all.findIndex((b) => nameKey(b.name) === nameKey(a.name)) === i).slice(0, MAX_RESEARCH_ARTISTS);
          if (artists.length) {
            const res = await resolveSoundAlikes(artists, { name: profile.name, actName: actLabel, spotifyId: args.spotifyId }, adapters);
            if (res.unavailable) throw new QlooDown("Qloo didn't answer for the artists you sound like.");
            // Saved as the performer's own "Artists you sound like" (with the Qloo id when Qloo knows them). The Hive's ones the ask
            // offered are confirmed by sending them (they become the performer's) and dropped when removed; the performer's own stay.
            const fresh = (await playlists.get(playlist.id)) ?? playlist;
            const sent = new Set(artists.map((a) => nameKey(a.name)));
            const pickedImage = (name: string) => artists.find((a) => nameKey(a.name) === nameKey(name))?.image;
            const hitOf = (name: string) => res.matches[artists.findIndex((a) => nameKey(a.name) === nameKey(name))] ?? null;
            const had = fresh.soundsLike
              .filter((a) => a.foundBy !== "hive" || sent.has(nameKey(a.name)))
              .map((a): SoundsLike => {
                const mine: SoundsLike = { ...a };
                delete mine.foundBy;
                const hit = a.qlooId ? null : hitOf(a.name);
                const image = !a.image ? (hit?.image ?? pickedImage(a.name)) : undefined;
                return { ...mine, ...(hit ? { qlooId: hit.qlooId } : {}), ...(image ? { image } : {}) };
              });
            const added = artists
              .filter((a) => !fresh.soundsLike.some((b) => nameKey(b.name) === nameKey(a.name)))
              .map((a): SoundsLike => {
                const hit = hitOf(a.name);
                const spotifyId = a.spotifyId ?? hit?.spotifyId;
                // The Spotify photo the performer picked (resolveSoundAlikes keeps it on the hit), else Qloo's, else the one sent.
                const image = hit?.image ?? a.image;
                return { name: a.name.slice(0, 80), ...(spotifyId ? { spotifyId } : {}), ...(hit ? { qlooId: hit.qlooId } : {}), ...(image ? { image } : {}) };
              });
            await patch({ soundsLike: [...had, ...added].slice(0, SOUNDS_LIKE_MAX) });
            if (res.found.length > 0) {
              signalAlikes.current = res.found.slice(0, RESEARCH_SIGNAL_SOUND_ALIKES).map((a) => ({ name: a.name, qlooId: a.qlooId, ...(a.spotifyId ? { spotifyId: a.spotifyId } : {}), ...(a.image ? { image: a.image } : {}) }));
              delete found.foundByHive;
              Object.assign(found, { fallback: "soundsLike" });
              usedArtists = res.found.slice(0, 3).map((a) => a.name);
              unmatchedArtists = res.unknown;
            } else {
              ask.tried.artists.push(...res.unknown.filter((name) => !ask.tried.artists.includes(name)));
              line = R.ask.unknownArtists(res.unknown);
            }
          }
          const genreTexts = [...new Set((input.genres ?? []).map((g) => g.trim().slice(0, 40)).filter(Boolean))].slice(0, MAX_RESEARCH_GENRES);
          if (genreTexts.length > 0) {
            found.genrePick = genreTexts[0];
            const tags: { id: string; name: string }[] = [];
            // A genre the ask suggested is already a Qloo tag: no second lookup.
            const suggested = new Map((waitingBefore?.suggest?.genres ?? []).map((g) => [normGenre(g.name), { id: g.id, name: g.name }] as const));
            for (const genre of genreTexts) {
              const tag = suggested.get(normGenre(genre)) ?? (await resolveGenreTag(genre, adapters));
              if (tag === "unavailable") throw new QlooDown("Qloo didn't answer for your genre.");
              if (!tag) unmatched.push(genre);
              else if (!tags.some((t) => t.id === tag.id)) tags.push(tag);
            }
            if (tags.length > 0) {
              genreSignal.tags = tags;
              usedGenres = tags.map((t) => titleGenre(t.name));
              if (usedArtists.length > 0) {
                // Both: the resolved artists lead, the genres' artists are added to the signal after them.
                await addTagArtists(tags);
                Object.assign(found, { genreTags: tags });
              } else Object.assign(found, { fallback: "genres", genreTags: tags });
            }
            if (usedArtists.length === 0 && tags.length === 0) {
              for (const genre of unmatched) if (!ask.tried.genres.includes(genre)) ask.tried.genres.push(genre);
              // The newest thing that didn't work is the genre: the line says so.
              line = R.ask.untaggedGenre(andList(unmatched));
            }
          }
          if (usedArtists.length > 0 || usedGenres.length > 0) {
            found.summary = R.fallback.using(usedArtists, usedGenres, [...unmatchedArtists, ...unmatched]);
            restateQloo(found);
            return "";
          }
          return line;
        };

        /** What the ask starts from: the sound-alikes found so far (saved, else Last.fm's), and genres as Qloo tags, the act's own picked. */
        const suggestNow = async (): Promise<ResearchSuggest> => {
          playlist = (await playlists.get(playlist.id)) ?? playlist;
          const saved = playlist.soundsLike.map((a) => ({ name: a.name, ...(a.spotifyId ? { spotifyId: a.spotifyId } : {}), ...(a.image ? { image: a.image } : {}) }));
          const artists = (saved.length ? saved : (found.similar ?? [])).slice(0, MAX_RESEARCH_ARTISTS);
          const genres = await suggestGenres({ name: profile.name, actName: actLabel, genres: profile.genres, pick: found.genrePick ?? null, tracks: ownTracks() }, artists.map((a) => a.name), adapters).catch(() => []);
          // Only confident ones start selected: the act's own clear genres, else ones at least two sound-alikes share. Never a single weak tag.
          const sure = genres.filter((g) => g.confident);
          const own = sure.filter((g) => g.from === "act");
          const picked = new Set((own.length ? own : sure).slice(0, MAX_RESEARCH_GENRES).map((g) => g.id));
          return { artists, genres: genres.map((g) => ({ id: g.id, name: g.name, from: g.from, picked: picked.has(g.id) })) };
        };

        // 4. Who you sound like (editable: saved as "Artists you sound like" only when that list is empty). With no taste signal at
        // all (Qloo doesn't know the act, nor any artist like it, nor a genre), the run waits here for the performer's input.
        const input = resume?.input;
        await step("soundsLike", input ? { artists: (input.artists ?? []).map((a) => a.name), genres: input.genres ?? [] } : {}, async (): Promise<SoundsLikeOutput> => {
          if (!own && found.fallback === "none") {
            let line: string = R.ask.first;
            if (input) line = await applyInput(input);
            else {
              // The performer's own sound-alikes Qloo doesn't know either: the first ask says so.
              const unknown = playlist.soundsLike.filter((a) => !a.qlooId).map((a) => a.name).slice(0, 3);
              if (unknown.length) {
                ask.tried.artists.push(...unknown.filter((name) => !ask.tried.artists.includes(name)));
                line = R.ask.unknownArtists(unknown);
              }
            }
            if (found.fallback === "none") {
              ask.asks++;
              if (ask.asks > RESEARCH_MAX_ASKS) return { summary: R.ask.gaveUp, artists: [], saved: false, gaveUp: true };
              return { summary: line, artists: [], saved: false, waiting: { asks: ask.asks, tried: ask.tried, suggest: await suggestNow() } };
            }
          }
          if (!own && found.fallback === "genres") {
            // A genre stands in for the act: Qloo's artists for that tag are who it sounds like (and the signal for the fans steps).
            if (!genreSignal.tags.length) genreSignal.tags = found.genreTags ?? [];
          const tags = genreSignal.tags;
            const res = fromQloo(await qloo.tagArtists(tags.map((t) => t.id), RESEARCH_SOUNDS_LIKE_SAVED + 4, adapters), "artists in your genre");
            const actKey = nameKey(actLabel ?? profile.name);
            const artists = res
              .filter((e) => nameKey(e.name) !== actKey && nameKey(e.name) !== nameKey(profile.name))
              .slice(0, RESEARCH_SOUNDS_LIKE_SAVED)
              .map((e) => ({ name: e.name, qlooId: e.id, ...(e.spotifyId && SPOTIFY_ID.test(e.spotifyId) ? { spotifyId: e.spotifyId } : {}), ...(e.image && /^https:\/\//.test(e.image) ? { image: e.image } : {}), ...(e.tags.length ? { tags: e.tags.slice(0, 3).map((t) => t.name) } : {}), affinity: r2(e.affinity) }));
            genreAlikes = artists.slice(0, RESEARCH_SIGNAL_SOUND_ALIKES).map((a) => ({ qlooId: a.qlooId, name: a.name }));
            // The Hive's Last.fm sound-alikes, when it found some, are who the act sounds like; the genre's artists only stand in as the signal.
            if (found.similar?.length) {
              const lastfm = found.similar.map((a) => ({ ...a, affinity: null }));
              return { summary: `You sound like ${lastfm.slice(0, 3).map((a) => a.name).join(", ")}`, artists: lastfm, saved: playlist.soundsLike.some((a) => a.foundBy === "hive"), basedOn: "genres" };
            }
            return { summary: artists.length ? basedOnGenres(andList(artists.slice(0, 3).map((a) => a.name))) : "Qloo found no artists in your genre", artists, saved: false, basedOn: "genres", byGenres: genreNamesNow() };
          }
          if (!own) {
            // Qloo doesn't know the act: the artists like it (the performer's, or the ones the Hive found and saved) are the answer.
            if (found.fallback !== "soundsLike") return { summary: PLAYLIST_COPY.research.fallback.noAlikes, artists: [], saved: false };
            const mine = alikesNow().map((a) => ({ name: a.name, qlooId: a.qlooId, ...(a.spotifyId ? { spotifyId: a.spotifyId } : {}), ...(a.image ? { image: a.image } : {}), affinity: null }));
            return { summary: basedOn(andList(mine.slice(0, 3).map((a) => a.name))), artists: mine, saved: found.foundByHive === true && playlist.soundsLike.some((a) => a.foundBy === "hive") };
          }
          const res = await soundsLikeFor(playlist, adapters);
          if (res.status === "unavailable") throw new QlooDown("Qloo didn't answer for the artists you sound like.");
          const artists = res.artists.map((a) => ({ ...a, affinity: null }));
          let saved = false;
          if (playlist.soundsLike.length === 0 && artists.length > 0) {
            // Every saved sound-alike keeps its Qloo photo (U33), so the list never shows initials.
            saved = await patch({
              soundsLike: artists.slice(0, RESEARCH_SOUNDS_LIKE_SAVED).map((a): SoundsLike => ({ name: a.name, qlooId: a.qlooId, ...(a.spotifyId ? { spotifyId: a.spotifyId } : {}), ...(a.image && /^https:\/\//.test(a.image) && a.image.length <= 500 ? { image: a.image } : {}) })),
            });
          } else {
            // A list the user already has: only photos it lacks are filled in, by name.
            const filled = fillSoundsLikeImages(playlist.soundsLike, artists);
            if (filled) await patch({ soundsLike: filled });
          }
          return { summary: artists.length ? `You sound like ${artists.slice(0, 3).map((a) => a.name).join(", ")}` : "Qloo found no artists like you", artists, saved };
        });
        // The Qloo step's saved output follows the input (the signal the later steps and "Find more songs to learn" read).
        if (steps.qloo) (steps.qloo as StoredStep<"qloo">).output = found;
        const four = steps.soundsLike?.output;
        if (four?.waiting) {
          await finish({ status: "done", endCode: "needs_sounds_like", saved: [], usage: null, waiting: { step: "soundsLike", stepId: lastStepId, message: four.summary, asks: four.waiting.asks, tried: four.waiting.tried, ...(four.waiting.suggest ? { suggest: four.waiting.suggest } : {}) } });
          return;
        }
        if (four?.gaveUp) {
          await finish({ status: "done", endCode: "no_taste_data", saved: [], usage: null });
          return;
        }

        // 5. Who your fans are.
        const fansSignal = own ? [own.id] : found.fallback === "soundsLike" ? alikesNow().map((a) => a.qlooId) : found.fallback === "genres" ? genreAlikes.map((a) => a.qlooId) : [];
        await step("fans", {}, async (): Promise<FansOutput> => {
          if (fansSignal.length === 0) return { ...noTaste(), age: [], gender: [], ageLean: null };
          const profileRes = await qloo.crowdProfile(fansSignal, adapters);
          const p = fromQloo(profileRes, "who your fans are");
          const age = Object.entries(p?.age ?? {})
            .map(([key, lean]) => ({ key, label: ageLabel(key), lean: r2(lean) ?? 0 }));
          const gender = Object.entries(p?.gender ?? {}).map(([key, lean]) => ({ key, label: key === "male" ? "Men" : key === "female" ? "Women" : key, lean: r2(lean) ?? 0 }));
          const top = [...age].sort((a, b) => b.lean - a.lean)[0];
          const ageLean = top && top.lean > 0 ? top.label : null;
          const line = ageLean ? `Your fans lean ${ageLean}` : "No clear age lean in Qloo's data";
          const lower = line.charAt(0).toLowerCase() + line.slice(1);
          const byGenre = !own && found.fallback === "genres";
          return { summary: own ? line : byGenre ? basedOnGenres(lower) : basedOn(lower), age, gender, ageLean, ...(own ? {} : byGenre ? { basedOn: "genres" as const, byGenres: genreNamesNow() } : { basedOn: "soundsLike" as const }) };
        });
      } else {
        const q = previous?.steps.qloo?.output;
        if (q?.matched && q.qlooId) own = { id: q.qlooId, name: q.name ?? playlist.actName ?? "you" };
        else if (!q?.fallback || q.waiting === "choice") throw new Error("no research to build on");
        else if (q.fallback === "genres") genreSignal.tags = q.genreTags ?? [];
      }

      // --- Step 6: where your fans are (the Qloo heatmap of you and your sound-alikes, worldwide). Full runs only: "more" keeps the saved map. ---
      if (mode === "full") {
        const fresh = (await playlists.get(playlist.id)) ?? playlist;
        playlist = fresh;
        const fb = steps.qloo?.output?.fallback;
        const mapAlikes = !own && fb === "genres" ? genreAlikes : !own && fb !== "soundsLike" ? [] : alikesNow();
        const noSignal = !own && mapAlikes.length === 0;
        await step("fansMap", { scope: "world", signal: [...(own ? [own.name] : []), ...mapAlikes.map((a) => a.name)] }, async (): Promise<FansMapOutput> => {
          if (noSignal) return { ...noTaste(), cells: [], areas: [], signalledBy: [] };
          // A heatmap Qloo can't give is a failed step, not a failed run: the other steps don't need it.
          return fansMapFor({ own, alikes: mapAlikes, adapters });
        });
      }

      // --- Step 7: what your fans also love (you + your sound-alikes as the signal, all of them left out). ---
      const current = (await playlists.get(playlist.id)) ?? playlist;
      playlist = current;
      const fallbackKind = own ? null : (steps.qloo?.output?.fallback ?? previous?.steps.qloo?.output?.fallback ?? null);
      const alikes = !own && fallbackKind !== "soundsLike" ? [] : alikesNow();
      const signal = [...(own ? [own.id] : []), ...alikes.map((a) => a.qlooId)];
      const nameOf = new Map<string, string>([...(own ? [[own.id, own.name] as [string, string]] : []), ...alikes.map((a) => [a.qlooId, a.name] as [string, string])]);
      const leaveOut = new Set([...signal, ...(steps.soundsLike?.output?.artists ?? []).map((a) => a.qlooId)]);
      const leaveOutNames = new Set([...(own ? [nameKey(own.name)] : []), nameKey(actLabel ?? ""), ...playlist.soundsLike.map((a) => nameKey(a.name))].filter(Boolean));
      const signalNames = [...(own ? [own.name] : []), ...alikes.map((a) => a.name)];
      const history = await learn.history(playlist.id);
      const ctx = new LearnContext(adapters, playlist, history, today, usage);
      const state = new LearnState();
      const genreNames = genreSignal.tags.map((t) => titleGenre(t.name));
      const fansLove = await step("fansLove", { signal: fallbackKind === "genres" ? genreNames : signalNames }, async (): Promise<FansLoveOutput> => {
        if (fallbackKind === "none") return { ...noTaste(), artists: [], signalledBy: [], excluded: 0 };
        // Genre tags stand in for the act: the artists people who like those genres also like.
        const res =
          fallbackKind === "genres"
            ? { artists: fromQloo(await qloo.tagArtists(genreSignal.tags.map((t) => t.id), RESEARCH_FANS_LOVE_TAKE, adapters), "what your fans also love") }
            : fromQloo(await qloo.tasteArtists(signal, RESEARCH_FANS_LOVE_TAKE, adapters), "what your fans also love");
        const kept = res.artists.filter((a) => !leaveOut.has(a.id) && !leaveOutNames.has(nameKey(a.name)));
        const artists = kept.slice(0, RESEARCH_FANS_LOVE_KEPT).map((e) => {
          const because = [...new Set(e.explanation.map((x) => x.name ?? nameOf.get(x.entityId) ?? null).filter((x): x is string => Boolean(x)))].slice(0, 2);
          state.artists.set(e.id, { id: e.id, name: e.name, from: "related_artists", affinity: r2(e.affinity), because, growth: null, trendDelta: null, pitch: null, related: true, listeners: e.lastfmListeners });
          return {
            name: e.name,
            qlooId: e.id,
            ...(e.spotifyId && SPOTIFY_ID.test(e.spotifyId) ? { spotifyId: e.spotifyId } : {}),
            ...(e.image && /^https:\/\//.test(e.image) ? { image: e.image } : {}),
            ...(e.tags.length ? { tags: e.tags.slice(0, 3).map((t) => t.name) } : {}),
            affinity: r2(e.affinity),
            because,
          };
        });
        const line = artists.length ? `Your fans also love ${artists.slice(0, 3).map((a) => a.name).join(", ")}` : "Qloo found no other artists your fans love";
        return {
          summary: own ? line : fallbackKind === "genres" ? basedOnGenres(line.charAt(0).toLowerCase() + line.slice(1)) : basedOn(line.charAt(0).toLowerCase() + line.slice(1)),
          artists,
          signalledBy: fallbackKind === "genres" ? genreNames : signalNames,
          excluded: res.artists.length - kept.length,
          ...(own ? {} : fallbackKind === "genres" ? { basedOn: "genres" as const, byGenres: genreNamesNow() } : { basedOn: "soundsLike" as const }),
        };
      });

      // U33: photos the saved "Artists you sound like" still lack, from what fans love and the sound-alikes this run found.
      {
        const filled = fillSoundsLikeImages(playlist.soundsLike, [...(fansLove?.artists ?? []), ...(steps.soundsLike?.output?.artists ?? [])]);
        if (filled) await patch({ soundsLike: filled });
      }

      // --- Step 8: songs to learn from those artists' top tracks, the whole history left out (the learn run's top_tracks). ---
      if (fansLove && fansLove.artists.length > 0) {
        const pick = fansLove.artists.slice(0, RESEARCH_LEARN_ARTISTS).map((a) => a.qlooId);
        await step("learn", { artists: fansLove.artists.slice(0, RESEARCH_LEARN_ARTISTS).map((a) => a.name) }, async (): Promise<LearnOutput> => {
          const found = await runTopTracks(ctx, state, pick, RESEARCH_LEARN_PER_ARTIST);
          const photo = new Map(fansLove.artists.filter((a) => a.image).map((a) => [a.qlooId, a.image as string]));
          const out = { ...found, songs: found.songs.map((s) => (photo.has(s.artistId) ? { ...s, artistImage: photo.get(s.artistId) } : s)) };
          return { ...out, summary: out.songs.length ? `Found ${plural(out.songs.length, "song")} your fans would stop for` : out.summary };
        });
      }

      // --- Step 9: your sound in genres (full runs only) ---
      if (mode === "full") {
        await step("genres", {}, async (): Promise<GenresOutput> => {
          if (!own && fallbackKind === "none") return { ...noTaste(), tags: [] };
          if (!own && fallbackKind === "genres") {
            const out = genreSignal.tags.map((t) => ({ id: t.id, name: titleGenre(t.name), affinity: null }));
            return { summary: `Your sound: ${out.slice(0, 3).map((t) => t.name).join(", ")}`, tags: out, basedOn: "genres" };
          }
          const tags = fromQloo(await qloo.actGenres(signal, RESEARCH_GENRES_TAKE, adapters), "your genres");
          const seen = new Set<string>();
          const out = tags
            .map((t) => ({ id: t.id, name: t.name.trim().replace(/\b\w/g, (c) => c.toUpperCase()), affinity: r2(t.affinity) }))
            .filter((t) => t.name && isMusicGenreTag(t) && !seen.has(t.id) && seen.add(t.id));
          const line = out.length ? `Your sound: ${out.slice(0, 3).map((t) => t.name).join(", ")}` : "Qloo has no genres for your sound";
          return { summary: own ? line : basedOn(line.charAt(0).toLowerCase() + line.slice(1)), tags: out, ...(own ? {} : { basedOn: "soundsLike" as const }) };
        });
      }

      // --- Step 10: one Claude call ranks the songs and sums up the act ---
      // The numbers the model may cite: what its prompt carries, so not the Spotify steps (profile, songs) it never sees.
      for (const [key, s] of Object.entries(steps)) if (s?.output && key !== "profile" && key !== "songs") state.seen.add(s.output);
      const q = steps.qloo?.output;
      const fans = steps.fans?.output;
      // No Spotify field reaches the model (Spotify Developer Terms §IV.2): the act's name is Qloo's, else the one the
      // performer saved, never the Spotify profile's; no Spotify genres or followers. The songs are Last.fm's (runTopTracks).
      const facts: SummaryFacts = {
        act: (q?.matched ? q.name : null) ?? (mode === "full" ? actLabel : playlist.actName) ?? own?.name ?? "this act",
        ...(own || fallbackKind !== "soundsLike" ? {} : { basedOnSoundsLike: true }),
        description: q?.description ?? null,
        audience: q?.audience ?? [],
        genres: (steps.genres?.output?.tags ?? []).slice(0, 4).map((t) => t.name),
        soundsLike: (fallbackKind === "soundsLike" ? alikesNow() : playlist.soundsLike).slice(0, 4).map((a) => a.name),
        fansLove: (fansLove?.artists ?? []).slice(0, 4).map((a) => a.name),
        ageLean: fans?.ageLean ?? null,
        genderLean: (() => {
          const g = [...(fans?.gender ?? [])].sort((a, b) => b.lean - a.lean)[0];
          return g && g.lean > 0.05 ? `a little more ${g.label.toLowerCase()}` : null;
        })(),
      };
      const nine: { usage: RunRecord["usage"]; picks: ReturnType<typeof buildSuggestions>; by: SummaryOutput["by"] } = { usage: null, picks: [], by: "template" };
      await step("summary", {}, async (): Promise<SummaryOutput> => {
        const result = await summarise(facts, state, ctx, { offline: adapters.offline, model: args.model, signal: args.signal });
        nine.usage = result.usage;
        nine.by = result.by;
        // Spotify's covers and links join the picks only now, after the model call: the model saw Last.fm's songs alone.
        if (result.accepted) await joinSpotifyDisplay(state, result.accepted.picks.map((p) => p.songId), ctx);
        const picks = (nine.picks = result.accepted ? buildSuggestions(result.accepted, state, ctx, result.by) : []);
        return { summary: summaryLine(result.by, picks.length), by: result.by, picks: picks.length };
      });

      const saved = nine.picks.length ? await learn.insertSuggestions(playlist.id, record.id, nine.picks) : [];
      const status = saved.length === 0 ? "done" : nine.by === "template" ? "fallback" : "done";
      const endCode = saved.length === 0 ? "nothing_new" : nine.by === "template" ? "model_unavailable" : null;
      await finish({ status, endCode, saved, usage: nine.usage });
    });
  } catch (error) {
    const down = error instanceof QlooDown;
    const late = error instanceof StepTimeout;
    // research-cut: no end and no finishRun, so the row stays running like a function stopped mid-step.
    if (error instanceof RunCut) return;
    if (!down && !late) log.error("research run failed", { error: error instanceof Error ? error.message : "unknown" });
    await finish({ status: "failed", endCode: down ? qlooEndCode((error as QlooDown).budget) : late ? "timeout" : null, saved: [], usage: null }).catch(() => undefined);
  } finally {
    clearTimeout(watchdog);
    if (!run.done) run.finish();
  }
}
