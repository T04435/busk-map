import { describe, expect, it } from "vitest";
import { trackKey } from "@/lib/text";
import { fillAsRepertoire, mergeFillArtists, pickFillSongs, rankFillArtists, suggestionBecause, type FillArtist, type FillTrack } from "@/server/scoring/fill";
import { buildSetlist } from "@/server/scoring/setlist";

const artist = (id: string, name: string, extra: Partial<FillArtist> = {}): FillArtist => ({ id, name, growth: null, listeners: null, because: [], ...extra });
const track = (artistName: string, title: string, extra: Partial<FillTrack> = {}): FillTrack => ({ title, artist: artistName, spotifyTrackId: null, year: null, durationMs: null, url: `https://x/${title}`, popularity: null, ...extra });

describe("suggested fill: pictures (U03)", () => {
  it("a suggested song keeps its track image when the catalogue had one, and carries no key when it had none", () => {
    const [withImage, without] = fillAsRepertoire(
      [
        { artist: artist("a", "Alpha"), track: track("Alpha", "One", { image: "https://i.scdn.co/image/x" }), source: "spotify" },
        { artist: artist("b", "Beta"), track: track("Beta", "Two"), source: "lastfm" },
      ],
      {},
    );
    expect(withImage.suggestion).toMatchObject({ image: "https://i.scdn.co/image/x" });
    expect(without.suggestion).not.toHaveProperty("image");
  });
});

describe("suggested fill: candidates", () => {
  it("merges the crowd's and the related artists once, joins explanations, and leaves out artists already in the set", () => {
    const merged = mergeFillArtists(
      [
        [artist("a", "Alpha", { because: ["Seed"] }), artist("b", "Beta")],
        [artist("a", "Alpha", { because: ["Other"], listeners: 5000 }), artist("c", "The Gamma"), artist("d", "Delta")],
      ],
      new Set(["gamma"]),
    );
    expect(merged.map((a) => a.id)).toEqual(["a", "b", "d"]);
    expect(merged[0]).toMatchObject({ because: ["Seed", "Other"], listeners: 5000 });
    // Later listings fill gaps but never overwrite; an artist already in the set by id is left out too.
    const again = mergeFillArtists([[artist("a", "Alpha", { growth: 1, listeners: 10 })], [artist("a", "Alpha", { growth: 5, listeners: 99 }), artist("z", "Zed")]], new Set(), new Set(["z"]));
    expect(again).toEqual([{ id: "a", name: "Alpha", growth: 1, listeners: 10, because: [] }]);
  });

  it("ranks by the pitch's affinity, then audience growth, then Last.fm listeners; unscored artists go last", () => {
    const list = [artist("u", "Unscored", { growth: 9 }), artist("lo", "Low", { listeners: 10 }), artist("hi", "High"), artist("g", "Growing", { growth: 2 }), artist("l", "Listened", { listeners: 900 })];
    const order = rankFillArtists(list, { hi: 0.9, lo: 0.4, g: 0.4, l: 0.4 }).map((a) => a.id);
    expect(order).toEqual(["hi", "g", "l", "lo", "u"]);
  });

  it("breaks full ties by growth on both sides, then by name; repeated explanations join once", () => {
    const tied = [artist("b", "Beta", { growth: 1, listeners: 5 }), artist("a", "Alpha", { growth: 1, listeners: 5 }), artist("c", "Gamma", { growth: 3 })];
    expect(rankFillArtists(tied, {}).map((a) => a.id)).toEqual(["c", "a", "b"]);
    const mixed = [artist("n", "None"), artist("l", "Listened", { listeners: 7 }), artist("g", "Grown", { growth: 1 }), artist("m", "Both", { growth: 1, listeners: 2 })];
    expect(rankFillArtists(mixed, {}).map((a) => a.id)).toEqual(["m", "g", "l", "n"]);
    expect(rankFillArtists([...mixed].reverse(), {}).map((a) => a.id)).toEqual(["m", "g", "l", "n"]);
    const twice = mergeFillArtists([[artist("a", "A", { because: ["X"] })], [artist("a", "A", { because: ["X", "Y"] })]], new Set());
    expect(twice[0].because).toEqual(["X", "Y"]);
  });

  it("a different pitch ranks the same artists differently", () => {
    const list = [artist("a", "A"), artist("b", "B")];
    expect(rankFillArtists(list, { a: 0.9, b: 0.1 })[0].id).toBe("a");
    expect(rankFillArtists(list, { a: 0.1, b: 0.9 })[0].id).toBe("b");
  });

  it("words the reason from the data only", () => {
    expect(suggestionBecause(artist("a", "A", { because: ["Paul Kelly", "Archie Roach", "Third"], listeners: 1_200_000 }), 0.824)).toBe(
      "Liked by the crowd here (affinity 82/100), fans also like Paul Kelly and Archie Roach, 1.2M Last.fm listeners",
    );
    expect(suggestionBecause(artist("a", "A"), undefined)).toBe("Liked by this city's crowd");
    expect(suggestionBecause(artist("a", "A", { listeners: 48_400 }), 0.5)).toMatch(/48k Last\.fm listeners/);
    expect(suggestionBecause(artist("a", "A", { listeners: 640 }), 0.5)).toMatch(/640 Last\.fm listeners/);
  });
});

describe("suggested fill: songs", () => {
  const catalogue = (all: Record<string, FillTrack[]>, looked: string[] = []) => async (a: FillArtist) => {
    looked.push(a.name);
    return all[a.name] ? { source: "spotify" as const, tracks: all[a.name] } : null;
  };

  it("takes at most two songs per artist, skips songs the act has or removed, and stops looking up once the count is met", async () => {
    const looked: string[] = [];
    const picks = await pickFillSongs(
      [artist("a", "A"), artist("b", "B"), artist("c", "C"), artist("d", "D")],
      3,
      2,
      4,
      new Set([trackKey("A", "Had")]),
      new Set([trackKey("A", "Removed")]),
      catalogue({ A: [track("A", "Had"), track("A", "Removed"), track("A", "One"), track("A", "Two"), track("A", "Three")], B: [track("B", "Hit"), track("B", "Other")], C: [track("C", "Never")] }, looked),
    );
    expect(picks.map((p) => p.track.title)).toEqual(["One", "Two", "Hit"]);
    expect(looked).toEqual(["A", "B"]);
  });

  it("looks up at most maxArtists and returns fewer songs when artists have none", async () => {
    const looked: string[] = [];
    const picks = await pickFillSongs([artist("a", "A"), artist("b", "B"), artist("c", "C")], 6, 2, 2, new Set(), new Set(), catalogue({ A: [track("A", "x")], C: [track("C", "y")] }, looked));
    expect(picks.map((p) => p.track.title)).toEqual(["x"]);
    expect(looked).toEqual(["A", "B"]);
  });

  it("never picks one song twice (same title from two sources, alternate spellings)", async () => {
    const picks = await pickFillSongs([artist("a", "A"), artist("b", "A")], 4, 2, 4, new Set(), new Set(), catalogue({ A: [track("A", "Song"), track("A", "Song - Remastered 2011")] }));
    expect(picks).toHaveLength(1);
  });

  it("an empty Repertoire with fill gives a suggested-only set, each row tagged", () => {
    const picks = [
      { artist: artist("a", "A", { because: ["Seed"] }), track: track("A", "One", { spotifyTrackId: "t1" }), source: "spotify" as const },
      { artist: artist("b", "B"), track: track("B", "Two"), source: "lastfm" as const },
    ];
    const set = buildSetlist(fillAsRepertoire(picks, { a: 0.8, b: 0.4 }), { a: 0.8, b: 0.4 }, {});
    expect(set).toHaveLength(2);
    for (const e of set) expect(e.origin).toBe("suggested");
    const one = set.find((e) => e.title === "One")!;
    expect(one.suggestion).toEqual({ because: "Liked by the crowd here (affinity 80/100), fans also like Seed", source: "spotify", sourceUrl: "https://x/One", spotifyTrackId: "t1" });
    expect(one.own).toBe(false);
  });

  it("the act's own songs stay origin 'repertoire' with no suggestion", () => {
    const set = buildSetlist([{ id: "s0", title: "Mine", artist: "Me", artistEntityId: null, own: true, durationMs: null }], {}, {});
    expect(set[0]).toMatchObject({ origin: "repertoire", suggestion: null });
  });
});
