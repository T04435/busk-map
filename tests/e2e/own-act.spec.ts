import { EXPLANATIONS_LABEL, expect, isoDay, LOCAL, openDetails, pickDate, SATURDAY, shortDay, SUNDAY, test, waitForPlan } from "./fixtures";
import { serverDay } from "./clock";

test.describe("own act", () => {
  test.skip(!LOCAL, "Starts the agent automatically; local offline server only");

  test("a typed performer and songs open a plan and start the agent", async ({ page }) => {
    await page.goto("/busks");
    const form = page.getByRole("form", { name: "Plan for your own act" });
    await form.getByLabel("Act name").fill("Jess on guitar");
    await form.getByLabel("Artists you sound like").fill("Paul Kelly, Missy Higgins");
    // One song typed in under the search (Spotify has no match for it), just for this busk.
    await page.route("**/api/repertoire?type=tracks*", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ mode: "synthetic", tracks: [] }) }));
    await form.getByRole("button", { name: "Edit for this busk" }).click();
    await form.getByText("+ Add a song just for this busk").click();
    await form.getByRole("combobox", { name: "Search songs on Spotify" }).pressSequentially("My Laneway Song - Jess");
    await form.getByTestId("type-it-in").getByRole("button", { name: "Add as typed" }).click();
    await form.getByRole("button", { name: "Done" }).click();
    await form.getByRole("button", { name: "Plan my busk" }).click();

    await expect(page).toHaveURL(/\/p\/[0-9A-Za-z]{9}$/);
    await expect(page.getByRole("heading", { level: 1, name: "Jess on guitar" })).toBeVisible();
    await waitForPlan(page);
    await expect(page.getByText(EXPLANATIONS_LABEL)).toBeVisible();
    // The song typed just for this busk is in the pitch's suggested set (in the details sheet).
    await expect((await openDetails(page)).getByText("My Laneway Song").first()).toBeVisible();
  });

  test("B-036: a pick closes the song list and keeps focus in the cleared search; the artists hint", async ({ page }) => {
    await page.goto("/busks");
    const form = page.getByRole("form", { name: "Plan for your own act" });
    await expect(form.getByTestId("artists-hint")).toHaveText(/^0 of 10\. Type a comma to add a name that isn.t on Spotify\.$/);
    await form.getByRole("button", { name: "Edit for this busk" }).click();
    await form.getByText("+ Add a song just for this busk").click();
    const box = form.getByPlaceholder("Search songs, e.g. Riptide");
    await expect(async () => {
      await box.fill("");
      await box.fill("Riptide");
      await expect(form.getByRole("option").first()).toBeVisible({ timeout: 1500 });
    }).toPass();
    await form.getByRole("option").first().click();
    await expect(form.getByRole("option")).toHaveCount(0);
    await expect(box).toBeFocused();
    await expect(box).toHaveValue("");
    await expect(form.getByRole("list", { name: "Songs for this busk" }).getByRole("listitem")).toHaveCount(1);
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
    await expect(chips.getByRole("listitem").nth(1)).toContainText("Typed");

    // Songs: versions by the act's artists come first (marked), then Spotify's order: cover, title, artist, album and length.
    // These are songs the act already plays, so there is no Learn it menu here.
    await form.getByRole("button", { name: "Edit for this busk" }).click();
    await form.getByText("+ Add a song just for this busk").click();
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
    const picked = form.getByRole("list", { name: "Songs for this busk" });
    await expect(picked.getByRole("listitem")).toHaveCount(1);
    await expect(picked).toContainText("3:07");
    await expect(picked.getByRole("button", { name: /^Learn it/ })).toHaveCount(0);
    await form.getByRole("button", { name: "Done" }).click();

    // The plan date is today or later.
    const date = form.getByLabel("Date");
    await date.click();
    await expect(page.locator(`[role="gridcell"][data-day="${serverDay(-2)}"]`).first()).toHaveAttribute("data-disabled", "true");
    await page.keyboard.press("Escape");
    const day = isoDay(9);
    await pickDate(page, date, day);
    // Any time is the default; pick the evening so the plan's slot is the fixed 6-9 pm.
    await form.getByRole("radio", { name: /Evening/ }).click();

    await form.getByRole("button", { name: "Plan my busk" }).click();
    // The plan opens on its short link; the request (artists with Spotify ids, songs with lengths, the date) is stored behind it.
    await expect(page).toHaveURL(/\/p\/[0-9A-Za-z]{9}$/);
    await expect(page.getByText(`${shortDay(day)} · 6–9 pm · General permit`).first()).toBeVisible();
    await waitForPlan(page);
    // Qloo matched the picked artist (by Spotify id first); the setlist shows lengths. The act's own songs get no Learn it;
    // only "Learn these" suggestions do (opening external searches).
    await expect(page.getByTestId("unmatched-artists")).toContainText("This plan uses the artists Qloo did match: Paul Kelly.");
    const sheet = await openDetails(page);
    await expect(sheet.getByTestId("set-length")).toHaveText("Set length 3:07 · 1 song");
    await expect(page.getByRole("button", { name: "Learn it: Gravy (synthetic result 1)" })).toHaveCount(0);
    const learn = sheet.getByRole("region", { name: "Songs you should learn" }).getByRole("button", { name: /^Learn it: / }).first();
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

  test("a failed submit focuses the first invalid field and wires it to its error (B-220)", async ({ page }) => {
    await page.goto("/busks");
    const form = page.getByRole("form", { name: "Plan for your own act" });
    await form.getByLabel("Act name").fill("No artists");
    await form.getByRole("button", { name: "Plan my busk" }).click();
    await expect(form.locator("#err-artists")).toBeVisible();
    const field = form.locator("[data-field=artists] input").first();
    await expect(field).toBeFocused();
    await expect(field).toHaveAttribute("aria-invalid", "true");
    await expect(field).toHaveAttribute("aria-describedby", "err-artists");
  });

  test("while planning, the button reads Planning and the form is busy (B-221)", async ({ page }) => {
    await page.route("**/api/plans", async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.continue();
    });
    await page.goto("/busks");
    const form = page.getByRole("form", { name: "Plan for your own act" });
    await form.getByLabel("Act name").fill("Busy Duo");
    await form.getByLabel("Artists you sound like").fill("Paul Kelly");
    await form.getByRole("button", { name: "Plan my busk" }).click();
    const pending = form.getByRole("button", { name: /Planning/ });
    await expect(pending).toBeDisabled();
    await expect(form).toHaveAttribute("aria-busy", "true");
  });

  test("after planning, Back shows the form ready again, not stuck on Planning (user bug, 17 Oct)", async ({ page }) => {
    await page.goto("/busks");
    const form = page.getByRole("form", { name: "Plan for your own act" });
    await form.getByLabel("Act name").fill("Back Again Duo");
    await form.getByLabel("Artists you sound like").fill("Paul Kelly");
    await form.getByRole("button", { name: "Plan my busk" }).click();
    await expect(page).toHaveURL(/\/p\/[0-9A-Za-z]{9}$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/busks/);
    const again = page.getByRole("form", { name: "Plan for your own act" });
    await expect(again.getByRole("button", { name: "Plan my busk" })).toBeEnabled();
    await expect(again.getByRole("button", { name: /Planning/ })).toHaveCount(0);
    await expect(again).not.toHaveAttribute("aria-busy", "true");
  });

  test("Enter in the act name, artist search, song search or Spotify link field never starts a plan (user bug, 17 Oct)", async ({ page }) => {
    let posted = 0;
    await page.route("**/api/plans", async (route) => {
      posted += 1;
      await route.continue();
    });
    await page.goto("/busks");
    const form = page.getByRole("form", { name: "Plan for your own act" });
    await form.getByLabel("Act name").fill("Enter Key Duo");
    await form.getByLabel("Act name").press("Enter");
    await form.getByLabel("Artists you sound like").fill("Paul Kelly");
    await form.getByLabel("Artists you sound like").press("Enter");
    await form.getByRole("button", { name: "Edit for this busk" }).click();
    await form.getByText("+ Add a song just for this busk").click();
    const link = form.getByLabel(/Your Spotify artist profile/);
    if (await link.count()) {
      await link.fill("https://open.spotify.com/artist/0000000000000000000000");
      await link.press("Enter");
    }
    const search = form.getByPlaceholder("Search songs, e.g. Riptide");
    await search.fill("Riptide");
    await search.press("Enter");
    await page.waitForTimeout(800);
    expect(posted).toBe(0);
    await expect(page).toHaveURL(/\/busks/);
    await expect(form.getByRole("button", { name: /Planning/ })).toHaveCount(0);
  });

  test("a typed plan link (deep link) opens the same plan", async ({ page }) => {
    await page.goto(`/plan?name=Deep%20Link%20Duo&artists=Angus%20%26%20Julia%20Stone&songs=Big%20Jet%20Plane~Angus%20%26%20Julia%20Stone&date=${SUNDAY}&from=12&to=15&permit=general`);
    await expect(page).toHaveURL(/\/p\/[0-9A-Za-z]{9}$/);
    await expect(page.getByRole("heading", { level: 1, name: "Deep Link Duo" })).toBeVisible();
    await expect(page.getByText(`${shortDay(SUNDAY)} · 12–3 pm · General permit`).first()).toBeVisible();
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
    // ONE alert (B-045): taste is left out, with the way to pick artists from Spotify.
    await expect(alert).toContainText("Qloo couldn't match any of your artists");
    await expect(alert).toContainText("Taste is left out of this plan");
    await expect(page.getByRole("link", { name: "Pick your artists from Spotify" })).toBeVisible();
    // Claude had nothing to research: said once, and no research funnel or feed is drawn.
    await expect(page.getByTestId("agent-fallback")).toContainText("Claude didn't research this busk");
    await expect(page.getByTestId("plan-funnel")).toHaveCount(0);
    await expect(page.getByTestId("agent-stream")).toHaveCount(0);
  });
});

test.describe("F25: a song Spotify doesn't have is one row in the song search", () => {
  test.skip(!LOCAL, "Relies on the mock's catalogue");

  test("splits Title - Artist, says what it saves, and adds it just for this busk", async ({ page }) => {
    await page.goto("/busks");
    const form = page.getByRole("form", { name: "Plan for your own act" });
    await form.getByRole("button", { name: "Edit for this busk" }).click();
    await form.getByText("+ Add a song just for this busk").click();
    const box = form.getByPlaceholder("Search songs, e.g. Riptide");
    await expect(async () => {
      await box.fill("");
      await box.fill("Wild Song - The Nobodies");
      await expect(form.getByRole("option", { name: "Add “Wild Song” by The Nobodies as typed" })).toBeVisible({ timeout: 1500 });
    }).toPass();
    await expect(form.getByText("It's saved without a length, tagged Typed. Edit the title or artist any time.")).toBeVisible();
    await form.getByRole("option", { name: /as typed/ }).last().click();
    const picked = form.getByRole("list", { name: "Songs for this busk" });
    await expect(picked).toContainText("Wild Song");
    await expect(picked).toContainText("The Nobodies");
    await expect(picked).toContainText("Just for this busk");
    // A title with no dash has no "by".
    await box.fill("Mystery Tune");
    await expect(form.getByRole("option", { name: "Add “Mystery Tune” as typed" })).toBeVisible();
  });
});
