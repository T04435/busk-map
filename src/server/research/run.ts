import "server-only";
import type { LanguageModel } from "ai";
import { ageLabel } from "@/lib/age";
import { skippedOf, ZERO_LEARN_TOTALS, type LearnStreamEvent, type LearnTotals, type StoredLearnStep } from "@/lib/learn-schema";
import { PLAYLIST_COPY } from "@/lib/playlist-copy";
import type { SoundsLike } from "@/lib/playlist-schema";
import {
  MORE_STEPS,
  RESEARCH_LABELS,
  RESEARCH_SOURCES,
  RESEARCH_STEPS,
  RESEARCH_TOOLS,
  type FansLoveOutput,
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
} from "@/lib/repertoire-research";
import { nameKey } from "@/lib/text";
import type { AdapterContext } from "@/server/adapters/core";
import * as qloo from "@/server/adapters/qloo";
import { withQlooUsage, type QlooUsage } from "@/server/adapters/qloo/usage";
import { getArtistCatalogue, getArtistProfile } from "@/server/adapters/repertoire";
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
  MAX_SONGS,
  RESEARCH_FANS_LOVE_KEPT,
  RESEARCH_FANS_LOVE_TAKE,
  RESEARCH_GENRES_TAKE,
  RESEARCH_LEARN_ARTISTS,
  RESEARCH_LEARN_PER_ARTIST,
  RESEARCH_OWN_SONGS_MAX,
  RESEARCH_SIGNAL_SOUND_ALIKES,
  RESEARCH_SOUNDS_LIKE_SAVED,
} from "@/server/playlist/config";
import { findOwnOnQloo, soundsLikeFor } from "@/server/playlist/own-artist";
import type { PlaylistRecord, PlaylistStore } from "@/server/playlist/store";

/** Live Qloo /entities (probe 17 Oct, Hopsin): genre tag types end ":genre" (older shapes: "urn:tag:genre:…"). */
export const isGenreTag = (type?: string | null) => Boolean(type && (type.startsWith("urn:tag:genre") || type.endsWith(":genre")));
/** Live Qloo /entities: the audience character tags (Loyal, Passionate, Youthful…) have types ending ":qloo". */
export const isAudienceTag = (type?: string | null) => Boolean(type && type.endsWith(":qloo") && !isGenreTag(type));
import { summarise, type SummaryFacts } from "./summary";

/**
 * One Repertoire research run (hackathons/qloo-2026/repertoire-research-spec.md): nine server steps streamed as tool calls on
 * the learn stream, then the songs to learn saved as learn suggestions and the snapshot saved on the Repertoire. A research
 * run is a learn_runs row (inputs.kind), so it shares the run limit (and the refund when Qloo is down), the history, the
 * no-repeat rule and the replay. Only step 9 calls a model, once. Nothing here throws: the stream ends with one `end`.
 *
 * mode "full": every step, for the saved Spotify link. mode "more": steps 6, 7 and 9 only ("Find more songs to learn"),
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
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const r2 = (n: number | null | undefined) => (n === null || n === undefined || !Number.isFinite(n) ? null : Math.round(n * 100) / 100);
const SPOTIFY_ID = /^[A-Za-z0-9]{22}$/;

class QlooDown extends Error {}

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
  async function step<K extends ResearchStepKey>(key: K, input: unknown, work: () => Promise<StepOutputs[K]>): Promise<StepOutputs[K] | null> {
    const id = `rs-${++n}`;
    const tool = RESEARCH_TOOLS[key];
    push({ type: "tool-start", id, tool, label: RESEARCH_LABELS[key], source: RESEARCH_SOURCES[key], input });
    try {
      const output = await work();
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

  try {
    const today = serverToday(CITIES.melbourne.timeZone);
    await withQlooUsage(async (usage) => {
      usageNow = usage;
      const fromQloo = <T>(result: { mode: string; data: T }, what: string): T => {
        if (result.mode === "fallback") throw new QlooDown(`Qloo didn't answer for ${what}.`);
        return result.data;
      };

      // --- Steps 1–5 (full runs only) ---
      let own: { id: string; name: string } | null = null;
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
          await patch({ spotifyArtistId: args.spotifyId, spotifyProfile: p, ...(playlist.actName ? {} : { actName: p.name.slice(0, 80) }) });
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

        // 2. Your songs, straight into Songs you can sing, tagged Your song.
        await step("songs", { artist: profile.name }, async (): Promise<SongsOutput> => {
          const market = CITIES[(playlist.city in CITIES ? playlist.city : "melbourne") as keyof typeof CITIES].countryCode;
          const cat = await getArtistCatalogue(args.spotifyId, market, adapters);
          let source: SongsOutput["source"] = "spotify";
          let tracks = (cat.mode === "fallback" ? [] : cat.data).map((t) => ({
            id: SPOTIFY_ID.test(t.id) ? t.id : null,
            title: t.title,
            artist: profile.name,
            year: t.year,
            durationMs: t.durationMs,
            album: t.album ?? null,
            image: t.image,
            href: t.url ?? (SPOTIFY_ID.test(t.id) ? `https://open.spotify.com/track/${t.id}` : null),
          }));
          if (tracks.length === 0) {
            const fm = await getSongs([profile.name], adapters);
            const top = fm.mode === "fallback" ? [] : (Object.values(fm.data)[0] ?? []);
            source = top.length ? "lastfm" : "none";
            tracks = top.map((t) => ({ id: null, title: t.title, artist: profile.name, year: null, durationMs: null, album: null, image: null, href: t.url }));
          }
          const out: SongsOutput = { summary: "", source, songs: [], added: 0, already: 0, full: false };
          for (const t of tracks.slice(0, RESEARCH_OWN_SONGS_MAX)) {
            const res = await playlists.addSong(playlist.id, {
              title: t.title.slice(0, 120),
              artist: t.artist.slice(0, 80),
              own: true,
              source: source === "lastfm" ? "lastfm" : "spotify",
              ...(t.id ? { spotifyTrackId: t.id } : {}),
              ...(t.year && t.year >= 1900 && t.year <= 2100 ? { year: t.year } : {}),
              ...(t.durationMs && t.durationMs > 0 && t.durationMs <= 3_600_000 ? { durationMs: t.durationMs } : {}),
            });
            if (res.ok) out.added++;
            else if (res.reason === "duplicate") out.already++;
            else {
              out.full = true;
              break;
            }
            out.songs.push({ ...t, id: res.ok ? res.song.id : null });
          }
          out.summary =
            source === "none"
              ? "Found none of your songs on Spotify or Last.fm"
              : `Added ${out.added} of your songs to ${PLAYLIST_COPY.canSing}${out.already ? ` (${out.already} already there)` : ""}${out.full ? `; your Repertoire is full (${MAX_SONGS})` : ""}`;
          return out;
        });

        // 3. You on Qloo: the resolver, then the entity's own tags and description.
        const found = await step("qloo", { spotifyId: args.spotifyId, name: profile.name }, async (): Promise<QlooOutput> => {
          const hit = await findOwnOnQloo(args.spotifyId, profile.name, adapters);
          if (hit.qloo === "unavailable") throw new QlooDown("Qloo didn't answer, so your artist couldn't be found.");
          await patch({ qlooArtistId: hit.entity?.id ?? null });
          if (!hit.entity) return { summary: "Qloo doesn't know this artist yet", matched: false, qlooId: null, name: null, description: null, genres: [], audience: [], popularity: null };
          const detail = await qloo.artistDetail(hit.entity.id, adapters);
          const d = detail.mode === "fallback" ? null : detail.data;
          const genres = [...new Set((d?.tags ?? hit.entity.tags.map((t) => ({ ...t, type: "urn:tag:genre:music" }))).filter((t) => isGenreTag(t.type)).map((t) => t.name))].slice(0, 8);
          const audience = [...new Set((d?.tags ?? []).filter((t) => isAudienceTag(t.type)).map((t) => t.name))].slice(0, 6);
          return {
            summary: `Found ${hit.entity.name} on Qloo${audience.length ? `: ${audience.slice(0, 3).join(", ")}` : ""}`,
            matched: true,
            qlooId: hit.entity.id,
            name: hit.entity.name,
            description: d?.description ?? null,
            genres,
            audience,
            popularity: r2(d?.popularity ?? hit.entity.popularity),
          };
        });
        if (!found?.matched || !found.qlooId) {
          await finish({ status: "failed", endCode: found ? "no_match" : "qloo_unavailable", saved: [], usage: null });
          return;
        }
        own = { id: found.qlooId, name: found.name ?? profile.name };

        // 4. Who you sound like (editable: saved as "Artists you sound like" only when that list is empty).
        await step("soundsLike", {}, async (): Promise<SoundsLikeOutput> => {
          const res = await soundsLikeFor(playlist, adapters);
          if (res.status === "unavailable") throw new QlooDown("Qloo didn't answer for the artists you sound like.");
          const artists = res.artists.map((a) => ({ ...a, affinity: null }));
          let saved = false;
          if (playlist.soundsLike.length === 0 && artists.length > 0) {
            saved = await patch({ soundsLike: artists.slice(0, RESEARCH_SOUNDS_LIKE_SAVED).map((a): SoundsLike => ({ name: a.name, qlooId: a.qlooId, ...(a.spotifyId ? { spotifyId: a.spotifyId } : {}) })) });
          }
          return { summary: artists.length ? `You sound like ${artists.slice(0, 3).map((a) => a.name).join(", ")}` : "Qloo found no artists like you", artists, saved };
        });

        // 5. Who your fans are.
        await step("fans", {}, async (): Promise<FansOutput> => {
          const profileRes = await qloo.crowdProfile([own!.id], adapters);
          const p = fromQloo(profileRes, "who your fans are");
          const age = Object.entries(p?.age ?? {})
            .map(([key, lean]) => ({ key, label: ageLabel(key), lean: r2(lean) ?? 0 }));
          const gender = Object.entries(p?.gender ?? {}).map(([key, lean]) => ({ key, label: key === "male" ? "Men" : key === "female" ? "Women" : key, lean: r2(lean) ?? 0 }));
          const top = [...age].sort((a, b) => b.lean - a.lean)[0];
          const ageLean = top && top.lean > 0 ? top.label : null;
          return { summary: ageLean ? `Your fans lean ${ageLean}` : "No clear age lean in Qloo's data", age, gender, ageLean };
        });
      } else {
        const q = previous?.steps.qloo?.output;
        if (!q?.qlooId) throw new Error("no research to build on");
        own = { id: q.qlooId, name: q.name ?? playlist.actName ?? "you" };
      }

      // --- Step 6: what your fans also love (you + your sound-alikes as the signal, all of them left out). ---
      const current = (await playlists.get(playlist.id)) ?? playlist;
      playlist = current;
      const alikes = playlist.soundsLike.filter((a) => a.qlooId).slice(0, RESEARCH_SIGNAL_SOUND_ALIKES) as (SoundsLike & { qlooId: string })[];
      const signal = [own.id, ...alikes.map((a) => a.qlooId)];
      const nameOf = new Map<string, string>([[own.id, own.name], ...alikes.map((a) => [a.qlooId, a.name] as [string, string])]);
      const leaveOut = new Set([...signal, ...(steps.soundsLike?.output?.artists ?? []).map((a) => a.qlooId)]);
      const leaveOutNames = new Set([nameKey(own.name), ...playlist.soundsLike.map((a) => nameKey(a.name))]);
      const history = await learn.history(playlist.id);
      const ctx = new LearnContext(adapters, playlist, history, today, usage);
      const state = new LearnState();
      const fansLove = await step("fansLove", { signal: [own.name, ...alikes.map((a) => a.name)] }, async (): Promise<FansLoveOutput> => {
        const res = fromQloo(await qloo.tasteArtists(signal, RESEARCH_FANS_LOVE_TAKE, adapters), "what your fans also love");
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
        return {
          summary: artists.length ? `Your fans also love ${artists.slice(0, 3).map((a) => a.name).join(", ")}` : "Qloo found no other artists your fans love",
          artists,
          signalledBy: [own!.name, ...alikes.map((a) => a.name)],
          excluded: res.artists.length - kept.length,
        };
      });

      // --- Step 7: songs to learn from those artists' top tracks, the whole history left out (the learn run's top_tracks). ---
      if (fansLove && fansLove.artists.length > 0) {
        const pick = fansLove.artists.slice(0, RESEARCH_LEARN_ARTISTS).map((a) => a.qlooId);
        await step("learn", { artists: fansLove.artists.slice(0, RESEARCH_LEARN_ARTISTS).map((a) => a.name) }, async (): Promise<LearnOutput> => {
          const out = await runTopTracks(ctx, state, pick, RESEARCH_LEARN_PER_ARTIST);
          return { ...out, summary: out.songs.length ? `Found ${plural(out.songs.length, "song")} your fans would stop for` : out.summary };
        });
      }

      // --- Step 8: your sound in genres (full runs only) ---
      if (mode === "full") {
        await step("genres", {}, async (): Promise<GenresOutput> => {
          const tags = fromQloo(await qloo.actGenres([own!.id], RESEARCH_GENRES_TAKE, adapters), "your genres");
          const seen = new Set<string>();
          const out = tags
            .map((t) => ({ id: t.id, name: t.name.trim().replace(/\b\w/g, (c) => c.toUpperCase()), affinity: r2(t.affinity) }))
            .filter((t) => t.name && !seen.has(t.id) && seen.add(t.id));
          return { summary: out.length ? `Your sound: ${out.slice(0, 3).map((t) => t.name).join(", ")}` : "Qloo has no genres for your sound", tags: out };
        });
      }

      // --- Step 9: one Claude call ranks the songs and sums up the act ---
      for (const s of Object.values(steps)) if (s?.output) state.seen.add(s.output);
      const p = steps.profile?.output;
      const q = steps.qloo?.output;
      const fans = steps.fans?.output;
      const facts: SummaryFacts = {
        act: playlist.actName ?? p?.name ?? own.name,
        spotifyGenres: p?.genres.slice(0, 4) ?? [],
        followers: p?.followers ?? null,
        description: q?.description ?? null,
        audience: q?.audience ?? [],
        genres: (steps.genres?.output?.tags ?? []).slice(0, 4).map((t) => t.name),
        soundsLike: playlist.soundsLike.slice(0, 4).map((a) => a.name),
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
        const who = result.by === "claude" ? "Claude" : result.by === "mock" ? "The test model" : "The data";
        return { summary: `${who} ranked ${plural(picks.length, "song")} and summed up your act`, text: result.text, by: result.by, picks: picks.length };
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
