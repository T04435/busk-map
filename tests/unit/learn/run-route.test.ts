import { beforeEach, describe, expect, it, vi } from "vitest";
import { learnStreamEventSchema, type LearnStreamEvent } from "@/lib/learn-schema";

/**
 * POST /api/playlist/learn end to end, offline: the memory stores, the Qloo mock, the synthetic Spotify and the mock
 * learn model. The stream is read the way the page reads it, and every line is checked against the contract (§7.2).
 */
async function load() {
  vi.resetModules();
  vi.stubEnv("BUSKMAP_OFFLINE", "1");
  vi.stubEnv("BUSKMAP_ALLOW_FAULTS", "1");
  vi.stubEnv("VERCEL", "");
  const playlistStore = await import("@/server/playlist/store");
  playlistStore.resetPlaylistStoresForTests();
  (await import("@/server/learn/store")).resetLearnStoresForTests();
  (await import("@/server/learn/runs")).clearLearnRunsForTests();
  const mock = await import("@/server/learn/mock-model");
  mock.resetMockLearnerCalls();
  return {
    playlistStore,
    mock,
    songs: await import("@/app/api/playlist/songs/route"),
    learn: await import("@/app/api/playlist/learn/route"),
    events: await import("@/app/api/playlist/learn/runs/[runId]/events/route"),
    patch: await import("@/app/api/playlist/learn/suggestions/[id]/route"),
    store: await import("@/server/learn/store"),
  };
}

const base = "http://localhost:3100/api/playlist";
const req = (method: string, path: string, body?: unknown, cookie?: string, headers: Record<string, string> = {}) =>
  new Request(base + path, { method, headers: { "content-type": "application/json", host: "localhost:3100", ...(cookie ? { cookie } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
const cookieOf = (res: Response) => res.headers.get("set-cookie")?.split(";")[0] ?? "";
const ctx = (v: Record<string, string>) => ({ params: Promise.resolve(v) }) as never;

async function readEvents(res: Response): Promise<LearnStreamEvent[]> {
  const text = await res.text();
  return text
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => {
      const parsed = learnStreamEventSchema.safeParse(JSON.parse(l));
      expect(parsed.success, l.slice(0, 160)).toBe(true);
      return parsed.data!;
    });
}

const ARTISTS = [
  ["Dumb Things", "Paul Kelly"],
  ["To Her Door", "Paul Kelly"],
  ["Avant Gardener", "Courtney Barnett"],
  ["Scar", "Missy Higgins"],
  ["Riptide", "Vance Joy"],
];

async function withSongs(m: Awaited<ReturnType<typeof load>>, count = ARTISTS.length) {
  let cookie = "";
  for (const [title, artist] of ARTISTS.slice(0, count)) {
    const res = await m.songs.POST(req("POST", "/songs", { title, artist }, cookie));
    cookie ||= cookieOf(res);
  }
  return cookie;
}

const start = (m: Awaited<ReturnType<typeof load>>, cookie: string, headers: Record<string, string> = {}) => m.learn.POST(req("POST", "/learn", undefined, cookie, headers));
const list = async (m: Awaited<ReturnType<typeof load>>, cookie: string) => (await m.learn.GET(req("GET", "/learn", undefined, cookie))).json();

beforeEach(() => vi.unstubAllEnvs());

describe("POST /api/playlist/learn: a run", () => {
  it("streams run → status → steps (totals after each tool-end) → suggestions → totals → usage → end, and saves the songs", async () => {
    const m = await load();
    const cookie = await withSongs(m);
    const res = await start(m, cookie);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/x-ndjson");
    const events = await readEvents(res);
    const types = events.map((e) => e.type);
    expect(types[0]).toBe("run");
    expect(types[1]).toBe("status");
    expect(types.at(-1)).toBe("end");
    expect(types.filter((t) => t === "end")).toHaveLength(1);
    expect(types.filter((t) => (t as string) === "plan" || (t as string) === "error")).toHaveLength(0);
    // suggestions come after every step and right before the final totals, usage and end
    const firstSuggestion = types.indexOf("suggestion");
    const lastSuggestion = types.lastIndexOf("suggestion");
    expect(firstSuggestion).toBeGreaterThan(types.lastIndexOf("tool-end"));
    expect(types.slice(lastSuggestion + 1)).toEqual(["totals", "usage", "end"]);
    const run = events[0] as Extract<LearnStreamEvent, { type: "run" }>;
    expect(run).toMatchObject({ number: 1, model: "mock", replay: false, stepsKept: true, inputs: { songs: 5, soundsLike: [], pitches: [] } });
    expect(events[1]).toMatchObject({ type: "status", message: "Looking for songs to learn" });
    const toolNames = events.filter((e) => e.type === "tool-start").map((e) => (e as { tool: string }).tool);
    expect(toolNames).toEqual(["match_playlist", "history", "related_artists", "crowd_at", "rising", "top_tracks", "finish_suggestions"]);
    // the final totals: newSongs is the saved count
    const suggestions = events.filter((e) => e.type === "suggestion") as Extract<LearnStreamEvent, { type: "suggestion" }>[];
    const totals = events.filter((e) => e.type === "totals").at(-1) as Extract<LearnStreamEvent, { type: "totals" }>;
    const end = events.at(-1) as Extract<LearnStreamEvent, { type: "end" }>;
    expect(totals.totals.newSongs).toBe(suggestions.length);
    expect(end).toMatchObject({ ok: true, runId: run.runId, mode: "mock", newCount: suggestions.length, code: null });
    expect(end.message).toBe(`The test model found ${suggestions.length} songs to learn.`);
    expect(suggestions.map((s) => s.rank)).toEqual(suggestions.map((_, i) => i + 1));
    expect(suggestions.every((s) => s.isNew && s.status === "pending" && s.runId === run.runId)).toBe(true);
    // saved: the list holds the same songs
    const body = await list(m, cookie);
    expect(body.runs[0]).toMatchObject({ runId: run.runId, number: 1, status: "done", model: "mock", newCount: suggestions.length, stepsKept: true });
    expect(body.suggestions.map((s: { id: string }) => s.id)).toEqual(suggestions.map((s) => s.id));
    expect(body.limit.remaining).toBe(2);
  });

  it("a second run gets the first run's items as history, returns none of them, and marks its own as new", async () => {
    const m = await load();
    const cookie = await withSongs(m);
    const first = await readEvents(await start(m, cookie));
    const firstSongs = (first.filter((e) => e.type === "suggestion") as { id: string; title: string; artist: string }[]);
    // learn one, dismiss one
    await m.patch.PATCH(req("PATCH", `/learn/suggestions/${firstSongs[0].id}`, { status: "learned" }, cookie), ctx({ id: firstSongs[0].id }));
    await m.patch.PATCH(req("PATCH", `/learn/suggestions/${firstSongs[1].id}`, { status: "dismissed" }, cookie), ctx({ id: firstSongs[1].id }));
    m.mock.resetMockLearnerCalls();
    const second = await readEvents(await start(m, cookie));
    const secondSongs = second.filter((e) => e.type === "suggestion") as { id: string; title: string; artist: string; isNew: boolean; basedOn: { kind: string; name: string }[] }[];
    expect(secondSongs.length).toBeGreaterThanOrEqual(3);
    const earlier = new Set(firstSongs.map((s) => `${s.artist}|${s.title}`));
    for (const s of secondSongs) expect(earlier.has(`${s.artist}|${s.title}`), `${s.title} came back`).toBe(false);
    // the model saw the history
    const prompt = m.mock.mockLearnerCalls[0].prompt;
    expect(prompt).toContain(`Learned from earlier runs (1): ${firstSongs[0].title}`);
    expect(prompt).toContain("Dismissed, never suggest again (1)");
    expect(prompt).toContain(`On your To learn list, not learned yet (${firstSongs.length - 2})`);
    // top_tracks left some out, and a card builds on the learned song
    const totals = second.filter((e) => e.type === "totals").at(-1) as Extract<LearnStreamEvent, { type: "totals" }>;
    expect(totals.totals.alreadySuggested + totals.totals.dismissedSkipped).toBeGreaterThan(0);
    expect(secondSongs[0].basedOn).toContainEqual({ kind: "learned", name: firstSongs[0].title });
    // New this run moves on
    const body = await list(m, cookie);
    const isNew = Object.fromEntries(body.suggestions.map((s: { id: string; isNew: boolean }) => [s.id, s.isNew]));
    expect(secondSongs.every((s) => isNew[s.id])).toBe(true);
    expect(firstSongs.every((s) => !isNew[s.id])).toBe(true);
    expect(body.runs.map((r: { number: number }) => r.number)).toEqual([2, 1]);
    // the learned song is in Songs you can sing
    const songs = await (await m.songs.POST(req("POST", "/songs", { title: "Probe", artist: "Probe" }, cookie))).json();
    expect(songs.playlist.songs.some((s: { title: string; state: string }) => s.title === firstSongs[0].title && s.state === "learned")).toBe(true);
  });

  it("replays a stored run from the store: the same steps, labelled a replay, no new model call, not counted", async () => {
    const m = await load();
    const cookie = await withSongs(m);
    const live = await readEvents(await start(m, cookie));
    const runId = (live[0] as { runId: string }).runId;
    const calls = m.mock.mockLearnerCalls.length;
    expect(calls).toBeGreaterThan(0);
    const replay = await readEvents(await m.events.GET(req("GET", `/learn/runs/${runId}/events`, undefined, cookie), ctx({ runId })));
    expect(m.mock.mockLearnerCalls).toHaveLength(calls);
    expect(replay[0]).toMatchObject({ type: "run", replay: true, stepsKept: true, runId, number: 1 });
    expect(replay[1]).toMatchObject({ type: "status", replay: true });
    const names = (events: LearnStreamEvent[]) => events.filter((e) => e.type === "tool-end").map((e) => (e as { tool: string; summary: string }).tool + ":" + (e as { summary: string }).summary);
    expect(names(replay)).toEqual(names(live));
    expect(replay.filter((e) => e.type === "suggestion").map((e) => (e as { id: string }).id)).toEqual(live.filter((e) => e.type === "suggestion").map((e) => (e as { id: string }).id));
    expect(replay.at(-1)).toEqual(live.at(-1));
    expect(replay.map((e) => e.type).slice(-3)).toEqual(["totals", "usage", "end"]);
    // not counted: still two runs left in the hour per Repertoire
    expect((await list(m, cookie)).limit.remaining).toBe(2);
  });

  it("a replay shows each suggestion's current status; a run whose steps were pruned replays without steps", async () => {
    const m = await load();
    const cookie = await withSongs(m);
    const live = await readEvents(await start(m, cookie));
    const runId = (live[0] as { runId: string }).runId;
    const first = (live.find((e) => e.type === "suggestion") as { id: string }).id;
    await m.patch.PATCH(req("PATCH", `/learn/suggestions/${first}`, { status: "dismissed" }, cookie), ctx({ id: first }));
    const replay = await readEvents(await m.events.GET(req("GET", `/learn/runs/${runId}/events`, undefined, cookie), ctx({ runId })));
    expect(replay.find((e) => e.type === "suggestion" && e.id === first)).toMatchObject({ status: "dismissed" });
    // prune: more runs than the retention keeps
    const store = m.playlistStore.playlistStore(true) as import("@/server/playlist/store").MemoryPlaylistStore;
    const playlistId = [...store.playlists.values()][0].id;
    const learn = m.store.learnStore(true, store);
    const rows = store.runRows.get(playlistId)!;
    for (let i = 0; i < 6; i++) {
      const r = await learn.startRun(playlistId, { model: "mock", inputs: { songs: 5, soundsLike: [], pitches: [] } });
      if (r.ok) await learn.finishRun(r.run.id, { status: "done", endCode: null, steps: [], totals: { artists: 0, crowds: 0, liked: 0, songsChecked: 0, alreadySuggested: 0, dismissedSkipped: 0, alreadyKnown: 0, newSongs: 0, qlooCalls: 0, qlooCacheHits: 0 }, usage: null, newCount: 0, skippedCount: 0 });
    }
    expect(rows[0].steps).toBeNull();
    const pruned = await readEvents(await m.events.GET(req("GET", `/learn/runs/${runId}/events`, undefined, cookie), ctx({ runId })));
    expect(pruned[0]).toMatchObject({ type: "run", replay: true, stepsKept: false });
    expect(pruned.some((e) => e.type === "tool-start")).toBe(false);
    expect(pruned.filter((e) => e.type === "suggestion").length).toBeGreaterThan(0);
    expect(pruned.at(-1)!.type).toBe("end");
  });

  it("a run is served only to the cookie that owns it", async () => {
    const m = await load();
    const cookie = await withSongs(m);
    const live = await readEvents(await start(m, cookie));
    const runId = (live[0] as { runId: string }).runId;
    const other = cookieOf(await m.songs.POST(req("POST", "/songs", { title: "x", artist: "y" })));
    expect((await m.events.GET(req("GET", `/learn/runs/${runId}/events`, undefined, other), ctx({ runId }))).status).toBe(404);
    expect((await m.events.GET(req("GET", `/learn/runs/${runId}/events`), ctx({ runId }))).status).toBe(404);
    expect((await m.events.GET(req("GET", "/learn/runs/nope/events", undefined, cookie), ctx({ runId: "nope" }))).status).toBe(404);
  });

  it("a viewer can join a run in flight: the steps so far, then the rest, ending at the same end", async () => {
    const m = await load();
    const cookie = await withSongs(m);
    const first = await start(m, cookie);
    const reader = first.body!.getReader();
    const firstChunk = await reader.read(); // the run is already going
    expect(firstChunk.done).toBe(false);
    const runId = JSON.parse(new TextDecoder().decode(firstChunk.value).split("\n")[0]).runId as string;
    const joined = await readEvents(await m.events.GET(req("GET", `/learn/runs/${runId}/events`, undefined, cookie), ctx({ runId })));
    expect(joined[0]).toMatchObject({ type: "run", runId, replay: false });
    expect(joined.at(-1)).toMatchObject({ type: "end", ok: true });
    expect(joined.filter((e) => e.type === "end")).toHaveLength(1);
    await reader.cancel();
  });
});

describe("the refusals before a run starts", () => {
  it("404 no_playlist without a Repertoire, 409 empty_playlist under 3 songs", async () => {
    const m = await load();
    const none = await start(m, "");
    expect(none.status).toBe(404);
    expect((await none.json()).error.code).toBe("no_playlist");
    const cookie = await withSongs(m, 2);
    const few = await start(m, cookie);
    expect(few.status).toBe(409);
    expect((await few.json()).error).toMatchObject({ code: "empty_playlist", minSongs: 3, message: "Add at least 3 songs you can sing, then find songs to learn." });
    expect(few.headers.get("cache-control")).toBe("no-store");
    expect((await list(m, cookie)).runs).toEqual([]);
  });

  it("409 already_running with the running run's id", async () => {
    const m = await load();
    const cookie = await withSongs(m);
    const store = m.playlistStore.playlistStore(true) as import("@/server/playlist/store").MemoryPlaylistStore;
    const playlistId = [...store.playlists.values()][0].id;
    const started = await m.store.learnStore(true, store).startRun(playlistId, { model: "mock", inputs: { songs: 5, soundsLike: [], pitches: [] } });
    const res = await start(m, cookie);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatchObject({ code: "already_running", runId: started.ok ? started.run.id : "" });
  });

  it("409 list_full at 40 pending suggestions", async () => {
    const m = await load();
    const cookie = await withSongs(m);
    const store = m.playlistStore.playlistStore(true) as import("@/server/playlist/store").MemoryPlaylistStore;
    const playlistId = [...store.playlists.values()][0].id;
    for (let i = 0; i < 40; i++) await store.addPlanSuggestion(playlistId, { title: `Plan ${i}`, artist: `Artist ${i}`, reason: "r", growth: null });
    const res = await start(m, cookie);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatchObject({ code: "list_full", pending: 40, max: 40 });
  });

  it("429 limit with the Repertoire's scope, Retry-After, relative messages and a reset time, from the test fault", async () => {
    const m = await load();
    const cookie = await withSongs(m);
    const before = Date.now();
    const res = await start(m, cookie, { "x-buskmap-faults": "learn-limit" });
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe(String(45 * 60));
    expect(res.headers.get("cache-control")).toBe("no-store");
    const { error } = await res.json();
    expect(error).toMatchObject({ code: "limit", message: "You've started 3 runs this hour. Try again in about 45 minutes.", retryAfterS: 2700, limit: { scope: "repertoire", max: 3, windowMinutes: 60, retryInMinutes: 45 } });
    expect(error.limit.resetAt).toBe(error.retryAt);
    expect(Date.parse(error.retryAt)).toBeGreaterThanOrEqual(before + 2700_000 - 1000);
    expect(error.message).not.toMatch(/\d:\d\d|\b(am|pm)\b/i);
    expect((await list(m, cookie)).runs).toEqual([]); // nothing started
  });

  it("429 limit with the network's scope from the other fault, and the faults do nothing without BUSKMAP_ALLOW_FAULTS", async () => {
    const m = await load();
    const cookie = await withSongs(m);
    const res = await start(m, cookie, { "x-buskmap-faults": "learn-limit-ip" });
    expect(res.status).toBe(429);
    const { error } = await res.json();
    expect(error.limit.scope).toBe("ip");
    expect(error.message).toBe("A lot of runs have started from this network in the last hour. Try again in about 45 minutes.");
    vi.unstubAllEnvs();
    const off = await load();
    vi.stubEnv("BUSKMAP_ALLOW_FAULTS", "");
    const cookie2 = await withSongs(off);
    expect((await start(off, cookie2, { "x-buskmap-faults": "learn-limit" })).status).toBe(200);
  });

  it("checks Origin on the mutating route", async () => {
    const m = await load();
    const cookie = await withSongs(m);
    expect((await start(m, cookie, { origin: "https://evil.example" })).status).toBe(403);
  });
});

describe("when the data sources fail", () => {
  it("Qloo down: the run ends failed with qloo_unavailable, in plain words, and doesn't count against the limit", async () => {
    const m = await load();
    const cookie = await withSongs(m);
    const events = await readEvents(await start(m, cookie, { "x-buskmap-faults": "qloo" }));
    const end = events.at(-1) as Extract<LearnStreamEvent, { type: "end" }>;
    expect(end).toMatchObject({ ok: false, mode: "none", newCount: 0, code: "qloo_unavailable" });
    expect(end.message).toMatch(/Qloo isn't answering/);
    expect(events.filter((e) => e.type === "tool-start").map((e) => (e as { tool: string }).tool)).toEqual(["match_playlist"]);
    expect(m.mock.mockLearnerCalls).toHaveLength(0);
    const body = await list(m, cookie);
    expect(body.runs[0]).toMatchObject({ status: "failed" });
    expect(body.limit.remaining).toBe(3);
    // and the next run can start straight away
    expect((await start(m, cookie)).status).toBe(200);
  });
});
