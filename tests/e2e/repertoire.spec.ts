import AxeBuilder from "@axe-core/playwright";
import { expect, LOCAL, test } from "./fixtures";
import { WIDTHS } from "./layout-helpers";

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"];
const SHOTS = process.env.REPERTOIRE_SHOTS;

type Page = import("@playwright/test").Page;

const NO_MATCH = { status: 200, contentType: "application/json", body: JSON.stringify({ mode: "synthetic", tracks: [] }) };
const routed = new WeakSet<Page>();

/**
 * Adds a song. On an empty Repertoire the page is the research link field only (docs/repertoire-research.md), so the first
 * song (and any "(own)" song, which has no field) goes through the API. Once there is a Repertoire, the way the page offers
 * it when Spotify has no match: open "Add a song", search for "Title - Artist", then "Add as typed".
 */
async function add(page: Page, text: string, accepted = true) {
  const own = /\(own\)\s*$/i.test(text);
  const search = page.getByRole("combobox", { name: "Search songs on Spotify" });
  const trigger = page.getByRole("button", { name: "Add a song", exact: true });
  if (own || (await trigger.count()) === 0) {
    const [title, artist] = text.replace(/\(own\)\s*$/i, "").trim().split(/\s+-\s+/);
    const res = await page.request.post("/api/playlist/songs", { data: { title, artist, own, source: "typed" } });
    expect(res.ok()).toBe(accepted);
    await page.reload();
    return;
  }
  if (!routed.has(page)) {
    routed.add(page);
    await page.route("**/api/repertoire?type=tracks*", (route) => route.fulfill(NO_MATCH));
  }
  if (!(await search.isVisible())) await trigger.click();
  const box = search;
  // Typed before hydration, the query is lost: retry until the type-it-in form shows.
  await expect(async () => {
    await box.fill("");
    await box.fill(text);
    await expect(page.getByTestId("type-it-in")).toBeVisible({ timeout: 1500 });
  }).toPass();
  await page.getByTestId("type-it-in").getByRole("button", { name: "Add as typed" }).click();
  // The box clears once the server has answered: the next add must not type into the old value.
  await expect(box).toHaveValue(accepted ? "" : text);
}

/** The empty Repertoire page: the research link field, nothing else. */
const emptyPage = (page: Page) => expect(page.getByLabel("Your Spotify artist", { exact: true })).toBeVisible();

test.describe("Repertoire storage (offline, memory store)", () => {
  test.skip(!LOCAL, "Writes to the local offline server's memory store");

  test("a first save creates it, a reload keeps it, remove and move work", async ({ page }) => {
    await page.goto("/repertoire");
    await expect(page.getByRole("heading", { level: 1, name: "Your Repertoire" })).toBeVisible();
    await emptyPage(page);
    // Browsing created nothing and set no cookie.
    expect((await page.context().cookies()).some((c) => c.name === "buskmap_playlist")).toBe(false);

    await add(page, "How to Make Gravy - Paul Kelly");
    await expect(page.getByRole("list", { name: "Songs you can sing" })).toContainText("How to Make Gravy");
    await add(page, "Scar - Missy Higgins");
    await add(page, "My Laneway Song - Jess (own)");
    const list = page.getByRole("list", { name: "Songs you can sing" });
    await expect(list.getByRole("listitem")).toHaveCount(3);
    await expect(page.getByText("3 songs")).toBeVisible();

    // The cookie is httpOnly and holds a 22-character token that never shows in the page or its URL.
    const cookie = (await page.context().cookies()).find((c) => c.name === "buskmap_playlist")!;
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: "Lax" });
    expect(cookie.value).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(page.url()).not.toContain(cookie.value);
    expect(await page.content()).not.toContain(cookie.value);
    expect(await page.evaluate(() => document.cookie)).not.toContain("buskmap_playlist");

    // A repeat gets a friendly message.
    await add(page, "scar - missy higgins", false);
    await expect(page.getByRole("alert").filter({ hasText: "already in your Repertoire" })).toBeVisible();
    await expect(list.getByRole("listitem")).toHaveCount(3);

    // Reload: still there (the cookie).
    await page.reload();
    await expect(page.getByRole("list", { name: "Songs you can sing" }).getByRole("listitem")).toHaveCount(3);

    // Remove one.
    await page.getByRole("button", { name: "Remove Scar" }).click();
    await expect(page.getByRole("list", { name: "Songs you can sing" }).getByRole("listitem")).toHaveCount(2);
    await expect(page.getByRole("list", { name: "Songs you can sing" })).not.toContainText("Scar");

    // Learned → can sing. Songs reach Learned through the learn flow later; here the API puts one there.
    const state = await page.request.get("/api/playlist");
    const gravy = (await state.json()).playlist.songs.find((s: { title: string }) => s.title === "How to Make Gravy");
    const moved = await page.request.patch(`/api/playlist/songs/${gravy.id}`, { data: { state: "learned" } });
    expect(moved.ok()).toBe(true);
    await page.reload();
    const learned = page.getByRole("list", { name: "Learned", exact: true });
    await expect(learned).toContainText("How to Make Gravy");
    await expect(page.getByRole("list", { name: "Songs you can sing" })).not.toContainText("How to Make Gravy");
    await page.getByRole("button", { name: /^Move to can sing: How to Make Gravy/ }).click();
    await expect(page.getByRole("list", { name: "Songs you can sing" })).toContainText("How to Make Gravy");
    await expect(page.getByText("Songs you learn from suggestions show up here.")).toBeVisible();
  });

  test("focus stays in the list after Remove and Move, and lands on the add field when a list empties (B-016)", async ({ page }) => {
    await page.goto("/repertoire");
    for (const text of ["One - Artist", "Two - Artist", "Three - Artist"]) await add(page, text);
    // A middle row: the next row's Remove.
    await page.getByRole("button", { name: "Remove Two" }).click();
    await expect(page.getByRole("button", { name: "Remove Three" })).toBeFocused();
    // The last row: the previous row's Remove.
    await page.getByRole("button", { name: "Remove Three" }).click();
    await expect(page.getByRole("button", { name: "Remove One" })).toBeFocused();
    // Learned rows: Move goes to the next row's Move, Remove to the next row's Remove.
    await add(page, "Four - Artist");
    await add(page, "Five - Artist");
    const all = (await (await page.request.get("/api/playlist")).json()).playlist.songs as { id: string; title: string }[];
    for (const song of all.filter((s) => ["Four", "Five"].includes(s.title))) await page.request.patch(`/api/playlist/songs/${song.id}`, { data: { state: "learned" } });
    await page.reload();
    await page.getByRole("button", { name: /^Move to can sing: Four/ }).click();
    await expect(page.getByRole("button", { name: /^Move to can sing: Five/ })).toBeFocused();
    await page.getByRole("button", { name: "Remove Five" }).click();
    // The Learned list is empty: the page's main field (the research link, as there is no research yet).
    await expect(page.getByLabel("Your Spotify artist", { exact: true })).toBeFocused();
    // The only row of Songs you can sing: also the main field.
    for (const title of ["Four", "One"]) {
      await page.getByRole("button", { name: `Remove ${title}` }).click();
    }
    await expect(page.getByLabel("Your Spotify artist", { exact: true })).toBeFocused();
  });

  test("the Spotify search adds a picked song with its length", async ({ page }) => {
    await page.goto("/repertoire");
    await add(page, "First Song - Someone");
    await page.getByRole("button", { name: "Add a song", exact: true }).click();
    const box = page.getByRole("combobox", { name: "Search songs on Spotify" });
    await box.pressSequentially("Gravy");
    await page.getByRole("listbox", { name: "Song results" }).getByRole("option", { name: /Gravy \(synthetic result 1\)/ }).click();
    const list = page.getByRole("list", { name: "Songs you can sing" });
    await expect(list).toContainText("Gravy (synthetic result 1)");
    await expect(list).toContainText("3:07");
    await page.reload();
    await expect(page.getByRole("list", { name: "Songs you can sing" })).toContainText("Gravy (synthetic result 1)");
  });

  test("a second browser context gets its own empty Repertoire", async ({ browser, baseURL }) => {
    const a = await browser.newContext({ baseURL });
    const b = await browser.newContext({ baseURL });
    const pa = await a.newPage();
    const pb = await b.newPage();
    await pa.goto("/repertoire");
    await add(pa, "Only Mine - Context A");
    await expect(pa.getByRole("list", { name: "Songs you can sing" })).toContainText("Only Mine");
    await pb.goto("/repertoire");
    await emptyPage(pb);
    await add(pb, "Other One - Context B");
    await expect(pb.getByRole("list", { name: "Songs you can sing" })).not.toContainText("Only Mine");
    await pa.reload();
    await expect(pa.getByRole("list", { name: "Songs you can sing" })).not.toContainText("Other One");
    await a.close();
    await b.close();
  });

  test("forget deletes it and clears the cookie", async ({ page }) => {
    await page.goto("/repertoire");
    await add(page, "Gone Soon - Someone");
    await expect(page.getByRole("list", { name: "Songs you can sing" })).toContainText("Gone Soon");
    let nativeDialog = false;
    page.on("dialog", (d) => {
      nativeDialog = true;
      void d.dismiss();
    });
    await page.getByRole("button", { name: "Forget my Repertoire" }).click();
    // A shadcn AlertDialog, never the browser's confirm(): Keep it closes and keeps the Repertoire.
    const confirm = page.getByRole("alertdialog", { name: "Forget your Repertoire?" });
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "Keep it" }).click();
    await expect(confirm).toBeHidden();
    await expect(page.getByRole("list", { name: "Songs you can sing" })).toContainText("Gone Soon");
    await page.getByRole("button", { name: "Forget my Repertoire" }).click();
    await page.getByRole("alertdialog", { name: "Forget your Repertoire?" }).getByRole("button", { name: "Delete my Repertoire" }).click();
    await emptyPage(page);
    expect(nativeDialog).toBe(false);
    await expect
      .poll(async () => (await page.context().cookies()).some((c) => c.name === "buskmap_playlist" && c.value))
      .toBe(false);
  });

  test("the landing and plan pages link to it", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Repertoire", exact: true }).click();
    await expect(page).toHaveURL(/\/repertoire$/);
  });

  for (const width of WIDTHS) {
    test.describe(`at ${width}px`, () => {
      test.use({ viewport: { width, height: 900 } });
      const axeClean = async (page: Page) => {
        const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
        expect(violations.map((v) => `${v.impact} ${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
      };

      test("layout and axe: the empty Repertoire", async ({ page }, info) => {
        test.skip(info.project.name !== "desktop", "width tests run once, in the desktop project");
        await page.goto("/repertoire");
        await emptyPage(page);
        await axeClean(page);
        if (SHOTS) await page.screenshot({ path: `${SHOTS}/r1-repertoire-empty-${width}.png`, fullPage: true });
      });

      test("layout and axe: the Repertoire with songs", async ({ page }, info) => {
        test.skip(info.project.name !== "desktop", "width tests run once, in the desktop project");
        await page.goto("/repertoire");
        await emptyPage(page);
        for (const text of ["Axe Song - Axe Artist", "Second Song - Another Artist (own)"]) await add(page, text);
        await expect(page.getByRole("list", { name: "Songs you can sing" })).toContainText("Axe Song");
        await page.request.patch(`/api/playlist/songs/${(await (await page.request.get("/api/playlist")).json()).playlist.songs[1].id}`, { data: { state: "learned" } });
        await page.reload();
        await expect(page.getByRole("list", { name: "Learned", exact: true })).toBeVisible();
        await axeClean(page);
        // No horizontal page scroll.
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        if (SHOTS) await page.screenshot({ path: `${SHOTS}/r1-repertoire-songs-${width}.png`, fullPage: true });
      });
    });
  }
});
