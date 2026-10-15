import { describe, expect, it } from "vitest";
import { buildSetlist, learnThese } from "@/server/scoring";
import type { RepertoireSong } from "@/server/scoring";
import { trackKey } from "@/lib/text";

const song = (id: string, title: string, artist: string, artistEntityId: string | null, own = false, durationMs: number | null = null): RepertoireSong => ({
  id,
  title,
  artist,
  artistEntityId,
  own,
  durationMs,
});

describe("buildSetlist", () => {
  it("returns nothing for an empty repertoire", () => {
    expect(buildSetlist([], {}, {})).toEqual([]);
  });

  it("carries each song's length through", () => {
    const list = buildSetlist([song("s1", "Timed", "A", null, false, 215_000), song("s2", "Untimed", "B", null)], {}, {});
    expect(Object.fromEntries(list.map((s) => [s.title, s.durationMs]))).toEqual({ Timed: 215_000, Untimed: null });
  });

  it("blends crowd affinity with song popularity, opens with a recognisable song and avoids back-to-back artists", () => {
    const songs = [
      song("1", "Gravy", "Paul Kelly", "pk"),
      song("2", "To Her Door", "Paul Kelly", "pk"),
      song("3", "Depreston", "Courtney Barnett", "cb"),
      song("4", "Avant Gardener", "Courtney Barnett", "cb"),
      song("5", "My Own Tune", "Me", null, true),
      song("6", "Gravy (Live)", "Paul Kelly", "pk"),
    ];
    const affinity = { pk: 0.9, cb: 0.6 };
    const plays = {
      [trackKey("Paul Kelly", "Gravy")]: 300_000,
      [trackKey("Paul Kelly", "To Her Door")]: 2_000_000,
      [trackKey("Courtney Barnett", "Depreston")]: 900,
    };
    const set = buildSetlist(songs, affinity, plays);

    // Duplicate live take removed.
    expect(set).toHaveLength(5);
    // Opener: most played among the top three.
    expect(set[0].title).toBe("To Her Door");
    for (let i = 1; i < set.length - 1; i++) {
      if (set[i].artist === set[i - 1].artist) {
        // Only allowed when no other artist was left.
        expect(set.slice(i).every((s) => s.artist === set[i].artist)).toBe(true);
      }
    }
    const own = set.find((s) => s.own)!;
    expect(own).toMatchObject({ affinitySource: "proxy", playcount: null });
    expect(own.reason).toMatch(/Your own song/);
    expect(set.find((s) => s.title === "To Her Door")!.reason).toMatch(/2\.0M Last\.fm plays/);
    expect(set.find((s) => s.title === "Gravy")!.reason).toMatch(/300k/);
    expect(set.find((s) => s.title === "Depreston")!.reason).toMatch(/900 Last\.fm plays/);
    expect(set.find((s) => s.title === "Avant Gardener")!.affinitySource).toBe("qloo");
  });

  it("uses a neutral proxy with no Qloo data, labels unresolved covers and caps the length", () => {
    const set = buildSetlist([song("1", "A", "X", null), song("2", "B", "Y", "unknown-id"), song("3", "C", "Z", null)], {}, {}, 2);
    expect(set).toHaveLength(2);
    expect(set.every((s) => s.affinity === 1 && s.affinitySource === "proxy")).toBe(true);
    expect(set[0].reason).toMatch(/No Qloo match for/);
  });

  it("handles zero affinities and zero plays, and repeats an artist when no one else is left", () => {
    const songs = [song("1", "A", "Solo", "s"), song("2", "B", "Solo", "s"), song("3", "C", "Solo", "s")];
    const set = buildSetlist(songs, { s: 0 }, { [trackKey("Solo", "A")]: 0 });
    expect(set.map((s) => s.score)).toEqual([0, 0, 0]);
    expect(set).toHaveLength(3);
  });

  it("opens with the most-played of the top three even when it ranks third", () => {
    const songs = [song("1", "A", "P", "p"), song("2", "B", "Q", "q"), song("3", "C", "R", "r")];
    const plays = { [trackKey("P", "A")]: 1000, [trackKey("Q", "B")]: 1000, [trackKey("R", "C")]: 2000 };
    const set = buildSetlist(songs, { p: 1, q: 0.95, r: 0.3 }, plays);
    expect(set.map((s) => s.title)).toEqual(["C", "A", "B"]);
  });

  it("takes the median of an even number of known affinities", () => {
    const songs = [song("1", "A", "P", "p"), song("2", "B", "Q", "q"), song("3", "Mine", "Me", null, true)];
    const set = buildSetlist(songs, { p: 0.2, q: 0.6 }, {});
    expect(set.find((s) => s.own)!.affinity).toBeCloseTo(0.4 / 0.6, 2);
  });
});

describe("learnThese", () => {
  const repertoire = [song("1", "Known Song", "Already Played", "x")];

  it("suggests songs by rising local artists the performer doesn't play yet", () => {
    const result = learnThese(
      [
        { entityId: "a", name: "Riser", affinity: 0.8, percentDelta: 5.25 },
        { entityId: "b", name: "Already Played", affinity: 0.9, percentDelta: 9 },
        { entityId: "c", name: "Steady", affinity: null, percentDelta: -1 },
        { entityId: "d", name: "Unknown trend", affinity: 0.5, percentDelta: null },
        { entityId: "e", name: "Also unknown", affinity: 0.5, percentDelta: null },
      ],
      {
        Riser: [{ title: "Hit", playcount: 1000 }],
        Steady: [],
      },
      repertoire,
      4,
    );
    expect(result.map((r) => r.artist)).toEqual(["Riser", "Steady", "Also unknown", "Unknown trend"]);
    expect(result[0]).toMatchObject({ title: "Hit", playcount: 1000, reason: "Rising with this crowd (+5.3 pts), affinity 80/100" });
    expect(result[1]).toMatchObject({ title: null, reason: "Steady with this crowd (-1.0 pts)" });
    expect(result[2].reason).toBe("affinity 50/100");
  });

  it("breaks trend ties by affinity, treating unknown affinity as zero", () => {
    const result = learnThese(
      [
        { entityId: "a", name: "No affinity", affinity: null, percentDelta: 2 },
        { entityId: "b", name: "Some affinity", affinity: 0.4, percentDelta: 2 },
      ],
      {},
      [],
    );
    expect(result.map((r) => r.artist)).toEqual(["Some affinity", "No affinity"]);
  });

  it("without trending data, ranks by affinity and then Last.fm listeners, and says so in the reason", () => {
    const result = learnThese(
      [
        { entityId: "a", name: "Small", affinity: 0.7, percentDelta: null, listeners: 950 },
        { entityId: "b", name: "Big", affinity: 0.7, percentDelta: null, listeners: 1_250_000 },
        { entityId: "c", name: "Mid", affinity: 0.7, percentDelta: null, listeners: 48_400 },
        { entityId: "d", name: "Unknown", affinity: 0.7, percentDelta: null, listeners: null },
        { entityId: "e", name: "Closest", affinity: 0.9, percentDelta: null },
      ],
      {},
      [],
      5,
    );
    expect(result.map((r) => r.artist)).toEqual(["Closest", "Big", "Mid", "Small", "Unknown"]);
    expect(result.map((r) => r.reason)).toEqual([
      "affinity 90/100",
      "affinity 70/100, 1.3M Last.fm listeners",
      "affinity 70/100, 48k Last.fm listeners",
      "affinity 70/100, 950 Last.fm listeners",
      "affinity 70/100",
    ]);
  });

  it("falls back to a generic reason with no trend or affinity", () => {
    const result = learnThese([{ entityId: "a", name: "Band", affinity: null, percentDelta: null }], { Band: [{ title: "Song", playcount: 5 }] }, []);
    expect(result[0]).toMatchObject({ title: "Song", reason: "Liked by this crowd" });
  });
});
