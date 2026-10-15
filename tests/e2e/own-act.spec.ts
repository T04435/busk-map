import { expect, isoDay, LOCAL, pickDate, test, waitForPlan } from "./fixtures";

test.describe("own act", () => {
  test.skip(!LOCAL, "Starts the agent automatically; local offline server only");

  test("a typed performer and songs open a plan and start the agent", async ({ page }) => {
    await page.goto("/");
    const form = page.getByRole("form", { name: "Plan for your own act" });
    await form.getByLabel("Act name").fill("Jess on guitar");
    await form.getByLabel("Artists you sound like").fill("Paul Kelly, Missy Higgins");
    await form.getByLabel("Song list").fill("How to Make Gravy - Paul Kelly\nScar - Missy Higgins\nMy Laneway Song - Jess (own)");
    await form.getByRole("button", { name: "Plan my set" }).click();

    await expect(page).toHaveURL(/\/plan\?name=Jess/);
    await expect(page.getByRole("heading", { level: 1, name: "Jess on guitar" })).toBeVisible();
    await waitForPlan(page);
    await expect(page.getByText("Explanations: Claude")).toBeVisible();
    await expect(page.getByText("Your song").first()).toBeVisible();
  });

  test("live search: artist chips, a picked song, Learn it links and the date picker", async ({ page }) => {
    await page.goto("/");
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

    // Songs: cover, title, artist, album and length; Learn it opens external searches.
    const songBox = form.getByRole("combobox", { name: "Search songs on Spotify" });
    await songBox.pressSequentially("Gravy");
    const song = form.getByRole("listbox", { name: "Song results" }).getByRole("option").first();
    await expect(song).toContainText("Gravy (synthetic result 1)");
    await expect(song).toContainText("Synthetic Artist 1 · Synthetic Album");
    await expect(song).toContainText("3:07");
    await song.getByRole("button", { name: "Learn it: Gravy (synthetic result 1)" }).click();
    const menu = page.getByRole("menu");
    await expect(menu.getByRole("menuitem", { name: /Karaoke/ })).toHaveAttribute("href", /youtube\.com\/results\?search_query=Gravy.+karaoke/);
    await expect(menu.getByRole("menuitem", { name: /Chords/ })).toHaveAttribute("href", /ultimate-guitar\.com\/search\.php/);
    await expect(menu.getByRole("menuitem", { name: /Lyrics/ })).toHaveAttribute("href", /genius\.com\/search\?q=Gravy/);
    for (const item of await menu.getByRole("menuitem").all()) await expect(item).toHaveAttribute("target", "_blank");
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await song.click();
    const picked = form.getByRole("list", { name: "Songs you picked" });
    await expect(picked.getByRole("listitem")).toHaveCount(1);
    await expect(picked).toContainText("3:07");

    // The plan date is today or later.
    const date = form.getByLabel("Date");
    await date.click();
    await expect(page.locator(`[role="gridcell"][data-day="${isoDay(-2)}"]`).first()).toHaveAttribute("data-disabled", "true");
    await page.keyboard.press("Escape");
    const day = isoDay(9);
    await pickDate(page, date, day);

    await form.getByRole("button", { name: "Plan my set" }).click();
    await expect(page).toHaveURL(new RegExp(`date=${day}`));
    const params = new URL(page.url()).searchParams;
    expect(params.get("artists")).toMatch(/^Paul Kelly~[A-Za-z0-9]{22}\|Zzyzx Nobody\|Synthetic Artist 1$/);
    expect(params.get("songs")).toBe("Gravy (synthetic result 1)~Synthetic Artist 1~187s");
    await waitForPlan(page);
    // Qloo matched the picked artist (by Spotify id first); the setlist shows lengths and Learn it.
    await expect(page.getByTestId("unmatched-artists")).toContainText("This plan uses the artists Qloo did match: Paul Kelly.");
    await expect(page.getByTestId("set-length")).toHaveText("Set length: 3:07 (1 song).");
    await expect(page.getByRole("button", { name: "Learn it: Gravy (synthetic result 1)" })).toBeVisible();
  });

  test("asks for an artist before planning", async ({ page }) => {
    await page.goto("/");
    const form = page.getByRole("form", { name: "Plan for your own act" });
    await form.getByLabel("Act name").fill("No artists");
    await form.getByRole("button", { name: "Plan my set" }).click();
    await expect(form.getByRole("alert")).toHaveText("Add at least one artist you sound like.");
    await expect(page).toHaveURL(/\/$/);
  });

  test("a typed plan link (deep link) opens the same plan", async ({ page }) => {
    await page.goto("/plan?name=Deep%20Link%20Duo&artists=Angus%20%26%20Julia%20Stone&songs=Big%20Jet%20Plane~Angus%20%26%20Julia%20Stone&date=2026-10-25&from=12&to=15&permit=general");
    await expect(page.getByRole("heading", { level: 1, name: "Deep Link Duo" })).toBeVisible();
    await expect(page.getByText(/Sunday 2026-10-25, 12 pm–3 pm/)).toBeVisible();
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
    await page.goto("/plan?name=Half%20Known&artists=Paul%20Kelly|Zzyzx%20Nobody&date=2026-10-24&from=18&to=21");
    await waitForPlan(page);
    const alert = page.getByTestId("unmatched-artists");
    await expect(alert).toContainText("Qloo couldn't match Zzyzx Nobody");
    await expect(alert).toContainText("This plan uses the artists Qloo did match: Paul Kelly.");
    await expect(page.getByRole("region", { name: "Pitches", exact: true }).getByRole("listitem")).toHaveCount(3);
  });

  test("explains when no artist matched, and still ranks pitches on the other data", async ({ page }) => {
    await page.goto("/plan?name=Nobody%20Knows&artists=Zzyzx%20Nobody|Qqq%20Unknown&date=2026-10-24&from=18&to=21");
    await waitForPlan(page);
    const alert = page.getByTestId("unmatched-artists");
    await expect(alert).toContainText("Qloo couldn't match Zzyzx Nobody and Qqq Unknown");
    await expect(alert).toContainText("taste is left out");
    await page.getByRole("button", { name: "Plan with the agent (live)" }).click();
    await expect(page.getByText("Qloo couldn't match any of your artists, so the agent wasn't run")).toBeVisible();
  });
});
