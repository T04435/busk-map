import { beforeEach, describe, expect, it, vi } from "vitest";
import { learnStreamEventSchema, type LearnStreamEvent } from "@/lib/learn-schema";
import { RESEARCH_TOOLS } from "@/lib/repertoire-research";
import { CATALOG } from "@/server/qloo-mock/catalog";

/**
 * The research hang (v1.1.1): a step that never returns (a big Spotify catalogue) must not leave the run `running` with no
 * `end`. Step 2's catalogue fetch hangs here; the step timeout, the run watchdog and the `research-cut` fault are shortened
 * or switched on through the shared objects below.
 */
const T = vi.hoisted(() => ({ timeouts: { stepMs: 200, runMs: 5_000 }, hang: true }));
vi.mock("@/server/playlist/config", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/server/playlist/config")>()), RESEARCH_TIMEOUTS: T.timeouts }));
vi.mock("@/server/adapters/repertoire", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/adapters/repertoire")>();
  return { ...original, getArtistCatalogue: (...a: Parameters<typeof original.getArtistCatalogue>) => (T.hang ? new Promise<never>(() => {}) : original.getArtistCatalogue(...a)) };
});

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
    learn: await import("@/app/api/playlist/learn/route"),
    events: await import("@/app/api/playlist/learn/runs/[runId]/events/route"),
  };
}

const JULIA = CATALOG.find((a) => a.name === "Julia Jacklin")!;
const LINK = `https://open.spotify.com/artist/${JULIA.spotifyId}`;
const base = "http://localhost:3100/api/playlist";
const req = (method: string, path: string, body?: unknown, cookie?: string, headers: Record<string, string> = {}) =>
  new Request(base + path, { method, headers: { "content-type": "application/json", host: "localhost:3100", ...(cookie ? { cookie } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
const ctx = (v: Record<string, string>) => ({ params: Promise.resolve(v) }) as never;

async function readEvents(res: Response): Promise<LearnStreamEvent[]> {
  return (await res.text())
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => {
      const parsed = learnStreamEventSchema.safeParse(JSON.parse(l));
      expect(parsed.success, l.slice(0, 160)).toBe(true);
      return parsed.data!;
    });
}
const songsEnd = (events: LearnStreamEvent[]) => events.find((e) => e.type === "tool-end" && e.tool === RESEARCH_TOOLS.songs) as Extract<LearnStreamEvent, { type: "tool-end" }> | undefined;

beforeEach(() => {
  vi.unstubAllEnvs();
  T.hang = true;
});

describe("research run time limits", () => {
  it("a step past its time fails as 'took too long' and the run ends cleanly (failed, timeout), its row no longer running", async () => {
    Object.assign(T.timeouts, { stepMs: 200, runMs: 5_000 });
    const m = await load();
    const started = Date.now();
    const res = await m.research.POST(req("POST", "/research", { link: LINK }));
    const cookie = res.headers.get("set-cookie")?.split(";")[0] ?? "";
    const events = await readEvents(res);
    expect(Date.now() - started).toBeLessThan(3_000);
    expect(songsEnd(events)).toMatchObject({ ok: false, summary: expect.stringMatching(/took too long$/) });
    // No step after the cut one starts.
    expect(events.filter((e) => e.type === "tool-start").map((e) => (e as { tool: string }).tool)).toEqual([RESEARCH_TOOLS.profile, RESEARCH_TOOLS.songs]);
    expect(events.at(-1)).toMatchObject({ type: "end", ok: false, code: "timeout" });
    const list = await (await m.learn.GET(req("GET", "/learn", undefined, cookie))).json();
    expect(list.running).toBeNull();
    expect(list.runs[0]).toMatchObject({ status: "failed" });
  });

  it("the run watchdog ends a run still going before maxDuration: the open step is closed and `end` (timeout) is pushed", async () => {
    Object.assign(T.timeouts, { stepMs: 60_000, runMs: 300 });
    const m = await load();
    const started = Date.now();
    const res = await m.research.POST(req("POST", "/research", { link: LINK }));
    const events = await readEvents(res);
    expect(Date.now() - started).toBeLessThan(3_000);
    expect(songsEnd(events)).toMatchObject({ ok: false, summary: expect.stringMatching(/took too long$/) });
    const ends = events.filter((e) => e.type === "end");
    expect(ends).toHaveLength(1);
    expect(events.at(-1)).toMatchObject({ type: "end", ok: false, code: "timeout" });
  });

  it("research-cut: the stream ends after step 2 starts with no end, the row stays running and a join is told running_elsewhere", async () => {
    Object.assign(T.timeouts, { stepMs: 60_000, runMs: 60_000 });
    T.hang = false;
    const m = await load();
    const res = await m.research.POST(req("POST", "/research", { link: LINK }, undefined, { "x-buskmap-faults": "research-cut" }));
    const cookie = res.headers.get("set-cookie")?.split(";")[0] ?? "";
    const events = await readEvents(res);
    expect(events.at(-1)).toMatchObject({ type: "tool-start", tool: RESEARCH_TOOLS.songs });
    expect(events.some((e) => e.type === "end")).toBe(false);
    const list = await (await m.learn.GET(req("GET", "/learn", undefined, cookie))).json();
    expect(list.running).toMatchObject({ runId: expect.any(String) });
    const join = await m.events.GET(req("GET", `/learn/runs/${list.running.runId}/events`, undefined, cookie), ctx({ runId: list.running.runId }));
    expect(join.status).toBe(409);
    expect((await join.json()).error.code).toBe("running_elsewhere");
  });
});
