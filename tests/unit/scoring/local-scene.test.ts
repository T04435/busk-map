import { describe, expect, it } from "vitest";
import { trackKey } from "@/lib/text";
import { fillAsRepertoire, mergeFillArtists, suggestionBecause, type FillArtist } from "@/server/scoring/fill";
import {
  LOCAL_SCENE_BONUS,
  MAX_HANDLES,
  OVER_INDEX_MIN,
  overIndexGenres,
  rankSceneActs,
  sceneAffinityById,
  type LocalScene,
} from "@/server/scoring/local-scene";
import { buildSetlist, type RepertoireSong } from "@/server/scoring/setlist";

const row = (id: string, a: number, b: number, name = id) => ({ id, name, a, b });

describe("local scene: city over-index (compare, step 1)", () => {
  it("keeps the genres the city's crowd leans to by 0.15 or more over global pop, biggest gap first", () => {
    const handles = overIndexGenres([row("pop", 0.9, 0.9), row("folk", 0.5, 0.1, "Folk"), row("indie", 0.4, 0.2, " Indie Rock "), row("rock", 0.3, 0.2), row("jazz", 0.1, 0.6)]);
    expect(handles).toEqual([
      { id: "folk", name: "Folk", over: 0.4 },
      { id: "indie", name: "Indie Rock", over: 0.2 },
    ]);
    expect(OVER_INDEX_MIN).toBe(0.15);
  });

  it("caps the handles at seven", () => {
    const rows = Array.from({ length: 12 }, (_, i) => row(`g${i}`, 0.9 - i * 0.03, 0.1));
    const handles = overIndexGenres(rows);
    expect(handles).toHaveLength(MAX_HANDLES);
    expect(handles.map((h) => h.id)).toEqual(["g0", "g1", "g2", "g3", "g4", "g5", "g6"]);
  });

  it("keeps the single biggest positive gap when none reaches the bar (a city always has one handle), and none when nothing leans", () => {
    expect(overIndexGenres([row("a", 0.3, 0.2), row("b", 0.25, 0.2)]).map((h) => h.id)).toEqual(["a"]);
    expect(overIndexGenres([row("a", 0.2, 0.3), row("b", 0.5, 0.5)])).toEqual([]);
    expect(overIndexGenres([])).toEqual([]);
  });

  it("breaks equal gaps by name and ignores rows without an id or a name", () => {
    const handles = overIndexGenres([row("z", 0.6, 0.2, "Zydeco"), row("b", 0.6, 0.2, "Blues"), row("", 0.9, 0, "No id"), row("n", 0.9, 0, "  ")]);
    expect(handles.map((h) => h.name)).toEqual(["Blues", "Zydeco"]);
  });
});

describe("local scene: the list re-scored for the act's fans (step 2)", () => {
  const scene = [
    { id: "a", name: "Alpha" },
    { id: "b", name: "Beta" },
    { id: "c", name: "Gamma" },
    { id: "d", name: "Delta" },
  ];

  it("ranks scored acts best first, then the acts Qloo left out in the scene's own order", () => {
    const acts = rankSceneActs(scene, { c: 0.9, a: 0.4 }, new Set());
    expect(acts).toEqual([
      { id: "c", name: "Gamma", affinity: 0.9 },
      { id: "a", name: "Alpha", affinity: 0.4 },
      { id: "b", name: "Beta", affinity: null },
      { id: "d", name: "Delta", affinity: null },
    ]);
  });

  it("breaks equal scores by the scene's order, never offers back the act's own artists, and lists a name once", () => {
    const acts = rankSceneActs([...scene, { id: "e", name: "alpha" }, { id: "a", name: "Alpha" }], { a: 0.5, b: 0.5, e: 0.5, d: 0.5 }, new Set(["d"]));
    expect(acts.map((a) => a.id)).toEqual(["a", "b"].concat(["c"]));
  });

  it("gives the setlist builder only the scored acts", () => {
    const local: LocalScene = { genres: [], acts: [{ id: "a", name: "A", affinity: 0.8 }, { id: "b", name: "B", affinity: null }, { id: "c", name: "C", affinity: 0 }] };
    expect(sceneAffinityById(local)).toEqual({ a: 0.8 });
    expect(sceneAffinityById(null)).toEqual({});
  });
});

describe("local scene: set ordering (buildSetlist)", () => {
  const song = (id: string, artist: string, artistEntityId: string | null): RepertoireSong => ({ id, title: `Song ${id}`, artist, artistEntityId, own: false, durationMs: null });
  // Three artists the pitch's crowd likes equally, below the best one (so no score is at the ceiling); two are also local-scene acts.
  const songs = [song("1", "Global Star", "g"), song("2", "Local Hero", "l"), song("3", "Other Local", "o"), song("4", "Best Here", "x")];
  const affinity = { g: 0.6, l: 0.6, o: 0.6, x: 1 };
  const plays = { [trackKey("Global Star", "Song 1")]: 100, [trackKey("Local Hero", "Song 2")]: 100, [trackKey("Other Local", "Song 3")]: 100, [trackKey("Best Here", "Song 4")]: 10000 };

  it("leaves every score as it was without a scene, or when no song's artist is in it", () => {
    const base = buildSetlist(songs, affinity, plays);
    expect(buildSetlist(songs, affinity, plays, undefined, null, null)).toEqual(base);
    expect(buildSetlist(songs, affinity, plays, undefined, null, {})).toEqual(base);
    expect(buildSetlist(songs, affinity, plays, undefined, null, { zzz: 0.9 })).toEqual(base);
    expect(base.every((e) => !e.localScene)).toBe(true);
  });

  it("lifts a local-scene act's songs, in proportion to the act's fans' rank within the scene, and says why", () => {
    const base = buildSetlist(songs, affinity, plays);
    const withScene = buildSetlist(songs, affinity, plays, undefined, null, { l: 0.9, o: 0.45 });
    const by = (list: typeof base, id: string) => list.find((e) => e.songId === id)!;
    expect(Math.abs(by(withScene, "2").score - (by(base, "2").score + LOCAL_SCENE_BONUS * 100))).toBeLessThanOrEqual(1);
    expect(by(withScene, "3").score).toBeGreaterThan(by(base, "3").score);
    expect(by(withScene, "3").score).toBeLessThan(by(withScene, "2").score);
    expect(by(withScene, "1").score).toBe(by(base, "1").score);
    expect(by(withScene, "2")).toMatchObject({ localScene: true });
    expect(by(withScene, "2").reason).toContain("local scene act your fans would like (very strong match)");
    expect(by(withScene, "1").localScene).toBe(false);
  });

  it("changes the order: the local act's song moves ahead of an equal global one", () => {
    const tied = [song("1", "Global Star", "g"), song("2", "Local Hero", "l"), song("4", "Best Here", "x")];
    const noScene = buildSetlist(tied, affinity, {}).map((e) => e.songId);
    expect(noScene).toEqual(["4", "1", "2"]);
    const scene = buildSetlist(tied, affinity, {}, undefined, null, { l: 0.7 }).map((e) => e.songId);
    expect(scene).toEqual(["4", "2", "1"]);
  });

  it("never lifts a score past 100", () => {
    const top = buildSetlist([song("1", "Local Hero", "l")], { l: 1 }, { [trackKey("Local Hero", "Song 1")]: 5 }, undefined, null, { l: 1 });
    expect(buildSetlist([song("1", "Local Hero", "l")], { l: 1 }, { [trackKey("Local Hero", "Song 1")]: 5 })[0].score).toBe(100);
    expect(top[0].score).toBe(100);
  });
});

describe("local scene: suggested fill candidates", () => {
  const artist = (id: string, name: string, extra: Partial<FillArtist> = {}): FillArtist => ({ id, name, growth: null, listeners: null, because: [], ...extra });

  it("keeps the local flag when another list named the artist first, and says so in the suggestion", () => {
    const merged = mergeFillArtists([[artist("a", "Alpha")], [artist("a", "Alpha", { local: { fit: 0.8 } }), artist("b", "Beta", { local: { fit: null } })]], new Set());
    expect(merged.map((a) => a.local)).toEqual([{ fit: 0.8 }, { fit: null }]);
    const kept = mergeFillArtists([[artist("a", "Alpha", { local: { fit: 0.3 } })], [artist("a", "Alpha", { local: { fit: 0.9 } })]], new Set());
    expect(kept[0].local).toEqual({ fit: 0.3 });
    expect(suggestionBecause(merged[0], 0.7)).toBe("A local act your fans would like (strong match), Liked by the crowd here (strong affinity)");
    expect(suggestionBecause(merged[1], undefined)).toBe("A local act, Liked by this city's crowd");
    const pick = { artist: merged[0], track: { title: "T", artist: "Alpha", spotifyTrackId: null, year: null, durationMs: null, url: null, popularity: null }, source: "spotify" as const };
    expect(fillAsRepertoire([pick], { a: 0.7 })[0].suggestion?.because).toContain("A local act your fans would like");
  });
});
