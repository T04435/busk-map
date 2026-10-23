import { beforeEach, describe, expect, it, vi } from "vitest";
import { startingArtists, type FormPrefill } from "@/components/landing/performer-form";
import { planRequestSchema } from "@/lib/plan-schema";
import { actGenresOf, type ResearchSnapshot } from "@/lib/repertoire-research";
import { CATALOG, genreTagId } from "@/server/qloo-mock/catalog";
import { mockFetch, OFFLINE } from "../../helpers";

/**
 * An act Qloo doesn't know, whose research saved "who you sound like" and genres (v1.1.1): the busk form starts with those
 * sound-alikes, the suggestions come from them, and the plan's Qloo taste reads carry the genres as signal.interests.tags.
 */

/** Every Qloo request the in-process mock answered, as URLs. */
const qlooUrls: URL[] = [];
vi.mock("@/server/qloo-mock/fetch", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/qloo-mock/fetch")>();
  return {
    ...original,
    qlooMockFetch: (input: string | URL | Request, init?: RequestInit) => {
      qlooUrls.push(new URL(input instanceof Request ? input.url : String(input)));
      return original.qlooMockFetch(input, init);
    },
  };
});

const [A, B] = [CATALOG[1], CATALOG[2]];
const UNKNOWN_ID = "4gzpq5DPGxSnKTe4SA8HAU";

describe("the busk form's starting artists", () => {
  const rep = { soundsLike: [{ name: "Mariah Carey", qlooId: "q-mariah", image: "https://i.example/m.jpg" }, { name: "Celia Cruz" }] };
  const prefill = (artists: string[]): FormPrefill => ({
    performer: { name: "Act", artists, spotifyArtists: [], songs: [] } as unknown as FormPrefill["performer"],
    permit: "general",
    anyTime: true,
  });

  it("starts with the Repertoire's sound-alikes", () => {
    expect(startingArtists(undefined, rep).map((a) => a.name)).toEqual(["Mariah Carey", "Celia Cruz"]);
    expect(startingArtists(undefined, rep)[0]).toMatchObject({ qlooId: "q-mariah", image: "https://i.example/m.jpg", spotifyId: null });
  });

  it("planning again: the plan's artists first, then the Repertoire's it lacks, by name", () => {
    const got = startingArtists(prefill(["Shakira", "mariah carey"]), rep);
    expect(got.map((a) => a.name)).toEqual(["Shakira", "mariah carey", "Celia Cruz"]);
    expect(got[1]).toMatchObject({ qlooId: "q-mariah", image: "https://i.example/m.jpg" });
  });

  it("an empty plan list never wipes the Repertoire's", () => {
    expect(startingArtists(prefill([]), rep).map((a) => a.name)).toEqual(["Mariah Carey", "Celia Cruz"]);
  });

  it("stops at the picker's maximum", () => {
    const many = Array.from({ length: 10 }, (_, i) => `Artist ${i}`);
    expect(startingArtists(prefill(many), rep)).toHaveLength(10);
  });

  it("no Repertoire, no plan: empty", () => {
    expect(startingArtists(undefined, null)).toEqual([]);
  });
});

describe("actGenresOf: the genres the performer answered count", () => {
  const snapshot = (qloo: object, genres?: { id: string; name: string }[]) =>
    ({ steps: { qloo: { output: qloo }, ...(genres ? { genres: { output: { tags: genres } } } : {}) } }) as unknown as ResearchSnapshot;
  it("an unknown act's answered genre tags lead, then step 8's, once each", () => {
    const latin = { id: "urn:tag:genre:music:latin", name: "Latin" };
    const pop = { id: "urn:tag:genre:music:pop", name: "Pop" };
    expect(actGenresOf(snapshot({ matched: false, genreTags: [latin, pop] }, [pop]))).toEqual([latin, pop]);
  });
  it("a matched act keeps step 8's only", () => {
    expect(actGenresOf(snapshot({ matched: true, genreTags: [{ id: "urn:tag:x", name: "X" }] }))).toEqual([]);
  });
});

describe("suggestions for an act Qloo doesn't know (offline)", () => {
  beforeEach(() => vi.unstubAllEnvs());

  async function load() {
    vi.resetModules();
    vi.stubEnv("BUSKMAP_OFFLINE", "1");
    vi.stubEnv("VERCEL", "");
    const store = await import("@/server/playlist/store");
    store.resetPlaylistStoresForTests();
    return { root: await import("@/app/api/playlist/route"), profile: await import("@/app/api/playlist/profile/route"), soundsLike: await import("@/app/api/playlist/sounds-like/route") };
  }
  const req = (path: string, method: string, body?: unknown, cookie?: string) =>
    new Request(`http://localhost:3100${path}`, {
      method,
      headers: { "content-type": "application/json", host: "localhost:3100", ...(cookie ? { cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  it("are Qloo's related artists of the saved sound-alikes, never the saved ones themselves", async () => {
    const { root, profile, soundsLike } = await load();
    const cookie = (await root.POST(req("/api/playlist", "POST", { spotifyArtistId: UNKNOWN_ID }))).headers.get("set-cookie")?.split(";")[0] ?? "";
    const loaded = (await (await profile.POST(req("/api/playlist/profile", "POST", undefined, cookie))).json()).playlist;
    expect(loaded.qlooArtistId).toBeNull();
    await root.PATCH(req("/api/playlist", "PATCH", { revision: loaded.revision, soundsLike: [{ name: A.name, qlooId: A.id }, { name: B.name, qlooId: B.id }] }, cookie));
    const got = await (await soundsLike.GET(req("/api/playlist/sounds-like", "GET", undefined, cookie))).json();
    expect(got.status).toBe("ok");
    expect(got.artists.length).toBeGreaterThan(0);
    expect(got.artists.length).toBeLessThanOrEqual(10);
    const names = got.artists.map((a: { name: string }) => a.name);
    expect(names).not.toContain(A.name);
    expect(names).not.toContain(B.name);
  });

  it("sound-alikes Qloo doesn't know either: still unknown_artist", async () => {
    const { root, profile, soundsLike } = await load();
    const cookie = (await root.POST(req("/api/playlist", "POST", { spotifyArtistId: UNKNOWN_ID }))).headers.get("set-cookie")?.split(";")[0] ?? "";
    const loaded = (await (await profile.POST(req("/api/playlist/profile", "POST", undefined, cookie))).json()).playlist;
    await root.PATCH(req("/api/playlist", "PATCH", { revision: loaded.revision, soundsLike: [{ name: "Nobody Knows" }] }, cookie));
    expect(await (await soundsLike.GET(req("/api/playlist/sounds-like", "GET", undefined, cookie))).json()).toEqual({ status: "unknown_artist", artists: [] });
  });
});

describe("the plan's Qloo taste reads carry the act's genres when Qloo doesn't know the act (offline)", () => {
  const POP = { id: genreTagId("pop"), name: "Pop" };
  const SOUL = { id: genreTagId("soul"), name: "Soul" };
  const request = (extra: object) =>
    planRequestSchema.parse({
      city: "melbourne",
      slot: { date: "2026-10-30", startHour: 17, endHour: 20 },
      permit: "general",
      performer: { name: "Unknown act", artists: ["Zzq Nobody Knows This Name"], spotifyArtists: [], songs: [], ...extra },
    });

  async function taste(req: ReturnType<typeof request>) {
    qlooUrls.length = 0;
    mockFetch([]);
    const { PlanContext } = await import("@/server/agent/context");
    const ctx = new PlanContext(req, OFFLINE, "2026-10-23");
    const [cells] = await Promise.all([ctx.tasteCells(), ctx.places(), ctx.crowdProfile(), ctx.localArtists()]);
    const reads = (type: string) => qlooUrls.filter((u) => u.pathname === "/v2/insights" && u.searchParams.get("filter.type") === type);
    return { cells, reads };
  }

  it("genres only (no sound-alike Qloo knows): heatmap, places, crowd and local artists are signalled by the tags", async () => {
    const { cells, reads } = await taste(request({ genreTags: [POP, SOUL] }));
    expect(cells.length).toBeGreaterThan(0);
    for (const type of ["urn:heatmap", "urn:entity:place", "urn:demographics", "urn:entity:artist"]) {
      const sent = reads(type).filter((u) => u.searchParams.get("signal.interests.tags"));
      expect(sent.length, type).toBeGreaterThan(0);
      expect(sent[0].searchParams.get("signal.interests.tags")).toBe(`${POP.id},${SOUL.id}`);
    }
  });

  it("no genres: no tags param anywhere (the calls stay as they were)", async () => {
    const { reads } = await taste(request({}));
    expect(qlooUrls.some((u) => u.searchParams.has("signal.interests.tags"))).toBe(false);
    expect(reads("urn:heatmap")).toHaveLength(0);
  });

  it("an act Qloo knows (own artist): its genres don't join the taste reads", async () => {
    const { reads } = await taste(request({ genreTags: [POP], ownArtist: { qlooId: A.id, name: A.name } }));
    expect(reads("urn:heatmap").length).toBeGreaterThan(0);
    expect(reads("urn:heatmap").every((u) => !u.searchParams.has("signal.interests.tags"))).toBe(true);
  });
});
