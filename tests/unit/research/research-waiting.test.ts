import { beforeEach, describe, expect, it, vi } from "vitest";
import { learnStreamEventSchema, type LearnStreamEvent } from "@/lib/learn-schema";
import { PLAYLIST_COPY } from "@/lib/playlist-copy";
import { OFFLINE_PICKED_ARTISTS, OFFLINE_TEST_ACTS, OFFLINE_UNKNOWN_ARTIST, OFFLINE_UNTAGGED_GENRE, RESEARCH_MAX_ASKS, researchUsable, researchWaiting, type ResearchSnapshot } from "@/lib/repertoire-research";

const profiles = vi.hoisted(() => [] as string[]);
vi.mock("@/server/adapters/repertoire", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/adapters/repertoire")>();
  return { ...original, getArtistProfile: (id: string, context: Parameters<typeof original.getArtistProfile>[1]) => (profiles.push(id), original.getArtistProfile(id, context)) };
});

/**
 * A research run with no Qloo taste signal at all (the Victoria Queen case, offline: OFFLINE_TEST_ACTS.silent) waits at "Who you
 * sound like" for the performer's input, then carries on the SAME run from there: the steps before are reused, never fetched
 * again. Still nothing Qloo knows: it asks again, at most RESEARCH_MAX_ASKS times. Every step records its external calls.
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
    input: await import("@/app/api/playlist/research/[runId]/input/route"),
    events: await import("@/app/api/playlist/learn/runs/[runId]/events/route"),
    learn: await import("@/app/api/playlist/learn/route"),
    playlist: await import("@/app/api/playlist/route"),
  };
}
type Mods = Awaited<ReturnType<typeof load>>;

const base = "http://localhost:3100/api/playlist";
const req = (method: string, path: string, body?: unknown, cookie?: string) =>
  new Request(base + path, { method, headers: { "content-type": "application/json", host: "localhost:3100", ...(cookie ? { cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
const cookieOf = (res: Response) => res.headers.get("set-cookie")?.split(";")[0] ?? "";

async function read(res: Response): Promise<LearnStreamEvent[]> {
  return (await res.text())
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => {
      const parsed = learnStreamEventSchema.safeParse(JSON.parse(l));
      expect(parsed.success, l.slice(0, 160)).toBe(true);
      return parsed.data!;
    });
}
type End = Extract<LearnStreamEvent, { type: "end" }>;
type ToolEnd = Extract<LearnStreamEvent, { type: "tool-end" }>;
const end = (e: LearnStreamEvent[]) => e.at(-1) as End;
const runIdOf = (e: LearnStreamEvent[]) => (e.find((x) => x.type === "run") as Extract<LearnStreamEvent, { type: "run" }>).runId;
const starts = (e: LearnStreamEvent[]) => e.filter((x) => x.type === "tool-start").map((x) => (x.type === "tool-start" ? x.tool : ""));
const toolEnd = (e: LearnStreamEvent[], tool: string) => e.findLast((x) => x.type === "tool-end" && x.tool === tool) as ToolEnd | undefined;

async function start(m: Mods, key: keyof typeof OFFLINE_TEST_ACTS, cookie?: string, extra: object = {}) {
  const res = await m.research.POST(req("POST", "/research", { link: OFFLINE_TEST_ACTS[key].spotifyId, ...extra }, cookie));
  expect(res.status).toBe(200);
  return { cookie: cookie ?? cookieOf(res), events: await read(res) };
}
async function answer(m: Mods, cookie: string, runId: string, body: object) {
  const res = await m.input.POST(req("POST", `/research/${runId}/input`, body, cookie), { params: Promise.resolve({ runId }) });
  return { status: res.status, events: res.status === 200 ? await read(res) : [], body: res.status === 200 ? null : await res.json() };
}
async function view(m: Mods, cookie: string) {
  return (await (await m.playlist.GET(req("GET", "", undefined, cookie))).json()).playlist as { research: ResearchSnapshot; soundsLike: { name: string; qlooId?: string; foundBy?: string }[]; songs: unknown[] };
}
const SILENT = OFFLINE_TEST_ACTS.silent;
const R = PLAYLIST_COPY.research;

beforeEach(() => {
  vi.unstubAllEnvs();
  profiles.length = 0;
});

describe("the run pauses at the first step that needs a Qloo taste signal", () => {
  it("profile, songs and Qloo run; Who you sound like waits with the ask; nothing after it starts", async () => {
    const m = await load();
    const r = await start(m, "silent");
    expect(end(r.events)).toMatchObject({ ok: true, code: "needs_sounds_like" });
    expect(starts(r.events)).toEqual(["research_profile", "research_songs", "research_qloo", "research_sounds_like"]);
    const four = toolEnd(r.events, "research_sounds_like")!;
    expect(four).toMatchObject({ ok: true, summary: R.ask.first, output: { waiting: { asks: 1, tried: { artists: [], genres: [] } }, artists: [] } });
    const v = await view(m, r.cookie);
    expect(v.research.waiting).toMatchObject({ step: "soundsLike", stepId: "rs-4", asks: 1, message: R.ask.first });
    expect(v.research.steps.soundsLike!.status).toBe("waiting");
    for (const k of ["fans", "fansMap", "fansLove", "learn", "genres", "summary"] as const) expect(v.research.steps[k]).toBeUndefined();
    expect(v.research.steps.profile!.status).toBe("done");
    expect(v.songs.length).toBeGreaterThan(0);
    expect(researchWaiting(v.research)).toBe("input");
    expect(researchUsable(v.research)).toBe(false);
  });

  it("a performer's own sound-alike Qloo doesn't know is named in the first ask", async () => {
    const m = await load();
    const first = await start(m, "silent");
    const v0 = await view(m, first.cookie);
    await m.playlist.PATCH(req("PATCH", "", { revision: (v0 as unknown as { revision: number }).revision, soundsLike: [{ name: OFFLINE_UNKNOWN_ARTIST }] }, first.cookie));
    const r = await start(m, "silent", first.cookie, { refresh: true });
    expect(toolEnd(r.events, "research_sounds_like")!.summary).toBe(R.ask.unknownArtists([OFFLINE_UNKNOWN_ARTIST]));
    expect((await view(m, first.cookie)).research.waiting).toMatchObject({ tried: { artists: [OFFLINE_UNKNOWN_ARTIST] } });
  });

  it("a refresh (or a later visit) shows the waiting step: the replay ends waiting and keeps the ask", async () => {
    const m = await load();
    const r = await start(m, "silent");
    const runId = runIdOf(r.events);
    const res = await m.events.GET(req("GET", `/learn/runs/${runId}/events`, undefined, r.cookie), { params: Promise.resolve({ runId }) });
    expect(res.status).toBe(200);
    const replay = await read(res);
    expect(end(replay)).toMatchObject({ code: "needs_sounds_like", runId });
    expect(toolEnd(replay, "research_sounds_like")).toMatchObject({ summary: R.ask.first, output: { waiting: { asks: 1 } } });
  });
});

describe("the input carries on the same run", () => {
  it("same run id, the earlier steps sent from the store (not fetched again), the artists saved as the performer's", async () => {
    const m = await load();
    const r = await start(m, "silent");
    const runId = runIdOf(r.events);
    expect(profiles).toEqual([SILENT.spotifyId]);
    const runsBefore = (await (await m.learn.GET(req("GET", "/learn", undefined, r.cookie))).json()).runs.length;
    const a = await answer(m, r.cookie, runId, { artists: [{ name: "Paul Kelly" }, { name: "Courtney Barnett" }] });
    expect(a.status).toBe(200);
    expect(runIdOf(a.events)).toBe(runId);
    // Steps 1–3 come back as stored; Spotify's profile was not read again. The Qloo step is sent once more with the input it now uses.
    const kept = (e: LearnStreamEvent[]) => e.filter((x) => (x.type === "tool-end" || x.type === "tool-start") && ["rs-1", "rs-2"].includes(x.id));
    expect(kept(a.events)).toEqual(kept(r.events));
    const qlooEnd = toolEnd(a.events, "research_qloo")!;
    expect(qlooEnd.summary).toBe(R.fallback.using(["Paul Kelly", "Courtney Barnett"], []));
    expect(qlooEnd.calls).toEqual(toolEnd(r.events, "research_qloo")!.calls);
    expect(profiles).toEqual([SILENT.spotifyId]);
    expect(starts(a.events).filter((t) => t === "research_profile")).toHaveLength(1);
    expect(end(a.events).ok).toBe(true);
    expect(String(end(a.events).code)).not.toMatch(/^needs_/);
    const v = await view(m, r.cookie);
    expect(v.research.waiting).toBeUndefined();
    expect(v.research.runId).toBe(runId);
    for (const k of ["soundsLike", "fans", "fansMap", "fansLove", "learn", "genres", "summary"] as const) expect(v.research.steps[k]!.status, k).toBe("done");
    expect(v.research.steps.qloo!.output).toMatchObject({ fallback: "soundsLike", summary: R.fallback.using(["Paul Kelly", "Courtney Barnett"], []) });
    expect(v.research.steps.fansLove!.output!.signalledBy).toEqual(["Paul Kelly", "Courtney Barnett"]);
    expect(v.soundsLike.map((x) => x.name)).toEqual(["Paul Kelly", "Courtney Barnett"]);
    expect(v.soundsLike.every((x) => x.qlooId && !x.foundBy)).toBe(true);
    expect(researchUsable(v.research)).toBe(true);
    const runsAfter = (await (await m.learn.GET(req("GET", "/learn", undefined, r.cookie))).json()).runs;
    expect(runsAfter.length).toBe(runsBefore);
    expect(runsAfter[0]).toMatchObject({ runId, status: "done" });
  });

  it("only some artists resolve: it carries on with those", async () => {
    const m = await load();
    const r = await start(m, "silent");
    const a = await answer(m, r.cookie, runIdOf(r.events), { artists: [{ name: "Paul Kelly" }, { name: OFFLINE_UNKNOWN_ARTIST }] });
    expect(String(end(a.events).code)).not.toMatch(/^needs_/);
    const v = await view(m, r.cookie);
    expect(v.research.steps.fansLove!.output!.signalledBy).toEqual(["Paul Kelly"]);
    expect(v.soundsLike.map((x) => x.name)).toEqual(["Paul Kelly", OFFLINE_UNKNOWN_ARTIST]);
  });

  it("a genre Qloo has a tag for carries on from that genre, every Qloo step asking Qloo", async () => {
    const m = await load();
    const r = await start(m, "silent");
    const a = await answer(m, r.cookie, runIdOf(r.events), { genres: ["Folk"] });
    expect(end(a.events).ok).toBe(true);
    expect(String(end(a.events).code)).not.toMatch(/^needs_/);
    const v = await view(m, r.cookie);
    expect(v.research.steps.qloo!.output).toMatchObject({ fallback: "genres", genrePick: "Folk", genreTags: [{ name: "Folk" }], summary: R.fallback.using([], ["Folk"]) });
    expect(v.research.steps.soundsLike!.output).toMatchObject({ basedOn: "genres" });
    expect(v.research.steps.soundsLike!.output!.artists.length).toBeGreaterThan(0);
    expect(v.research.steps.fans!.output!.summary).not.toBe(R.fallback.noTaste);
    for (const tool of ["research_sounds_like", "research_fans", "research_fans_map", "research_fans_love"]) {
      expect(toolEnd(a.events, tool)!.calls?.some((c) => c.provider === "qloo"), tool).toBe(true);
    }
  });
});

describe("artists and a genre together", () => {
  it("the resolved artists lead the signal, the genre's artists follow, the step line names both, and it is saved for a refresh", async () => {
    const m = await load();
    const r = await start(m, "silent");
    const a = await answer(m, r.cookie, runIdOf(r.events), { artists: [{ name: "Paul Kelly" }, { name: "Courtney Barnett" }], genres: ["Folk"] });
    expect(end(a.events).ok).toBe(true);
    expect(String(end(a.events).code)).not.toMatch(/^needs_/);
    const line = R.fallback.using(["Paul Kelly", "Courtney Barnett"], ["Folk"]);
    expect(toolEnd(a.events, "research_qloo")!.summary).toBe(line);
    const v = await view(m, r.cookie);
    expect(v.research.steps.qloo!.output).toMatchObject({ fallback: "soundsLike", genrePick: "Folk", genreTags: [{ id: "urn:tag:genre:music:folk" }], summary: line });
    const fans = v.research.steps.soundsLike!.output!.artists.map((x) => x.name);
    expect(fans.slice(0, 2)).toEqual(["Paul Kelly", "Courtney Barnett"]);
    expect(fans.length).toBeGreaterThan(2);
  });

  it("an unknown artist plus a genre: the genre alone carries on", async () => {
    const m = await load();
    const r = await start(m, "silent");
    const a = await answer(m, r.cookie, runIdOf(r.events), { artists: [{ name: OFFLINE_UNKNOWN_ARTIST }], genres: ["Pop"] });
    expect(String(end(a.events).code)).not.toMatch(/^needs_/);
    expect((await view(m, r.cookie)).research.steps.qloo!.output).toMatchObject({ fallback: "genres", summary: R.fallback.using([], ["Pop"]) });
  });
});

describe("artists picked from Spotify (Mariah Carey and Celia Cruz) are resolved by Spotify id and named in the step", () => {
  const { mariah, celia } = OFFLINE_PICKED_ARTISTS;
  const picked = [
    { name: mariah.name, spotifyId: mariah.spotifyId, image: mariah.spotifyImage },
    { name: celia.name, spotifyId: celia.spotifyId },
  ];
  type Saved = { name: string; spotifyId?: string; qlooId?: string; image?: string };

  it("both resolve although Qloo's id lookup tags them with no music-genre id; the step names both and the two genres", async () => {
    const m = await load();
    const r = await start(m, "silent");
    const a = await answer(m, r.cookie, runIdOf(r.events), { artists: picked, genres: ["Folk", "Pop"] });
    expect(a.status).toBe(200);
    expect(String(end(a.events).code)).not.toMatch(/^needs_/);
    const line = R.fallback.using([mariah.name, celia.name], ["Folk", "Pop"]);
    expect(line).toBe("Qloo doesn't know you yet. Using your artists: Mariah Carey and Celia Cruz; your genres: Folk and Pop.");
    expect(toolEnd(a.events, "research_qloo")!.summary).toBe(line);
    const v = await view(m, r.cookie);
    const saved = v.soundsLike as Saved[];
    expect(saved.map((x) => x.name)).toEqual([mariah.name, celia.name]);
    expect(saved.every((x) => x.qlooId)).toBe(true);
    expect(v.research.steps.qloo!.output).toMatchObject({ fallback: "soundsLike", summary: line });
  });

  it("the Spotify photo is saved with the sound-alike; Qloo's photo stands in when Spotify's is missing", async () => {
    const m = await load();
    const r = await start(m, "silent");
    await answer(m, r.cookie, runIdOf(r.events), { artists: picked });
    const v = await view(m, r.cookie);
    const saved = v.soundsLike as Saved[];
    expect(saved.find((x) => x.name === mariah.name)).toMatchObject({ spotifyId: mariah.spotifyId, image: mariah.spotifyImage });
    expect(saved.find((x) => x.name === celia.name)).toMatchObject({ spotifyId: celia.spotifyId, image: celia.qlooImage });
    const listed = v.research.steps.soundsLike!.output!.artists;
    expect(listed.find((x) => x.name === mariah.name)!.image).toBe(mariah.spotifyImage);
    expect(listed.find((x) => x.name === celia.name)!.image).toBe(celia.qlooImage);
  });

  it("an artist Qloo can't match is named: 'Qloo doesn't know X'", async () => {
    const m = await load();
    const r = await start(m, "silent");
    const a = await answer(m, r.cookie, runIdOf(r.events), { artists: [picked[0], { name: OFFLINE_UNKNOWN_ARTIST }] });
    expect(toolEnd(a.events, "research_qloo")!.summary).toBe(`Qloo doesn't know you yet. Using your artists: ${mariah.name}. Qloo doesn't know ${OFFLINE_UNKNOWN_ARTIST}.`);
  });

  it("up to three genres resolve to Qloo tags and are all named; the old single genre is still accepted; a fourth is refused", async () => {
    const m = await load();
    const r = await start(m, "silent");
    const runId = runIdOf(r.events);
    expect((await answer(m, r.cookie, runId, { genres: ["Folk", "Pop", "Jazz", "Rock"] })).status).toBe(400);
    const a = await answer(m, r.cookie, runId, { genres: ["Folk", "Pop", "Jazz"] });
    expect(toolEnd(a.events, "research_qloo")!.summary).toBe("Qloo doesn't know you yet. Using your genres: Folk, Pop and Jazz.");
    const v = await view(m, r.cookie);
    expect(v.research.steps.qloo!.output).toMatchObject({ fallback: "genres", genreTags: [{ id: "urn:tag:genre:music:folk" }, { id: "urn:tag:genre:music:pop" }, { id: "urn:tag:genre:music:jazz" }] });
    const old = await load();
    const r2 = await start(old, "silent");
    const b = await answer(old, r2.cookie, runIdOf(r2.events), { genre: "Folk", genres: ["Pop"] });
    expect(toolEnd(b.events, "research_qloo")!.summary).toBe("Qloo doesn't know you yet. Using your genres: Pop and Folk.");
  });

  it("a genre with no tag is named; the others carry on", async () => {
    const m = await load();
    const r = await start(m, "silent");
    const a = await answer(m, r.cookie, runIdOf(r.events), { genres: ["Pop", OFFLINE_UNTAGGED_GENRE] });
    expect(toolEnd(a.events, "research_qloo")!.summary).toBe(`Qloo doesn't know you yet. Using your genre: Pop. Qloo doesn't know ${OFFLINE_UNTAGGED_GENRE}.`);
  });
});

describe("asks again when Qloo still knows nothing, at most three times", () => {
  it("unknown artists, then an untagged genre, then the cap: the run finishes without taste data, in one line", async () => {
    const m = await load();
    const r = await start(m, "silent");
    const runId = runIdOf(r.events);
    const a2 = await answer(m, r.cookie, runId, { artists: [{ name: OFFLINE_UNKNOWN_ARTIST }, { name: "Xyl Ghost" }] });
    expect(runIdOf(a2.events)).toBe(runId);
    expect(end(a2.events)).toMatchObject({ code: "needs_sounds_like", runId });
    expect(toolEnd(a2.events, "research_sounds_like")).toMatchObject({ summary: `Qloo doesn't know ${OFFLINE_UNKNOWN_ARTIST} or Xyl Ghost either. Try better-known artists, or pick a genre.`, output: { waiting: { asks: 2 } } });
    // The panel shows the step once: the old ask gives way to the new one.
    expect(starts(a2.events).filter((t) => t === "research_sounds_like")).toHaveLength(1);
    expect((await view(m, r.cookie)).soundsLike.map((x) => x.name)).toEqual([OFFLINE_UNKNOWN_ARTIST, "Xyl Ghost"]);

    const a3 = await answer(m, r.cookie, runId, { genre: OFFLINE_UNTAGGED_GENRE });
    expect(end(a3.events).code).toBe("needs_sounds_like");
    expect(toolEnd(a3.events, "research_sounds_like")).toMatchObject({ summary: R.ask.untaggedGenre(OFFLINE_UNTAGGED_GENRE), output: { waiting: { asks: RESEARCH_MAX_ASKS, tried: { artists: [OFFLINE_UNKNOWN_ARTIST, "Xyl Ghost"], genres: [OFFLINE_UNTAGGED_GENRE] } } } });
    const v3 = await view(m, r.cookie);
    expect(v3.research.waiting).toMatchObject({ asks: RESEARCH_MAX_ASKS });
    expect(v3.research.steps.qloo!.output!.genrePick).toBe(OFFLINE_UNTAGGED_GENRE);

    const last = await answer(m, r.cookie, runId, { artists: [{ name: OFFLINE_UNKNOWN_ARTIST }] });
    expect(end(last.events)).toMatchObject({ ok: true, code: "no_taste_data", runId, message: PLAYLIST_COPY.learn.end({ ok: true, mode: "mock", code: "no_taste_data", newCount: 0, skippedCount: 0 }) });
    expect(toolEnd(last.events, "research_sounds_like")).toMatchObject({ summary: R.ask.gaveUp, output: { gaveUp: true } });
    const v = await view(m, r.cookie);
    expect(v.research.waiting).toBeUndefined();
    for (const k of ["fans", "fansMap", "fansLove", "learn", "genres", "summary"] as const) expect(v.research.steps[k]!.status).toBe("skipped");
    // Not waiting any more: another answer is refused.
    expect((await answer(m, r.cookie, runId, { genres: ["Folk"] })).status).toBe(409);
  });
});

describe("POST /api/playlist/research/<runId>/input refusals", () => {
  it("bad input, another run id, and a run that isn't waiting", async () => {
    const m = await load();
    const r = await start(m, "silent");
    const runId = runIdOf(r.events);
    expect((await answer(m, r.cookie, runId, {})).status).toBe(400);
    expect((await answer(m, r.cookie, runId, { artists: [] })).status).toBe(400);
    expect((await answer(m, r.cookie, "00000000-0000-4000-8000-000000000000", { genres: ["Folk"] })).body).toMatchObject({ error: { code: "not_waiting" } });
    const julia = await start(m, "variant", r.cookie, {});
    expect(end(julia.events).ok).toBe(true);
    expect((await answer(m, r.cookie, runId, { genres: ["Folk"] })).body).toMatchObject({ error: { code: "not_waiting" } });
  });

  it("without a Repertoire there is nothing to answer", async () => {
    const m = await load();
    const res = await m.input.POST(req("POST", "/research/x/input", { genres: ["Folk"] }), { params: Promise.resolve({ runId: "x" }) });
    expect(res.status).toBe(404);
  });
});

describe("every external call is recorded on its step", () => {
  it("provider, endpoint, params without keys, status, count, ms and cached, for Spotify, Qloo and Last.fm", async () => {
    const m = await load();
    const r = await start(m, "silent");
    const profile = toolEnd(r.events, "research_profile")!.calls!;
    expect(profile).toEqual([{ provider: "spotify", endpoint: "/artists/{id}", params: { id: SILENT.spotifyId }, status: null, count: 1, ms: expect.any(Number), cached: false }]);
    const qlooCalls = toolEnd(r.events, "research_qloo")!.calls!;
    expect(qlooCalls.find((c) => c.provider === "qloo" && c.endpoint === "/entities")).toMatchObject({ status: 404, count: 0, cached: false, params: { "external.spotify.ids": SILENT.spotifyId } });
    expect(qlooCalls.some((c) => c.provider === "qloo" && c.endpoint === "/search" && c.params.query === SILENT.name)).toBe(true);
    expect(qlooCalls.some((c) => c.provider === "lastfm" && c.endpoint === "artist.getsimilar" && c.params.artist === SILENT.name)).toBe(true);
    expect(qlooCalls.some((c) => c.provider === "lastfm" && c.endpoint === "artist.gettoptags")).toBe(true);
    for (const e of r.events) if (e.type === "tool-end") for (const c of e.calls ?? []) for (const k of Object.keys(c.params)) expect(k).not.toMatch(/key|token|secret/i);
    // The calls are stored with the run: the replay carries them too.
    const runId = runIdOf(r.events);
    const replay = await read(await m.events.GET(req("GET", `/learn/runs/${runId}/events`, undefined, r.cookie), { params: Promise.resolve({ runId }) }));
    expect(toolEnd(replay, "research_qloo")!.calls).toEqual(qlooCalls);
  });
});
