import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { checksum, runMigrations, statements } from "../../../scripts/migrate-lib.mjs";
import { parseSpotifyArtistId, spotifyArtistUrl } from "@/lib/spotify-link";

const ID = "4gzpq5DPGxSnKTe4SA8HAU";

async function load() {
  vi.resetModules();
  vi.stubEnv("BUSKMAP_OFFLINE", "1");
  vi.stubEnv("VERCEL", "");
  const store = await import("@/server/playlist/store");
  store.resetPlaylistStoresForTests();
  const root = await import("@/app/api/playlist/route");
  const songs = await import("@/app/api/playlist/songs/route");
  return { root, songs };
}
const req = (method: string, body?: unknown, cookie?: string) =>
  new Request("http://localhost:3100/api/playlist", {
    method,
    headers: { "content-type": "application/json", host: "localhost:3100", ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const cookieOf = (res: Response) => res.headers.get("set-cookie")?.split(";")[0] ?? "";

describe("the act profile in the Repertoire (act name, artists you sound like, Spotify profile)", () => {
  beforeEach(() => vi.unstubAllEnvs());

  it("a Repertoire with none of it (an old row) reads as null, empty, null", async () => {
    const { root, songs } = await load();
    const made = await songs.POST(new Request("http://localhost:3100/api/playlist/songs", { method: "POST", headers: { "content-type": "application/json", host: "localhost:3100" }, body: JSON.stringify({ title: "A", artist: "B" }) }));
    const got = (await (await root.GET(req("GET", undefined, cookieOf(made)))).json()).playlist;
    expect(got).toMatchObject({ actName: null, soundsLike: [], spotifyArtistId: null });
  });

  it("saves and loads the three fields; a link is stored as its id; null clears", async () => {
    const { root } = await load();
    const created = await root.POST(req("POST", { actName: "Jess", soundsLike: [{ name: "Paul Kelly", spotifyId: ID }], spotifyArtistId: `https://open.spotify.com/artist/${ID}?si=x` }));
    expect(created.status).toBe(201);
    const cookie = cookieOf(created);
    const got = (await (await root.GET(req("GET", undefined, cookie))).json()).playlist;
    expect(got).toMatchObject({ actName: "Jess", soundsLike: [{ name: "Paul Kelly", spotifyId: ID }], spotifyArtistId: ID });

    // Saving only the name leaves the artists and the profile alone.
    const renamed = (await (await root.PATCH(req("PATCH", { revision: got.revision, actName: "Jess Duo" }, cookie))).json()).playlist;
    expect(renamed).toMatchObject({ actName: "Jess Duo", soundsLike: [{ name: "Paul Kelly" }], spotifyArtistId: ID });
    const cleared = (await (await root.PATCH(req("PATCH", { revision: renamed.revision, spotifyArtistId: null }, cookie))).json()).playlist;
    expect(cleared.spotifyArtistId).toBeNull();
    const bare = (await (await root.PATCH(req("PATCH", { revision: cleared.revision, spotifyArtistId: ID }, cookie))).json()).playlist;
    expect(bare.spotifyArtistId).toBe(ID);
  });

  it("validates: name 80, artists 10, the profile must be a Spotify artist link or id", async () => {
    const { root } = await load();
    const cookie = cookieOf(await root.POST(req("POST")));
    const patch = async (body: object) => (await root.PATCH(req("PATCH", { revision: 1, ...body }, cookie))).status;
    expect(await patch({ actName: "x".repeat(81) })).toBe(400);
    expect(await patch({ soundsLike: Array.from({ length: 11 }, (_, i) => ({ name: `A${i}` })) })).toBe(400);
    expect(await patch({ spotifyArtistId: "https://open.spotify.com/track/" + ID })).toBe(400);
    expect(await patch({ spotifyArtistId: "not a link" })).toBe(400);
    expect(await patch({ actName: "x".repeat(80), soundsLike: Array.from({ length: 10 }, (_, i) => ({ name: `A${i}` })) })).toBe(200);
  });

  it("reads and writes the profile snapshot and the Qloo artist id (null by default)", async () => {
    const { root } = await load();
    const created = await root.POST(req("POST"));
    const cookie = cookieOf(created);
    const first = (await created.json()).playlist;
    expect(first).toMatchObject({ spotifyProfile: null, qlooArtistId: null });
    const profile = { name: "Jess", images: [{ url: "https://i.scdn.co/x", width: 640, height: 640 }], genres: ["folk"], followers: 12, fetchedAt: "2026-10-17T00:00:00Z" };
    const saved = (await (await root.PATCH(req("PATCH", { revision: first.revision, spotifyProfile: profile, qlooArtistId: "ABC-123" }, cookie))).json()).playlist;
    expect(saved).toMatchObject({ spotifyProfile: profile, qlooArtistId: "ABC-123" });
    expect((await root.PATCH(req("PATCH", { revision: saved.revision, spotifyProfile: { name: "x" } }, cookie))).status).toBe(400);
    const cleared = (await (await root.PATCH(req("PATCH", { revision: saved.revision, spotifyProfile: null, qlooArtistId: null }, cookie))).json()).playlist;
    expect(cleared).toMatchObject({ spotifyProfile: null, qlooArtistId: null });
  });

  it("parses the link forms", () => {
    expect(parseSpotifyArtistId(`https://open.spotify.com/intl-es/artist/${ID}`)).toBe(ID);
    expect(parseSpotifyArtistId(`spotify:artist:${ID}`)).toBe(ID);
    expect(parseSpotifyArtistId(ID)).toBe(ID);
    expect(parseSpotifyArtistId("hello")).toBeNull();
    expect(spotifyArtistUrl(ID)).toBe(`https://open.spotify.com/artist/${ID}`);
  });
});

describe("migration 008", () => {
  const dir = path.join(process.cwd(), "migrations");
  const sql = readFileSync(path.join(dir, "008_act_profile.sql"), "utf8");

  it("is idempotent, adds the spotify_artist_id column and has no backfill", () => {
    for (const s of statements(sql)) expect(s).toMatch(/ADD COLUMN IF NOT EXISTS/);
    expect(sql).toMatch(/spotify_artist_id TEXT CHECK/);
    expect(sql).toMatch(/spotify_profile JSONB/);
    expect(sql).toMatch(/qloo_artist_id TEXT/);
    expect(sql).not.toMatch(/\bUPDATE\b|\bINSERT\b/i);
  });

  function fake(recorded: Record<string, string> = {}) {
    const table = new Map(Object.entries(recorded));
    const ran: string[] = [];
    const client = {
      async query(text: string) {
        return text.startsWith("SELECT filename") ? [...table].map(([filename, checksum]) => ({ filename, checksum })) : [];
      },
      async transaction(build: (txn: { query: (t: string, p?: unknown[]) => { text: string; params?: unknown[] } }) => { text: string; params?: unknown[] }[]) {
        for (const q of build({ query: (text, params) => ({ text, params }) })) {
          if (q.text.startsWith("INSERT INTO schema_migrations")) table.set((q.params as string[])[0], (q.params as string[])[1]);
          else ran.push(q.text);
        }
      },
    };
    return { client, table, ran };
  }

  it("applies on an empty database, in name order after 006", async () => {
    const { client, table } = fake();
    const logs: string[] = [];
    await runMigrations({ sql: client, dir, log: (m: string) => logs.push(m) });
    expect(logs.some((l) => l.startsWith("applied 008_act_profile.sql"))).toBe(true);
    expect([...table.keys()]).toEqual(readdirSync(dir).filter((f) => f.endsWith(".sql")).sort());
  });

  it("a late 007 still applies after 008 is recorded", async () => {
    const tmp = mkdtempSync(path.join(tmpdir(), "migrations-"));
    const eight = "ALTER TABLE playlists ADD COLUMN IF NOT EXISTS x INT;";
    writeFileSync(path.join(tmp, "008_act_profile.sql"), eight);
    writeFileSync(path.join(tmp, "007_week.sql"), "CREATE TABLE IF NOT EXISTS week (x int);");
    const { client, ran } = fake({ "008_act_profile.sql": checksum(eight) });
    const result = await runMigrations({ sql: client, dir: tmp, log: () => {} });
    expect(result).toEqual({ applied: ["007_week.sql"], skipped: ["008_act_profile.sql"] });
    expect(ran).toEqual(["CREATE TABLE IF NOT EXISTS week (x int)"]);
  });
});
