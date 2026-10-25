import { describe, expect, it, vi } from "vitest";
import { genreSearchTexts, isPlaceOrPeopleTag } from "@/lib/genre-tags";
import { pickGenreTag, usableTagNames } from "@/lib/qloo-match";

/** The live Yomil run (25 Oct): Last.fm's "cuba" became the genre "CUBA". Places, peoples and languages are never genres. */
const TAGS: Record<string, string[]> = {
  "Yml Cuba": ["cuba", "cuban", "spanish", "seen live", "2010s", "latin america", "cubaton", "latin urban"],
  "Alike Cu": ["reparto", "cuban"],
  // The live Yomil rerun (25 Oct): no artist tags for the act; sound-alikes with few tags.
  "Yml Live": [],
  "Wow Pp": ["cuba"],
  Bebe: ["urban", "cuba", "tropical", "cubano"],
};
/** Last.fm track tags, per artist (every track gets them). */
const TRACK_TAGS: Record<string, { name: string; count: number }[]> = {
  "Yml Live": [{ name: "cubaton", count: 100 }, { name: "tropical", count: 5 }],
};
vi.mock("@/server/adapters/songs", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/adapters/songs")>();
  return {
    ...original,
    getSimilarArtists: async () => ({ mode: "live" as const, data: [] }),
    getTopTags: async (name: string) => ({ mode: "live" as const, data: (TAGS[name] ?? []).map((n, i) => ({ name: n, count: 100 - i })) }),
    getTrackTopTags: async (artist: string) => ({ mode: "live" as const, data: TRACK_TAGS[artist] ?? [] }),
    getSongs: async (names: string[]) => ({ mode: "live" as const, data: Object.fromEntries(names.map((n) => [n, [{ title: `${n} hit`, playcount: 1, listeners: 1 }]])) }),
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

describe("no partial genre matches; 'urban' goes through the synonyms", () => {
  it("'urban' is never Urban Gospel", () => {
    const tags = [{ id: "urn:tag:genre:music:urban_gospel", name: "Urban Gospel" }];
    expect(pickGenreTag(tags, "urban")).toBeNull();
    expect(genreSearchTexts("urban")).toEqual(["urbano latino", "reggaeton"]);
    expect(genreSearchTexts("Urban Latino")).toEqual(["Urban Latino", "urbano latino", "reggaeton"]);
  });
});

describe("GET /api/genres (the ask's genre search)", () => {
  it("Qloo genre tags matching the text, music genres only, never a place, best match first", async () => {
    vi.resetModules();
    vi.stubEnv("BUSKMAP_OFFLINE", "1");
    const { GET } = await import("@/app/api/genres/route");
    const ask = async (q: string) => (await GET(new Request(`http://localhost/api/genres?q=${encodeURIComponent(q)}`))).json();
    expect(await ask("regg")).toEqual({ mode: "live", genres: [{ id: "urn:tag:genre:qloo:reggaeton", name: "Reggaeton" }] });
    expect((await ask("folk")).genres[0]).toEqual({ id: "urn:tag:genre:music:folk", name: "Folk" });
    expect((await ask("cuba")).genres).toEqual([]);
    expect((await ask("american")).genres).toEqual([]);
    expect((await GET(new Request("http://localhost/api/genres?q=r"))).status).toBe(400);
  });
});

describe("Last.fm track tags and confidence", () => {
  it("the act's track tags count when its artist has none; a tag from one weak source is never confident", async () => {
    vi.stubEnv("BUSKMAP_OFFLINE", "1");
    const { actLastfmTags, suggestGenres } = await import("@/server/playlist/own-artist");
    const tags = await actLastfmTags({ name: "Yml Live", tracks: ["One", "Two"] }, OFF);
    expect(tags).toEqual([
      { tag: "cubaton", weight: 2, sources: 2, confident: true },
      { tag: "tropical", weight: 0.1, sources: 2, confident: false },
    ]);
    // Sound-alikes: "cuba" and "cubano" are dropped; "urban" goes to Reggaeton through the synonyms; one sound-alike's tag isn't confident.
    const out = await suggestGenres({ name: "Yml Live", genres: [], tracks: ["One"] }, ["Wow Pp", "Bebe"], OFF);
    expect(out.map((g) => `${g.name}:${g.from}:${g.confident}`)).toEqual(["Reggaeton:act:true"]);
    const noTracks = await suggestGenres({ name: "Yml Live", genres: [] }, ["Wow Pp", "Bebe"], OFF);
    expect(noTracks.map((g) => `${g.name}:${g.from}:${g.confident}`)).toEqual(["Reggaeton:alikes:false"]);
  });
});
