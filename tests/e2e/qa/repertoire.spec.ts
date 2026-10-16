/**
 * QA: Repertoire R1 (fa348e3, b4cf4f1, cbda583). The API paths DEV's spec doesn't cover: limits, 409s, Origin,
 * cross-device ids, a forged cookie, and that plans and examples never write a Repertoire. Offline server only
 * (memory store); every test has its own browser context, so its own cookie jar.
 */
import { expect, LOCAL, test } from "../fixtures";

type Api = import("@playwright/test").APIRequestContext;

const add = (api: Api, title: string, artist: string, headers?: Record<string, string>) =>
  api.post("/api/playlist/songs", { data: { title, artist }, headers });
const view = async (api: Api) => (await (await api.get("/api/playlist")).json()).playlist;
const tokenOf = (setCookie: string | undefined) => /buskmap_playlist=([^;]*)/.exec(setCookie ?? "")?.[1] ?? null;

test.describe("QA Repertoire API", () => {
  test.skip(!LOCAL, "Writes Repertoires; local offline server only");

  test("GET never creates; the first save sets the cookie with the right flags", async ({ request }) => {
    const before = await request.get("/api/playlist");
    expect(await before.json()).toEqual({ playlist: null });
    expect(before.headers()["set-cookie"]).toBeUndefined();
    expect(before.headers()["cache-control"]).toContain("no-store");

    const first = await add(request, "Riptide", "Vance Joy");
    expect(first.status()).toBe(201);
    const cookie = first.headers()["set-cookie"];
    expect(tokenOf(cookie)).toMatch(/^[A-Za-z0-9_-]{22}$/);
    for (const flag of ["HttpOnly", "SameSite=Lax", "Path=/", `Max-Age=${400 * 24 * 60 * 60}`]) expect(cookie).toContain(flag);
    // Offline test server runs on http, so no Secure here; production adds it (token.ts, secureCookie()).
    const body = await first.json();
    expect(JSON.stringify(body)).not.toContain(tokenOf(cookie)!);
    expect(body.playlist.songs).toHaveLength(1);
  });

  test("a duplicate is refused, whatever the case, punctuation or remaster suffix", async ({ request }) => {
    expect((await add(request, "Riptide", "Vance Joy")).status()).toBe(201);
    for (const [title, artist] of [["riptide", "vance joy"], ["Riptide!", "Vance  Joy"], ["Riptide - Remastered 2011", "Vance Joy"]]) {
      const again = await add(request, title, artist);
      expect(again.status(), `${title} / ${artist}`).toBe(409);
      expect((await again.json()).error.code).toBe("already_added");
    }
    expect((await view(request)).songs).toHaveLength(1);
  });

  test("60 songs fit; the 61st is refused with playlist_full, and moving or removing still works", async ({ request }) => {
    for (let i = 1; i <= 60; i++) expect((await add(request, `Song ${i}`, `Artist ${i}`)).status(), `song ${i}`).toBe(201);
    const full = await add(request, "Song 61", "Artist 61");
    expect(full.status()).toBe(409);
    const err = (await full.json()).error;
    expect(err.code).toBe("playlist_full");
    expect(err.message).toContain("60");
    const songs = (await view(request)).songs;
    expect(songs).toHaveLength(60);
    // Learned counts toward the 60 too: moving doesn't free a slot.
    expect((await request.patch(`/api/playlist/songs/${songs[0].id}`, { data: { state: "learned" } })).ok()).toBe(true);
    expect((await add(request, "Song 61", "Artist 61")).status()).toBe(409);
    // Removing does.
    expect((await request.delete(`/api/playlist/songs/${songs[1].id}`)).ok()).toBe(true);
    expect((await add(request, "Song 61", "Artist 61")).status()).toBe(201);
  });

  test("PATCH needs the latest revision: a stale one is 409 stale and changes nothing", async ({ request }) => {
    await add(request, "Riptide", "Vance Joy");
    const r1 = (await view(request)).revision;
    const ok = await request.patch("/api/playlist", { data: { revision: r1, actName: "QA Duo" } });
    expect(ok.status()).toBe(200);
    const after = (await ok.json()).playlist;
    expect(after.revision).toBeGreaterThan(r1);
    const stale = await request.patch("/api/playlist", { data: { revision: r1, actName: "Overwritten" } });
    expect(stale.status()).toBe(409);
    expect((await stale.json()).error.code).toBe("stale");
    expect((await view(request)).actName).toBe("QA Duo");
  });

  test("bad input is 400 with no write", async ({ request }) => {
    expect((await request.post("/api/playlist/songs", { data: "not json", headers: { "content-type": "application/json" } })).status()).toBe(400);
    expect((await add(request, "", "Vance Joy")).status()).toBe(400);
    expect((await add(request, "x".repeat(500), "Vance Joy")).status()).toBe(400);
    expect((await request.patch("/api/playlist/songs/whatever", { data: { state: "dismissed" } })).status()).toBe(400);
    expect(await view(request)).toBeNull();
  });

  test("a cross-site Origin is refused (403 bad_origin) on every mutating route, and writes nothing", async ({ request }) => {
    const evil = { origin: "https://evil.example" };
    const res = await add(request, "Riptide", "Vance Joy", evil);
    expect(res.status()).toBe(403);
    expect((await res.json()).error.code).toBe("bad_origin");
    expect(res.headers()["set-cookie"]).toBeUndefined();
    expect((await request.post("/api/playlist", { headers: evil })).status()).toBe(403);
    expect(await view(request)).toBeNull();

    await add(request, "Riptide", "Vance Joy");
    const id = (await view(request)).songs[0].id;
    expect((await request.patch(`/api/playlist/songs/${id}`, { data: { state: "learned" }, headers: evil })).status()).toBe(403);
    expect((await request.delete(`/api/playlist/songs/${id}`, { headers: evil })).status()).toBe(403);
    expect((await request.delete("/api/playlist", { headers: evil })).status()).toBe(403);
    expect((await view(request)).songs).toHaveLength(1);
    // A sandboxed frame sends Origin: null.
    expect((await add(request, "Scar", "Missy Higgins", { origin: "null" })).status()).toBe(403);
  });

  test("another device's song id is not found, and nothing changes for its owner", async ({ request, playwright, baseURL }) => {
    await add(request, "Riptide", "Vance Joy");
    const id = (await view(request)).songs[0].id;
    const other = await playwright.request.newContext({ baseURL });
    try {
      expect((await other.delete(`/api/playlist/songs/${id}`)).status()).toBe(404); // no Repertoire at all
      await add(other, "Scar", "Missy Higgins");
      const del = await other.delete(`/api/playlist/songs/${id}`);
      expect(del.status()).toBe(404);
      expect((await del.json()).error.code).toBe("song_not_found");
      expect((await other.patch(`/api/playlist/songs/${id}`, { data: { state: "learned" } })).status()).toBe(404);
    } finally {
      await other.dispose();
    }
    expect((await view(request)).songs).toEqual([expect.objectContaining({ id, state: "can_sing" })]);
  });

  test("a forged or unknown cookie gets no Repertoire, and a save issues a fresh token (no fixation)", async ({ playwright, baseURL }) => {
    const forged = "AAAAAAAAAAAAAAAAAAAAAA"; // well-formed, never issued
    const api = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { cookie: `buskmap_playlist=${forged}` } });
    try {
      expect(await view(api)).toBeNull();
      const save = await add(api, "Riptide", "Vance Joy");
      expect(save.status()).toBe(201);
      const issued = tokenOf(save.headers()["set-cookie"]);
      expect(issued).toMatch(/^[A-Za-z0-9_-]{22}$/);
      expect(issued).not.toBe(forged);
    } finally {
      await api.dispose();
    }
  });
});

test.describe("QA Repertoire: plans and examples never write one", () => {
  test.skip(!LOCAL, "Offline server only");

  test("browsing every example, a week, a custom plan and the brain sets no cookie and creates nothing", async ({ page }) => {
    const writes: string[] = [];
    page.on("request", (r) => r.url().includes("/api/playlist") && r.method() !== "GET" && writes.push(`${r.method()} ${r.url()}`));
    for (const path of ["/", "/plan?example=acoustic", "/plan?example=sax", "/plan?example=folk-duo", "/week?example=sax", "/brain", "/tips", "/repertoire"]) {
      await page.goto(path);
      // An example link redirects on the client to its short link /p/<id>, then the plan streams.
      if (path.startsWith("/plan?example=")) await expect(page.getByRole("region", { name: "Pitches", exact: true })).toBeVisible();
      else await page.waitForLoadState("domcontentloaded");
    }
    await expect(page.getByRole("heading", { level: 1, name: "Your Repertoire" })).toBeVisible();
    await expect(page.getByText("No songs yet.")).toBeVisible();
    expect(writes).toEqual([]);
    expect((await page.context().cookies()).some((c) => c.name === "buskmap_playlist")).toBe(false);
    expect(await view(page.request)).toBeNull();
  });
});

test.describe("QA Repertoire page: keyboard", () => {
  test.skip(!LOCAL, "Writes a Repertoire");

  test("add with Enter, remove with the keyboard, and the status line says what happened", async ({ page }) => {
    await page.goto("/repertoire");
    const field = page.getByPlaceholder(/Title - Artist/i).first();
    await field.focus();
    await page.keyboard.type("Riptide - Vance Joy");
    await page.keyboard.press("Enter");
    const list = page.getByRole("list", { name: "Songs you can sing" });
    await expect(list.getByRole("listitem")).toHaveCount(1);
    const remove = page.getByRole("button", { name: "Remove Riptide" });
    await remove.focus();
    await expect(remove).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("status").filter({ hasText: "Removed Riptide." }).first()).toBeAttached();
    await expect(page.getByText("No songs yet.")).toBeVisible();
    // B-016: focus must not be lost to <body> when the removed button disappears.
    expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe("BODY");
  });

  test("removing a song that isn't the last one keeps focus in the list (B-016)", async ({ page }) => {
    await page.goto("/repertoire");
    const field = page.getByPlaceholder(/Title - Artist/i).first();
    for (const song of ["Riptide - Vance Joy", "Scar - Missy Higgins", "Dumb Things - Paul Kelly"]) {
      await field.fill(song);
      await page.keyboard.press("Enter");
      await expect(page.getByRole("list", { name: "Songs you can sing" }).getByText(song.split(" - ")[0])).toBeVisible();
    }
    await page.getByRole("button", { name: "Remove Scar" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("list", { name: "Songs you can sing" }).getByRole("listitem")).toHaveCount(2);
    expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe("BODY");
  });
});
