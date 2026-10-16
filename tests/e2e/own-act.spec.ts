import { addTypedSong, EXPLANATIONS_LABEL, expect, isoDay, LOCAL, openDetails, pickDate, SATURDAY, SUNDAY, test, waitForPlan } from "./fixtures";
import { serverDay } from "./clock";

test.describe("own act", () => {
  test.skip(!LOCAL, "Starts the agent automatically; local offline server only");

  test("a typed performer and songs open a plan and start the agent", async ({ page }) => {
    await page.goto("/busks");
    const form = page.getByRole("form", { name: "Plan for your own act" });
    await form.getByLabel("Act name").fill("Jess on guitar");
    await form.getByLabel("Artists you sound like").fill("Paul Kelly, Missy Higgins");
    for (const song of ["How to Make Gravy - Paul Kelly", "Scar - Missy Higgins", "My Laneway Song - Jess (own)"]) await addTypedSong(form, song);
    await expect(form.getByRole("list", { name: "Songs you picked" }).getByRole("listitem")).toHaveCount(3);
    await form.getByRole("button", { name: "Plan my busk" }).click();

    await expect(page).toHaveURL(/\/p\/[0-9A-Za-z]{9}$/);
    await expect(page.getByRole("heading", { level: 1, name: "Jess on guitar" })).toBeVisible();
    await waitForPlan(page);
    await expect(page.getByText(EXPLANATIONS_LABEL)).toBeVisible();
    await expect((await openDetails(page)).getByText("Your song").first()).toBeVisible();
  });

  test("F25/F26: no song textarea and no Load my songs button; the artist link loads on Enter or blur, once per value", async ({ page }) => {
    await page.goto("/busks");
    const form = page.getByRole("form", { name: "Plan for your own act" });
    await expect(form.getByLabel("Song list")).toHaveCount(0);
    await expect(form.getByRole("button", { name: "Load my songs" })).toHaveCount(0);
    const calls: string[] = [];
    page.on("request", (r) => r.url().includes("/api/repertoire?") && r.url().includes("type=artist") && calls.push(r.url()));
    const link = form.getByLabel("Your Spotify artist link");
    await link.fill("https://open.spotify.com/artist/4gzpq5DPGxSnKTe4SA8HAU");
    await link.press("Enter"); // does not submit the form
    await expect(page).toHaveURL(/\/busks/);
    await expect(form.getByRole("list", { name: "Songs you picked" })).toBeVisible();
    await link.blur(); // same value: no second load
    await link.focus();
    await link.blur();
    expect(calls).toHaveLength(1);
    // A bad value shows an error under the field.
    await link.fill("nope");
    await link.blur();
    await expect(form.getByText(/Paste your artist link/)).toBeVisible();
  });

  test("live search: artist chips, a picked song ranked by the act's artists, and the date picker", async ({ page }) => {
    await page.goto("/busks");
    const form = page.getByRole("form", { name: "Plan for your own act" });
    await form.getByLabel("Act name").fill("Search Tester");

    // Artists: nothing below 3 characters, then live results with photo fallbacks, releases and lazy Last.fm listeners.
    const artistBox = form.getByRole("combobox", { name: "Artists you sound like" });
    await artistBox.pressSequentially("Pa");
    await expect(form.getByText("Type 3 or more letters to search Spotify.")).toBeVisible();
    await artistBox.pressSequentially("u");
    const paul = form.getByRole("listbox", { name: "Artist results" }).getByRole("option", { name: /Paul Kelly/ });
    await expect(paul).toContainText(/\d+ releases/);
    await expect(paul).toContainText(/Last\.fm listeners/);
    await paul.click();
    const chips = form.getByRole("list", { name: "Artists you picked" });
    await expect(chips.getByRole("listitem")).toHaveText([/Paul Kelly/]);
    await expect(artistBox).toHaveValue("");
    // Free text still works, as a typed chip.
    await artistBox.fill("Zzyzx Nobody");
    await form.getByRole("option", { name: "Add “Zzyzx Nobody” as typed" }).click();
    await expect(chips.getByRole("listitem")).toHaveCount(2);
    await expect(chips.getByRole("listitem").nth(1)).toContainText("(typed)");

    // Songs: versions by the act's artists come first (marked), then Spotify's order: cover, title, artist, album and length.
    // These are songs the act already plays, so there is no Learn it menu here.
    const songBox = form.getByRole("combobox", { name: "Search songs on Spotify" });
    await songBox.pressSequentially("Gravy");
    const options = form.getByRole("listbox", { name: "Song results" }).getByRole("option");
    await expect(options.first()).toContainText("Paul Kelly · Synthetic Album");
    await expect(options.first()).toContainText("By your artist");
    const song = options.filter({ hasText: "Gravy (synthetic result 1)" });
    await expect(song).toContainText("Synthetic Artist 1 · Synthetic Album");
    await expect(song).toContainText("3:07");
    await expect(song).not.toContainText("By your artist");
    await expect(form.getByRole("button", { name: /^Learn it/ })).toHaveCount(0);
    await song.click();
    const picked = form.getByRole("list", { name: "Songs you picked" });
    await expect(picked.getByRole("listitem")).toHaveCount(1);
    await expect(picked).toContainText("3:07");
    await expect(picked.getByRole("button", { name: /^Learn it/ })).toHaveCount(0);

    // The plan date is today or later.
    const date = form.getByLabel("Date");
    await date.click();
    await expect(page.locator(`[role="gridcell"][data-day="${serverDay(-2)}"]`).first()).toHaveAttribute("data-disabled", "true");
    await page.keyboard.press("Escape");
    const day = isoDay(9);
    await pickDate(page, date, day);

    await form.getByRole("button", { name: "Plan my busk" }).click();
    // The plan opens on its short link; the request (artists with Spotify ids, songs with lengths, the date) is stored behind it.
    await expect(page).toHaveURL(/\/p\/[0-9A-Za-z]{9}$/);
    await expect(page.getByText(new RegExp(`${day}, 6 pm–9 pm`))).toBeVisible();
    await waitForPlan(page);
    // Qloo matched the picked artist (by Spotify id first); the setlist shows lengths. The act's own songs get no Learn it;
    // only "Learn these" suggestions do (opening external searches).
    await expect(page.getByTestId("unmatched-artists")).toContainText("This plan uses the artists Qloo did match: Paul Kelly.");
    const sheet = await openDetails(page);
    await expect(sheet.getByTestId("set-length")).toHaveText("Set length: 3:07 (1 song).");
    await expect(page.getByRole("button", { name: "Learn it: Gravy (synthetic result 1)" })).toHaveCount(0);
    const learn = sheet.getByRole("region", { name: "Learn these" }).getByRole("button", { name: /^Learn it: / }).first();
    await learn.click();
    const menu = page.getByRole("menu");
    await expect(menu.getByRole("menuitem", { name: /Karaoke/ })).toHaveAttribute("href", /youtube\.com\/results\?search_query=.+karaoke/);
    await expect(menu.getByRole("menuitem", { name: /Chords/ })).toHaveAttribute("href", /ultimate-guitar\.com\/search\.php/);
    await expect(menu.getByRole("menuitem", { name: /Lyrics/ })).toHaveAttribute("href", /genius\.com\/search\?q=/);
    for (const item of await menu.getByRole("menuitem").all()) await expect(item).toHaveAttribute("target", "_blank");
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
  });

  test("an artist picked from offline search (a made-up artist) opens a plan (B-003)", async ({ page }) => {
    await page.goto("/busks");
    const form = page.getByRole("form", { name: "Plan for your own act" });
    await form.getByLabel("Act name").fill("Synthetic Pick");
    await form.getByPlaceholder("Search Spotify, e.g. Paul Kelly").fill("Nobody Band Zzq");
    await page.getByRole("option", { name: /Nobody Band Zzq \(synthetic\)/ }).click();
    await expect(form.getByRole("list", { name: "Artists you picked" })).toContainText("Nobody Band Zzq (synthetic)");
    await form.getByRole("button", { name: "Plan my busk" }).click();
    await expect(page).toHaveURL(/\/p\/[0-9A-Za-z]{9}$/, { timeout: 10_000 });
  });

  test("asks for an artist before planning", async ({ page }) => {
    await page.goto("/busks");
    const form = page.getByRole("form", { name: "Plan for your own act" });
    await form.getByLabel("Act name").fill("No artists");
    await form.getByRole("button", { name: "Plan my busk" }).click();
    // One alert, naming the field (B-003), and the same words under the field.
    await expect(form.getByRole("alert")).toContainText("Artists you sound like");
    await expect(form.getByRole("alert")).toContainText("Add at least one artist you sound like.");
    await expect(form.locator("#err-artists")).toHaveText("Add at least one artist you sound like.");
    await expect(page).toHaveURL(/\/busks$/);
  });

  test("a typed plan link (deep link) opens the same plan", async ({ page }) => {
    await page.goto(`/plan?name=Deep%20Link%20Duo&artists=Angus%20%26%20Julia%20Stone&songs=Big%20Jet%20Plane~Angus%20%26%20Julia%20Stone&date=${SUNDAY}&from=12&to=15&permit=general`);
    await expect(page).toHaveURL(/\/p\/[0-9A-Za-z]{9}$/);
    await expect(page.getByRole("heading", { level: 1, name: "Deep Link Duo" })).toBeVisible();
    await expect(page.getByText(`Sunday ${SUNDAY}, 12 pm–3 pm`, { exact: false })).toBeVisible();
    await waitForPlan(page);
  });

  test("a broken plan link explains what is wrong", async ({ page }) => {
    await page.goto("/plan?name=Nobody");
    await expect(page.getByText("We couldn't read this plan")).toBeVisible();
    await expect(page.getByRole("link", { name: "Start again" })).toBeVisible();
  });
});

test.describe("artists Qloo can't match", () => {
  test.skip(!LOCAL, "Relies on the mock's catalogue");

  test("plans with the matched artists and names the unmatched one", async ({ page }) => {
    await page.goto(`/plan?name=Half%20Known&artists=Paul%20Kelly|Zzyzx%20Nobody&date=${SATURDAY}&from=18&to=21`);
    await waitForPlan(page);
    const alert = page.getByTestId("unmatched-artists");
    await expect(alert).toContainText("Qloo couldn't match Zzyzx Nobody");
    await expect(alert).toContainText("This plan uses the artists Qloo did match: Paul Kelly.");
    await expect(page.getByRole("region", { name: "Pitches", exact: true }).getByRole("listitem")).toHaveCount(3);
  });

  test("explains when no artist matched, and still ranks pitches on the other data", async ({ page }) => {
    await page.goto(`/plan?name=Nobody%20Knows&artists=Zzyzx%20Nobody|Qqq%20Unknown&date=${SATURDAY}&from=18&to=21`);
    await waitForPlan(page);
    const alert = page.getByTestId("unmatched-artists");
    await expect(alert).toContainText("Qloo couldn't match Zzyzx Nobody and Qqq Unknown");
    await expect(alert).toContainText("taste is left out");
    await expect(page.getByText("Qloo couldn't match any of your artists, so the agent wasn't run")).toBeVisible();
    // The plan shown isn't Claude's: said so once the run ends.
    await expect(page.getByTestId("agent-fallback")).toContainText("template ones");
  });
});
