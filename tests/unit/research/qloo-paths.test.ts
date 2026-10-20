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
    expect(SCENARIO_ARTISTS.map((a) => a.name)).toEqual([OFFLINE_TEST_ACTS.variant.qlooName, ...OFFLINE_TEST_ACTS.candidates.qlooNames, OFFLINE_TEST_ACTS.otherId.name, OFFLINE_TEST_ACTS.weak.name]);
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
    expect(none.events.some((e) => e.type === "status" && e.message === PLAYLIST_COPY.research.fallback.label(ALIKES.map((x) => x.name)))).toBe(true);
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

describe("path 4: Qloo doesn't know the act, so the Hive finds artists like it and the run never stops", () => {
  const FOUND = ["Paul Kelly", "Courtney Barnett", "Missy Higgins"];
  const labelOf = PLAYLIST_COPY.research.fallback.label;

  it("similar artists (Last.fm) resolved on Qloo become the signal and are saved as found by the Hive", async () => {
    const m = await load();
    const r = await go(m, act("unknown"));
    expect(end(r.events)).toMatchObject({ ok: true, code: expect.not.stringMatching(/^needs_/) });
    expect(stepsDone(r.events)).toBe(RESEARCH_STEPS.length);
    const line = labelOf(FOUND);
    expect(line).toBe("Qloo doesn't know you yet, so this is based on artists like you: Paul Kelly, Courtney Barnett and Missy Higgins.");
    expect(r.events.some((e) => e.type === "status" && e.message === line)).toBe(true);
    const v = await view(m, r.cookie);
    const s = v.research.steps as ResearchSnapshot["steps"];
    expect(s.qloo!.output).toMatchObject({ matched: false, fallback: "soundsLike", foundByHive: true, summary: line });
    expect(v.soundsLike.map((a: { name: string }) => a.name)).toEqual(FOUND);
    expect(v.soundsLike.every((a: { foundBy?: string; qlooId?: string }) => a.foundBy === "hive" && a.qlooId)).toBe(true);
    for (const k of ["fans", "fansMap", "fansLove", "genres"] as const) expect(s[k]!.output).toMatchObject({ basedOn: "soundsLike" });
    expect(s.fans!.output!.summary).toMatch(/^Based on the artists you sound like: /);
    expect(s.soundsLike!.output!.artists.map((a) => a.name)).toEqual(FOUND);
    const love = s.fansLove!.output!;
    expect(love.artists.length).toBeGreaterThan(0);
    expect(love.artists.some((a) => FOUND.includes(a.name))).toBe(false);
    expect(love.signalledBy).toEqual(FOUND);
    expect(s.learn!.output!.songs.length).toBeGreaterThan(0);
    expect(s.summary!.output).toMatchObject({ by: "mock", picks: expect.any(Number) });
    expect(v.qlooArtistId).toBeNull();
    expect(researchUsable(v.research)).toBe(true);
    expect(researchWaiting(v.research)).toBeNull();
  });

  it("'Find more songs to learn' works from the Hive's sound-alikes", async () => {
    const m = await load();
    const first = await go(m, act("unknown"));
    const more = await go(m, { mode: "more" }, first.cookie);
    expect(end(more.events).ok).toBe(true);
    expect(more.events.filter((e) => e.type === "tool-end" && e.ok).map((e) => e.type === "tool-end" && e.tool)).toEqual(["research_fans_love", "research_learn", "research_summary"]);
  });

  it("sound-alikes the performer set are the signal and are never overwritten", async () => {
    const m = await load();
    const first = await go(m, act("unknown"));
    const v0 = await view(m, first.cookie);
    await m.playlist.PATCH(req("PATCH", "", { revision: v0.revision, soundsLike: ALIKES }, first.cookie));
    const run = await go(m, { ...act("unknown"), refresh: true }, first.cookie);
    expect(end(run.events).ok).toBe(true);
    expect(stepsDone(run.events)).toBe(RESEARCH_STEPS.length);
    const v = await view(m, first.cookie);
    expect(v.soundsLike.map((a: { name: string }) => a.name)).toEqual(ALIKES.map((a) => a.name));
    expect(v.soundsLike.some((a: { foundBy?: string }) => a.foundBy)).toBe(false);
    const s = v.research.steps as ResearchSnapshot["steps"];
    expect(s.qloo!.output).toMatchObject({ fallback: "soundsLike", summary: labelOf(ALIKES.map((a) => a.name)) });
    expect(s.qloo!.output!.foundByHive).toBeUndefined();
    expect(s.fansLove!.output!.signalledBy).toEqual(ALIKES.map((a) => a.name));
  });

  it("sound-alikes the performer set that Qloo cannot resolve are kept, and the Hive's are used for this run only", async () => {
    const m = await load();
    const first = await go(m, act("nothing"));
    const v0 = await view(m, first.cookie);
    await m.playlist.PATCH(req("PATCH", "", { revision: v0.revision, soundsLike: [{ name: "Qzv Nobody" }] }, first.cookie));
    const next = await go(m, { ...act("unknown"), refresh: true }, first.cookie);
    expect(end(next.events).ok).toBe(true);
    expect(String(end(next.events).code)).not.toMatch(/^needs_/);
    expect(stepsDone(next.events)).toBe(RESEARCH_STEPS.length);
    const v = await view(m, first.cookie);
    expect(v.soundsLike.map((a: { name: string }) => a.name)).toEqual(["Qzv Nobody"]);
    expect(qlooOut(v)).toMatchObject({ fallback: "soundsLike", foundByHive: true });
  });

  it("similar artists Qloo does not know fall back to the act's genres as Qloo genre tags", async () => {
    const m = await load();
    const r = await go(m, act("unresolved"));
    expect(end(r.events)).toMatchObject({ ok: true, code: expect.not.stringMatching(/^needs_/) });
    expect(stepsDone(r.events)).toBe(RESEARCH_STEPS.length);
    const v = await view(m, r.cookie);
    const s = v.research.steps as ResearchSnapshot["steps"];
    expect(s.qloo!.output).toMatchObject({ matched: false, fallback: "genres", genreTags: [{ id: expect.stringMatching(/^urn:tag:genre/), name: "Indie Folk" }], summary: PLAYLIST_COPY.research.fallback.genresLabel(["Indie Folk"]) });
    expect(s.qloo!.output!.summary).toBe("Qloo doesn't know you yet, so this is based on your genres: Indie Folk.");
    // The genre's artists on Qloo stand in for who the act sounds like (never saved as the performer's), and every Qloo step asks Qloo.
    expect(v.soundsLike).toHaveLength(0);
    expect(s.soundsLike!.output).toMatchObject({ basedOn: "genres" });
    const genreAlikes = s.soundsLike!.output!.artists.map((a) => a.name);
    expect(genreAlikes.length).toBeGreaterThan(0);
    expect(s.fansLove!.output).toMatchObject({ basedOn: "genres", signalledBy: ["Indie Folk"] });
    expect(s.fansLove!.output!.artists.some((a) => genreAlikes.includes(a.name))).toBe(false);
    expect(s.fansLove!.output!.artists.length).toBeGreaterThan(0);
    expect(s.genres!.output).toMatchObject({ basedOn: "genres" });
    expect(s.genres!.output!.tags.map((t) => t.name)).toEqual(["Indie Folk"]);
    expect(s.learn!.output!.songs.length).toBeGreaterThan(0);
    expect(s.fans!.output).toMatchObject({ basedOn: "genres", summary: expect.stringMatching(/^Based on your genre: /) });
    expect(s.fansMap!.output!.summary).not.toBe(PLAYLIST_COPY.research.fallback.noTaste);
    expect(researchUsable(v.research)).toBe(true);
    const more = await go(m, { mode: "more" }, r.cookie);
    expect(end(more.events).ok).toBe(true);
    expect(stepsDone(more.events)).toBe(3);
  });

  it("with nothing to go on the run waits at Who you sound like: profile and songs done, no empty Qloo steps (research-waiting.test.ts)", async () => {
    const m = await load();
    const r = await go(m, act("nothing"));
    expect(end(r.events)).toMatchObject({ ok: true, code: "needs_sounds_like" });
    const v = await view(m, r.cookie);
    const s = v.research.steps as ResearchSnapshot["steps"];
    expect(s.profile!.status).toBe("done");
    expect(s.songs!.status).toBe("done");
    expect(v.songs.length).toBeGreaterThan(0);
    expect(s.qloo!.output).toMatchObject({ matched: false, fallback: "none", summary: PLAYLIST_COPY.research.fallback.noneLabel });
    expect(s.soundsLike!.status).toBe("waiting");
    for (const k of ["fans", "fansMap", "fansLove", "learn", "genres", "summary"] as const) expect(s[k]).toBeUndefined();
    expect(researchUsable(v.research)).toBe(false);
    expect(researchWaiting(v.research)).toBe("input");
  });

  it("'none of these' goes on to look for artists like you, and waits for input when there are none", async () => {
    const m = await load();
    const first = await go(m, act("candidates"));
    const none = await go(m, { ...act("candidates"), refresh: true, qlooChoice: { none: true } }, first.cookie);
    expect(end(none.events)).toMatchObject({ ok: true, code: "needs_sounds_like" });
    const v = await view(m, first.cookie);
    expect(qlooOut(v)).toMatchObject({ matched: false, declined: true, fallback: "none" });
    expect(v.research.waiting).toMatchObject({ step: "soundsLike", asks: 1 });
  });

  it("Yomil: 'not on Qloo' is not remembered, so every new run looks for the act on Qloo again, first", async () => {
    const m = await load();
    expect(OFFLINE_TEST_ACTS.unknown).toMatchObject({ name: "Yomil", spotifyId: "0U0oUxOfhtjkfoJ3ZNWEfU" });
    const first = await go(m, act("unknown"));
    const before = searched.filter((n) => n === "Yomil").length;
    expect(before).toBeGreaterThan(0);
    expect((await view(m, first.cookie)).qlooArtistId).toBeNull();
    await go(m, { ...act("unknown"), refresh: true }, first.cookie);
    expect(searched.filter((n) => n === "Yomil").length).toBeGreaterThan(before);
  });

  it("only the test acts with no taste signal anywhere wait for input", async () => {
    const waits = new Set(["otherId", "nothing", "silent"]);
    for (const key of Object.keys(OFFLINE_TEST_ACTS) as (keyof typeof OFFLINE_TEST_ACTS)[]) {
      const m = await load();
      const r = await go(m, act(key));
      expect(end(r.events).code === "needs_sounds_like", key).toBe(waits.has(key));
      expect(end(r.events).ok, key).toBe(true);
    }
  });
});

describe("findSoundAlikes", () => {
  const OFF = { offline: true, faults: [] } as const;
  it("each path, on the offline mocks", async () => {
    await load();
    const { findSoundAlikes } = await import("@/server/playlist/own-artist");
    const u = OFFLINE_TEST_ACTS.unknown;
    const a = await findSoundAlikes({ name: u.name, genres: u.genres }, OFF);
    expect(a.source).toBe("lastfm");
    expect(a.alikes.map((x) => x.name)).toEqual(["Paul Kelly", "Courtney Barnett", "Missy Higgins"]);
    expect(a.similar).toEqual([...u.similar]);
    const r = OFFLINE_TEST_ACTS.unresolved;
    const b = await findSoundAlikes({ name: r.name, genres: r.genres }, OFF);
    expect(b).toMatchObject({ source: "genres", alikes: [], similar: [...r.similar] });
    expect(b.tags.map((t) => t.name)).toEqual(["Indie Folk"]);
    const n = OFFLINE_TEST_ACTS.nothing;
    expect(await findSoundAlikes({ name: n.name, genres: n.genres }, OFF)).toMatchObject({ source: "none", alikes: [], tags: [], similar: [] });
  });

  it("tries the act name when the Spotify name has no similar artists, and never lists the act itself", async () => {
    await load();
    const { findSoundAlikes } = await import("@/server/playlist/own-artist");
    const u = OFFLINE_TEST_ACTS.unknown;
    const res = await findSoundAlikes({ name: "Someone Else", actName: u.name, genres: [] }, OFF);
    expect(res.source).toBe("lastfm");
  });

  it("a Qloo outage is unavailable, not 'none'", async () => {
    await load();
    const { findSoundAlikes } = await import("@/server/playlist/own-artist");
    const u = OFFLINE_TEST_ACTS.unknown;
    expect((await findSoundAlikes({ name: u.name, genres: u.genres }, { offline: true, faults: ["qloo"] } as never)).source).toBe("unavailable");
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

describe("gaps in the unknown-act fallback", () => {
  const OFF = { offline: true, faults: [] } as const;
  const T = OFFLINE_TEST_ACTS;

  it("Last.fm tags alone: Spotify sends no genres, so the act's Last.fm tags become Qloo genre tags (noise dropped)", async () => {
    await load();
    const { findSoundAlikes } = await import("@/server/playlist/own-artist");
    const a = await findSoundAlikes({ name: T.lastfmTags.name, genres: [], spotifyId: T.lastfmTags.spotifyId }, OFF);
    expect(a).toMatchObject({ source: "genres", alikes: [], similar: [] });
    expect(a.tags.map((t) => t.name)).toEqual(["Folk"]);
    const m = await load();
    const r = await go(m, act("lastfmTags"));
    expect(end(r.events).ok).toBe(true);
    expect(qlooOut(await view(m, r.cookie))).toMatchObject({ matched: false, fallback: "genres", genreTags: [{ name: "Folk" }] });
  });

  it("a name hit with another Spotify id is not the act", async () => {
    await load();
    const { findOwnOnQloo } = await import("@/server/playlist/own-artist");
    const rejected = await findOwnOnQloo(T.otherId.spotifyId, T.otherId.name, OFF, { genres: T.otherId.genres });
    expect(rejected).toMatchObject({ entity: null, qloo: "unknown", candidates: [], weak: false });
    // The same name with Qloo's own Spotify id for it is the act.
    const same = await findOwnOnQloo(T.otherId.qlooSpotifyId, T.otherId.name, OFF);
    expect(same).toMatchObject({ qloo: "matched", by: "name" });
    expect(same.entity?.name).toBe(T.otherId.name);
    const m = await load();
    const r = await go(m, act("otherId"));
    const v = await view(m, r.cookie);
    expect(v.qlooArtistId).toBeNull();
    expect(qlooOut(v)).toMatchObject({ matched: false, fallback: "none" });
  });

  it("an entity with no music-genre tag is weak: the Hive's sound-alikes stand in, and it is used alone only when nothing else is found", async () => {
    await load();
    const { findOwnOnQloo, refreshOwnArtist } = await import("@/server/playlist/own-artist");
    const hit = await findOwnOnQloo(T.weak.spotifyId, T.weak.name, OFF, { genres: T.weak.genres });
    expect(hit).toMatchObject({ qloo: "matched", by: "name", weak: true });
    expect((await refreshOwnArtist(T.weak.spotifyId, OFF)).qlooArtistId).toBeNull();
    const m = await load();
    const r = await go(m, act("weak"));
    expect(end(r.events).ok).toBe(true);
    const v = await view(m, r.cookie);
    expect(v.qlooArtistId).toBeNull();
    expect(qlooOut(v)).toMatchObject({ matched: false, fallback: "soundsLike", foundByHive: true });
    expect(v.soundsLike.map((a: { name: string }) => a.name)).toEqual(["Paul Kelly", "Courtney Barnett", "Missy Higgins"]);
  });

  it("a weak match found as a sound-alike is dropped too", async () => {
    await load();
    const { findSoundAlikes } = await import("@/server/playlist/own-artist");
    const a = await findSoundAlikes({ name: T.secondHop.name, genres: [] }, OFF);
    expect(a.alikes.map((x) => x.name)).not.toContain(T.weak.name);
  });

  it("fewer than three similar artists resolve: the similar artists of the top two are tried, ranked after the first step's", async () => {
    await load();
    const { findSoundAlikes } = await import("@/server/playlist/own-artist");
    const a = await findSoundAlikes({ name: T.secondHop.name, genres: T.secondHop.genres, spotifyId: T.secondHop.spotifyId }, OFF);
    expect(a.source).toBe("lastfm");
    expect(a.alikes.map((x) => x.name)).toEqual(["Paul Kelly", "Courtney Barnett", "Missy Higgins"]);
    expect(a.similar).toEqual([...T.secondHop.similar]);
    // Yomil resolves three at once: no second step, so no search for a second-step name.
    searched.length = 0;
    await findSoundAlikes({ name: T.unknown.name, genres: [] }, OFF);
    expect(searched).toEqual(T.unknown.similar);
    const m = await load();
    const r = await go(m, act("secondHop"));
    expect(qlooOut(await view(m, r.cookie))).toMatchObject({ fallback: "soundsLike", foundByHive: true });
  });

  it("the performer's own sound-alikes stay the signal, ahead of found ones", async () => {
    const m = await load();
    const first = await go(m, act("secondHop"));
    const cookie = first.cookie;
    const own = [{ name: "Paul Kelly" }, { name: "Courtney Barnett" }];
    const saved = await m.playlist.PATCH(req("PATCH", "", { revision: (await view(m, cookie)).revision, soundsLike: own }, cookie));
    expect(saved.status).toBe(200);
    const again = await go(m, { ...act("secondHop"), refresh: true }, cookie);
    expect(end(again.events).ok).toBe(true);
    expect((await view(m, cookie)).soundsLike.map((a: { name: string; foundBy?: string }) => a.name)).toEqual(["Paul Kelly", "Courtney Barnett"]);
  });

  it("no tag anywhere: the run finishes with no taste data; a genre the performer picks becomes the signal, and a refresh keeps it", async () => {
    const m = await load();
    const first = await go(m, act("nothing"));
    expect(qlooOut(await view(m, first.cookie))).toMatchObject({ fallback: "none" });
    const picked = await go(m, { ...act("nothing"), refresh: true, genre: "Folk" }, first.cookie);
    expect(end(picked.events).ok).toBe(true);
    expect(qlooOut(await view(m, first.cookie))).toMatchObject({ fallback: "genres", genrePick: "Folk", genreTags: [{ name: "Folk" }] });
    const again = await go(m, { ...act("nothing"), refresh: true }, first.cookie);
    expect(end(again.events).ok).toBe(true);
    expect(qlooOut(await view(m, first.cookie))).toMatchObject({ fallback: "genres", genrePick: "Folk" });
  });
});
