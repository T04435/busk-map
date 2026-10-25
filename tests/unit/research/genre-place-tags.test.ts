import { describe, expect, it, vi } from "vitest";
import { genreSearchTexts, isPlaceOrPeopleTag } from "@/lib/genre-tags";
import { pickGenreTag, usableTagNames } from "@/lib/qloo-match";

/** The live Yomil run (25 Oct): Last.fm's "cuba" became the genre "CUBA". Places, peoples and languages are never genres. */
const TAGS: Record<string, string[]> = {
  "Yml Cuba": ["cuba", "cuban", "spanish", "seen live", "2010s", "latin america", "cubaton", "latin urban"],
  "Alike Cu": ["reparto", "cuban"],
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

describe("places, peoples and languages are never genres", () => {
  it("names", () => {
    for (const name of ["Cuba", "CUBA", "cuban", "Spanish", "Latin America", "Latin American", "American", "Brazilian Music", "Puerto Rican", "en español", "Havana"]) expect(isPlaceOrPeopleTag(name), name).toBe(true);
    for (const name of ["Latin", "Cuban Urban", "Latin Pop", "Australian Hip Hop", "Reggaeton", "Rock en Español", "World Music", "Dembow"]) expect(isPlaceOrPeopleTag(name), name).toBe(false);
  });
  it("Last.fm tags: places, years and noise are dropped before any lookup", () => {
    expect(usableTagNames(TAGS["Yml Cuba"])).toEqual(["cubaton", "latin urban"]);
  });
  it("a /v2/tags result that is a place is never picked, whatever its type", () => {
    const tags = [
      { id: "urn:tag:genre:music:cuba", name: "CUBA" },
      { id: "urn:tag:genre:music:american", name: "American" },
      { id: "urn:tag:genre:qloo:cuban_urban", name: "Cuban Urban" },
    ];
    expect(pickGenreTag(tags, "cuba")).toBeNull();
    expect(pickGenreTag(tags, "cuban", { broad: true })).toBeNull();
    expect(pickGenreTag(tags, "american")).toBeNull();
    expect(pickGenreTag(tags, "cuban urban", { broad: true })).toEqual(tags[2]);
  });
});

describe("Latin urban synonyms", () => {
  it("labels map to the genres Qloo has, in order", () => {
    expect(genreSearchTexts("Cubaton")).toEqual(["Cubaton", "reggaeton"]);
    expect(genreSearchTexts("latin urban")).toEqual(["latin urban", "urbano latino", "reggaeton"]);
    expect(genreSearchTexts("Latin Trap")).toEqual(["Latin Trap", "trap latino", "trap"]);
    expect(genreSearchTexts("reguetón")).toEqual(["reguetón", "reggaeton"]);
    expect(genreSearchTexts("folk")).toEqual(["folk"]);
  });

  it("the Yomil case on the mock: no Cuba, the Latin urban labels resolve to Reggaeton and Cuban Urban", async () => {
    vi.stubEnv("BUSKMAP_OFFLINE", "1");
    const { resolveGenreTag, suggestGenres, findSoundAlikes } = await import("@/server/playlist/own-artist");
    expect(await resolveGenreTag("cuba", OFF)).toBeNull();
    expect(await resolveGenreTag("Cuban", OFF)).toBeNull();
    expect(await resolveGenreTag("cubaton", OFF)).toEqual({ id: "urn:tag:genre:qloo:reggaeton", name: "Reggaeton" });
    expect(await resolveGenreTag("reparto", OFF)).toEqual({ id: "urn:tag:genre:qloo:cuban_urban", name: "Cuban Urban" });
    const out = await suggestGenres({ name: "Yml Cuba", genres: [] }, ["Alike Cu"], OFF);
    expect(out.map((g) => `${g.name}:${g.from}`)).toEqual(["Reggaeton:act", "Cuban Urban:alikes"]);
    const found = await findSoundAlikes({ name: "Yml Cuba", genres: [] }, OFF);
    expect(found.tags.map((t) => t.name)).toEqual(["Reggaeton"]);
  });
});

describe("/v2/tags retries once on a server error", () => {
  it("a 502 or a timeout is tried again once; a 404 or a refusal is not", async () => {
    const { AdapterError } = await import("@/server/adapters/core");
    const { retryOnceOnServerError, isServerError } = await import("@/server/adapters/qloo/client");
    expect(isServerError(new AdapterError("qloo", "http", "hackathon.api.qloo.com/v2/tags returned HTTP 502", 502))).toBe(true);
    expect(isServerError(new AdapterError("qloo", "timeout", "timed out after 8000 ms"))).toBe(true);
    expect(isServerError(new AdapterError("qloo", "http", "returned HTTP 400", 400))).toBe(false);
    expect(isServerError(new AdapterError("qloo", "not_found", "returned HTTP 404", 404))).toBe(false);
    let calls = 0;
    const flaky = async () => {
      if (++calls === 1) throw new AdapterError("qloo", "http", "returned HTTP 502", 502);
      return "ok";
    };
    expect(await retryOnceOnServerError(flaky, "/v2/tags", 0)).toBe("ok");
    expect(calls).toBe(2);
    let twice = 0;
    await expect(retryOnceOnServerError(async () => { twice++; throw new AdapterError("qloo", "http", "returned HTTP 503", 503); }, "/v2/tags", 0)).rejects.toThrow("503");
    expect(twice).toBe(2);
  });
});
