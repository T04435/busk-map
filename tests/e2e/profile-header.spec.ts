import { expect, LOCAL, test } from "./fixtures";

/**
 * The Spotify profile header and Qloo "Artists you sound like" suggestions (offline: made-up Spotify artist, the Qloo mock).
 * A catalogue artist in the mock is known to Qloo, so it gets suggestions; any other id gets the quiet line.
 */
type Page = import("@playwright/test").Page;
const form = (page: Page) => page.getByRole("form", { name: "Plan for your own act" });
const state = async (page: Page) => (await (await page.request.get("/api/playlist")).json()).playlist;
const UNKNOWN = "4gzpq5DPGxSnKTe4SA8HAU";
const idOf = async (page: Page, name: string): Promise<string> => (await (await page.request.get(`/api/repertoire?type=artists&q=${encodeURIComponent(name)}`)).json()).artists[0].id;
const calls = (page: Page) => {
  const seen = { profile: 0, soundsLike: 0 };
  page.on("request", (r) => {
    if (r.url().endsWith("/api/playlist/profile") && r.method() === "POST") seen.profile++;
    if (r.url().endsWith("/api/playlist/sounds-like")) seen.soundsLike++;
  });
  return seen;
};

test.describe("Spotify profile header and sounds-like suggestions (offline)", () => {
  test.skip(!LOCAL, "Writes to the local offline server's memory store");

  test("a saved link loads nothing by itself; Load shows photo mark, name and genres; suggestions are added by hand and saved by hand", async ({ page }) => {
    const id = await idOf(page, "Paul Kelly");
    await page.request.post("/api/playlist", { data: { spotifyArtistId: id } });
    const seen = calls(page);
    await page.goto("/repertoire");
    const header = page.getByTestId("profile-header");
    await expect(header.getByRole("button", { name: "Load my Spotify profile" })).toBeVisible();
    expect(seen.profile).toBe(0);
    await expect(page.getByTestId("sounds-like-suggestions")).toHaveCount(0);

    await header.getByRole("button", { name: "Load my Spotify profile" }).click();
    await expect(page.getByTestId("profile-name")).toHaveText("Paul Kelly");
    await expect(header.getByRole("list", { name: "Genres" }).getByRole("listitem").first()).toBeVisible();
    // No photo offline: the hex mark carries the initials.
    await expect(header.locator('[data-slot="hex-cell"]')).toContainText("PK");
    expect(seen.profile).toBe(1);
    const saved = await state(page);
    expect(saved.spotifyProfile.name).toBe("Paul Kelly");
    expect(saved.qlooArtistId).toBeTruthy();

    // Suggestions: never the artist itself, nothing picked for you.
    const suggestions = page.getByTestId("sounds-like-suggestions");
    await expect(suggestions.getByRole("heading", { name: /artists you sound like/i })).toBeVisible();
    await expect(suggestions.getByRole("listitem").filter({ hasText: /^Paul Kelly/ })).toHaveCount(0);
    expect(saved.soundsLike).toEqual([]);
    const first = suggestions.getByRole("listitem").first();
    const name = (await first.locator('[data-slot="chip"]').innerText()).trim();
    await first.getByRole("button", { name: `Add ${name}` }).click();
    await expect(page.getByTestId("act-profile").getByRole("list", { name: "Artists you picked" })).toContainText(name);
    await expect(suggestions.getByRole("button", { name: `Add ${name}` })).toHaveCount(0);
    // Added to the form only: saved when "Save act details" is pressed.
    expect((await state(page)).soundsLike).toEqual([]);
    await page.getByRole("button", { name: "Save act details" }).click();
    await expect.poll(async () => (await state(page)).soundsLike.map((a: { name: string }) => a.name)).toEqual([name]);

    // Reloading the page asks neither Spotify nor refreshes the profile; "Add all" adds the rest.
    await page.reload();
    await expect(page.getByTestId("profile-name")).toHaveText("Paul Kelly");
    expect(seen.profile).toBe(1);
    await page.getByRole("button", { name: "Add all" }).click();
    await expect(page.getByTestId("sounds-like-suggestions")).toHaveCount(0);
    expect((await page.getByTestId("act-profile").getByRole("list", { name: "Artists you picked" }).getByRole("listitem").count())).toBeGreaterThan(1);
  });

  test("a link typed on /repertoire loads the profile once; Refresh profile loads it again, on request", async ({ page }) => {
    const id = await idOf(page, "Courtney Barnett");
    const seen = calls(page);
    await page.goto("/repertoire");
    // The add form remounts when the Repertoire has loaded: type after that.
    await expect(page.getByRole("heading", { name: /songs you can sing/i })).toBeVisible();
    const field = page.getByLabel(/Your Spotify artist profile/);
    await field.fill(`https://open.spotify.com/artist/${id}`);
    await field.press("Enter");
    await expect(page.getByTestId("profile-name")).toHaveText("Courtney Barnett");
    expect(seen.profile).toBe(1);
    await page.getByRole("button", { name: /Refresh profile/ }).click();
    await expect(page.getByRole("status").filter({ hasText: "Profile refreshed." })).toBeVisible();
    expect(seen.profile).toBe(2);
  });

  test("when Qloo doesn't know the artist: the header shows, one quiet line replaces the suggestions, and it is not retried", async ({ page }) => {
    await page.request.post("/api/playlist", { data: { spotifyArtistId: UNKNOWN } });
    const seen = calls(page);
    await page.goto("/repertoire");
    await page.getByRole("button", { name: "Load my Spotify profile" }).click();
    await expect(page.getByTestId("profile-name")).toHaveText("Synthetic Performer");
    await expect(page.getByTestId("profile-header").locator('[data-slot="hex-cell"]')).toContainText("SP");
    await expect(page.getByTestId("sounds-like-note")).toHaveText("Qloo doesn't know this artist yet, so there are no suggestions.");
    await expect(page.getByTestId("sounds-like-suggestions")).toHaveCount(0);
    expect((await state(page)).qlooArtistId).toBeNull();
    await page.reload();
    await expect(page.getByTestId("sounds-like-note")).toBeVisible();
    expect(seen.profile).toBe(1);
  });

  test("the busk form shows the header and suggestions; adding one is an edit, saved only with 'Save to my Repertoire'", async ({ page }) => {
    const id = await idOf(page, "Paul Kelly");
    await page.request.post("/api/playlist", { data: { spotifyArtistId: id, songs: [{ title: "Synthetic Song", artist: "Paul Kelly" }] } });
    await page.request.post("/api/playlist/profile");
    const seen = calls(page);
    await page.goto("/busks");
    const f = form(page);
    await expect(f.getByTestId("profile-name")).toHaveText("Paul Kelly");
    const suggestions = f.getByTestId("sounds-like-suggestions");
    await expect(suggestions).toBeVisible();
    const first = suggestions.getByRole("listitem").first();
    const name = (await first.locator('[data-slot="chip"]').innerText()).trim();
    await first.getByRole("button", { name: `Add ${name}` }).click();
    await expect(f.getByRole("list", { name: "Artists you picked" })).toContainText(name);
    await expect(f.getByTestId("save-act")).toBeVisible();
    expect((await state(page)).soundsLike).toEqual([]);
    await f.getByTestId("save-act").getByRole("button", { name: "Save to my Repertoire" }).click();
    await expect.poll(async () => (await state(page)).soundsLike.map((a: { name: string }) => a.name)).toEqual([name]);
    expect(seen.profile).toBe(0);
  });
});
