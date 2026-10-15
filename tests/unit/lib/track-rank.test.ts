import { describe, expect, it } from "vitest";
import { isByActArtist, mergeTrackLists, rankByActArtists, scopedArtistNames } from "@/lib/track-rank";

// SYNTHETIC: invented ids, shaped like a Spotify search for "Quimbara".
const track = (id: string, ...artists: [string, string][]) => ({ id, artists: artists.map(([aid, name]) => ({ id: aid, name })) });
const succar = track("t-succar", ["a-succar", "Tony Succar"]);
const celiaLive = track("t-celia-live", ["a-celia", "Celia Cruz"], ["a-johnny", "Johnny Pacheco"]);
const cover = track("t-cover", ["a-band", "Salsa Band"]);
const celiaStudio = track("t-celia", ["a-celia", "Celia Cruz"]);
const compay = track("t-compay", ["a-other-id", "Compay Segundo"]);

const chips = [
  { name: "Celia Cruz", spotifyId: "a-celia" },
  { name: "Buena Vista Social Club", spotifyId: "a-bvsc" },
  { name: "Compay Segundo", spotifyId: null },
];

describe("song search ranking by the act's artists", () => {
  it("puts tracks by a chip artist first, keeping Spotify's order within each group", () => {
    const ranked = rankByActArtists([succar, celiaLive, cover, celiaStudio], chips);
    expect(ranked.map((t) => t.id)).toEqual(["t-celia-live", "t-celia", "t-succar", "t-cover"]);
  });

  it("matches by Spotify id, any listed artist, and falls back to a normalised name", () => {
    expect(isByActArtist(celiaLive, chips)).toBe(true);
    // A typed chip (no id) matches by name, ignoring case and punctuation.
    expect(isByActArtist(track("x", ["zz", "compay  segundo!"]), chips)).toBe(true);
    // An id match wins even when the display name differs.
    expect(isByActArtist(track("y", ["a-bvsc", "BVSC"]), chips)).toBe(true);
    expect(isByActArtist(compay, chips)).toBe(true);
    expect(isByActArtist(succar, chips)).toBe(false);
  });

  it("leaves Spotify's order alone without chips or without matches", () => {
    expect(rankByActArtists([succar, celiaLive, cover], []).map((t) => t.id)).toEqual(["t-succar", "t-celia-live", "t-cover"]);
    expect(rankByActArtists([succar, cover], chips).map((t) => t.id)).toEqual(["t-succar", "t-cover"]);
  });

  it("merges the plain and scoped results, keeping the first copy of a track", () => {
    const merged = mergeTrackLists([succar, celiaLive], [celiaLive, celiaStudio], [compay]);
    expect(merged.map((t) => t.id)).toEqual(["t-succar", "t-celia-live", "t-celia", "t-compay"]);
    expect(rankByActArtists(merged, chips).map((t) => t.id)).toEqual(["t-celia-live", "t-celia", "t-compay", "t-succar"]);
  });

  it("scopes at most three distinct chip artists", () => {
    const many = [...chips, { name: "celia cruz", spotifyId: null }, { name: "Omara Portuondo", spotifyId: null }, { name: " ", spotifyId: null }];
    expect(scopedArtistNames(many)).toEqual(["Celia Cruz", "Buena Vista Social Club", "Compay Segundo"]);
    expect(scopedArtistNames(many, 5)).toEqual(["Celia Cruz", "Buena Vista Social Club", "Compay Segundo", "Omara Portuondo"]);
  });
});
