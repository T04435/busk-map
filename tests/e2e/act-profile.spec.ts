import { expect, LOCAL, test } from "./fixtures";

/** The Repertoire keeps the act name, the artists you sound like and the Spotify artist profile; the busk form starts from them. Offline, memory store, one cookie jar per test. */
type Page = import("@playwright/test").Page;
const form = (page: Page) => page.getByRole("form", { name: "Plan for your own act" });
const state = async (page: Page) => (await (await page.request.get("/api/playlist")).json()).playlist;
const ID = "4gzpq5DPGxSnKTe4SA8HAU";
const LINK = `https://open.spotify.com/artist/${ID}`;
const profileCalls = (page: Page) => {
  const calls: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/repertoire") && r.url().includes("type=artist")) calls.push(r.url());
  });
  return calls;
};

test.describe("the act profile in the Repertoire (offline)", () => {
  test.skip(!LOCAL, "Writes to the local offline server's memory store");

  test("save on /repertoire, the busk form prefills, a busk edit stays on the busk, an explicit save updates it", async ({ page }) => {
    const calls = profileCalls(page);
    await page.goto("/repertoire");
    const act = page.getByTestId("act-profile");
    await expect(act.getByRole("button", { name: "Save act details" })).toBeDisabled();
    await act.getByLabel("Act name").fill("Jess on guitar");
    await act.getByLabel("Artists you sound like").fill("Paul Kelly");
    await act.getByLabel("Artists you sound like").press("Enter");
    await act.getByRole("button", { name: "Save act details" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Act details saved." })).toBeVisible();
    expect(await state(page)).toMatchObject({ actName: "Jess on guitar", soundsLike: [{ name: "Paul Kelly" }] });

    // The profile link, loaded once, is kept too.
    await page.getByLabel(/Your Spotify artist profile/).fill(LINK);
    await page.getByLabel(/Your Spotify artist profile/).press("Enter");
    await expect.poll(async () => (await state(page)).spotifyArtistId).toBe(ID);
    expect(calls).toHaveLength(1);

    // The busk form is prefilled with all three, and loading it makes no Spotify profile call.
    await page.goto("/busks");
    const f = form(page);
    await expect(f.getByLabel("Act name")).toHaveValue("Jess on guitar");
    await expect(f.getByRole("list", { name: "Artists you picked" })).toContainText("Paul Kelly");
    await f.getByRole("button", { name: "Edit for this busk" }).click();
    await f.getByText("+ Add a song just for this busk").click();
    await expect(f.getByLabel(/Your Spotify artist profile/)).toHaveValue(LINK);
    await f.getByLabel(/Your Spotify artist profile/).focus();
    await f.getByLabel(/Your Spotify artist profile/).blur();
    await expect(f.getByRole("button", { name: "Refresh my songs" })).toBeVisible();
    expect(calls).toHaveLength(1);
    await expect(f.getByTestId("save-act")).toHaveCount(0);

    // Edit for this busk: the plan request carries the edited values; the Repertoire keeps the saved ones.
    await f.getByLabel("Act name").fill("Jess and Sam");
    await expect(f.getByTestId("save-act")).toBeVisible();
    const posted = page.waitForRequest((r) => r.url().endsWith("/api/plans") && r.method() === "POST");
    await f.getByRole("button", { name: "Plan my busk" }).click();
    expect((await posted).postDataJSON().performer.name).toBe("Jess and Sam");
    await page.goto("/repertoire");
    await expect(page.getByTestId("act-profile").getByLabel("Act name")).toHaveValue("Jess on guitar");
    expect((await state(page)).actName).toBe("Jess on guitar");

    // "Back to my Repertoire" drops the edit; "Save to my Repertoire" keeps it.
    await page.goto("/busks");
    await form(page).getByLabel("Act name").fill("Jess and Sam");
    await form(page).getByRole("button", { name: "Back to my Repertoire" }).click();
    await expect(form(page).getByLabel("Act name")).toHaveValue("Jess on guitar");
    await form(page).getByLabel("Act name").fill("Jess and Sam");
    await form(page).getByRole("button", { name: "Save to my Repertoire" }).click();
    await expect(form(page).getByRole("status").filter({ hasText: "Saved to your Repertoire." })).toBeVisible();
    expect(await state(page)).toMatchObject({ actName: "Jess and Sam", spotifyArtistId: ID, soundsLike: [{ name: "Paul Kelly" }] });
    await page.goto("/repertoire");
    await expect(page.getByTestId("act-profile").getByLabel("Act name")).toHaveValue("Jess and Sam");
  });

  test("a changed profile link loads its songs once and Refresh loads them again, on request only", async ({ page }) => {
    await page.request.post("/api/playlist", { data: { actName: "Jess", spotifyArtistId: LINK } });
    const calls = profileCalls(page);
    await page.goto("/busks");
    const f = form(page);
    await f.getByRole("button", { name: "Edit for this busk" }).click();
    await f.getByText("+ Add a song just for this busk").click();
    const add = f.getByTestId("repertoire-add");
    await expect(add.getByLabel(/Your Spotify artist profile/)).toHaveValue(LINK);
    expect(calls).toHaveLength(0);
    await add.getByRole("button", { name: "Refresh my songs" }).click();
    await expect(add.getByRole("status")).toContainText(/Added \d+ of your songs|Offline test mode/);
    expect(calls).toHaveLength(1);
    await expect(add.getByText(/If you release music/)).toHaveCount(0);
  });
});
