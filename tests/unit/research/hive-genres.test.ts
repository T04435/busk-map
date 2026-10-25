import { describe, expect, it, vi } from "vitest";

/** The Hive's genre call for the research ask (hive-genres.ts): what it is sent, what it answers, and failing quietly. */
describe("the Hive's genre suggestions", () => {
  it("the prompt carries the act's name and its sound-alikes' names only", async () => {
    const { hiveGenrePrompt, HIVE_GENRE_INSTRUCTIONS } = await import("@/server/research/hive-genres");
    const prompt = hiveGenrePrompt({ act: "Wpy Popi", soundsLike: ["Dny Omy", "Lkm Kimi"] });
    expect(prompt).toBe('ACT: Wpy Popi\nSOUNDS_LIKE_JSON: ["Dny Omy","Lkm Kimi"]\n\nName up to 3 music genres.');
    expect(HIVE_GENRE_INSTRUCTIONS).toMatch(/never a country, a city, a people, a language/);
  });

  it("answers up to three genres with its usage; the test model offline", async () => {
    const { hiveGenres, MOCK_HIVE_GENRES } = await import("@/server/research/hive-genres");
    const out = await hiveGenres({ act: "Wpy Popi", soundsLike: ["Dny Omy"] }, { offline: true });
    expect(out).toMatchObject({ genres: [...MOCK_HIVE_GENRES], by: "mock", usage: { inputTokens: 40, outputTokens: 12, steps: 1 } });
  });

  it("a failing model, no act name, or no AI gateway: no suggestions and nothing counted", async () => {
    const { hiveGenres, createMockGenreModel } = await import("@/server/research/hive-genres");
    expect(await hiveGenres({ act: "Wpy Popi", soundsLike: [] }, { offline: false, model: createMockGenreModel("fail") })).toEqual({ genres: [], by: null, usage: null });
    expect(await hiveGenres({ act: "  ", soundsLike: ["Dny Omy"] }, { offline: true })).toEqual({ genres: [], by: null, usage: null });
    vi.stubEnv("AI_GATEWAY_API_KEY", "");
    vi.stubEnv("VERCEL_OIDC_TOKEN", "");
    vi.stubEnv("VERCEL", "");
    vi.resetModules();
    const fresh = await import("@/server/research/hive-genres");
    expect(await fresh.hiveGenres({ act: "Wpy Popi", soundsLike: [] }, { offline: false })).toEqual({ genres: [], by: null, usage: null });
    vi.unstubAllEnvs();
  });

  it("only genres that resolve exactly or by a synonym are offered, never a place, and never preselected (ask-suggest.test.ts runs the whole ask)", async () => {
    vi.stubEnv("BUSKMAP_OFFLINE", "1");
    const { resolveGenreTag } = await import("@/server/playlist/own-artist");
    const OFF = { offline: true, faults: [] } as const;
    expect(await resolveGenreTag("funk", OFF)).toMatchObject({ id: "urn:tag:genre:music:funk" });
    expect(await resolveGenreTag("Cuba", OFF)).toBeNull();
    expect(await resolveGenreTag("polka", OFF)).toBeNull();
    vi.unstubAllEnvs();
  });
});
