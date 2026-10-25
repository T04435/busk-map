import { beforeEach, describe, expect, it, vi } from "vitest";
import { learnStreamEventSchema, type LearnStreamEvent } from "@/lib/learn-schema";
import { OFFLINE_ALIKE_TAGS, OFFLINE_SPOTIFY_ONLY_ARTISTS, OFFLINE_TEST_ACTS, type ResearchSnapshot } from "@/lib/repertoire-research";

/**
 * The ask starts from what the research found (the Wow Popy case, offline: OFFLINE_TEST_ACTS.taggedAlikes): the Last.fm
 * sound-alikes prefilled with their Spotify id and photo, and specific genres (Qloo's own tags) from their Last.fm tags,
 * preselected. Carry on as it is confirms them, and the fans steps use those genres and say which.
 */
async function load() {
  vi.resetModules();
  vi.stubEnv("BUSKMAP_OFFLINE", "1");
  vi.stubEnv("VERCEL", "");
  (await import("@/server/playlist/store")).resetPlaylistStoresForTests();
  (await import("@/server/learn/store")).resetLearnStoresForTests();
  (await import("@/server/learn/runs")).clearLearnRunsForTests();
  return {
    research: await import("@/app/api/playlist/research/route"),
    input: await import("@/app/api/playlist/research/[runId]/input/route"),
    playlist: await import("@/app/api/playlist/route"),
  };
}
type Mods = Awaited<ReturnType<typeof load>>;
const base = "http://localhost:3100/api/playlist";
const req = (method: string, path: string, body?: unknown, cookie?: string) =>
  new Request(base + path, { method, headers: { "content-type": "application/json", host: "localhost:3100", ...(cookie ? { cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
async function read(res: Response): Promise<LearnStreamEvent[]> {
  return (await res.text())
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => learnStreamEventSchema.parse(JSON.parse(l)));
}
const end = (e: LearnStreamEvent[]) => e.at(-1) as Extract<LearnStreamEvent, { type: "end" }>;
const runIdOf = (e: LearnStreamEvent[]) => (e.find((x) => x.type === "run") as Extract<LearnStreamEvent, { type: "run" }>).runId;
async function view(m: Mods, cookie: string) {
  return (await (await m.playlist.GET(req("GET", "", undefined, cookie))).json()).playlist as { research: ResearchSnapshot; soundsLike: { name: string; spotifyId?: string; image?: string; foundBy?: string }[] };
}
const ACT = OFFLINE_TEST_ACTS.taggedAlikes;

beforeEach(() => vi.unstubAllEnvs());

describe("the ask is prefilled with what the research found", () => {
  it("found sound-alikes with their Spotify id and photo; their specific genres as Qloo tags, preselected; unchanged = confirmed", async () => {
    const m = await load();
    const res = await m.research.POST(req("POST", "/research", { link: ACT.spotifyId }));
    const cookie = res.headers.get("set-cookie")?.split(";")[0] ?? "";
    const events = await read(res);
    expect(end(events)).toMatchObject({ ok: true, code: "needs_sounds_like" });
    const v = await view(m, cookie);
    const suggest = v.research.waiting!.suggest!;
    expect(suggest.artists).toEqual(ACT.similar.map((name) => ({ name, spotifyId: OFFLINE_SPOTIFY_ONLY_ARTISTS[name].spotifyId, image: OFFLINE_SPOTIFY_ONLY_ARTISTS[name].image })));
    // Shared by both sound-alikes first (Reggaeton), then the rest; Qloo's own genre tags, Qloo's names; "seen live" is noise.
    // Only a genre two sound-alikes share starts selected: never one from a single sound-alike's tag.
    expect(suggest.genres).toEqual([
      { id: "urn:tag:genre:qloo:reggaeton", name: "Reggaeton", from: "alikes", picked: true },
      { id: "urn:tag:genre:qloo:dembow", name: "Dembow", from: "alikes", picked: false },
      { id: "urn:tag:genre:qloo:cuban_urban", name: "Cuban Urban", from: "alikes", picked: false },
      // Fewer than three sure genres: the Hive's one small call (the test model offline answers funk, Cuba and polka). Cuba is a
      // place and polka has no Qloo tag, so only Funk is offered, never selected.
      { id: "urn:tag:genre:music:funk", name: "Funk", from: "hive", picked: false },
    ]);
    expect(suggest.hiveBy).toBe("mock");
    // The call is counted on the run, and again once it carries on.
    expect(v.research.waiting!.hiveUsage).toMatchObject({ inputTokens: 40, outputTokens: 12, steps: 1 });
    expect(events.find((e) => e.type === "usage")).toMatchObject({ inputTokens: 40, outputTokens: 12 });
    expect(OFFLINE_ALIKE_TAGS["Dny Omy"]).toContain("seen live");
    // The waiting step's own output carries it too (the live page reads it from the stream).
    const waitingEnd = events.findLast((e) => e.type === "tool-end" && e.tool === "research_sounds_like") as Extract<LearnStreamEvent, { type: "tool-end" }>;
    expect((waitingEnd.output as { waiting: { suggest: unknown } }).waiting.suggest).toEqual(suggest);

    // Carry on as it is: the prefilled artists and the preselected genres.
    const runId = runIdOf(events);
    const answer = await m.input.POST(req("POST", `/research/${runId}/input`, { artists: suggest.artists, genres: suggest.genres.filter((g) => g.picked).map((g) => g.name) }, cookie), { params: Promise.resolve({ runId }) });
    expect(answer.status).toBe(200);
    const more = await read(answer);
    expect(String(end(more).code)).not.toMatch(/^needs_/);
    const used = more.find((e) => e.type === "usage") as { inputTokens: number; steps: number } | undefined;
    expect(used!.inputTokens).toBeGreaterThan(40);
    expect(used!.steps).toBe(2);
    const after = await view(m, cookie);
    const s = after.research.steps;
    expect(s.qloo!.output).toMatchObject({ fallback: "genres", genreTags: [{ id: "urn:tag:genre:qloo:reggaeton", name: "Reggaeton" }] });
    // Confirmed: the found sound-alikes are now the performer's own, with their Spotify id and photo.
    expect(after.soundsLike).toEqual(suggest.artists);
    // The fans steps use those specific genres and say which, in a short line.
    expect(s.fans!.output!.summary).toMatch(/^Based on Reggaeton: your fans lean /);
    expect(s.fansLove!.output).toMatchObject({ basedOn: "genres", signalledBy: ["Reggaeton"], byGenres: ["Reggaeton"] });
    expect(s.fans!.output).toMatchObject({ basedOn: "genres", byGenres: ["Reggaeton"] });
    expect(s.fansLove!.output!.summary).toMatch(/^Based on Reggaeton: your fans also love /);
    expect(s.fansLove!.output!.artists.length).toBeGreaterThan(0);
  }, 30_000);

  it("removing a found sound-alike drops it; the performer's own are kept", async () => {
    const m = await load();
    const res = await m.research.POST(req("POST", "/research", { link: ACT.spotifyId }));
    const cookie = res.headers.get("set-cookie")?.split(";")[0] ?? "";
    const events = await read(res);
    const runId = runIdOf(events);
    const answer = await m.input.POST(req("POST", `/research/${runId}/input`, { artists: [{ name: "Lkm Kimi" }, { name: "Paul Kelly" }] }, cookie), { params: Promise.resolve({ runId }) });
    await read(answer);
    expect((await view(m, cookie)).soundsLike.map((a) => `${a.name}:${a.foundBy ?? "you"}`)).toEqual(["Lkm Kimi:you", "Paul Kelly:you"]);
  }, 30_000);
});

describe("genre tags: Qloo's own genre tags and specific over broad", () => {
  const OFF = { offline: true, faults: [] } as const;
  it("a genre Qloo has only as its own tag resolves through the wider /v2/tags search", async () => {
    await load();
    const { resolveGenreTag } = await import("@/server/playlist/own-artist");
    expect(await resolveGenreTag("reggaeton", OFF)).toEqual({ id: "urn:tag:genre:qloo:reggaeton", name: "Reggaeton" });
    expect(await resolveGenreTag("Cuban urban", OFF)).toEqual({ id: "urn:tag:genre:qloo:cuban_urban", name: "Cuban Urban" });
    expect(await resolveGenreTag("indie folk", OFF)).toMatchObject({ id: "urn:tag:genre:music:indie_folk" });
    expect(await resolveGenreTag("Latin", OFF)).toBeNull();
  });
});
