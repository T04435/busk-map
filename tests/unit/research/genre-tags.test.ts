import { describe, expect, it } from "vitest";
import { isMusicGenreTag } from "@/lib/genre-tags";

describe("which Qloo tags count as music genres", () => {
  it("keeps music genres", () => {
    expect(isMusicGenreTag({ id: "urn:tag:genre:music:reggaeton", name: "Reggaeton" })).toBe(true);
    expect(isMusicGenreTag({ id: "urn:tag:genre:music:cumbia", name: "Cumbia" })).toBe(true);
    expect(isMusicGenreTag({ id: "x1", name: "Indie Folk" })).toBe(true);
  });
  it("drops tags whose id marks a place", () => {
    expect(isMusicGenreTag({ id: "urn:tag:location:argentina", name: "Whatever" })).toBe(false);
    expect(isMusicGenreTag({ id: "urn:tag:country:ar", name: "Whatever" })).toBe(false);
    expect(isMusicGenreTag({ id: "urn:tag:audience:qloo:youthful", name: "Youthful" })).toBe(false);
  });
  it("backstop: drops names that are a country or a city", () => {
    expect(isMusicGenreTag({ id: "urn:tag:genre:music:argentina", name: "Argentina" })).toBe(false);
    expect(isMusicGenreTag({ id: "abc", name: "Buenos Aires" })).toBe(false);
    expect(isMusicGenreTag({ id: "abc", name: "Mexico" })).toBe(false);
    expect(isMusicGenreTag({ id: "abc", name: "Latin America" })).toBe(false);
  });
});
