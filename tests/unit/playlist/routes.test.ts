import { beforeEach, describe, expect, it, vi } from "vitest";

async function load(env: Record<string, string> = {}) {
  vi.resetModules();
  vi.stubEnv("BUSKMAP_OFFLINE", "1");
  vi.stubEnv("VERCEL", "");
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  const store = await import("@/server/playlist/store");
  store.resetPlaylistStoresForTests();
  const root = await import("@/app/api/playlist/route");
  const songs = await import("@/app/api/playlist/songs/route");
  const one = await import("@/app/api/playlist/songs/[id]/route");
  return { root, songs, one, store };
}

const url = "http://localhost:3100/api/playlist";
const req = (method: string, path = "", body?: unknown, cookie?: string, headers: Record<string, string> = {}) =>
  new Request(url + path, {
    method,
    headers: { "content-type": "application/json", host: "localhost:3100", ...(cookie ? { cookie } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const cookieOf = (res: Response) => res.headers.get("set-cookie")?.split(";")[0] ?? "";
const ctx = (id: string) => ({ params: Promise.resolve({ id }) }) as never;

describe("/api/playlist routes (offline, memory store)", () => {
  beforeEach(() => vi.unstubAllEnvs());

  it("GET never creates a Repertoire and sets no cookie", async () => {
    const { root } = await load();
    const res = await root.GET(req("GET"));
    expect(await res.json()).toEqual({ playlist: null });
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("the first save creates it lazily and sets an httpOnly device cookie; later calls reuse it", async () => {
    const { songs, root } = await load();
    const res = await songs.POST(req("POST", "/songs", { title: "Riptide", artist: "Vance Joy" }));
    expect(res.status).toBe(201);
    const header = res.headers.get("set-cookie")!;
    expect(header).toMatch(/^buskmap_playlist=[A-Za-z0-9_-]{22}; Max-Age=34560000; Path=\/; HttpOnly; SameSite=Lax/);
    const body = await res.json();
    expect(JSON.stringify(body)).not.toContain(cookieOf(res).split("=")[1]);
    expect(body.playlist.songs).toHaveLength(1);

    const cookie = cookieOf(res);
    const again = await songs.POST(req("POST", "/songs", { title: "Scar", artist: "Missy Higgins" }, cookie));
    expect((await again.json()).playlist.songs).toHaveLength(2);
    const got = await (await root.GET(req("GET", "", undefined, cookie))).json();
    expect(got.playlist.songs.map((s: { title: string }) => s.title)).toEqual(["Riptide", "Scar"]);
    expect(got.playlist.revision).toBe(3);
  });

  it("a different cookie, or none, sees an empty Repertoire", async () => {
    const { songs, root } = await load();
    await songs.POST(req("POST", "/songs", { title: "A", artist: "B" }));
    expect((await (await root.GET(req("GET", "", undefined, "buskmap_playlist=" + "z".repeat(22)))).json()).playlist).toBeNull();
  });

  it("answers a repeat with 409 already_added and the 61st song with 409 playlist_full, in plain words", async () => {
    const { songs } = await load();
    let cookie = "";
    for (let i = 0; i < 60; i++) {
      const r = await songs.POST(req("POST", "/songs", { title: `S${i}`, artist: "A" }, cookie));
      cookie ||= cookieOf(r);
    }
    const dup = await songs.POST(req("POST", "/songs", { title: "s0", artist: "a" }, cookie));
    expect(dup.status).toBe(409);
    expect((await dup.json()).error).toEqual({ code: "already_added", message: "That song is already in your Repertoire." });
    const full = await songs.POST(req("POST", "/songs", { title: "S61", artist: "A" }, cookie));
    expect(full.status).toBe(409);
    expect((await full.json()).error.code).toBe("playlist_full");
  });

  it("validates input with a friendly 400", async () => {
    const { songs, one } = await load();
    const bad = await songs.POST(req("POST", "/songs", { title: "", artist: "A" }));
    expect(bad.status).toBe(400);
    expect((await bad.json()).error.code).toBe("invalid_request");
    expect(bad.headers.get("set-cookie")).toBeNull();
    const badState = await one.PATCH(req("PATCH", "/songs/1", { state: "pending" }), ctx("1"));
    expect(badState.status).toBe(400);
  });

  it("moves a song to learned and back, and removes it; unknown ids are 404", async () => {
    const { songs, one } = await load();
    const made = await songs.POST(req("POST", "/songs", { title: "A", artist: "B" }));
    const cookie = cookieOf(made);
    const id = (await made.json()).song.id as string;
    const learned = await one.PATCH(req("PATCH", `/songs/${id}`, { state: "learned" }, cookie), ctx(id));
    expect((await learned.json()).playlist.songs[0].state).toBe("learned");
    const back = await one.PATCH(req("PATCH", `/songs/${id}`, { state: "can_sing" }, cookie), ctx(id));
    expect((await back.json()).playlist.songs[0].state).toBe("can_sing");
    expect((await one.DELETE(req("DELETE", `/songs/nope`, undefined, cookie), ctx("nope"))).status).toBe(404);
    const removed = await one.DELETE(req("DELETE", `/songs/${id}`, undefined, cookie), ctx(id));
    expect((await removed.json()).playlist.songs).toEqual([]);
  });

  it("song routes never create a Repertoire: no cookie is 404 no_playlist", async () => {
    const { one } = await load();
    const res = await one.DELETE(req("DELETE", "/songs/1"), ctx("1"));
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("no_playlist");
  });

  it("PATCH needs the current revision (409 when stale)", async () => {
    const { songs, root } = await load();
    const made = await songs.POST(req("POST", "/songs", { title: "A", artist: "B" }));
    const cookie = cookieOf(made);
    const stale = await root.PATCH(req("PATCH", "", { revision: 1, actName: "Jess" }, cookie));
    expect(stale.status).toBe(409);
    expect((await stale.json()).error.code).toBe("stale");
    const ok = await root.PATCH(req("PATCH", "", { revision: 2, actName: "Jess" }, cookie));
    expect((await ok.json()).playlist).toMatchObject({ actName: "Jess", revision: 3 });
  });

  it("DELETE forgets it and clears the cookie", async () => {
    const { songs, root } = await load();
    const cookie = cookieOf(await songs.POST(req("POST", "/songs", { title: "A", artist: "B" })));
    const res = await root.DELETE(req("DELETE", "", undefined, cookie));
    expect(res.headers.get("set-cookie")).toMatch(/Max-Age=0/);
    expect((await (await root.GET(req("GET", "", undefined, cookie))).json()).playlist).toBeNull();
  });

  it("refuses a mutation whose Origin is another site", async () => {
    const { songs } = await load();
    const res = await songs.POST(req("POST", "/songs", { title: "A", artist: "B" }, undefined, { origin: "https://evil.example" }));
    expect(res.status).toBe(403);
    expect(res.headers.get("set-cookie")).toBeNull();
    const same = await songs.POST(req("POST", "/songs", { title: "A", artist: "B" }, undefined, { origin: "http://localhost:3100" }));
    expect(same.status).toBe(201);
  });

  it("503s on Vercel without a database instead of pretending to save", async () => {
    const { root } = await load({ VERCEL: "1" });
    vi.stubEnv("BUSKMAP_OFFLINE", "");
    vi.resetModules();
    const fresh = await import("@/app/api/playlist/route");
    const res = await fresh.GET(req("GET"));
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe("unavailable");
    void root;
  });
});

describe("the creation limit: 10 new Repertoires an hour per IP", () => {
  it("refuses the 11th, counts only new ones, and is off offline", async () => {
    vi.resetModules();
    const { createRateLimiter, playlistCreateGate } = await import("@/server/rate-limit");
    const limiter = createRateLimiter(10, 60 * 60_000);
    const t = Date.now();
    for (let i = 0; i < 10; i++) expect(playlistCreateGate({ offline: false, ip: "1.1.1.1" }, limiter, t)).toEqual({ ok: true });
    const refused = playlistCreateGate({ offline: false, ip: "1.1.1.1" }, limiter, t + 60_000);
    expect(refused).toMatchObject({ ok: false });
    expect(refused.ok === false && refused.retryAfterS).toBe(59 * 60);
    expect(playlistCreateGate({ offline: false, ip: "2.2.2.2" }, limiter, t)).toEqual({ ok: true });
    expect(playlistCreateGate({ offline: true, ip: "1.1.1.1" }, limiter, t)).toEqual({ ok: true });
  });

  it("answers 429 limit with Retry-After on the 11th create from one IP (live mode, memory store)", async () => {
    vi.resetModules();
    vi.stubEnv("BUSKMAP_OFFLINE", "");
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("DATABASE_URL", "");
    const { songs } = { songs: await import("@/app/api/playlist/songs/route") };
    const make = () => songs.POST(req("POST", "/songs", { title: "A", artist: "B" }, undefined, { "x-real-ip": "9.9.9.9" }));
    for (let i = 0; i < 10; i++) expect((await make()).status).toBe(201);
    const res = await make();
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toMatch(/^\d+$/);
    expect((await res.json()).error.code).toBe("limit");
  });
});
