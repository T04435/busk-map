import { describe, expect, it } from "vitest";
import { rankArtistResults } from "@/lib/artist-results";

const row = (id: string, name: string, releases: number | null = null) => ({ id, name, releases, image: null, url: null });

describe("the artist picker's Spotify rows", () => {
  it("drops 0-release namesakes of a real artist and puts the one with the most releases first, where the name first appears", () => {
    const results = [row("a0", "Wow Popy"), row("b", "Wow Popy Band"), row("a1", "Wow Popy"), row("a2", "wow popy")];
    const ranked = rankArtistResults(results, { a0: 0, a1: 12, a2: 3, b: 5 });
    expect(ranked.map((r) => r.artist.id)).toEqual(["a1", "a2", "b"]);
    expect(ranked.map((r) => r.released)).toEqual([12, 3, 5]);
  });

  it("Last.fm listeners (looked up by name) only on the row that clearly is that name's artist", () => {
    const ranked = rankArtistResults([row("x", "Same"), row("y", "Same"), row("u", "Unique")], { x: 2, y: 9, u: 4 });
    expect(ranked.map((r) => `${r.artist.id}:${r.listeners}`)).toEqual(["y:true", "x:false", "u:true"]);
  });

  it("while release counts load, a shared name shows no listeners and the order stays Spotify's; a tie is not a clear match", () => {
    expect(rankArtistResults([row("x", "Same"), row("y", "Same"), row("u", "Unique")]).map((r) => `${r.artist.id}:${r.listeners}`)).toEqual(["x:false", "y:false", "u:true"]);
    expect(rankArtistResults([row("x", "Same", 4), row("y", "Same", 4)]).map((r) => r.listeners)).toEqual([false, false]);
  });

  it("namesakes all without releases are all kept", () => {
    expect(rankArtistResults([row("x", "Nobody", 0), row("y", "Nobody", 0)]).map((r) => r.artist.id)).toEqual(["x", "y"]);
  });
});
