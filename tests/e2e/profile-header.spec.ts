import { expect, LOCAL, test } from "./fixtures";

/**
 * The Spotify profile header and Qloo "Artists you sound like" suggestions (offline: made-up Spotify artist, the Qloo mock).
 * A catalogue artist in the mock is known to Qloo, so it gets suggestions; any other id gets the quiet line.
 */
type Page = import("@playwright/test").Page;
const form = (page: Page) => page.getByRole("form", { name: "Plan for your own act" });
const state = async (page: Page) => (await (await page.request.get("/api/playlist")).json()).playlist;
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

  // The /repertoire half (Load, Refresh profile, the unknown artist) moved to repertoire-research.spec.ts: the page is the research run now.

  test("the busk form shows the header and suggestions; adding one is for this busk only, never shown as typed, and offers no save", async ({ page }) => {
    const id = await idOf(page, "Paul Kelly");
    await page.request.post("/api/playlist", { data: { spotifyArtistId: id, songs: [{ title: "Synthetic Song", artist: "Paul Kelly" }] } });
    await page.request.post("/api/playlist/profile");
    const seen = calls(page);
    await page.goto("/busks");
    const f = form(page);
    await expect(f.getByTestId("profile-name")).toHaveText("Paul Kelly");
    await expect(f.getByRole("button", { name: /Refresh profile/ })).toHaveCount(0);
    const suggestions = f.getByTestId("sounds-like-suggestions");
    await expect(suggestions).toBeVisible();
    const first = suggestions.getByRole("listitem").first();
    const name = (await first.locator('[data-slot="chip"]').innerText()).trim();
    await first.getByRole("button", { name: `Add ${name}` }).click();
    const picked = f.getByRole("list", { name: "Artists you picked" });
    await expect(picked).toContainText(name);
    // A Qloo suggestion carries its Spotify id (the mock sends one), so it is not a "Typed" chip.
    await expect(picked).not.toContainText("Typed");
    await expect(f.getByTestId("save-act")).toHaveCount(0);
    await expect(f.getByRole("button", { name: "Save to my Repertoire" })).toHaveCount(0);
    expect((await state(page)).soundsLike).toEqual([]);
    expect(seen.profile).toBe(0);
  });
});
