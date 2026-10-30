import { beforeEach, describe, expect, it, vi } from "vitest";
import { learnStreamEventSchema, type LearnStreamEvent } from "@/lib/learn-schema";
import { OFFLINE_TEST_ACTS, RESEARCH_STEPS, type ResearchSnapshot } from "@/lib/repertoire-research";
import { PLAYLIST_COPY } from "@/lib/playlist-copy";
import { NOTONQ_FILLED_ID } from "@/server/qloo-mock/notonq";

/**
 * An act Qloo lacks that NotOnQ fills in (lib/notonq.ts), end to end on the offline mocks: the Qloo mock plays the proxy for the
 * NotOnQ test act (qloo-mock/notonq.ts). The act is the filled artist, labelled, and its taste steps carry the stand-ins.
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
const base = "http://localhost:3100/api/playlist";
const req = (method: string, path: string, body?: unknown, cookie?: string) =>
  new Request(base + path, { method, headers: { "content-type": "application/json", host: "localhost:3100", ...(cookie ? { cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });

async function events(res: Response): Promise<LearnStreamEvent[]> {
  return (await res.text())
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => learnStreamEventSchema.parse(JSON.parse(l)));
}

beforeEach(() => vi.unstubAllEnvs());

describe("an act NotOnQ filled in", () => {
  it("is the act's entity (labelled, by name), never the Last.fm-only path, and the taste steps say which stand-ins answered", async () => {
    const m = await load();
    const res = await m.research.POST(req("POST", "/research", { link: OFFLINE_TEST_ACTS.notonq.spotifyId }));
    expect(res.status).toBe(200);
    const cookie = res.headers.get("set-cookie")?.split(";")[0] ?? "";
    const stream = await events(res);
    const end = stream.at(-1) as Extract<LearnStreamEvent, { type: "end" }>;
    expect(end).toMatchObject({ ok: true });
    expect(end.code ?? "").not.toMatch(/^needs_/);
    expect(stream.filter((e) => e.type === "tool-end" && e.ok)).toHaveLength(RESEARCH_STEPS.length);

    const view = (await (await m.playlist.GET(req("GET", "", undefined, cookie))).json()).playlist as { qlooArtistId: string | null; research: ResearchSnapshot };
    const steps = view.research.steps;
    expect(view.qlooArtistId).toBe(NOTONQ_FILLED_ID);
    expect(steps.qloo!.output).toMatchObject({ matched: true, qlooId: NOTONQ_FILLED_ID, name: OFFLINE_TEST_ACTS.notonq.name, by: "name", filledBy: "notonq" });
    expect(steps.qloo!.output!.summary).toBe(`Qloo doesn't know you yet; NotOnQ filled in ${OFFLINE_TEST_ACTS.notonq.name}`);
    expect(steps.qloo!.output!.fallback).toBeUndefined();
    const via = { by: "notonq", standIns: [...OFFLINE_TEST_ACTS.notonq.standIns] };
    for (const key of ["soundsLike", "fans", "fansMap", "fansLove", "genres"] as const) expect(steps[key]!.output!.via, key).toEqual(via);
    // The stand-ins' answers are Qloo's own artists: not labelled as filled.
    expect(steps.fansLove!.output!.artists.length).toBeGreaterThan(0);
    expect(steps.fansLove!.output!.artists.every((a) => a.filledBy === undefined)).toBe(true);
    // Steps that aren't taste answers carry no stand-ins.
    expect((steps.learn!.output as { via?: unknown }).via).toBeUndefined();
  }, 20_000);

  it("with no stand-ins it is no match: Last.fm isn't asked again, and the run asks who the act sounds like", async () => {
    const m = await load();
    const res = await m.research.POST(req("POST", "/research", { link: OFFLINE_TEST_ACTS.notonqEmpty.spotifyId }));
    const cookie = res.headers.get("set-cookie")?.split(";")[0] ?? "";
    const stream = await events(res);
    expect(stream.at(-1)).toMatchObject({ type: "end", ok: true, code: "needs_sounds_like" });
    const qlooStep = stream.findLast((e) => e.type === "tool-end" && e.tool === "research_qloo") as Extract<LearnStreamEvent, { type: "tool-end" }>;
    expect(qlooStep.calls?.some((c) => c.provider === "qloo")).toBe(true);
    expect(qlooStep.calls?.some((c) => c.provider === "lastfm")).toBe(false);
    const view = (await (await m.playlist.GET(req("GET", "", undefined, cookie))).json()).playlist as { qlooArtistId: string | null; research: ResearchSnapshot };
    expect(view.qlooArtistId).toBeNull();
    expect(view.research.steps.qloo!.output).toMatchObject({ matched: false, qlooId: null, fallback: "none", summary: PLAYLIST_COPY.research.fallback.noneLabel });
    expect(view.research.waiting).toMatchObject({ step: "soundsLike" });
  }, 20_000);

  it("a Qloo act's research carries no NotOnQ provenance at all", async () => {
    const m = await load();
    const res = await m.research.POST(req("POST", "/research", { link: OFFLINE_TEST_ACTS.variant.spotifyId }));
    const cookie = res.headers.get("set-cookie")?.split(";")[0] ?? "";
    await events(res);
    const view = (await (await m.playlist.GET(req("GET", "", undefined, cookie))).json()).playlist as { research: ResearchSnapshot };
    expect(JSON.stringify(view.research)).not.toMatch(/notonq|filledBy/i);
  }, 20_000);
});
