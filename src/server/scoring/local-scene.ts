import { nameKey } from "@/lib/text";

/**
 * The local scene: what to play HERE, as opposed to what the crowd streams everywhere. Pure and deterministic; the
 * Qloo calls (context.ts:localScene) hand their data in.
 *
 * In English-speaking cities the crowd at a pitch comes back as global pop (research/cities/cities.md, "WHAT: options
 * tested"). The method that works has two steps, both cacheable per city:
 *  1. City over-index: `/v2/analysis/compare` of the city's usual crowd (a) against a global-pop set (b) gives the genres
 *     the city over-indexes on, 1–7 of them.
 *  2. Local scene: location plus one of those genre tags (`signal.interests.tags`) gives the local artists, which are then
 *     re-scored for the act's fans (`filter.results.entities` + the act's artists as the signal).
 */

/** A genre counts as an over-index when its share in the city's crowd exceeds the global-pop set's by this much (the research's 0.15). */
export const OVER_INDEX_MIN = 0.15;
/** At most this many genre handles per city. */
export const MAX_HANDLES = 7;
/** Artists asked for: the city's usual crowd (compare group a), the global-pop set (group b) and the local scene list. */
export const USUAL_CROWD_TAKE = 20;
export const GLOBAL_POP_TAKE = 20;
export const SCENE_TAKE = 20;
/** Local acts shown in the plan, and offered to the suggested fill as candidates. */
export const SCENE_ACTS_SHOWN = 6;
/** Most a local-scene act can add to a song's 0–1 set score (when the act's fans like that artist best of the local scene). */
export const LOCAL_SCENE_BONUS = 0.1;

export type GenreContrastRow = { id: string; name: string; a: number; b: number };
export type GenreHandle = { id: string; name: string; over: number };

/**
 * The genres the city over-indexes on: share in group a minus share in group b of at least OVER_INDEX_MIN, biggest gap
 * first, at most MAX_HANDLES. When none reaches the bar, the single biggest positive gap stands (the research found one
 * to seven handles in every one of 30 cities); none at all means the city has no handle.
 */
export function overIndexGenres(rows: GenreContrastRow[]): GenreHandle[] {
  const gaps = rows
    .map((r) => ({ id: r.id, name: r.name.trim(), over: Math.round((r.a - r.b) * 1000) / 1000 }))
    .filter((r) => r.id && r.name && r.over > 0)
    .sort((x, y) => y.over - x.over || x.name.localeCompare(y.name));
  const strong = gaps.filter((g) => g.over >= OVER_INDEX_MIN).slice(0, MAX_HANDLES);
  return strong.length > 0 ? strong : gaps.slice(0, 1);
}

/**
 * The act's own genres (Repertoire research step 8) against the city's handles: the handles the act shares go first (so the
 * scene search leans to them) and are named in `yours`. Matched by tag id, else by name. Without act genres, unchanged.
 */
export function preferActGenres(handles: GenreHandle[], act: readonly { id: string; name: string }[] | undefined): { handles: GenreHandle[]; yours: string[] } {
  if (!act?.length) return { handles, yours: [] };
  const ids = new Set(act.map((g) => g.id));
  const names = new Set(act.map((g) => nameKey(g.name)));
  const shared = (h: GenreHandle) => ids.has(h.id) || names.has(nameKey(h.name));
  const mine = handles.filter(shared);
  return { handles: [...mine, ...handles.filter((h) => !shared(h))], yours: mine.map((h) => h.id) };
}

export type SceneAct = { id: string; name: string; /** The act's fans' Qloo affinity for this local act (0–1), null when Qloo left it out of the re-score. */ affinity: number | null; /** Qloo's photo of the act, when it has one. */ image?: string };

/**
 * The local scene list re-scored for the act's fans ("local acts your fans would like"): scored acts first, best first;
 * acts Qloo left out of the re-score follow in the scene's own order. The act's own artists are never offered back.
 */
export function rankSceneActs(scene: { id: string; name: string; image?: string | null }[], affinity: Record<string, number>, exclude: ReadonlySet<string>): SceneAct[] {
  const seen = new Set<string>();
  const acts: SceneAct[] = [];
  for (const a of scene) {
    if (exclude.has(a.id) || seen.has(a.id) || seen.has(nameKey(a.name))) continue;
    seen.add(a.id);
    seen.add(nameKey(a.name));
    acts.push({ id: a.id, name: a.name, affinity: affinity[a.id] ?? null, ...(a.image ? { image: a.image } : {}) });
  }
  const order = new Map(acts.map((a, i) => [a.id, i]));
  return acts.sort((x, y) => (y.affinity ?? -1) - (x.affinity ?? -1) || order.get(x.id)! - order.get(y.id)!);
}

/** What a plan carries of the local scene. */
export type LocalScene = {
  /** The city's over-indexed genres (the handles), biggest gap first (the act's own genres first, when it has any). */
  genres: GenreHandle[];
  /** Ids of the handles the act's own genres share (Repertoire research); absent without act genres. */
  yours?: string[];
  /** The local acts, re-scored for the act's fans. */
  acts: SceneAct[];
};

/** Entity id to the act's fans' affinity, for the scored local acts: what the setlist builder weighs. */
export function sceneAffinityById(scene: LocalScene | null): Record<string, number> {
  const out: Record<string, number> = {};
  for (const a of scene?.acts ?? []) if (a.affinity !== null && a.affinity > 0) out[a.id] = a.affinity;
  return out;
}
