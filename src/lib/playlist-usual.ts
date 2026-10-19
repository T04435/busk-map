/**
 * Usual pitches (docs/playlist-architecture.md D4): the top pitch of each of the last N busks planned with the
 * Repertoire, newest first. Pure and client-safe; the server records a busk, the store keeps the list.
 */
import type { UsualPitch } from "./playlist-schema";
import { nameKey } from "./text";

export type RecentBusk = UsualPitch & {
  /** Identifies the plan (its request hash), so planning it again does not count as a second busk. */
  key: string;
  at: number;
};

/** The busk goes first; an earlier record of the same plan is dropped; only the last `max` stay. */
export function withBusk(recent: RecentBusk[], busk: RecentBusk, max: number): RecentBusk[] {
  return [busk, ...recent.filter((b) => b.key !== busk.key)].slice(0, max);
}

/** The distinct pitches of the recent busks (two busks at one pitch make one usual pitch), newest first. */
export function usualFromBusks(recent: RecentBusk[], max: number): UsualPitch[] {
  const seen = new Set<string>();
  const out: UsualPitch[] = [];
  for (const { name, lat, lon } of recent) {
    const id = nameKey(name) || name.toLowerCase();
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ name, lat, lon });
  }
  return out.slice(0, max);
}
