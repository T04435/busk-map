import { describe, expect, it, vi } from "vitest";
import { isCoarseGenre, isGenreTagId, pickGenreTag } from "@/lib/qloo-match";

/** suggestGenres and findSoundAlikes over controlled Last.fm tags (the offline Qloo mock resolves them). */
const TAGS: Record<string, string[]> = {
  "Act One": ["reggae", "dembow", "seen live"],
  "Alike A": ["reggaeton", "pop"],
  "Alike B": ["reggaeton", "cuban urban"],
};
vi.mock("@/server/adapters/songs", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/adapters/songs")>();
  return {
    ...original,
    getSimilarArtists: async () => ({ mode: "live" as const, data: [] }),
    getTopTags: async (name: string) => ({ mode: "live" as const, data: (TAGS[name] ?? []).map((n, i) => ({ name: n, count: 100 - i })) }),
  };
});

const OFF = { offline: true, faults: [] } as const;

describe("genre suggestions for the ask", () => {
  it("the act's own first (specific before broad), then its sound-alikes' (most shared first), as Qloo tags with Qloo's names", async () => {
    vi.stubEnv("BUSKMAP_OFFLINE", "1");
    const { suggestGenres } = await import("@/server/playlist/own-artist");
    const out = await suggestGenres({ name: "Act One", genres: [] }, ["Alike A", "Alike B"], OFF);
    expect(out.map((g) => `${g.name}:${g.from}`)).toEqual(["Dembow:act", "Reggae:act", "Reggaeton:alikes", "Cuban Urban:alikes", "Pop:alikes"]);
    expect(out.find((g) => g.name === "Dembow")!.id).toBe("urn:tag:genre:qloo:dembow");
  });

  it("the signal for an act Qloo doesn't know uses its specific genre tags, not a broad one", async () => {
    vi.stubEnv("BUSKMAP_OFFLINE", "1");
    const { findSoundAlikes } = await import("@/server/playlist/own-artist");
    const found = await findSoundAlikes({ name: "Act One", genres: [] }, OFF);
    expect(found).toMatchObject({ source: "genres", tags: [{ id: "urn:tag:genre:qloo:dembow", name: "Dembow" }] });
    // A broad genre the performer picked stays, ahead of the specific ones.
    const picked = await findSoundAlikes({ name: "Act One", genres: [], pick: "Reggae" }, OFF);
    expect(picked.tags.map((t) => t.name)).toEqual(["Reggae", "Dembow"]);
  });
});

describe("genre tag ids", () => {
  it("Qloo's own genre tags count, plain labels and other kinds don't", () => {
    expect(isGenreTagId("urn:tag:genre:qloo:reggaeton")).toBe(true);
    expect(isGenreTagId("urn:tag:genre:music:folk")).toBe(true);
    expect(isGenreTagId("urn:tag:genre:australian")).toBe(false);
    expect(isGenreTagId("urn:tag:style:qloo:urban_latin")).toBe(false);
  });
  it("the wider match takes Qloo's own genre tags; the music-only one doesn't", () => {
    const tags = [{ id: "urn:tag:genre:cubaton", name: "Cubaton" }, { id: "urn:tag:genre:qloo:reggaeton", name: "Reggaeton" }];
    expect(pickGenreTag(tags, "reggaeton")).toBeNull();
    expect(pickGenreTag(tags, "reggaeton", { broad: true })).toEqual(tags[1]);
    expect(pickGenreTag(tags, "cubaton", { broad: true })).toBeNull();
  });
  it("broad genres", () => {
    expect(isCoarseGenre("Reggae")).toBe(true);
    expect(isCoarseGenre("Hip-Hop")).toBe(true);
    expect(isCoarseGenre("dembow")).toBe(false);
  });
});
