import { OFFLINE_TEST_ARTIST } from "../../src/lib/repertoire-research";
import { expect, LOCAL, test } from "./fixtures";

/**
 * The act kept in the Repertoire, filled by Repertoire research (name from Spotify, sound-alikes from Qloo, genre tags), and
 * the busk form that starts from it. Offline, memory store, one cookie jar per test.
 */
type Page = import("@playwright/test").Page;
const form = (page: Page) => page.getByRole("form", { name: "Plan for your own act" });
const state = async (page: Page) => (await (await page.request.get("/api/playlist")).json()).playlist;

async function researched(page: Page) {
  const res = await page.request.post("/api/playlist/research", { data: { link: OFFLINE_TEST_ARTIST.spotifyId } });
  expect(res.ok()).toBe(true);
  await res.text();
}

test.describe("the act profile in the Repertoire (offline)", () => {
  test.skip(!LOCAL, "Writes to the local offline server's memory store");

  test("research fills the act, the busk form prefills from it, and a busk edit stays on the busk", async ({ page }) => {
    await researched(page);
    const saved = await state(page);
    expect(saved).toMatchObject({ actName: OFFLINE_TEST_ARTIST.name, spotifyArtistId: OFFLINE_TEST_ARTIST.spotifyId });
    expect(saved.soundsLike.length).toBe(6);

    await page.goto("/busks");
    const f = form(page);
    await expect(f.getByLabel("Act name")).toHaveValue(OFFLINE_TEST_ARTIST.name);
    await expect(f.getByRole("list", { name: "Artists you picked" })).toContainText(saved.soundsLike[0].name);
    await expect(f.getByTestId("save-act")).toHaveCount(0);

    // Editing the name here is for this busk only; the request carries your genre tags for the local scene.
    await f.getByLabel("Act name").fill("Jess and Sam");
    const posted = page.waitForRequest((r) => r.url().endsWith("/api/plans") && r.method() === "POST");
    await f.getByRole("button", { name: "Plan my busk" }).click();
    const performer = (await posted).postDataJSON().performer;
    expect(performer.name).toBe("Jess and Sam");
    expect(performer.genreTags.length).toBeGreaterThan(0);
    expect((await state(page)).actName).toBe(OFFLINE_TEST_ARTIST.name);
  });
});
