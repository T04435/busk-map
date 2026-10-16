import { describe, expect, it } from "vitest";
import { addSongSchema, parseTypedSong, patchPlaylistSchema, playlistSongKey } from "@/lib/playlist-schema";
import { PLAYLIST_COPY } from "@/lib/playlist-copy";

describe("song_key normalisation", () => {
  it("ignores case, punctuation, a leading The and remaster-style suffixes", () => {
    const base = playlistSongKey("The Paul Kelly", "How to Make Gravy");
    expect(playlistSongKey("paul kelly", "HOW TO MAKE GRAVY!")).toBe(base);
    expect(playlistSongKey("Paul Kelly", "How to Make Gravy - Remastered 2019")).toBe(base);
    expect(playlistSongKey("Paul Kelly", "How to Make Gravy (Live)")).toBe(base);
    expect(playlistSongKey("Paul Kelly", "Other Song")).not.toBe(base);
    expect(base).toBe("paul kelly|how to make gravy");
  });

  it("keeps songs apart when a part normalises to nothing", () => {
    expect(playlistSongKey("Artist", "!!!")).not.toBe(playlistSongKey("Artist", "???"));
    expect(playlistSongKey("Artist", "!!!")).toBe("artist|!!!");
  });
});

describe("addSongSchema", () => {
  it("trims, collapses whitespace and strips control characters", () => {
    const song = addSongSchema.parse({ title: "  Riptide\n\t ", artist: "Vance   Joy" });
    expect(song).toMatchObject({ title: "Riptide", artist: "Vance Joy", own: false, source: "typed" });
  });

  it("refuses empty, over-long, suggested-source and bad Spotify ids", () => {
    expect(addSongSchema.safeParse({ title: " ", artist: "A" }).success).toBe(false);
    expect(addSongSchema.safeParse({ title: "x".repeat(121), artist: "A" }).success).toBe(false);
    expect(addSongSchema.safeParse({ title: "T", artist: "a".repeat(81) }).success).toBe(false);
    expect(addSongSchema.safeParse({ title: "T", artist: "A", source: "suggested" }).success).toBe(false);
    expect(addSongSchema.safeParse({ title: "T", artist: "A", spotifyTrackId: "nope" }).success).toBe(false);
    expect(addSongSchema.safeParse({ title: "T", artist: "A", durationMs: 0 }).success).toBe(false);
    expect(addSongSchema.safeParse({ title: "T", artist: "A", spotifyTrackId: "a".repeat(22), durationMs: 200_000, year: 1999 }).success).toBe(true);
  });
});

describe("patchPlaylistSchema", () => {
  it("needs a revision and something to change, and bounds the lists", () => {
    expect(patchPlaylistSchema.safeParse({ revision: 1 }).success).toBe(false);
    expect(patchPlaylistSchema.safeParse({ actName: "Jess" }).success).toBe(false);
    expect(patchPlaylistSchema.safeParse({ revision: 1, actName: "Jess" }).success).toBe(true);
    expect(patchPlaylistSchema.safeParse({ revision: 1, soundsLike: Array.from({ length: 11 }, (_, i) => ({ name: `A${i}` })) }).success).toBe(false);
    expect(patchPlaylistSchema.safeParse({ revision: 1, usualPitches: Array.from({ length: 4 }, () => ({ name: "P", lat: 1, lon: 1 })) }).success).toBe(false);
  });
});

describe("parseTypedSong", () => {
  it("reads Title - Artist with an optional (own)", () => {
    expect(parseTypedSong("Scar - Missy Higgins")).toEqual({ title: "Scar", artist: "Missy Higgins", own: false });
    expect(parseTypedSong("My Song - Me (own)")).toEqual({ title: "My Song", artist: "Me", own: true });
    expect(parseTypedSong("Just a title")).toBeNull();
  });
});

describe("copy", () => {
  it("names the feature Repertoire", () => {
    expect(PLAYLIST_COPY.name).toBe("Repertoire");
    expect(PLAYLIST_COPY.errors.full(60)).toContain("60");
  });
});
