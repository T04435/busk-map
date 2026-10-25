import "server-only";
import { nameKey } from "@/lib/text";
import type { AdapterContext } from "@/server/adapters/core";
import * as qloo from "@/server/adapters/qloo";
import type { QlooUsage } from "@/server/adapters/qloo/usage";
import { knownCity, type CityId } from "@/server/cities";
import { LEARN_QLOO_BUDGET } from "@/server/playlist/config";
import type { PlaylistRecord } from "@/server/playlist/store";
import { historyKeys, learnedSongs, songsPerArtist, type HistoryKeys } from "./history";
import type { HistoryData } from "./types";

/** An artist the run starts from: the Repertoire's songs' artists and the "sounds like" artists. */
export type Seed = { name: string; spotifyId?: string; qlooId?: string; entity: qloo.QlooEntity | null };

/** Resolve at most this many seeds (qloo/index.ts:MAX_ARTISTS). */
export const MAX_SEEDS = qloo.MAX_ARTISTS;

/** Seeds, most frequent first: songs per artist, with a bonus for the artists the act says it sounds like. */
export function seedArtists(playlist: Pick<PlaylistRecord, "soundsLike">, history: Pick<HistoryData, "songs">): Seed[] {
  const byKey = new Map<string, Seed & { score: number }>();
  const add = (name: string, extra: Partial<Seed>, weight: number) => {
    const key = nameKey(name);
    if (!key) return;
    const have = byKey.get(key);
    if (have) {
      have.score += weight;
      Object.assign(have, Object.fromEntries(Object.entries(extra).filter(([, v]) => v !== undefined)));
    } else byKey.set(key, { name, entity: null, ...extra, score: weight });
  };
  for (const a of playlist.soundsLike) add(a.name, { spotifyId: a.spotifyId, qlooId: a.qlooId }, 2);
  for (const s of history.songs) add(s.artist, {}, 1);
  return [...byKey.values()]
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, MAX_SEEDS)
    .map(({ score: _score, ...seed }) => seed); // eslint-disable-line @typescript-eslint/no-unused-vars
}

export type MatchOutput = {
  summary: string;
  songs: number;
  artists: { name: string; matched: boolean }[];
  unmatched: string[];
};

/**
 * Everything one learn run knows and shares between its steps: the Repertoire, its history, the matched seeds, the
 * Qloo counter and budget. Per run; nothing here outlives it.
 */
export class LearnContext {
  readonly keys: HistoryKeys;
  readonly perArtist: Map<string, number>;
  readonly learned: { title: string; artist: string }[];
  /** nameKey of every artist the Repertoire already sings, and of the sounds-like artists. */
  readonly sungArtists: Set<string>;
  readonly soundsLikeArtists: Set<string>;
  seeds: Seed[];
  /** Set when a Qloo call fell back (Qloo down), for the end of the run. */
  qlooFailed = false;
  /** The trending window is looked up once per run (it is cached for the day). */
  windowChecked = false;
  readonly city: CityId;
  readonly market: string;

  constructor(
    readonly adapters: AdapterContext,
    readonly playlist: PlaylistRecord,
    readonly history: HistoryData,
    readonly today: string,
    readonly usage: QlooUsage,
  ) {
    this.keys = historyKeys(history);
    this.perArtist = songsPerArtist(history);
    this.learned = learnedSongs(history);
    this.sungArtists = new Set(history.songs.map((s) => nameKey(s.artist)));
    this.soundsLikeArtists = new Set(playlist.soundsLike.map((a) => nameKey(a.name)));
    this.seeds = seedArtists(playlist, history);
    this.city = knownCity(playlist.city).id;
    this.market = knownCity(this.city).countryCode;
  }

  get area() {
    return knownCity(this.city).bbox;
  }

  /** The usual pitches by name (D4); empty means the city crowd. */
  get pitches() {
    return this.playlist.usualPitches;
  }

  /** The matched seeds' Qloo ids. */
  get matched(): Seed[] {
    return this.seeds.filter((s) => s.entity);
  }

  seedName(entityId: string): string | null {
    return this.seeds.find((s) => s.entity?.id === entityId)?.entity?.name ?? null;
  }

  /** Qloo requests this run may still send. */
  qlooLeft(): number {
    return LEARN_QLOO_BUDGET - this.usage.calls;
  }

  /**
   * The server step `match_playlist`: stored ids first (the "sounds like" chips carry them), then Qloo's id match and
   * name search for the rest. `status` says whether the run can go on.
   */
  async matchPlaylist(): Promise<{ output: MatchOutput; status: "ok" | "qloo_unavailable" | "no_match" }> {
    const stored = this.seeds.filter((s) => s.qlooId);
    for (const s of stored) s.entity = { id: s.qlooId!, name: s.name, popularity: null, lastfmListeners: null, affinity: null, audienceGrowth: null, tags: [], explanation: [] };
    const rest = this.seeds.filter((s) => !s.qlooId);
    let down = false;
    if (rest.length > 0) {
      const result = await qloo.resolveArtists(
        rest.map((s) => s.name),
        this.adapters,
        rest.flatMap((s) => (s.spotifyId ? [{ name: s.name, id: s.spotifyId }] : [])),
      );
      if (result.mode === "fallback") down = true;
      for (const r of result.data) {
        const seed = rest.find((s) => s.name.toLowerCase() === r.query.toLowerCase());
        if (seed && r.entity) seed.entity = r.entity;
      }
    }
    const matched = this.matched;
    const unmatched = this.seeds.filter((s) => !s.entity).map((s) => s.name);
    const songs = this.history.songs.length;
    const output: MatchOutput = {
      summary: matched.length
        ? `Matched your ${songs} song${songs === 1 ? "" : "s"} to ${matched.length} artist${matched.length === 1 ? "" : "s"} on Qloo`
        : down
          ? "Qloo didn't answer, so your songs couldn't be matched"
          : "Qloo couldn't match any of your artists",
      songs,
      artists: this.seeds.map((s) => ({ name: s.entity?.name ?? s.name, matched: Boolean(s.entity) })),
      unmatched,
    };
    if (matched.length > 0) return { output, status: "ok" };
    this.qlooFailed = down;
    return { output, status: down ? "qloo_unavailable" : "no_match" };
  }
}
