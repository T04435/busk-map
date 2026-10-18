import { beforeEach, describe, expect, it, vi } from "vitest";
import { learnStreamEventSchema, type LearnStreamEvent } from "@/lib/learn-schema";
import { RESEARCH_STEPS, RESEARCH_TOOLS, type ResearchSnapshot } from "@/lib/repertoire-research";
import { CATALOG } from "@/server/qloo-mock/catalog";

/**
 * POST /api/playlist/research end to end, offline: the memory stores, the Qloo mock, the synthetic Spotify and Last.fm
 * fixtures and the mock summary writer. Every line is checked against the learn stream contract.
 */
async function load() {
  vi.resetModules();
  vi.stubEnv("BUSKMAP_OFFLINE", "1");
  vi.stubEnv("BUSKMAP_ALLOW_FAULTS", "1");
  vi.stubEnv("VERCEL", "");
  (await import("@/server/playlist/store")).resetPlaylistStoresForTests();
  (await import("@/server/learn/store")).resetLearnStoresForTests();
  (await import("@/server/learn/runs")).clearLearnRunsForTests();
  return {
    research: await import("@/app/api/playlist/research/route"),
    playlist: await import("@/app/api/playlist/route"),
    learn: await import("@/app/api/playlist/learn/route"),
    events: await import("@/app/api/playlist/learn/runs/[runId]/events/route"),
  };
}

const JULIA = CATALOG.find((a) => a.name === "Julia Jacklin")!;
const LINK = `https://open.spotify.com/artist/${JULIA.spotifyId}?si=abc`;
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

const tools = (events: LearnStreamEvent[]) => events.flatMap((e) => (e.type === "tool-end" ? [e.tool] : []));
const end = (events: LearnStreamEvent[]) => events.at(-1) as Extract<LearnStreamEvent, { type: "end" }>;

beforeEach(() => vi.unstubAllEnvs());

describe("POST /api/playlist/research: the full run on the offline mock artist", () => {
  it("creates the Repertoire, streams the ten steps in order, saves your songs, act, Qloo artist, sound-alikes, suggestions and the snapshot", async () => {
    const m = await load();
    const res = await m.research.POST(req("POST", "/research", { link: LINK }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/x-ndjson");
    const cookie = cookieOf(res);
    expect(cookie).toMatch(/^buskmap_playlist=/);
    const events = await readEvents(res);
    expect(events[0]).toMatchObject({ type: "run", number: 1, model: "mock", inputs: { kind: "research" } });
    expect(events[1]).toMatchObject({ type: "status", message: "Researching your act" });
    expect(tools(events)).toEqual(RESEARCH_STEPS.map((k) => RESEARCH_TOOLS[k]));
    expect(events.filter((e) => e.type === "tool-end").every((e) => e.type === "tool-end" && e.ok)).toBe(true);
    const suggestions = events.filter((e) => e.type === "suggestion");
    expect(suggestions.length).toBeGreaterThanOrEqual(3);
    for (const s of suggestions) if (s.type === "suggestion") expect(s.reason).toMatch(/^Mock reason: fans of .+ love /);
    expect(end(events)).toMatchObject({ type: "end", ok: true, mode: "mock", newCount: suggestions.length });
    const totals = events.filter((e) => e.type === "totals").at(-1);
    expect(totals).toMatchObject({ totals: { newSongs: suggestions.length } });
    // About 7 Qloo requests cold (spec: 6–9): id match, detail, sound-alikes, fans, fans also love, genres (+ a search miss).
    const calls = totals?.type === "totals" ? totals.totals.qlooCalls : 0;
    expect(calls).toBeGreaterThanOrEqual(6);
    expect(calls).toBeLessThanOrEqual(10);

    const view = (await (await m.playlist.GET(req("GET", "", undefined, cookie))).json()).playlist;
    expect(view.actName).toBe("Julia Jacklin");
    expect(view.spotifyArtistId).toBe(JULIA.spotifyId);
    expect(view.qlooArtistId).toBe(JULIA.id);
    expect(view.songs).toHaveLength(4);
    expect(view.songs.every((s: { own: boolean; artist: string }) => s.own && s.artist === "Julia Jacklin")).toBe(true);
    expect(view.soundsLike).toHaveLength(6);
    const snap = view.research as ResearchSnapshot;
    expect(snap).toMatchObject({ version: 1, spotifyArtistId: JULIA.spotifyId, mode: "full", runNumber: 1 });
    for (const k of RESEARCH_STEPS) expect(snap.steps[k]?.status, k).toBe("done");
    expect(snap.steps.qloo?.output).toMatchObject({ matched: true, audience: expect.arrayContaining(["Dreamy"]), description: expect.stringContaining("Julia Jacklin") });
    expect(snap.steps.fansLove?.output?.artists.some((a) => a.name === "Julia Jacklin" || view.soundsLike.some((s: { name: string }) => s.name === a.name))).toBe(false);
    expect(snap.steps.summary?.output).toMatchObject({ by: "mock", text: expect.stringMatching(/^Mock summary/) });

    // The learn list shows the run and its songs, and the run replays.
    const list = await (await m.learn.GET(req("GET", "/learn", undefined, cookie))).json();
    expect(list.runs[0]).toMatchObject({ number: 1, inputs: { kind: "research" } });
    expect(list.suggestions.length).toBe(suggestions.length);
    const replay = await readEvents(await m.events.GET(req("GET", `/learn/runs/${list.runs[0].runId}/events`, undefined, cookie), ctx({ runId: list.runs[0].runId })));
    expect(tools(replay)).toEqual(RESEARCH_STEPS.map((k) => RESEARCH_TOOLS[k]));
  });

  it("the same link again is up to date unless refreshed; refresh reruns everything without duplicating your songs", async () => {
    const m = await load();
    const first = await m.research.POST(req("POST", "/research", { link: LINK }));
    const cookie = cookieOf(first);
    await readEvents(first);
    const again = await m.research.POST(req("POST", "/research", { link: LINK }, cookie));
    expect(again.status).toBe(409);
    expect((await again.json()).error.code).toBe("up_to_date");
    const refreshed = await readEvents(await m.research.POST(req("POST", "/research", { link: LINK, refresh: true }, cookie)));
    expect(tools(refreshed)).toHaveLength(10);
    const songs = refreshed.find((e) => e.type === "tool-end" && e.tool === "research_songs");
    expect(songs).toMatchObject({ output: { added: 0, already: 4 } });
    const view = (await (await m.playlist.GET(req("GET", "", undefined, cookie))).json()).playlist;
    expect(view.songs).toHaveLength(4);
  });

  it("Find more songs to learn reruns steps 6, 7 and 9 only, and never re-suggests a song", async () => {
    const m = await load();
    const first = await m.research.POST(req("POST", "/research", { link: LINK }));
    const cookie = cookieOf(first);
    const one = await readEvents(first);
    const more = await readEvents(await m.research.POST(req("POST", "/research", { mode: "more" }, cookie)));
    expect(more[0]).toMatchObject({ type: "run", number: 2, inputs: { kind: "more" } });
    expect(tools(more)).toEqual(["research_fans_love", "research_learn", "research_summary"]);
    const titles = (events: LearnStreamEvent[]) => events.flatMap((e) => (e.type === "suggestion" ? [`${e.artist}|${e.title}`] : []));
    for (const t of titles(more)) expect(titles(one)).not.toContain(t);
    const learn = more.find((e) => e.type === "tool-end" && e.tool === "research_learn");
    expect(learn).toMatchObject({ output: { skipped: { alreadySuggested: expect.any(Number) } } });
    const view = (await (await m.playlist.GET(req("GET", "", undefined, cookie))).json()).playlist;
    // The snapshot keeps steps 1–5 and 8 from the full run, with the new 6, 7 and 9.
    expect(view.research).toMatchObject({ mode: "more", runNumber: 2, fullRunId: (one[0] as { runId: string }).runId });
    expect(view.research.steps.profile.status).toBe("done");
  });

  it("refuses before spending: a bad link, more without research, the limit fault", async () => {
    const m = await load();
    expect((await m.research.POST(req("POST", "/research", { link: "https://example.com/x" }))).status).toBe(400);
    expect((await m.research.POST(req("POST", "/research", {}))).status).toBe(400);
    expect((await m.research.POST(req("POST", "/research", { mode: "more" }))).status).toBe(404);
    const limited = await m.research.POST(req("POST", "/research", { link: LINK }, undefined, { "x-buskmap-faults": "learn-limit" }));
    expect(limited.status).toBe(429);
    expect((await limited.json()).error.limit.scope).toBe("repertoire");
  });

  it("Qloo down: the run ends qloo_unavailable after your profile and songs are saved, and doesn't count", async () => {
    const m = await load();
    const res = await m.research.POST(req("POST", "/research", { link: LINK }, undefined, { "x-buskmap-faults": "qloo" }));
    const cookie = cookieOf(res);
    const events = await readEvents(res);
    expect(tools(events)).toEqual(["research_profile", "research_songs", "research_qloo"]);
    expect(end(events)).toMatchObject({ ok: false, code: "qloo_unavailable" });
    const list = await (await m.learn.GET(req("GET", "/learn", undefined, cookie))).json();
    expect(list.limit.remaining).toBe(list.limit.max);
    const view = (await (await m.playlist.GET(req("GET", "", undefined, cookie))).json()).playlist;
    expect(view.songs).toHaveLength(4);
    expect(view.research.steps.qloo.status).toBe("failed");
    expect(view.research.steps.soundsLike.status).toBe("skipped");
  });

  it("Spotify down: the run ends spotify_unavailable after step 1, saves no snapshot and doesn't count", async () => {
    const m = await load();
    const res = await m.research.POST(req("POST", "/research", { link: LINK }, undefined, { "x-buskmap-faults": "repertoire" }));
    const cookie = cookieOf(res);
    const events = await readEvents(res);
    expect(tools(events)).toEqual(["research_profile"]);
    expect(end(events)).toMatchObject({ ok: false, code: "spotify_unavailable" });
    expect(end(events).message).toMatch(/Spotify isn't answering/);
    const view = (await (await m.playlist.GET(req("GET", "", undefined, cookie))).json()).playlist;
    expect(view.research).toBeNull();
  });
});
