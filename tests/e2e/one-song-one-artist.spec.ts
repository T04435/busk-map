import { EXAMPLES } from "../../src/lib/examples";
import { OFFLINE_TEST_ARTIST } from "../../src/lib/repertoire-research";
import { expect, LOCAL, test, waitForPlan } from "./fixtures";

/**
 * The user's rule (18 Oct 2026): one Song component and one Artist component. On the pages that list songs and artists
 * (/, /p/[id], /repertoire), every place a known song title shows as its own text sits inside [data-slot="song-row"], and
 * every place a known artist name shows sits inside [data-slot="artist-chip"] (or a song row, as the song's artist, or the act's
 * [data-slot="artist-profile"]); inside a sentence the one form is the Mention (hex photo plus the name). The unit twin (tests/unit/one-song-one-artist.test.ts) blocks the markup in source.
 */
type Page = import("@playwright/test").Page;

/** Text nodes whose whole trimmed text is one of `names`, visible, and not inside an allowed slot. */
async function outside(page: Page, names: string[], slots: string): Promise<string[]> {
  return page.evaluate(
    ({ names, slots }) => {
      const wanted = new Set(names.map((n) => n.trim().toLowerCase()).filter(Boolean));
      const found: string[] = [];
      const walker = document.createTreeWalker(document.querySelector("main") ?? document.body, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = (node.textContent ?? "").trim();
        const el = node.parentElement;
        if (!el || !wanted.has(text.toLowerCase())) continue;
        if (el.closest("[hidden], [aria-hidden='true'], .sr-only, script, style, template")) continue;
        const box = el.getBoundingClientRect();
        if (box.width === 0 && box.height === 0) continue;
        if (!el.closest(slots)) found.push(`${text} in <${el.tagName.toLowerCase()} ${el.getAttribute("data-testid") ?? el.className}>`);
      }
      return found;
    },
    { names, slots },
  );
}

// A Mention is the one inline form of a song or an artist inside a sentence (a step line, a reason; user feedback U05/U08).
const SONG = '[data-slot="song-row"], [data-slot="mention"]';
const ARTIST = '[data-slot="artist-chip"], [data-slot="song-row"], [data-slot="artist-profile"], [data-slot="mention"]';

/** Every {title, artist} and every artist {name} in a JSON body (the plan, the playlist, the research). */
function collect(value: unknown, out = { songs: new Set<string>(), artists: new Set<string>() }, key = "") {
  if (Array.isArray(value)) value.forEach((v) => collect(v, out, key));
  else if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    if (typeof o.title === "string" && typeof o.artist === "string") {
      out.songs.add(o.title);
      out.artists.add(o.artist);
    } else if (typeof o.name === "string" && /artist|sound|similar|fan|crowd|scene|because/i.test(key)) out.artists.add(o.name);
    for (const [k, v] of Object.entries(o)) collect(v, out, k);
  } else if (typeof value === "string" && /^artists?$|soundsLike/i.test(key)) out.artists.add(value);
  return out;
}

/** Open every disclosure so the cards inside render. Menus (Learn it) and dialogs (Start over) also say aria-expanded: they are not folds, and one open menu would block the next click. */
async function openFolds(page: Page) {
  for (const fold of await page.locator("main button[aria-expanded='false']:not([aria-haspopup]):not([data-slot='alert-dialog-trigger'])").all()) await fold.click({ timeout: 2000 }).catch(() => undefined);
}

async function expectUnified(page: Page, songs: Iterable<string>, artists: Iterable<string>) {
  expect(await outside(page, [...songs], SONG), "songs rendered outside SongRow").toEqual([]);
  expect(await outside(page, [...artists], ARTIST), "artists rendered outside ArtistChip").toEqual([]);
}

test.describe("one Song, one Artist (unify rule)", () => {
  test.skip(!LOCAL, "Runs the offline agent and the mock artist; local offline server only");

  test("the landing page: every example song and artist is a SongRow or an ArtistChip", async ({ page }) => {
    await page.goto("/");
    const songs = EXAMPLES.flatMap((e) => e.performer.songs.map((s) => s.title));
    const artists = EXAMPLES.flatMap((e) => [...e.performer.artists, ...e.performer.songs.map((s) => s.artist)]);
    await expectUnified(page, songs, artists);
  });

  test("a busk (/p/[id]): the setlist, the crowd and the tool cards use the one Song and one Artist", async ({ page }) => {
    await page.goto("/");
    const example = EXAMPLES[0];
    // Read the plan stream through a route: after the client navigates to /p/[id] the browser drops the
    // response body, so response.text() can fail under load.
    let body = "";
    await page.route("**/api/plan", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      const response = await route.fetch();
      body = await response.text();
      await route.fulfill({ response, body });
    });
    await page.getByRole("link", { name: new RegExp(`^${example.label} `) }).click();
    await expect(page).toHaveURL(/\/p\/[0-9A-Za-z]{9}$/);
    await waitForPlan(page);
    await expect.poll(() => body.length).toBeGreaterThan(0);
    const found = collect(body.split("\n").filter(Boolean).map((line) => JSON.parse(line) as unknown));
    for (const s of example.performer.songs) found.songs.add(s.title);
    for (const a of example.performer.artists) found.artists.add(a);
    // Open every fold so the tool cards and pitch details render too.
    await openFolds(page);
    await expectUnified(page, found.songs, found.artists);
  });

  test("/repertoire: your songs, songs to learn, sound-alikes, fans and the profile use the one components", async ({ page }) => {
    await page.goto("/repertoire");
    await page.getByLabel("Your Spotify artist link").fill(`https://open.spotify.com/artist/${OFFLINE_TEST_ARTIST.spotifyId}`);
    await page.getByRole("button", { name: "Research my act" }).click();
    await expect(page.getByTestId("research-end")).toBeVisible({ timeout: 20_000 });
    const found = collect([await (await page.request.get("/api/playlist")).json(), await (await page.request.get("/api/repertoire")).json()]);
    found.artists.add(OFFLINE_TEST_ARTIST.name);
    await openFolds(page);
    await expectUnified(page, found.songs, found.artists);
  });
});
