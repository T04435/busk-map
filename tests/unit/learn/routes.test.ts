import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NewSuggestion } from "@/server/learn/types";

async function load() {
  vi.resetModules();
  vi.stubEnv("BUSKMAP_OFFLINE", "1");
  vi.stubEnv("VERCEL", "");
  const playlistStore = await import("@/server/playlist/store");
  playlistStore.resetPlaylistStoresForTests();
  const learn = await import("@/server/learn/store");
  learn.resetLearnStoresForTests();
  const songs = await import("@/app/api/playlist/songs/route");
  const list = await import("@/app/api/playlist/learn/route");
  const one = await import("@/app/api/playlist/learn/suggestions/[id]/route");
  const { playlistSongKey } = await import("@/lib/playlist-schema");
  return { playlistStore, learn, songs, list, one, playlistSongKey };
}

const base = "http://localhost:3100/api/playlist";
const req = (method: string, path: string, body?: unknown, cookie?: string, headers: Record<string, string> = {}) =>
  new Request(base + path, { method, headers: { "content-type": "application/json", host: "localhost:3100", ...(cookie ? { cookie } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
const cookieOf = (res: Response) => res.headers.get("set-cookie")?.split(";")[0] ?? "";
const ctx = (id: string) => ({ params: Promise.resolve({ id }) }) as never;

async function seeded() {
  const m = await load();
  const first = await m.songs.POST(req("POST", "/songs", { title: "Jolene", artist: "Dolly Parton" }));
  const cookie = cookieOf(first);
  const store = m.playlistStore.playlistStore(true) as import("@/server/playlist/store").MemoryPlaylistStore;
  const playlist = [...store.playlists.values()][0];
  const learn = m.learn.learnStore(true, store);
  const run = await learn.startRun(playlist.id, { model: "mock", inputs: { songs: 1, soundsLike: [], pitches: [] } });
  if (!run.ok) throw new Error();
  const pick = (title: string, rank: number): NewSuggestion => ({
    songKey: m.playlistSongKey("Gillian Welch", title), title, artist: "Gillian Welch", spotifyTrackId: null, qlooArtistId: null, year: 1998, durationMs: 200_000, imageUrl: null, sourceUrl: null,
    songSource: "spotify", reason: "Because.", rank, evidence: { ranker: "mock", artistFrom: "related_artists", because: ["Dolly Parton"], affinity: 0.5, growth: null, trendDelta: null, basedOn: [{ kind: "repertoire", name: "Dolly Parton" }] },
  });
  const saved = await learn.insertSuggestions(playlist.id, run.run.id, [pick("Orphan Girl", 1), pick("Look at Miss Ohio", 2)]);
  await learn.finishRun(run.run.id, { status: "done", endCode: null, steps: [], totals: { artists: 1, crowds: 0, liked: 1, songsChecked: 2, alreadySuggested: 0, dismissedSkipped: 0, alreadyKnown: 0, newSongs: 2, qlooCalls: 0, qlooCacheHits: 0 }, usage: null, newCount: 2, skippedCount: 0 });
  return { ...m, cookie, saved, playlist, store };
}

describe("GET /api/playlist/learn", () => {
  beforeEach(() => vi.unstubAllEnvs());

  it("never creates a Repertoire: a device with none gets an empty list and no cookie", async () => {
    const { list } = await load();
    const res = await list.GET(req("GET", "/learn"));
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ running: null, limit: { max: 3, windowMinutes: 60, remaining: 3, retryInMinutes: null }, runs: [], suggestions: [], pending: { count: 0, max: 40 } });
  });

  it("returns the running run, the limit state, the runs newest first and every suggestion (§7.3)", async () => {
    const { list, cookie } = await seeded();
    const body = await (await list.GET(req("GET", "/learn", undefined, cookie))).json();
    expect(body.running).toBeNull();
    expect(body.limit).toEqual({ max: 3, windowMinutes: 60, remaining: 2, retryInMinutes: null });
    expect(body.runs).toHaveLength(1);
    expect(body.runs[0]).toMatchObject({ number: 1, status: "done", model: "mock", inputs: { songs: 1, soundsLike: [], pitches: [] }, newCount: 2, skippedCount: 0, stepsKept: true });
    expect(Object.keys(body.runs[0]).sort()).toEqual(["finishedAt", "inputs", "model", "newCount", "number", "runId", "skippedCount", "startedAt", "status", "stepsKept"]);
    expect(body.suggestions.map((s: { title: string }) => s.title)).toEqual(["Orphan Girl", "Look at Miss Ohio"]);
    expect(body.suggestions[0]).toMatchObject({ runNumber: 1, rank: 1, because: "Fans of Dolly Parton like them", basedOn: [{ kind: "repertoire", name: "Dolly Parton" }], isNew: true, status: "pending", learnedAt: null, dismissedAt: null, songSource: "spotify" });
    expect(Object.keys(body.suggestions[0]).sort()).toEqual(
      ["artist", "basedOn", "because", "dismissedAt", "durationMs", "growth", "id", "image", "isNew", "learnedAt", "rank", "reason", "runId", "runNumber", "songSource", "sourceUrl", "status", "suggestedAt", "title", "trendDelta", "year"].sort(),
    );
    expect(body.pending).toEqual({ count: 2, max: 40 });
  });

  it("shows a running run, and the plan suggestions as 'Added from plans' (no run)", async () => {
    const { list, learn, cookie, playlist, store } = await seeded();
    await store.addPlanSuggestion(playlist.id, { title: "Zed", artist: "Q", reason: "Crowd favourite", growth: null });
    await learn.learnStore(true, store).startRun(playlist.id, { model: "claude", inputs: { songs: 1, soundsLike: [], pitches: [] } });
    const body = await (await list.GET(req("GET", "/learn", undefined, cookie))).json();
    expect(body.running).toMatchObject({ number: 2 });
    expect(body.suggestions.find((s: { title: string }) => s.title === "Zed")).toMatchObject({ runId: null, runNumber: null, songSource: "plan", isNew: false });
  });
});

describe("PATCH /api/playlist/learn/suggestions/[id]", () => {
  beforeEach(() => vi.unstubAllEnvs());

  it("Learned moves the song into Songs you can sing and returns the new row; Undo takes it out", async () => {
    const { one, songs, cookie, saved } = await seeded();
    const res = await one.PATCH(req("PATCH", `/learn/suggestions/${saved[0].id}`, { status: "learned" }, cookie), ctx(saved[0].id));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.suggestion).toMatchObject({ status: "learned" });
    expect(body.song).toMatchObject({ title: "Orphan Girl", state: "learned", source: "suggested" });
    const mine = await (await songs.POST(req("POST", "/songs", { title: "Another", artist: "Someone" }, cookie))).json();
    expect(mine.playlist.songs.map((s: { title: string }) => s.title)).toEqual(["Jolene", "Orphan Girl", "Another"]);
    const undo = await one.PATCH(req("PATCH", `/learn/suggestions/${saved[0].id}`, { status: "pending" }, cookie), ctx(saved[0].id));
    expect((await undo.json()).suggestion).toMatchObject({ status: "pending" });
  });

  it("dismisses and undoes; a transition that isn't one is a 400, an unknown id a 404, a bad body a 400", async () => {
    const { one, cookie, saved } = await seeded();
    const patch = (id: string, body: unknown, c: string | undefined = cookie) => one.PATCH(req("PATCH", `/learn/suggestions/${id}`, body, c), ctx(id));
    expect((await (await patch(saved[1].id, { status: "dismissed" })).json()).suggestion.status).toBe("dismissed");
    const bad = await patch(saved[1].id, { status: "learned" });
    expect(bad.status).toBe(400);
    expect((await bad.json()).error.code).toBe("invalid_transition");
    expect((await patch(saved[1].id, { status: "pending" })).status).toBe(200);
    expect((await patch("9999", { status: "dismissed" })).status).toBe(404);
    expect((await patch(saved[1].id, { status: "gone" })).status).toBe(400);
    expect((await patch(saved[1].id, { status: "dismissed" }, "")).status).toBe(404);
  });

  it("is only for the cookie that owns the suggestion, and checks Origin", async () => {
    const { one, saved, songs } = await seeded();
    const other = cookieOf(await songs.POST(req("POST", "/songs", { title: "x", artist: "y" })));
    expect((await one.PATCH(req("PATCH", `/learn/suggestions/${saved[0].id}`, { status: "dismissed" }, other), ctx(saved[0].id))).status).toBe(404);
    const cross = await one.PATCH(req("PATCH", `/learn/suggestions/${saved[0].id}`, { status: "dismissed" }, other, { origin: "https://evil.example" }), ctx(saved[0].id));
    expect(cross.status).toBe(403);
  });
});
