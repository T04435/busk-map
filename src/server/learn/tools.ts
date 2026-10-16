import "server-only";
import { tool } from "ai";
import { z } from "zod";
import { ageLabel } from "@/lib/age";
import { LEARN_TOOL_LABELS, LEARN_TOOL_SOURCES } from "@/lib/learn-tools";
import { playlistSongKey } from "@/lib/playlist-schema";
import { nameKey, songKey } from "@/lib/text";
import type { AdapterResult } from "@/server/adapters/core";
import * as qloo from "@/server/adapters/qloo";
import { NumberBag } from "@/server/agent/number-bag";
import { boxAround } from "@/server/agent/where";
import { catalogueOf } from "@/server/songs/catalogue";
import { LEARN_LIMITS, LEARN_MAX_PER_ARTIST, LEARN_MAX_PICKS, LEARN_MIN_PICKS, LEARN_OVER_REPRESENTED_AT, LEARN_TOOL_CAPS } from "@/server/playlist/config";
import type { LearnContext } from "./context";
import { leftOutReason } from "./history";
import type { Evidence, NewSuggestion } from "./types";

export { LEARN_TOOL_LABELS, LEARN_TOOL_SOURCES };

/**
 * The learn run's tools (docs/playlist-architecture.md §2.2–2.3, §2.6). Claude chooses each tool's inputs; the tools reuse
 * the cached, paced adapters, so every Qloo call stays behind the same caching, pacing and timeouts as the busk agent,
 * and is counted against the run's budget (LEARN_QLOO_BUDGET). Every output is what the model sees and what the page
 * shows under the step; each has a one-line `summary`.
 *
 * Guardrails live here: ids only from this run's own results, `top_tracks` leaves out the whole history on the server,
 * the final answer is checked by `checkPicks`, and numbers in the words must come from a tool result.
 */
const r2 = (n: number | null | undefined) => (n === null || n === undefined || !Number.isFinite(n) ? null : Math.round(n * 100) / 100);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** An error the model sees and can act on. */
export class LearnToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LearnToolError";
  }
}

export type ArtistInfo = {
  id: string;
  name: string;
  /** Where the run first met the artist. */
  from: "related_artists" | "crowd_at";
  affinity: number | null;
  /** Names of the input artists that explain the result (Qloo explainability), strongest first. */
  because: string[];
  growth: number | null;
  trendDelta: number | null;
  /** The usual pitch whose crowd likes them, when a crowd_at read returned them. */
  pitch: string | null;
  related: boolean;
  listeners: number | null;
};

export type FoundSong = {
  songId: string;
  songKey: string;
  title: string;
  artist: string;
  artistId: string;
  spotifyTrackId: string | null;
  year: number | null;
  durationMs: number | null;
  image: string | null;
  sourceUrl: string | null;
  source: "spotify" | "lastfm";
  popularity: number | null;
};

export type AcceptedPick = { songId: string; reason: string; buildsOn: string | null; templated: boolean };
export type AcceptedAnswer = { picks: AcceptedPick[]; summary: string; notes: string[] };

/** Per-run state the tools share: what the run found, what it spent, and the accepted answer. */
export class LearnState {
  /** Numbers the model has seen (prompt and tool outputs), for the numbers check. */
  readonly seen = new NumberBag();
  readonly artists = new Map<string, ArtistInfo>();
  /** Songs top_tracks returned in THIS run, by songId. Picks come only from here. */
  readonly found = new Map<string, FoundSong>();
  /** Artists whose songs have been looked up. */
  readonly looked = new Set<string>();
  /** Artists skipped because the Repertoire already has 3 or more of their songs: a run that finds only these has nothing new. */
  coveredSeen = 0;
  readonly calls: Record<string, number> = {};
  readonly successes: Record<string, number> = {};
  answer: AcceptedAnswer | null = null;
  rejections = 0;
  /** Set near the step or token cap: top_tracks opens whatever the looks, so finish_suggestions has songs to choose from. */
  wrappingUp = false;
  /** Set when the model's words couldn't be salvaged: the run stops and the fallback ranks the data. */
  giveUp = false;
  /** Set when the answer was accepted only after the numbers check failed MAX rejections times. */
  templatedReasons = 0;
  songCounter = 0;
  /** Qloo tools run one at a time, so the budget pre-check sees the true count. */
  chain: Promise<unknown> = Promise.resolve();
  /** The Qloo-tool order and the artists named, for the trace. */
  readonly trace: string[] = [];
}

// --- Gating (investigate first) ---

/** `top_tracks` opens after related_artists and after crowd_at or rising; or when the run is wrapping up. */
export function songsOpen(state: Pick<LearnState, "successes" | "wrappingUp">): boolean {
  if (state.wrappingUp) return true;
  const done = (t: string) => (state.successes[t] ?? 0) > 0;
  return done("related_artists") && (done("crowd_at") || done("rising"));
}

/** `finish_suggestions` opens once top_tracks has returned songs; or when the run is wrapping up. */
export function finishOpen(state: Pick<LearnState, "found" | "wrappingUp">): boolean {
  return state.found.size > 0 || state.wrappingUp;
}

export function gateMessage(state: Pick<LearnState, "successes">): string {
  const done = (t: string) => (state.successes[t] ?? 0) > 0;
  const missing = [done("related_artists") ? null : "related_artists at least once", done("crowd_at") || done("rising") ? null : "crowd_at or rising at least once"].filter(Boolean);
  return `top_tracks isn't open yet: investigate first. Still needed: ${missing.join(" and ")}.`;
}

const GATES: Record<string, { open: (state: LearnState) => boolean; message: (state: LearnState) => string }> = {
  top_tracks: { open: songsOpen, message: gateMessage },
  finish_suggestions: { open: finishOpen, message: () => "finish_suggestions isn't open yet: call top_tracks first, then choose from the songs it returns." },
};

// --- Words ---

/** The template reason (also the fallback's): only facts the tools returned, no numbers. */
export function templateReason(artist: Pick<ArtistInfo, "name" | "because" | "pitch" | "related">): string {
  const fans = artist.because.slice(0, 2);
  const crowd = artist.pitch ? ` The crowd at ${artist.pitch} likes them too.` : "";
  if (fans.length > 0) return `Fans of ${fans.join(" and ")} also like ${artist.name}.${crowd}`.slice(0, 240);
  return artist.pitch ? `The crowd at ${artist.pitch} likes ${artist.name}.` : `Fans of your songs also like ${artist.name}.`;
}

export function templateSummary(count: number): string {
  return `${plural(count, "song")} your fans and crowds like, picked from the data.`;
}

// --- Inputs and outputs ---

export const finishSuggestionsSchema = z.object({
  picks: z
    .array(
      z.object({
        songId: z.string().max(20).describe("A songId exactly as returned by top_tracks in this run, e.g. 's-3'."),
        reason: z.string().min(1).max(240).describe("One sentence a busker would find useful. Every number in it must come from a tool result."),
        buildsOn: z.string().max(120).optional().describe("A title from their Learned list, only if this song follows it."),
      }),
    )
    .min(1)
    .max(LEARN_MAX_PICKS),
  summary: z.string().max(400).describe("One or two sentences for the run, from tool results only."),
  notes: z.array(z.string().max(300)).max(4).describe("Data caveats, e.g. a missing source."),
});
export type FinishAnswer = z.infer<typeof finishSuggestionsSchema>;

export type Problem = { kind: "pool" | "repeat" | "artist" | "count" | "numbers"; message: string; songIds?: string[]; numbers?: string[] };

/** How many picks a run needs: 3, or fewer when fewer valid songs exist (2 per artist at most). */
export function wantedPicks(state: Pick<LearnState, "found">): number {
  const perArtist = new Map<string, number>();
  for (const s of state.found.values()) perArtist.set(s.artistId, (perArtist.get(s.artistId) ?? 0) + 1);
  const achievable = [...perArtist.values()].reduce((sum, n) => sum + Math.min(LEARN_MAX_PER_ARTIST, n), 0);
  return Math.min(LEARN_MIN_PICKS, achievable);
}

const isOverRepresented = (ctx: Pick<LearnContext, "perArtist">, artist: string) => (ctx.perArtist.get(nameKey(artist)) ?? 0) >= LEARN_OVER_REPRESENTED_AT;

/** The guardrails on the final answer (docs §2.6). Pure, so tests can call it directly. */
export function checkPicks(answer: FinishAnswer, state: LearnState, ctx: Pick<LearnContext, "keys" | "perArtist">): Problem[] {
  if (state.found.size === 0) return [{ kind: "pool", message: "Call top_tracks before finishing." }];
  const problems: Problem[] = [];
  const ids = answer.picks.map((p) => p.songId);
  const unknown = ids.filter((id) => !state.found.has(id));
  if (unknown.length) {
    const valid = [...state.found.values()].slice(0, 10).map((s) => `${s.songId} (${s.title}, ${s.artist})`).join("; ");
    state.seen.add(valid);
    problems.push({ kind: "pool", songIds: unknown, message: `Not from this run's top_tracks: ${unknown.join(", ")}. Use songIds that top_tracks returned. Valid: ${valid}.` });
  }
  if (new Set(ids).size !== ids.length) problems.push({ kind: "repeat", message: "Each song only once." });
  const chosen = [...new Set(ids)].flatMap((id) => (state.found.has(id) ? [state.found.get(id)!] : []));
  for (const song of chosen) {
    // top_tracks already leaves these out, so this is a backstop (the history can change while a run goes on).
    if (leftOutReason(ctx.keys, song.songKey)) problems.push({ kind: "repeat", songIds: [song.songId], message: `${song.title} by ${song.artist} is already in the history: never offer a song twice.` });
  }
  const perArtist = new Map<string, FoundSong[]>();
  for (const song of chosen) perArtist.set(song.artistId, [...(perArtist.get(song.artistId) ?? []), song]);
  for (const songs of perArtist.values()) {
    if (isOverRepresented(ctx, songs[0].artist)) problems.push({ kind: "artist", songIds: songs.map((s) => s.songId), message: `${songs[0].artist} already has ${LEARN_OVER_REPRESENTED_AT} or more songs in the Repertoire: pick another artist.` });
    else if (songs.length > LEARN_MAX_PER_ARTIST) problems.push({ kind: "artist", songIds: songs.map((s) => s.songId), message: `At most ${LEARN_MAX_PER_ARTIST} songs by ${songs[0].artist}.` });
  }
  const want = wantedPicks(state);
  if (new Set(ids).size < want) problems.push({ kind: "count", message: `Choose at least ${want} songs.` });
  const text = [answer.summary, ...answer.picks.map((p) => p.reason), ...answer.notes].join(" ");
  const bad = state.seen.unknownIn(text);
  if (bad.length) problems.push({ kind: "numbers", numbers: bad, message: `These numbers aren't in any tool result: ${bad.join(", ")}. Use only numbers the tools returned.` });
  return problems;
}

/** A `buildsOn` title that matches the Learned list, else null (dropped silently, never a rejection). */
function validBuildsOn(title: string | undefined, ctx: Pick<LearnContext, "learned">): string | null {
  if (!title) return null;
  const hit = ctx.learned.find((s) => songKey(s.title) === songKey(title));
  return hit ? hit.title : null;
}

/** The answer when nothing is wrong. */
export function acceptAnswer(answer: FinishAnswer, ctx: Pick<LearnContext, "learned">): AcceptedAnswer {
  const seen = new Set<string>();
  return {
    picks: answer.picks.filter((p) => !seen.has(p.songId) && seen.add(p.songId)).map((p) => ({ songId: p.songId, reason: p.reason, buildsOn: validBuildsOn(p.buildsOn, ctx), templated: false })),
    summary: answer.summary,
    notes: answer.notes,
  };
}

/**
 * After MAX rejections (docs §2.6): picks with only number problems stay, with the template reason in place of the
 * unverified one; picks that break the rules (not this run's songs, repeats, artist caps) are dropped. Null when too few
 * remain, and the run falls back to the data.
 */
export function salvageAnswer(answer: FinishAnswer, state: LearnState, ctx: Pick<LearnContext, "keys" | "perArtist" | "learned">): AcceptedAnswer | null {
  const kept: AcceptedPick[] = [];
  const used = new Set<string>();
  const perArtist = new Map<string, number>();
  for (const p of answer.picks) {
    const song = state.found.get(p.songId);
    if (!song || used.has(p.songId) || leftOutReason(ctx.keys, song.songKey) || isOverRepresented(ctx, song.artist)) continue;
    if ((perArtist.get(song.artistId) ?? 0) >= LEARN_MAX_PER_ARTIST) continue;
    used.add(p.songId);
    perArtist.set(song.artistId, (perArtist.get(song.artistId) ?? 0) + 1);
    const templated = state.seen.unknownIn(p.reason).length > 0;
    const info = state.artists.get(song.artistId);
    kept.push({
      songId: p.songId,
      reason: templated ? templateReason(info ?? { name: song.artist, because: [], pitch: null, related: false }) : p.reason,
      buildsOn: validBuildsOn(p.buildsOn, ctx),
      templated,
    });
  }
  if (kept.length < wantedPicks(state) || kept.length === 0) return null;
  const summaryBad = state.seen.unknownIn(answer.summary).length > 0;
  return {
    picks: kept,
    summary: summaryBad ? templateSummary(kept.length) : answer.summary,
    notes: answer.notes.filter((n) => state.seen.unknownIn(n).length === 0),
  };
}

/** The saved rows for an accepted answer. Every catalogue field comes from the top_tracks record, never from the model. */
export function buildSuggestions(accepted: AcceptedAnswer, state: LearnState, ctx: Pick<LearnContext, "learned" | "sungArtists" | "soundsLikeArtists">, ranker: Evidence["ranker"]): NewSuggestion[] {
  return accepted.picks.flatMap((pick, i) => {
    const song = state.found.get(pick.songId);
    if (!song) return [];
    const info = state.artists.get(song.artistId);
    const basedOn: Evidence["basedOn"] = [];
    const add = (kind: Evidence["basedOn"][number]["kind"], name: string) => {
      if (!basedOn.some((b) => b.kind === kind && b.name === name)) basedOn.push({ kind, name });
    };
    if (pick.buildsOn) add("learned", pick.buildsOn);
    for (const name of info?.because ?? []) {
      const learned = ctx.learned.find((l) => nameKey(l.artist) === nameKey(name));
      if (learned) add("learned", learned.title);
      else if (ctx.sungArtists.has(nameKey(name))) add("repertoire", name);
      else if (ctx.soundsLikeArtists.has(nameKey(name))) add("soundsLike", name);
    }
    if (info?.pitch) add("crowd", info.pitch);
    return [
      {
        songKey: song.songKey,
        title: song.title,
        artist: song.artist,
        spotifyTrackId: song.spotifyTrackId,
        qlooArtistId: song.artistId,
        year: song.year,
        durationMs: song.durationMs,
        imageUrl: song.image && song.image.startsWith("https://i.scdn.co/") ? song.image : null,
        sourceUrl: song.sourceUrl,
        songSource: song.source,
        reason: pick.reason.slice(0, 240),
        rank: i + 1,
        evidence: {
          ranker: pick.templated ? "template" : ranker,
          artistFrom: info?.from ?? "related_artists",
          because: info?.because ?? [],
          affinity: info?.affinity ?? null,
          growth: info?.growth ?? null,
          trendDelta: info?.trendDelta ?? null,
          ...(info?.pitch ? { pitch: info.pitch } : {}),
          basedOn: basedOn.slice(0, 4),
        },
      },
    ];
  });
}

// --- The tools ---

type Row = {
  artistId: string;
  name: string;
  affinity: number | null;
  because: string[];
  growth: number | null;
  alreadyInPlaylist: boolean;
};

export type TopTracksOutput = {
  summary: string;
  songs: { songId: string; title: string; artist: string; artistId: string; year: number | null; durationMs: number | null; source: "spotify" | "lastfm"; popularity: number | null }[];
  checked: number;
  skipped: { alreadySuggested: number; dismissed: number; canSing: number };
  overRepresented: string[];
  noSongs: string[];
  /** The artists this call looked up, so the model doesn't ask for them again. */
  lookedUp: string[];
};

/**
 * top_tracks, also run by the server for the fallback: songs by these artists, with the WHOLE history left out here
 * (suggested before, dismissed, already sung), so the model can't repeat itself however the prompt is truncated.
 */
export async function runTopTracks(ctx: LearnContext, state: LearnState, artistIds: string[], perArtist: number): Promise<TopTracksOutput> {
  const unknown = artistIds.filter((id) => !state.artists.has(id));
  if (unknown.length) {
    const valid = [...state.artists.values()].slice(0, 12).map((a) => `${a.id} (${a.name})`).join("; ");
    throw new LearnToolError(`Unknown artistId ${unknown.join(", ")}: use ids returned by related_artists, crowd_at or rising in this run. Known: ${valid}.`);
  }
  const again = artistIds.filter((id) => state.looked.has(id));
  if (again.length) throw new LearnToolError(`You already looked up songs by ${again.map((id) => state.artists.get(id)!.name).join(", ")}. Choose other artists, or finish.`);
  const out: TopTracksOutput = { summary: "", songs: [], checked: 0, skipped: { alreadySuggested: 0, dismissed: 0, canSing: 0 }, overRepresented: [], noSongs: [], lookedUp: [] };
  let lastfm = 0;
  for (const id of [...new Set(artistIds)]) {
    const info = state.artists.get(id)!;
    state.looked.add(id);
    out.lookedUp.push(id);
    if (isOverRepresented(ctx, info.name)) {
      out.overRepresented.push(info.name);
      state.coveredSeen++;
      continue;
    }
    const catalogue = await catalogueOf(info.name, ctx.market, ctx.adapters);
    if (catalogue.tracks.length === 0) {
      out.noSongs.push(info.name);
      continue;
    }
    if (catalogue.source === "lastfm") lastfm++;
    const taken: FoundSong[] = [];
    const considered = new Set<string>();
    for (const t of catalogue.tracks) {
      const key = playlistSongKey(t.artist, t.title);
      if (considered.has(key)) continue;
      considered.add(key);
      out.checked++;
      const why = leftOutReason(ctx.keys, key);
      if (why === "dismissed") out.skipped.dismissed++;
      else if (why === "alreadySuggested") out.skipped.alreadySuggested++;
      else if (why === "alreadyKnown") out.skipped.canSing++;
      else if (taken.length < perArtist && ![...state.found.values()].some((f) => f.songKey === key)) {
        taken.push({
          songId: `s-${++state.songCounter}`,
          songKey: key,
          title: t.title,
          artist: t.artist,
          artistId: id,
          spotifyTrackId: t.spotifyTrackId,
          year: t.year,
          durationMs: t.durationMs,
          image: t.image,
          sourceUrl: t.url,
          source: catalogue.source,
          popularity: t.popularity,
        });
      }
    }
    for (const f of taken) state.found.set(f.songId, f);
    for (const f of taken) out.songs.push({ songId: f.songId, title: f.title, artist: f.artist, artistId: f.artistId, year: f.year, durationMs: f.durationMs, source: f.source, popularity: f.popularity });
  }
  const left = [
    out.skipped.alreadySuggested ? `${plural(out.skipped.alreadySuggested, "song")} suggested before` : null,
    out.skipped.dismissed ? `${plural(out.skipped.dismissed, "song")} you dismissed` : null,
    out.skipped.canSing ? `${plural(out.skipped.canSing, "song")} you already sing` : null,
  ].filter(Boolean);
  const via = lastfm > 0 ? `Spotify (Last.fm for ${lastfm})` : "Spotify";
  out.summary = `Picked top tracks on ${via}${out.songs.length ? ` for ${plural(new Set(out.songs.map((s) => s.artistId)).size, "artist")}` : ""}.${left.length ? ` Left out ${left.join(" and ")}` : ""}`.trim();
  if (out.songs.length === 0 && out.checked === 0) out.summary = out.overRepresented.length ? `Left out ${out.overRepresented.join(", ")}: already well covered in your Repertoire` : "No songs found for those artists";
  return out;
}

export function createLearnTools(ctx: LearnContext, state: LearnState) {
  const tools = buildTools(ctx, state);
  // Gate, count and cap every call; a gated call costs no cap slot.
  for (const [name, t] of Object.entries(tools) as [string, { execute?: (...args: never[]) => unknown }][]) {
    const execute = t.execute;
    if (!execute) continue;
    t.execute = (async (...args: never[]) => {
      const gate = GATES[name];
      if (gate && !gate.open(state)) throw new LearnToolError(gate.message(state));
      const cap = LEARN_TOOL_CAPS[name as keyof typeof LEARN_TOOL_CAPS];
      state.calls[name] = (state.calls[name] ?? 0) + 1;
      if (cap !== undefined && state.calls[name] > cap) throw new LearnToolError(`${name} can be used ${cap} time${cap === 1 ? "" : "s"} in a run and you have used it. Use what you have.`);
      const out = (await execute(...args)) as { skipped?: unknown; accepted?: boolean } | undefined;
      if (typeof out?.skipped !== "string" && (name !== "finish_suggestions" || out?.accepted)) state.successes[name] = (state.successes[name] ?? 0) + 1;
      return out;
    }) as typeof execute;
  }
  return tools;
}

function buildTools(ctx: LearnContext, state: LearnState) {
  /** Every output is recorded for the numbers check, then returned. */
  const seen = <T>(output: T): T => {
    state.seen.add(output);
    return output;
  };
  /** Qloo tools run one at a time, so the budget pre-check sees the true count. */
  const serial = <T>(fn: () => Promise<T>): Promise<T> => {
    const next = state.chain.then(fn, fn);
    state.chain = next.catch(() => undefined);
    return next;
  };
  const budgetSkip = (what: string) => seen({ summary: "The Qloo budget for this run is used up. Choose songs with what you have.", skipped: "budget", tool: what });
  const fromQloo = <T>(result: AdapterResult<T>, what: string): T => {
    if (result.mode === "fallback") {
      ctx.qlooFailed = true;
      throw new LearnToolError(`Qloo didn't answer for ${what}. Carry on with what you have, or finish.`);
    }
    return result.data;
  };
  const remember = (e: qloo.QlooEntity, from: ArtistInfo["from"], pitch: string | null): Row => {
    const because = [...e.explanation]
      .sort((a, b) => b.score - a.score)
      .flatMap((x) => {
        const name = x.name ?? ctx.seedName(x.entityId);
        return name ? [name] : [];
      })
      .filter((n, i, all) => all.indexOf(n) === i)
      .slice(0, 2);
    const growth = e.audienceGrowth && e.audienceGrowth !== 0 ? r2(e.audienceGrowth) : null;
    const have = state.artists.get(e.id);
    if (have) {
      have.related ||= from === "related_artists";
      if (pitch && !have.pitch) have.pitch = pitch;
      if (!have.because.length) have.because = because;
      have.growth ??= growth;
      have.affinity = Math.max(have.affinity ?? 0, e.affinity ?? 0) || have.affinity;
    } else {
      state.artists.set(e.id, { id: e.id, name: e.name, from, affinity: r2(e.affinity), because, growth, trendDelta: null, pitch, related: from === "related_artists", listeners: e.lastfmListeners });
    }
    return { artistId: e.id, name: e.name, affinity: r2(e.affinity), because, growth, alreadyInPlaylist: ctx.sungArtists.has(nameKey(e.name)) };
  };
  const seedIds = (names?: string[]): string[] => {
    const matched = ctx.matched;
    if (!names?.length) return matched.map((s) => s.entity!.id);
    const picked = matched.filter((s) => names.some((n) => nameKey(n) === nameKey(s.name) || nameKey(n) === nameKey(s.entity!.name)));
    if (picked.length === 0) throw new LearnToolError(`None of ${names.join(", ")} is a matched artist. Matched: ${matched.map((s) => s.entity!.name).join(", ")}.`);
    return picked.map((s) => s.entity!.id);
  };

  const pitchNames = [...new Set(ctx.pitches.map((p) => p.name))];
  const pitchChoices: [string, ...string[]] = pitchNames.length ? [pitchNames[0], ...pitchNames.slice(1), "city"] : ["city"];

  return {
    related_artists: tool({
      description:
        "Artists whose fans overlap the Repertoire's fans, anywhere (Qloo), with which of the act's artists explain each one. Use it to find artists close to the act's taste, or to a song they have learned.",
      inputSchema: z.object({
        seeds: z.array(z.string().max(80)).max(10).optional().describe("Names of the matched artists to signal; default all."),
        take: z.number().int().min(5).max(30).default(20).describe("How many artists to return."),
      }),
      execute: ({ seeds, take }) =>
        serial(async () => {
          const ids = seedIds(seeds);
          if (ctx.qlooLeft() < 1) return budgetSkip("related_artists");
          const res = fromQloo(await qloo.tasteArtists(ids, take, ctx.adapters), "related artists");
          const artists = res.artists.slice(0, take).map((e) => remember(e, "related_artists", null));
          return seen({
            summary: artists.length ? `Found ${artists.length} artists your fans also like` : "Qloo found no related artists",
            artists,
          });
        }),
    }),

    crowd_at: tool({
      description:
        "The artists the crowd at one of the act's usual pitches likes, given the act's taste (Qloo, with which of the act's artists explain each one). 'city' reads the whole city centre. Use it to find artists that fit where they busk.",
      inputSchema: z.object({
        pitch: z.enum(pitchChoices).describe("One of the act's usual pitches by name, or 'city'."),
        take: z.number().int().min(5).max(15).default(10),
      }),
      execute: ({ pitch, take }) =>
        serial(async () => {
          const ids = seedIds();
          if (ctx.qlooLeft() < 1) return budgetSkip("crowd_at");
          const spot = ctx.pitches.find((p) => p.name === pitch);
          const box = spot ? boxAround(spot, 400, ctx.area) : ctx.area;
          const res = fromQloo(await qloo.localArtists(ids, box, take, ctx.adapters), `the crowd at ${pitch}`);
          const label = spot ? spot.name : "the city centre";
          const artists = res.artists.slice(0, take).map((e) => remember(e, "crowd_at", spot ? spot.name : "the city centre"));
          return seen({
            summary: artists.length ? `Read the crowd at ${label}: ${plural(artists.length, "artist")}` : `Qloo has no crowd data for ${label}`,
            pitch,
            artists,
          });
        }),
    }),

    rising: tool({
      description: "Momentum for up to 5 artists you have already met: their audience growth and how fast they are rising (Qloo trending). Use ids from related_artists or crowd_at.",
      inputSchema: z.object({ artistIds: z.array(z.string().max(80)).min(1).max(5).describe("artistIds from earlier results in this run.") }),
      execute: ({ artistIds }) =>
        serial(async () => {
          const unknown = artistIds.filter((id) => !state.artists.has(id));
          if (unknown.length) throw new LearnToolError(`Unknown artistId ${unknown.join(", ")}: use ids returned by related_artists or crowd_at in this run.`);
          const worst = artistIds.length + (ctx.windowChecked ? 0 : qloo.TRENDING_PROBES);
          if (ctx.qlooLeft() < worst) return budgetSkip("rising");
          ctx.windowChecked = true;
          const window = fromQloo(await qloo.trendingWindow(artistIds[0], ctx.today, ctx.adapters), "trending");
          const rows = window ? fromQloo(await qloo.rising(artistIds, window.start, window.end, ctx.adapters), "trending") : [];
          // ONE unit: percentile points gained over the window (newest week minus oldest, 0-100 scale). `percentDelta` is a
          // week-over-week change in percent, a different unit, so it is never used here.
          const moving = rows.some((r) => (r.windowChange ?? 0) !== 0);
          const artists = artistIds.map((id) => {
            const info = state.artists.get(id)!;
            const row = rows.find((r) => r.entityId === id);
            const delta = moving && row ? (row.windowChange ?? null) : null;
            info.trendDelta = delta && delta !== 0 ? r2(delta) : null;
            return { artistId: id, name: info.name, growth: info.growth, trendDelta: info.trendDelta };
          });
          return seen({
            summary: window && moving ? "Checked who's rising with those crowds" : window ? "Checked who's rising: no movement in Qloo's latest trending data" : "Qloo has no recent trending data for these artists",
            window: window ? { start: window.start, end: window.end } : null,
            artists,
          });
        }),
    }),

    crowd_profile: tool({
      description: "The age lean of the act's fans (Qloo demographics), for era fit. Optional.",
      inputSchema: z.object({}),
      execute: () =>
        serial(async () => {
          const ids = seedIds();
          if (ctx.qlooLeft() < 1) return budgetSkip("crowd_profile");
          const profile = fromQloo(await qloo.crowdProfile(ids, ctx.adapters), "the age of your fans");
          const bands = Object.entries(profile?.age ?? {})
            .sort((a, b) => b[1] - a[1])
            .map(([band, lean]) => ({ band: ageLabel(band), lean: r2(lean) }));
          const ageLean = bands[0] && (bands[0].lean ?? 0) > 0 ? bands[0].band : null;
          return seen({ summary: ageLean ? `Your fans lean ${ageLean}` : "No clear age lean in Qloo's data", ageLean, bands });
        }),
    }),

    top_tracks: tool({
      description:
        "Songs by the artists you choose (Spotify, Last.fm for any it lacks). Songs already suggested, dismissed or in the Repertoire are left out for you and counted. Opens after related_artists and crowd_at or rising.",
      inputSchema: z.object({
        artistIds: z.array(z.string().max(80)).min(1).max(4).describe("artistIds from earlier results in this run."),
        perArtist: z.number().int().min(1).max(3).default(3).describe("Songs to take per artist."),
      }),
      execute: async ({ artistIds, perArtist }) => seen(await runTopTracks(ctx, state, artistIds, perArtist)),
    }),

    finish_suggestions: tool({
      description: `Finish: ${LEARN_MIN_PICKS} to ${LEARN_MAX_PICKS} songs from top_tracks (songIds, best first, at most ${LEARN_MAX_PER_ARTIST} per artist) with a one-sentence reason each, a short summary and data caveats. Rejected answers say why; fix and call again.`,
      inputSchema: finishSuggestionsSchema,
      execute: async (answer) => {
        // A run cut short before top_tracks still finishes against songs: the server looks them up for the best artists.
        if (state.found.size === 0 && state.wrappingUp) {
          const best = [...state.artists.values()].sort((a, b) => rankKey(b) - rankKey(a)).slice(0, 4).map((a) => a.id);
          if (best.length) seen(await runTopTracks(ctx, state, best, 2).catch(() => null));
        }
        const problems = checkPicks(answer, state, ctx);
        if (problems.length === 0) {
          state.answer = acceptAnswer(answer, ctx);
          return { accepted: true, summary: `Ranked ${plural(state.answer.picks.length, "song")} and wrote why` };
        }
        if (state.rejections < LEARN_LIMITS.maxRejections) {
          state.rejections++;
          return { accepted: false, summary: `Rejected: ${problems.map((p) => p.message).join(" ")}`, problems: problems.map((p) => p.message) };
        }
        const salvaged = salvageAnswer(answer, state, ctx);
        if (!salvaged) {
          state.giveUp = true;
          return { accepted: false, summary: "Rejected: too few valid songs are left. The server will choose from the data.", problems: problems.map((p) => p.message) };
        }
        state.answer = salvaged;
        state.templatedReasons = salvaged.picks.filter((p) => p.templated).length;
        return { accepted: true, summary: `Ranked ${plural(salvaged.picks.length, "song")} and wrote why` };
      },
    }),
  };
}

/** A sortable score for "the best artists seen": growth, then trend, then affinity, with a bonus for related + crowd. */
export function rankKey(a: ArtistInfo): number {
  return (a.growth ?? 0) * 1000 + (a.trendDelta ?? 0) * 10 + (a.affinity ?? 0) + (a.related && a.pitch ? 0.25 : 0);
}

export type LearnTools = ReturnType<typeof createLearnTools>;
export type LearnToolName = keyof LearnTools;
