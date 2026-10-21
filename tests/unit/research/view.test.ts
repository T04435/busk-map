import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LearnStreamEvent } from "@/lib/learn-schema";
import { OFFLINE_TEST_ARTIST, RESEARCH_STEPS } from "@/lib/repertoire-research";
import { toRepertoireView } from "@/lib/repertoire-research-view";
import { CATALOG } from "@/server/qloo-mock/catalog";

/** The view model from real offline runs (the route on the mocks), cut at different points of the stream. */
async function load() {
  vi.resetModules();
  vi.stubEnv("BUSKMAP_OFFLINE", "1");
  vi.stubEnv("BUSKMAP_ALLOW_FAULTS", "1");
  vi.stubEnv("VERCEL", "");
  (await import("@/server/playlist/store")).resetPlaylistStoresForTests();
  (await import("@/server/learn/store")).resetLearnStoresForTests();
  (await import("@/server/learn/runs")).clearLearnRunsForTests();
  return { research: await import("@/app/api/playlist/research/route"), playlist: await import("@/app/api/playlist/route"), learn: await import("@/app/api/playlist/learn/route") };
}
const JULIA = CATALOG.find((a) => a.name === "Julia Jacklin")!;
const req = (method: string, path: string, body?: unknown, cookie?: string, headers: Record<string, string> = {}) =>
  new Request(`http://localhost:3100/api/playlist${path}`, { method, headers: { "content-type": "application/json", host: "localhost:3100", ...(cookie ? { cookie } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
const parse = async (res: Response) => (await res.text()).split("\n").filter(Boolean).map((l) => JSON.parse(l) as LearnStreamEvent);
async function fullRun(headers: Record<string, string> = {}) {
  const m = await load();
  const res = await m.research.POST(req("POST", "/research", { link: JULIA.spotifyId }, undefined, headers));
  const cookie = res.headers.get("set-cookie")!.split(";")[0];
  const events = await parse(res);
  const playlist = (await (await m.playlist.GET(req("GET", "", undefined, cookie))).json()).playlist;
  const list = await (await m.learn.GET(req("GET", "/learn", undefined, cookie))).json();
  return { m, cookie, events, playlist, list };
}
const cutAfter = (events: LearnStreamEvent[], tool: string) => events.slice(0, events.findIndex((e) => e.type === "tool-end" && e.tool === tool) + 1);
const statuses = (v: ReturnType<typeof toRepertoireView>) => Object.fromEntries(v.steps.map((s) => [s.key, s.status]));

beforeEach(() => vi.unstubAllEnvs());

describe("toRepertoireView", () => {
  it("the offline test artist is the mock catalogue's artist", () => {
    expect(OFFLINE_TEST_ARTIST.spotifyId).toBe(JULIA.spotifyId);
  });

  it("empty: ten pending steps and every result null", () => {
    const v = toRepertoireView({});
    expect(v.phase).toBe("empty");
    expect(v.steps.map((s) => s.key)).toEqual([...RESEARCH_STEPS]);
    expect(v.steps.every((s) => s.status === "pending")).toBe(true);
    expect(Object.values(v.results).every((r) => r === null)).toBe(true);
    expect(v.totals).toEqual({ qlooCalls: 0, songs: 0, soundsLike: 0, fanArtists: 0, songsChecked: 0, toLearn: null });
  });

  it("running: the steps landed so far are done with their line and cells; later results stay null (the skeletons)", async () => {
    const { events } = await fullRun();
    const mid = [...cutAfter(events, "research_qloo"), events.find((e) => e.type === "tool-start" && e.tool === "research_sounds_like")!];
    const v = toRepertoireView({ events: mid });
    expect(v.phase).toBe("running");
    expect(statuses(v)).toMatchObject({ profile: "done", songs: "done", qloo: "done", soundsLike: "running", fans: "pending", summary: "pending" });
    expect(v.steps[0]).toMatchObject({ found: expect.stringContaining("Julia Jacklin"), cells: [{ name: "Julia Jacklin" }] });
    expect(v.steps[2].cells?.map((c) => c.name)).toEqual(expect.arrayContaining(["Dreamy"]));
    expect(v.results.profile).toMatchObject({ name: "Julia Jacklin", audience: expect.arrayContaining(["Dreamy"]), href: expect.stringContaining(JULIA.spotifyId) });
    expect(v.results.canSing).toHaveLength(4);
    expect(v.results.canSing?.every((s) => s.own)).toBe(true);
    for (const k of ["summary", "fans", "soundsLike", "fansLove", "toLearn"] as const) expect(v.results[k], k).toBeNull();
    expect(v.totals.songs).toBe(4);
    expect(v.totals.toLearn).toBeNull();
  });

  it("Hive Identity: the songs step says its live source (Spotify first) for its running mark, and a done step keeps the source it came from", async () => {
    const { events } = await fullRun();
    const startSongs = events.findIndex((e) => e.type === "tool-start" && e.tool === "research_songs");
    const live = events.slice(startSongs + 1).find((e) => e.type === "tool-source");
    expect(live).toMatchObject({ type: "tool-source", source: "spotify" });
    const running = toRepertoireView({ events: events.slice(0, events.indexOf(live!) + 1) });
    expect(running.steps[1]).toMatchObject({ key: "songs", status: "running", source: "spotify" });
    const done = toRepertoireView({ events: cutAfter(events, "research_songs").filter((e) => e.type !== "tool-source") });
    expect(done.steps[1]).toMatchObject({ key: "songs", status: "done", source: "spotify" });
    const fellBack = toRepertoireView({ events: [...events.slice(0, startSongs + 1), { type: "tool-source", id: (events[startSongs] as { id: string }).id, source: "lastfm" }] });
    expect(fellBack.steps[1]).toMatchObject({ status: "running", source: "lastfm" });
  });

  it("done, live: every result in place, To learn from the run's suggestions, the totals final", async () => {
    const { events } = await fullRun();
    const v = toRepertoireView({ events });
    expect(v.phase).toBe("done");
    expect(v.steps.every((s) => s.status === "done")).toBe(true);
    expect(v.results.summary).toBeNull(); // the paragraph about the act is retired
    expect(v.results.fans?.age.length).toBeGreaterThan(0);
    expect(v.results.soundsLike?.every((a) => a.source === "qloo")).toBe(true);
    expect(v.results.fansLove?.length).toBeGreaterThan(0);
    expect(v.results.toLearn?.length).toBe(v.end?.newCount);
    expect(v.results.toLearn?.[0]).toMatchObject({ status: "pending", reason: expect.stringMatching(/^Mock reason/) });
    expect(v.totals).toMatchObject({ toLearn: v.end?.newCount, soundsLike: 10, fanArtists: 10 });
    expect(v.totals.qlooCalls).toBeGreaterThanOrEqual(6);
  });

  it("done, saved: the snapshot plus the Repertoire and the Learn list (current statuses, the editable sound-alikes)", async () => {
    const { playlist, list } = await fullRun();
    const v = toRepertoireView({ snapshot: playlist.research, playlist, suggestions: list.suggestions });
    expect(v.phase).toBe("done");
    expect(v.mode).toBe("full");
    expect(v.steps.every((s) => s.status === "done")).toBe(true);
    expect(v.results.soundsLike).toHaveLength(6);
    expect(v.results.canSing).toHaveLength(4);
    expect(v.results.learned).toEqual([]);
    expect(v.results.toLearn).toHaveLength(list.suggestions.length);
    expect(v.totals.toLearn).toBe(list.suggestions.length);
  });

  it("a live Find more: steps 1–5 and 8 from the snapshot, 6, 7 and 9 from the stream", async () => {
    const { m, cookie, playlist } = await fullRun();
    const more = await parse(await m.research.POST(req("POST", "/research", { mode: "more" }, cookie)));
    const mid = cutAfter(more, "research_fans_love");
    const v = toRepertoireView({ snapshot: playlist.research, events: mid, playlist });
    expect(v.mode).toBe("more");
    expect(statuses(v)).toMatchObject({ profile: "done", genres: "done", fansLove: "done", learn: "pending", summary: "pending" });
    expect(v.results.profile?.name).toBe("Julia Jacklin");
    expect(v.results.summary).toBeNull();
  });

  it("a saved sound-alike shows its saved photo (not initials), before the step's own, and the chip list of the view carries it", async () => {
    const { playlist } = await fullRun();
    const saved = [
      { name: "Mariah Carey", spotifyId: "MockPickedArtist000001", qlooId: "q1", image: "https://i.scdn.co/image/saved-mariah" },
      { name: "Celia Cruz", qlooId: "q2", image: "https://images.qloo.test/celia-cruz.jpg" },
      { name: "Typed Only" },
    ];
    const v = toRepertoireView({ snapshot: playlist.research, playlist: { ...playlist, soundsLike: saved } });
    const byName = Object.fromEntries((v.results.soundsLike ?? []).map((a) => [a.name, a]));
    expect(byName["Mariah Carey"].image).toBe("https://i.scdn.co/image/saved-mariah");
    expect(byName["Celia Cruz"].image).toBe("https://images.qloo.test/celia-cruz.jpg");
    expect(byName["Typed Only"].image).toBeUndefined();
  });

  it("U03 U06: a saved song borrows the act's photo and this run's covers; links are Spotify only", async () => {
    const { events, playlist, list } = await fullRun();
    // The offline profile has no photo, so give it one the way Spotify's snapshot would.
    const withPhoto = { ...playlist, spotifyProfile: { ...playlist.spotifyProfile, images: [{ url: "https://i.scdn.co/image/me", width: 300, height: 300 }] } };
    const v = toRepertoireView({ snapshot: playlist.research, playlist: withPhoto, suggestions: list.suggestions });
    expect(v.results.canSing?.length).toBeGreaterThan(0);
    for (const s of v.results.canSing ?? []) expect(s.image ?? s.artistImage, `${s.title} has a photo`).toBeTruthy();
    for (const s of [...(v.results.canSing ?? []), ...(v.results.toLearn ?? [])]) if (s.href) expect(s.href).toMatch(/^https:\/\/open\.spotify\.com\/track\//);
    for (const a of [...(v.results.soundsLike ?? []), ...(v.results.fansLove ?? [])]) if (a.href) expect(a.href).toMatch(/^https:\/\/open\.spotify\.com\/artist\//);
    expect(v.results.canSing?.[0].source).toBe("spotify");
    // The live stream gives the same songs without any link that is not Spotify's.
    for (const s of toRepertoireView({ events }).results.canSing ?? []) if (s.href) expect(s.href).toMatch(/^https:\/\/open\.spotify\.com\//);
  });

  it("Qloo down: the steps after Finding you on Qloo are skipped, the profile and songs stay", async () => {
    const { events } = await fullRun({ "x-buskmap-faults": "qloo" });
    const v = toRepertoireView({ events });
    expect(statuses(v)).toMatchObject({ profile: "done", songs: "done", qloo: "failed", soundsLike: "skipped", summary: "skipped" });
    expect(v.steps[2].note).toMatch(/Qloo didn't answer/);
    expect(v.end).toMatchObject({ ok: false, code: "qloo_unavailable" });
    expect(v.results.profile?.name).toBe("Julia Jacklin");
  });
});
