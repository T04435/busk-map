import { beforeEach, describe, expect, it, vi } from "vitest";
import { learnStreamEventSchema, type LearnStreamEvent } from "@/lib/learn-schema";
import { OFFLINE_TEST_ACTS, RESEARCH_STEPS, researchUsable, researchWaiting, type ResearchSnapshot } from "@/lib/repertoire-research";
import { PLAYLIST_COPY } from "@/lib/playlist-copy";
import { CATALOG, SCENARIO_ARTISTS, mockId } from "@/server/qloo-mock/catalog";

const searched = vi.hoisted(() => [] as string[]);
vi.mock("@/server/adapters/qloo", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/adapters/qloo")>();
  return { ...original, searchArtistHits: (name: string, context: Parameters<typeof original.searchArtistHits>[1]) => (searched.push(name), original.searchArtistHits(name, context)) };
});

/**
 * How the run finds the act on Qloo, end to end on the offline mocks: the exact Spotify-id match, a variant-name match, candidates
 * the performer confirms (or refuses), the fallback to "Artists you sound like", and the picker when there are none. Every
 * path is a deterministic test act (lib/repertoire-research.ts: OFFLINE_TEST_ACTS).
 */
async function load() {
  vi.resetModules();
  vi.stubEnv("BUSKMAP_OFFLINE", "1");
  vi.stubEnv("BUSKMAP_ALLOW_FAULTS", "1");
  vi.stubEnv("VERCEL", "");
  (await import("@/server/playlist/store")).resetPlaylistStoresForTests();
  (await import("@/server/learn/store")).resetLearnStoresForTests();
  (await import("@/server/learn/runs")).clearLearnRunsForTests();
  return { research: await import("@/app/api/playlist/research/route"), playlist: await import("@/app/api/playlist/route") };
}
type Mods = Awaited<ReturnType<typeof load>>;

const JULIA = CATALOG.find((a) => a.name === "Julia Jacklin")!;
const base = "http://localhost:3100/api/playlist";
const req = (method: string, path: string, body?: unknown, cookie?: string) =>
  new Request(base + path, { method, headers: { "content-type": "application/json", host: "localhost:3100", ...(cookie ? { cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
const cookieOf = (res: Response) => res.headers.get("set-cookie")?.split(";")[0] ?? "";

async function events(res: Response): Promise<LearnStreamEvent[]> {
  return (await res.text())
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => {
      const parsed = learnStreamEventSchema.safeParse(JSON.parse(l));
      expect(parsed.success, l.slice(0, 160)).toBe(true);
      return parsed.data!;
    });
}
const end = (e: LearnStreamEvent[]) => e.at(-1) as Extract<LearnStreamEvent, { type: "end" }>;
const stepsDone = (e: LearnStreamEvent[]) => e.filter((x) => x.type === "tool-end" && x.ok).length;

async function go(m: Mods, body: object, cookie?: string) {
  const res = await m.research.POST(req("POST", "/research", body, cookie));
  expect(res.status).toBe(200);
  return { cookie: cookie ?? cookieOf(res), events: await events(res) };
}
async function view(m: Mods, cookie: string) {
  return (await (await m.playlist.GET(req("GET", "", undefined, cookie))).json()).playlist;
}
const qlooOut = (v: { research: ResearchSnapshot }) => v.research.steps.qloo!.output!;
const act = (key: keyof typeof OFFLINE_TEST_ACTS) => ({ link: OFFLINE_TEST_ACTS[key].spotifyId });
const MARA_ELLISON = mockId("artist", "Mara Ellison");
const ALIKES = [{ name: "Paul Kelly" }, { name: "Courtney Barnett" }];

beforeEach(() => {
  vi.unstubAllEnvs();
  searched.length = 0;
});

describe("the test acts are in step with the mock", () => {
  it("the scenario artists live outside the ranking catalogue and none carries a test act's Spotify id", () => {
    for (const a of SCENARIO_ARTISTS) {
      expect(CATALOG.some((c) => c.id === a.id)).toBe(false);
      expect(Object.values(OFFLINE_TEST_ACTS).some((t) => t.spotifyId === a.spotifyId)).toBe(false);
    }
    expect(SCENARIO_ARTISTS.map((a) => a.name)).toEqual([OFFLINE_TEST_ACTS.variant.qlooName, ...OFFLINE_TEST_ACTS.candidates.qlooNames]);
    for (const t of Object.values(OFFLINE_TEST_ACTS)) expect(t.spotifyId).toMatch(/^[A-Za-z0-9]{22}$/);
  });
});

describe("path 1: the exact Spotify-id match is certain", () => {
  it("matches by id and never asks", async () => {
    const m = await load();
    const r = await go(m, { link: JULIA.spotifyId });
    expect(end(r.events)).toMatchObject({ ok: true });
    const v = await view(m, r.cookie);
    expect(qlooOut(v)).toMatchObject({ matched: true, qlooId: JULIA.id, by: "id" });
    expect(v.qlooArtistId).toBe(JULIA.id);
  });
});

describe("path 2: a name variant is found and accepted", () => {
  it("finds Zelia Marquez from 'Zélia Marquez (feat. Ro Dias)', with all ten steps", async () => {
    const m = await load();
    const r = await go(m, act("variant"));
    expect(end(r.events)).toMatchObject({ ok: true, code: expect.not.stringMatching(/^needs_/) });
    expect(stepsDone(r.events)).toBe(RESEARCH_STEPS.length);
    const v = await view(m, r.cookie);
    expect(qlooOut(v)).toMatchObject({ matched: true, name: OFFLINE_TEST_ACTS.variant.qlooName, by: "name" });
    expect(v.qlooArtistId).toBe(mockId("artist", OFFLINE_TEST_ACTS.variant.qlooName));
    expect(qlooOut(v).fallback).toBeUndefined();
  });
});

describe("path 3: low confidence pauses and asks", () => {
  it("pauses with the candidates, runs nothing after step 3, keeps the songs, and the run does not count", async () => {
    const m = await load();
    const r = await go(m, act("candidates"));
    expect(end(r.events)).toMatchObject({ ok: true, code: "needs_choice", newCount: 0, message: expect.stringContaining("Pick yours") });
    expect(stepsDone(r.events)).toBe(3);
    const v = await view(m, r.cookie);
    const q = qlooOut(v);
    expect(q).toMatchObject({ matched: false, waiting: "choice" });
    expect(q.candidates!.map((c) => c.name).sort()).toEqual([...OFFLINE_TEST_ACTS.candidates.qlooNames].sort());
    expect(q.candidates!.every((c) => c.qlooId && Array.isArray(c.genres))).toBe(true);
    expect(v.qlooArtistId).toBeNull();
    expect(v.songs.length).toBeGreaterThan(0);
    expect(researchWaiting(v.research)).toBe("choice");
    expect(researchUsable(v.research)).toBe(false);
    expect(v.research.steps.fansLove?.status).toBe("skipped");
  });

  it("confirming a candidate saves qlooArtistId, finishes the research, and is not asked again", async () => {
    const m = await load();
    const first = await go(m, act("candidates"));
    const picked = await go(m, { ...act("candidates"), refresh: true, qlooChoice: { id: MARA_ELLISON } }, first.cookie);
    expect(end(picked.events).ok).toBe(true);
    expect(stepsDone(picked.events)).toBe(RESEARCH_STEPS.length);
    let v = await view(m, first.cookie);
    expect(v.qlooArtistId).toBe(MARA_ELLISON);
    expect(qlooOut(v)).toMatchObject({ matched: true, name: "Mara Ellison", by: "chosen" });
    // A refresh with no choice reuses the saved id: no candidates, no question.
    const again = await go(m, { ...act("candidates"), refresh: true }, first.cookie);
    expect(end(again.events).code).not.toBe("needs_choice");
    v = await view(m, first.cookie);
    expect(qlooOut(v)).toMatchObject({ matched: true, qlooId: MARA_ELLISON, by: "saved" });
  });

  it("a choice that was not offered is ignored and the question stays", async () => {
    const m = await load();
    const first = await go(m, act("candidates"));
    const bogus = await go(m, { ...act("candidates"), refresh: true, qlooChoice: { id: JULIA.id } }, first.cookie);
    expect(end(bogus.events).code).toBe("needs_choice");
    expect((await view(m, first.cookie)).qlooArtistId).toBeNull();
  });

  it("'none of these' falls back to the sound-alikes and is remembered for the link", async () => {
    const m = await load();
    const first = await go(m, act("candidates"));
    const v0 = await view(m, first.cookie);
    await m.playlist.PATCH(req("PATCH", "", { revision: v0.revision, soundsLike: ALIKES }, first.cookie));
    const none = await go(m, { ...act("candidates"), refresh: true, qlooChoice: { none: true } }, first.cookie);
    expect(end(none.events).ok).toBe(true);
    expect(String(end(none.events).code)).not.toMatch(/^needs_/);
    expect(stepsDone(none.events)).toBe(RESEARCH_STEPS.length);
    expect(none.events.some((e) => e.type === "status" && e.message === PLAYLIST_COPY.research.fallback.label)).toBe(true);
    let v = await view(m, first.cookie);
    expect(qlooOut(v)).toMatchObject({ matched: false, fallback: "soundsLike", declined: true });
    expect(v.qlooArtistId).toBeNull();
    // Refreshing does not ask again.
    const again = await go(m, { ...act("candidates"), refresh: true }, first.cookie);
    expect(end(again.events).code).not.toBe("needs_choice");
    v = await view(m, first.cookie);
    expect(qlooOut(v)).toMatchObject({ fallback: "soundsLike", declined: true });
  });
});

describe("path 4: Qloo doesn't know the act, so the sound-alikes are the signal", () => {
  async function fallbackRun() {
    const m = await load();
    const first = await go(m, act("unknown"));
    const v0 = await view(m, first.cookie);
    await m.playlist.PATCH(req("PATCH", "", { revision: v0.revision, soundsLike: ALIKES }, first.cookie));
    const run = await go(m, { ...act("unknown"), refresh: true }, first.cookie);
    return { m, cookie: first.cookie, run, first };
  }

  it("runs every step, labels each Qloo step honestly, and excludes the sound-alikes from what fans love", async () => {
    const { m, cookie, run } = await fallbackRun();
    expect(end(run.events).ok).toBe(true);
    expect(stepsDone(run.events)).toBe(RESEARCH_STEPS.length);
    const label = PLAYLIST_COPY.research.fallback.label;
    expect(label).toBe("Qloo doesn't know you yet, so this is based on the artists you sound like");
    const v = await view(m, cookie);
    const s = v.research.steps as ResearchSnapshot["steps"];
    expect(s.qloo!.output).toMatchObject({ matched: false, fallback: "soundsLike", summary: label });
    for (const k of ["fans", "fansMap", "fansLove", "genres"] as const) expect(s[k]!.output).toMatchObject({ basedOn: "soundsLike" });
    expect(s.fans!.output!.summary).toMatch(/^Based on the artists you sound like: /);
    expect(s.soundsLike!.output!.artists.map((a) => a.name)).toEqual(ALIKES.map((a) => a.name));
    const love = s.fansLove!.output!;
    expect(love.artists.length).toBeGreaterThan(0);
    expect(love.artists.some((a) => ALIKES.some((x) => x.name === a.name))).toBe(false);
    expect(love.signalledBy).toEqual(ALIKES.map((a) => a.name));
    expect(s.learn!.output!.songs.length).toBeGreaterThan(0);
    expect(s.summary!.output).toMatchObject({ by: "mock", picks: expect.any(Number) });
    expect(s.summary!.output).not.toHaveProperty("text");
    expect(v.qlooArtistId).toBeNull();
    expect(researchUsable(v.research)).toBe(true);
  });

  it("'Find more songs to learn' works from the fallback", async () => {
    const { m, cookie } = await fallbackRun();
    const more = await go(m, { mode: "more" }, cookie);
    expect(end(more.events).ok).toBe(true);
    expect(more.events.filter((e) => e.type === "tool-end" && e.ok).map((e) => e.type === "tool-end" && e.tool)).toEqual(["research_fans_love", "research_learn", "research_summary"]);
  });

  it("with no sound-alikes the run pauses and asks for 2 or 3, then carries on", async () => {
    const m = await load();
    const first = await go(m, act("unknown"));
    expect(end(first.events)).toMatchObject({ ok: true, code: "needs_sounds_like", message: expect.stringContaining("Pick 2 or 3 artists you sound like") });
    expect(stepsDone(first.events)).toBe(3);
    const v = await view(m, first.cookie);
    expect(qlooOut(v)).toMatchObject({ waiting: "soundsLike", fallback: "soundsLike" });
    expect(researchWaiting(v.research)).toBe("soundsLike");
    expect(v.soundsLike).toHaveLength(0);
    // The performer picks (typed names are resolved on Qloo), and the same link carries on.
    await m.playlist.PATCH(req("PATCH", "", { revision: v.revision, soundsLike: [{ name: "Missy Higgins" }, { name: "Gordi" }] }, first.cookie));
    const next = await go(m, { ...act("unknown"), refresh: true }, first.cookie);
    expect(String(end(next.events).code)).not.toMatch(/^needs_/);
    expect(stepsDone(next.events)).toBe(RESEARCH_STEPS.length);
    const v2 = await view(m, first.cookie);
    expect(v2.soundsLike.every((a: { qlooId?: string }) => a.qlooId)).toBe(true);
    expect(qlooOut(v2).waiting).toBeUndefined();
  });

  it("sound-alikes Qloo cannot resolve either pause the run again instead of guessing", async () => {
    const m = await load();
    const first = await go(m, act("unknown"));
    const v = await view(m, first.cookie);
    await m.playlist.PATCH(req("PATCH", "", { revision: v.revision, soundsLike: [{ name: "Qzv Nobody" }] }, first.cookie));
    const next = await go(m, { ...act("unknown"), refresh: true }, first.cookie);
    expect(end(next.events).code).toBe("needs_sounds_like");
  });
});

describe("the search budget", () => {
  const OFF = { offline: true, faults: [] } as const;

  it("an id match sends no name search; a variant match stops at the first accepted search", async () => {
    await load();
    const { findOwnOnQloo } = await import("@/server/playlist/own-artist");
    expect(await findOwnOnQloo(JULIA.spotifyId, "Anything", OFF)).toMatchObject({ by: "id", searches: 0 });
    expect(searched).toEqual([]);
    const hit = await findOwnOnQloo(OFFLINE_TEST_ACTS.variant.spotifyId, OFFLINE_TEST_ACTS.variant.name, OFF, { genres: OFFLINE_TEST_ACTS.variant.genres });
    expect(hit).toMatchObject({ by: "name", qloo: "matched", searches: 2 });
    expect(searched).toEqual([OFFLINE_TEST_ACTS.variant.name, "Zélia Marquez"]);
  });

  it("never sends more than the Spotify name plus four variants, each different", async () => {
    await load();
    const { findOwnOnQloo } = await import("@/server/playlist/own-artist");
    const res = await findOwnOnQloo("Zz00000000000000000000", "Aaa Bbb (feat. Ccc) y Ddd Eee", OFF, { actName: "Aaa Bbb Long Stage Name - Live" });
    expect(res).toMatchObject({ qloo: "unknown", candidates: [] });
    expect(res.searches).toBeLessThanOrEqual(5);
    expect(searched.length).toBe(res.searches);
    expect(new Set(searched.map((n) => n.toLowerCase())).size).toBe(searched.length);
  });

  it("a Qloo outage is unavailable, not unknown", async () => {
    await load();
    const { findOwnOnQloo } = await import("@/server/playlist/own-artist");
    const res = await findOwnOnQloo("Zz00000000000000000000", "Aaa", { offline: true, faults: ["qloo"] } as never);
    expect(res.qloo).toBe("unavailable");
  });
});
