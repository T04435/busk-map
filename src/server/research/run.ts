import "server-only";
import type { LanguageModel } from "ai";
import { ageLabel } from "@/lib/age";
import { skippedOf, ZERO_LEARN_TOTALS, type LearnStreamEvent, type LearnTotals, type StoredLearnStep } from "@/lib/learn-schema";
import type { MentionSource } from "@/lib/mention";
import { andList, PLAYLIST_COPY } from "@/lib/playlist-copy";
import type { QlooCandidateView } from "@/lib/qloo-match";
import type { SoundsLike } from "@/lib/playlist-schema";
import {
  MORE_STEPS,
  RESEARCH_LABELS,
  RESEARCH_SOURCES,
  RESEARCH_STEPS,
  RESEARCH_TOOLS,
  type FansLoveOutput,
  type FansMapOutput,
  type FansOutput,
  type GenresOutput,
  type LearnOutput,
  type ProfileOutput,
  type QlooOutput,
  type ResearchMode,
  type ResearchSnapshot,
  type ResearchStepKey,
  type SongsOutput,
  type SoundsLikeOutput,
  type StepOutputs,
  type StoredStep,
  type SummaryOutput,
  summaryLine,
} from "@/lib/repertoire-research";
import { nameKey } from "@/lib/text";
import type { AdapterContext } from "@/server/adapters/core";
import * as qloo from "@/server/adapters/qloo";
import { withQlooUsage, type QlooUsage } from "@/server/adapters/qloo/usage";
import { getArtistCatalogue, getArtistProfile } from "@/server/adapters/repertoire";
import { spotifyLimitedUntil } from "@/server/adapters/repertoire/pacer";
import { getSongs } from "@/server/adapters/songs";
import { CITIES } from "@/server/cities";
import { serverToday } from "@/server/clock";
import { log } from "@/server/log";
import { LearnContext } from "@/server/learn/context";
import { boundSteps } from "@/server/learn/run";
import { endOf, suggestionEvent } from "@/server/learn/replay";
import type { LearnRun } from "@/server/learn/runs";
import type { LearnStore } from "@/server/learn/store";
import { buildSuggestions, LearnState, runTopTracks } from "@/server/learn/tools";
import type { RunRecord } from "@/server/learn/types";
import {
  RESEARCH_FANS_LOVE_KEPT,
  RESEARCH_FANS_LOVE_TAKE,
  RESEARCH_GENRES_TAKE,
  RESEARCH_LEARN_ARTISTS,
  RESEARCH_LEARN_PER_ARTIST,
  RESEARCH_SIGNAL_SOUND_ALIKES,
  RESEARCH_SOUNDS_LIKE_SAVED,
} from "@/server/playlist/config";
import { fansMapFor } from "./fans-map";
import { isMusicGenreTag } from "@/lib/genre-tags";
import { findOwnOnQloo, findSoundAlikes, soundsLikeFor } from "@/server/playlist/own-artist";
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
  /** Test fault `research-slow`: wait this long at the start of every step. */
  stepDelayMs?: number;
  /** The performer's answer to "Is one of these you?": a candidate the last run offered, or none of them. */
  qlooChoice?: { id: string } | { none: true };
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const r2 = (n: number | null | undefined) => (n === null || n === undefined || !Number.isFinite(n) ? null : Math.round(n * 100) / 100);
const SPOTIFY_ID = /^[A-Za-z0-9]{22}$/;

class QlooDown extends Error {}

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
  const stored: StoredLearnStep[] = [];
  const push = (event: LearnStreamEvent) => {
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
  push({ type: "status", message: mode === "more" ? PLAYLIST_COPY.research.moreStarted : PLAYLIST_COPY.research.runStarted });

  const previous = args.playlist.research ?? null;
  // "more" starts from the saved snapshot; a full run starts empty and keeps nothing from the last one.
  const steps: ResearchSnapshot["steps"] = mode === "more" && previous ? structuredClone(previous.steps) : {};
  for (const k of mode === "more" ? MORE_STEPS : RESEARCH_STEPS) delete steps[k];
  let playlist = args.playlist;
  let n = 0;
  /** The act's name for this run's summary: the saved one, or the new profile's when the name follows the profile. */
  let actLabel: string | null = args.playlist.actName;
  let usageNow: QlooUsage = { calls: 0, cacheHits: 0 };

  const finish = async (end: { status: "done" | "failed" | "fallback"; endCode: RunRecord["endCode"]; saved: Awaited<ReturnType<LearnStore["insertSuggestions"]>>; usage: RunRecord["usage"] }) => {
    // Steps never started this run are skipped (a full run that stopped early; "more" leaves the others as they were).
    for (const k of mode === "more" ? MORE_STEPS : RESEARCH_STEPS) if (!steps[k]) (steps as Record<string, StoredStep>)[k] = { status: "skipped", output: null };
    const totals = researchTotals(steps, usageNow, end.saved.length);
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
      };
      await playlists.saveResearch(playlist.id, snapshot).catch((error) => log.warn("research snapshot not saved", { error: error instanceof Error ? error.message : "unknown" }));
    }
  };

  /** One step: tool-start, the work, tool-end, then the running totals. A thrown error is a failed step (and the run goes on). */
  async function step<K extends ResearchStepKey>(key: K, input: unknown, work: (via: (source: MentionSource) => void) => Promise<StepOutputs[K]>): Promise<StepOutputs[K] | null> {
    const id = `rs-${++n}`;
    const tool = RESEARCH_TOOLS[key];
    push({ type: "tool-start", id, tool, label: RESEARCH_LABELS[key], source: RESEARCH_SOURCES[key], input });
    // `via`: a step with a backup source says which one it is on now, so its running mark shows that source.
    const via = (source: MentionSource) => push({ type: "tool-source", id, source });
    try {
      if (args.stepDelayMs) await new Promise((resolve) => setTimeout(resolve, args.stepDelayMs));
      const output = await work(via);
      (steps as Record<string, StoredStep>)[key] = { status: "done", output };
      push({ type: "tool-end", id, tool, ok: true, summary: output.summary, output });
      return output;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      (steps as Record<string, StoredStep>)[key] = { status: "failed", output: null };
      push({ type: "tool-end", id, tool, ok: false, summary: message.slice(0, 300), output: { error: message.slice(0, 600) } });
      if (error instanceof QlooDown) throw error;
      return null;
    } finally {
      push({ type: "totals", totals: researchTotals(steps, usageNow) });
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

  try {
    const today = serverToday(CITIES.melbourne.timeZone);
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
      if (mode === "full") {
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
          return;
        }

        // 2. Your songs, straight into Songs you can sing.
        await step("songs", { artist: profile.name }, async (via): Promise<SongsOutput> => {
          via("spotify");
          const market = CITIES[(playlist.city in CITIES ? playlist.city : "melbourne") as keyof typeof CITIES].countryCode;
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
          for (const t of tracks) {
            const res = await playlists.addSong(playlist.id, {
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
            });
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
            if (hit.entity) {
              by = hit.by ?? "name";
              entity = { id: hit.entity.id, name: hit.entity.name, popularity: hit.entity.popularity, genres: hit.entity.tags.map((t) => t.name) };
            } else candidates = hit.candidates;
          }
          await patch({ qlooArtistId: entity?.id ?? null });
          if (entity) {
            if (!detail) {
              const res = await qloo.artistDetail(entity.id, adapters);
              detail = res.mode === "fallback" ? null : res.data;
            }
            const genres = [...new Set((detail?.tags ?? entity.genres.map((name) => ({ name, type: "urn:tag:genre:music" }))).filter((t) => isGenreTag(t.type)).map((t) => t.name))].slice(0, 8);
            const audience = [...new Set((detail?.tags ?? []).filter((t) => isAudienceTag(t.type)).map((t) => t.name))].slice(0, 6);
            return {
              summary: `Found ${entity.name} on Qloo${audience.length ? `: ${audience.slice(0, 3).join(", ")}` : ""}`,
              matched: true,
              qlooId: entity.id,
              name: entity.name,
              description: detail?.description ?? null,
              genres,
              audience,
              popularity: r2(detail?.popularity ?? entity.popularity),
              ...(by ? { by } : {}),
              ...(profile.image ? { image: profile.image } : {}),
            };
          }
          if (candidates.length > 0) return { ...empty, summary: R.candidates.summary, candidates, waiting: "choice" };
          // Qloo doesn't know the act, and the run never stops for that. The signal, in order: the performer's own "Artists you sound
          // like"; else the Hive finds some (Last.fm similar artists confirmed on Qloo); else the act's genres as Qloo tags; else none.
          const mine = await alikesWithQlooIds();
          const declinedMark = declined ? { declined: true } : {};
          if (mine.length > 0) return { ...empty, summary: R.fallback.label(mine.slice(0, 3).map((a) => a.name)), fallback: "soundsLike", ...declinedMark };
          const hive = await findSoundAlikes({ name: profile.name, actName: actLabel, genres: profile.genres }, adapters);
          if (hive.source === "unavailable") throw new QlooDown("Qloo didn't answer, so artists like you couldn't be found.");
          if (hive.source === "lastfm") {
            const found = hive.alikes.map((a): SoundsLike & { qlooId: string } => ({ name: a.name, qlooId: a.qlooId, ...(a.spotifyId ? { spotifyId: a.spotifyId } : {}), ...(a.image ? { image: a.image } : {}), foundBy: "hive" }));
            signalAlikes.current = found;
            // Saved as "Artists you sound like" (marked as the Hive's) only when the performer has none of their own: theirs are never overwritten.
            if (playlist.soundsLike.length === 0) await patch({ soundsLike: found.slice(0, RESEARCH_SOUNDS_LIKE_SAVED) });
            return { ...empty, summary: R.fallback.label(found.slice(0, 3).map((a) => a.name)), fallback: "soundsLike", foundByHive: true, ...declinedMark };
          }
          if (hive.source === "genres") {
            genreSignal.tags = hive.tags;
            return { ...empty, summary: R.fallback.genresLabel(hive.tags.slice(0, 3).map((t) => t.name)), fallback: "genres", genreTags: hive.tags, ...declinedMark };
          }
          return { ...empty, summary: R.fallback.noneLabel, fallback: "none", ...declinedMark };
        });
        if (!found) {
          await finish({ status: "failed", endCode: "qloo_unavailable", saved: [], usage: null });
          return;
        }
        // Paused only on "Is one of these you?": a likely match that needs the performer's yes. The run ends cleanly (it doesn't count), the answer starts the next one.
        if (found.waiting) {
          await finish({ status: "done", endCode: "needs_choice", saved: [], usage: null });
          return;
        }
        if (found.matched && found.qlooId) own = { id: found.qlooId, name: found.name ?? profile.name };
        else push({ type: "status", message: found.summary });

        // 4. Who you sound like (editable: saved as "Artists you sound like" only when that list is empty).
        await step("soundsLike", {}, async (): Promise<SoundsLikeOutput> => {
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

        // 5. Who your fans are.
        await step("fans", {}, async (): Promise<FansOutput> => {
          if (!own && found.fallback !== "soundsLike") return { ...noTaste(), age: [], gender: [], ageLean: null };
          const profileRes = await qloo.crowdProfile(own ? [own.id] : alikesNow().map((a) => a.qlooId), adapters);
          const p = fromQloo(profileRes, "who your fans are");
          const age = Object.entries(p?.age ?? {})
            .map(([key, lean]) => ({ key, label: ageLabel(key), lean: r2(lean) ?? 0 }));
          const gender = Object.entries(p?.gender ?? {}).map(([key, lean]) => ({ key, label: key === "male" ? "Men" : key === "female" ? "Women" : key, lean: r2(lean) ?? 0 }));
          const top = [...age].sort((a, b) => b.lean - a.lean)[0];
          const ageLean = top && top.lean > 0 ? top.label : null;
          const line = ageLean ? `Your fans lean ${ageLean}` : "No clear age lean in Qloo's data";
          return { summary: own ? line : basedOn(line.charAt(0).toLowerCase() + line.slice(1)), age, gender, ageLean, ...(own ? {} : { basedOn: "soundsLike" as const }) };
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
        const noSignal = !own && steps.qloo?.output?.fallback !== "soundsLike";
        const mapAlikes = noSignal ? [] : alikesNow();
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
      const genreNames = genreSignal.tags.map((t) => t.name);
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
          summary: own || fallbackKind === "genres" ? line : basedOn(line.charAt(0).toLowerCase() + line.slice(1)),
          artists,
          signalledBy: fallbackKind === "genres" ? genreNames : signalNames,
          excluded: res.artists.length - kept.length,
          ...(own ? {} : { basedOn: fallbackKind === "genres" ? ("genres" as const) : ("soundsLike" as const) }),
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
            const out = genreSignal.tags.map((t) => ({ id: t.id, name: t.name.trim().replace(/\b\w/g, (c) => c.toUpperCase()), affinity: null }));
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
      for (const s of Object.values(steps)) if (s?.output) state.seen.add(s.output);
      const p = steps.profile?.output;
      const q = steps.qloo?.output;
      const fans = steps.fans?.output;
      const facts: SummaryFacts = {
        act: (mode === "full" ? actLabel : playlist.actName) ?? p?.name ?? own?.name ?? "this act",
        ...(own || fallbackKind !== "soundsLike" ? {} : { basedOnSoundsLike: true }),
        spotifyGenres: p?.genres.slice(0, 4) ?? [],
        followers: p?.followers ?? null,
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
    if (!down) log.error("research run failed", { error: error instanceof Error ? error.message : "unknown" });
    await finish({ status: "failed", endCode: down ? "qloo_unavailable" : null, saved: [], usage: null }).catch(() => undefined);
  } finally {
    run.finish();
  }
}
