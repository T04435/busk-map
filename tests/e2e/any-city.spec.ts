import AxeBuilder from "@axe-core/playwright";
import { EXAMPLES } from "../../src/lib/examples";
import { OFFLINE_TEST_ARTIST } from "../../src/lib/repertoire-research";
import { serverDay } from "./clock";
import { agentSteps, expect, LOCAL, openDetails, test, waitForPlan } from "./fixtures";

/**
 * V2 2.1 "Any city": the busk form's city search, a plan in another city (offline mode's second city, Tokyo), and
 * Melbourne exactly as before. Offline server, mock model, synthetic geocoder. V2 2.3: Tokyo's pitches stand at
 * OpenStreetMap public spaces (offline: the synthetic Overpass answer, "Synthetic OSM …"), credited to OSM.
 */
type Page = import("@playwright/test").Page;
const form = (page: Page) => page.getByRole("form", { name: "Plan for your own act" });
const cityField = (page: Page) => form(page).getByRole("button", { name: /^City / });
const postedPlan = (page: Page) => page.waitForRequest((r) => r.url().endsWith("/api/plans") && r.method() === "POST");
const map = (page: Page) => page.locator("[data-center]");

/** The map's centre (phones show the map on demand). */
async function mapCentre(page: Page) {
  const show = page.getByRole("button", { name: "Show the map" });
  if (await show.isVisible()) await show.click();
  await map(page).scrollIntoViewIfNeeded();
  return map(page);
}
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"];

async function pickCity(page: Page, query: string, option: string) {
  await cityField(page).click();
  const search = page.getByPlaceholder("Search a city, e.g. Tokyo");
  await expect(search).toBeFocused();
  await search.fill(query);
  await page.getByRole("option", { name: option }).click();
  await expect(cityField(page)).toContainText(option);
}

test.describe("any city (offline)", () => {
  test.skip(!LOCAL, "Local offline server only");

  test("Melbourne is preselected and a Melbourne busk sends no place", async ({ page }) => {
    await page.goto("/busks");
    await expect(cityField(page)).toContainText("Melbourne, Victoria, Australia");
    await form(page).getByLabel("Artists you sound like").fill("Paul Kelly");
    const posted = postedPlan(page);
    await form(page).getByRole("button", { name: "Plan my busk" }).click();
    const body = (await posted).postDataJSON();
    expect(body.city).toBe("melbourne");
    expect(body).not.toHaveProperty("place");
    await expect(page).toHaveURL(/\/p\/[0-9A-Za-z]{9}$/);
    await waitForPlan(page);
    await expect(page.getByText(/^Tokyo/)).toHaveCount(0);
  });

  test("pick Tokyo: the plan runs there, the map centres on Tokyo and the page says Tokyo", async ({ page }) => {
    await page.goto("/busks");
    await pickCity(page, "Tok", "Tokyo, Japan");
    await form(page).getByLabel("Artists you sound like").fill("Paul Kelly");
    const posted = postedPlan(page);
    await form(page).getByRole("button", { name: "Plan my busk" }).click();
    const body = (await posted).postDataJSON();
    expect(body.city).toBe("tokyo-jp");
    // A metro: the place carries its planning radius (the city and its suburbs).
    expect(body.place).toEqual({ name: "Tokyo", country: "Japan", countryCode: "JP", lat: 35.6895, lon: 139.6917, timeZone: "Asia/Tokyo", radiusKm: 15 });
    await expect(page).toHaveURL(/\/p\/[0-9A-Za-z]{9}$/);
    await waitForPlan(page);
    // The eyebrow names the city (a second device may get the first one's run as a shared replay).
    await expect(page.getByText(/^(Shared busk · )?Tokyo · /).first()).toBeVisible();
    const pitches = page.getByRole("region", { name: "Pitches", exact: true }).locator("button[data-pitch-name]");
    await expect(pitches).toHaveCount(3);
    for (const name of await pitches.evaluateAll((els) => els.map((el) => el.getAttribute("data-pitch-name") ?? ""))) {
      expect(name).not.toMatch(/Federation|Bourke|Flinders|Degraves/);
      // OpenStreetMap public spaces, not taste-cell names ("Near …", "Taste area …").
      expect(name).toMatch(/^Synthetic OSM |^Pedestrian street$/);
    }
    await expect(await mapCentre(page)).toHaveAttribute("data-center", "35.6895,139.6917", { timeout: 15_000 });
    // No City of Melbourne busking layers in Tokyo.
    await expect(page.getByTestId("data-used")).not.toContainText("City of Melbourne");
    await expect(page.getByTestId("data-used")).toContainText("© OpenStreetMap contributors");
    // The pitch's own sheet credits OpenStreetMap.
    const sheet = await openDetails(page);
    await expect(sheet.getByText("© OpenStreetMap contributors")).toBeVisible();
    await page.keyboard.press("Escape");

    // Planning again keeps the city.
    const id = new URL(page.url()).pathname.split("/").pop();
    await page.goto(`/busks?again=${id}`);
    await expect(cityField(page)).toContainText("Tokyo, Japan");
  });

  test("Tokyo with its suburbs: the plan searches districts and spreads the pitches over at least two", async ({ page }, testInfo) => {
    await page.goto("/busks");
    await pickCity(page, "Tok", "Tokyo, Japan");
    // Its own act per project, so each device runs the plan (not a replay of another test's run).
    await form(page).getByLabel("Act name").fill(`Metro ${testInfo.project.name}`);
    await form(page).getByLabel("Artists you sound like").fill("Paul Kelly");
    await form(page).getByRole("button", { name: "Plan my busk" }).click();
    await expect(page).toHaveURL(/\/p\/[0-9A-Za-z]{9}$/);
    await waitForPlan(page);
    const names = await page
      .getByRole("region", { name: "Pitches", exact: true })
      .locator("button[data-pitch-name]")
      .evaluateAll((els) => els.map((el) => el.getAttribute("data-pitch-name") ?? ""));
    expect(names).toHaveLength(3);
    // The synthetic metro's suburbs name their spots "Synthetic OSM East …", "… South …", "… North …"; the rest are the centre.
    const districtOf = (name: string) => /^Synthetic OSM (East|South|North) /.exec(name)?.[1] ?? "centre";
    const counts = new Map<string, number>();
    for (const name of names) counts.set(districtOf(name), (counts.get(districtOf(name)) ?? 0) + 1);
    expect(counts.size, names.join(", ")).toBeGreaterThanOrEqual(2);
    expect(Math.max(...counts.values()), names.join(", ")).toBeLessThanOrEqual(2);
    // The map frames the districts the plan searched.
    expect(Number(await (await mapCentre(page)).getAttribute("data-districts"))).toBeGreaterThanOrEqual(3);
  });

  test("Tokyo with its suburbs: the Hive compares the named areas, the pitches span at least two and the map labels them", async ({ page }, testInfo) => {
    await page.goto("/busks");
    await pickCity(page, "Tok", "Tokyo, Japan");
    await form(page).getByLabel("Act name").fill(`Areas ${testInfo.project.name}`);
    await form(page).getByLabel("Artists you sound like").fill("Paul Kelly");
    await form(page).getByRole("button", { name: "Plan my busk" }).click();
    await expect(page).toHaveURL(/\/p\/[0-9A-Za-z]{9}$/);
    await waitForPlan(page);
    // The step names the areas it looked at, never coordinates.
    const feed = await agentSteps(page);
    const step = feed.locator('[data-tool="compare_areas"]');
    await expect(step).toContainText("Areas across the city");
    await expect(step).toContainText(/Looked at .*Synthetic Shibuya/);
    await expect(step).toContainText("Synthetic Asakusa");
    await expect(step).toContainText("Synthetic Ueno");
    await expect(feed).not.toContainText(/-?\d+\.\d{4}, -?\d+\.\d{4}/);
    // Each synthetic suburb's spots carry its hub's label ("Synthetic OSM East …"): the pitches come from at least two areas.
    const AREA: Record<string, string> = { East: "Synthetic Shibuya", South: "Synthetic Asakusa", North: "Synthetic Ueno" };
    const names = await page
      .getByRole("region", { name: "Pitches", exact: true })
      .locator("button[data-pitch-name]")
      .evaluateAll((els) => els.map((el) => el.getAttribute("data-pitch-name") ?? ""));
    const areas = new Set(names.map((name) => AREA[/^Synthetic OSM (East|South|North) /.exec(name)?.[1] ?? ""] ?? "Tokyo"));
    expect(areas.size, names.join(", ")).toBeGreaterThanOrEqual(2);
    // The map labels the named areas, ranked, across the whole area.
    const labels = (await (await mapCentre(page)).getAttribute("data-areas"))?.split("|") ?? [];
    expect(labels).toEqual(expect.arrayContaining(["Tokyo", "Synthetic Shibuya", "Synthetic Asakusa", "Synthetic Ueno", "Synthetic Nakano"]));
    expect(labels).not.toContain("Synthetic Ebisu");
  });

  test("an old Tokyo link (no radius in its place) still plans the city centre only", async ({ page }, testInfo) => {
    const params = new URLSearchParams({ name: `Old link ${testInfo.project.name}`, artists: "Paul Kelly", date: serverDay(10), city: "tokyo-jp", place: "Tokyo~JP~35.6895~139.6917~Asia/Tokyo~Japan" });
    await page.goto(`/plan?${params}`);
    await expect(page).toHaveURL(/\/p\/[0-9A-Za-z]{9}$/);
    await waitForPlan(page);
    const names = await page
      .getByRole("region", { name: "Pitches", exact: true })
      .locator("button[data-pitch-name]")
      .evaluateAll((els) => els.map((el) => el.getAttribute("data-pitch-name") ?? ""));
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) expect(name).not.toMatch(/^Synthetic OSM (East|South|North) /);
    await expect(await mapCentre(page)).not.toHaveAttribute("data-districts");
    await expect(await mapCentre(page)).not.toHaveAttribute("data-areas");
  });

  test("the city search is an accessible combobox in a popover", async ({ page }) => {
    await page.goto("/busks");
    await cityField(page).click();
    const search = page.getByPlaceholder("Search a city, e.g. Tokyo");
    // Before typing: the current city (Melbourne) is the one option.
    await expect(page.getByRole("option")).toHaveCount(1);
    await search.fill("Melb");
    await expect(page.getByRole("option", { name: "Melbourne, Victoria, Australia" })).toBeVisible();
    await expect(page.getByRole("option", { name: "Melbourne, Florida, United States" })).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    expect(results.violations.map((v) => v.id)).toEqual([]);
    await search.fill("Zzzz");
    await expect(page.getByText("No city matches “Zzzz”.")).toBeVisible();
    await expect(page.getByRole("listbox")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(cityField(page)).toContainText("Melbourne, Victoria, Australia");
  });

  test("Melbourne example plans are unchanged: Melbourne's map and its council layers", async ({ page }) => {
    await page.goto(`/plan?example=${EXAMPLES[0].id}`);
    await expect(page).toHaveURL(/\/p\/[0-9A-Za-z]{9}$/);
    await waitForPlan(page);
    await expect(page.getByRole("region", { name: "Pitches", exact: true }).getByRole("listitem")).toHaveCount(3);
    await expect(await mapCentre(page)).toHaveAttribute("data-center", "-37.8136,144.9631", { timeout: 15_000 });
    await expect(page.getByTestId("data-used")).toContainText("City of Melbourne");
    await expect(page.getByText(/^(Shared busk · )?Melbourne · /)).toHaveCount(0);
  });

  test("Repertoire: a fans city's \"Plan a busk here\" opens /busks with that city selected", async ({ page }) => {
    await page.goto("/repertoire");
    await page.getByLabel("Your Spotify artist link").fill(`https://open.spotify.com/artist/${OFFLINE_TEST_ARTIST.spotifyId}`);
    await page.getByRole("button", { name: "Research my act" }).click();
    await expect(page.getByTestId("research-end")).toBeVisible({ timeout: 20_000 });
    const cities = page.getByTestId("fans-cities").getByTestId("fans-city");
    await expect(cities.first()).toBeVisible();
    // The first city that isn't the built-in Melbourne: its link opens the form on that city, with its time zone's clock.
    const names = await cities.locator("span.font-bold").allTextContents();
    const at = names.findIndex((n) => !n.startsWith("Melbourne"));
    expect(at, `fans cities: ${names.join(", ")}`).toBeGreaterThanOrEqual(0);
    const name = names[at].split(",")[0];
    await cities.nth(at).getByRole("link", { name: new RegExp(`^Plan a busk here in ${name}`) }).click();
    await expect(page).toHaveURL(/\/busks\?fans=/);
    await expect(cityField(page)).toContainText(name);
    await expect(cityField(page)).not.toContainText("Melbourne");
  });
});

/**
 * V2 2.2 and 2.4: outside Melbourne each signal names its level in plain words, and the rules are "not checked", never
 * "allowed". Melbourne keeps today's labels. Offline, so no source answers live: only "Estimate" and "Not checked" show.
 */
test.describe("signal levels and rules not checked (offline)", () => {
  test.skip(!LOCAL, "Local offline server only");

  test("Tokyo: Estimate activity, rules Not checked, no permit anywhere", async ({ page }) => {
    await page.goto("/busks");
    await pickCity(page, "Tok", "Tokyo, Japan");
    // Melbourne's permits mean nothing in Tokyo: the picker goes, and the busk asks for a general permit.
    await expect(form(page).getByRole("radio", { name: "Premium permit" })).toHaveCount(0);
    await form(page).getByLabel("Artists you sound like").fill("Paul Kelly");
    const posted = postedPlan(page);
    await form(page).getByRole("button", { name: "Plan my busk" }).click();
    expect((await posted).postDataJSON().permit).toBe("general");
    await waitForPlan(page);

    await expect(page.getByTestId("plan-tags")).toContainText("Activity: Estimate");
    await expect(page.getByText(/^(Shared busk · )?Tokyo · /).first()).not.toContainText("permit");
    await expect(page.getByTestId("rules-line")).toHaveText("Local busking rules not checked: check with the city before you play.");
    await expect(page.getByText("Busk Map never confirms a pitch is legal")).toHaveCount(0);
    const rules = page.getByTestId("rules-not-checked");
    await expect(rules).toContainText("Local busking rules");
    await expect(rules.getByTestId("level-badge")).toHaveText("Not checked");
    // Test data is never called live.
    await expect(page.locator('[data-level="Live data"]')).toHaveCount(0);

    const sheet = await openDetails(page);
    const legal = sheet.getByRole("region", { name: "Rules" }).locator("xpath=ancestor::*[@data-slot='item'][1]");
    await expect(legal).toContainText("Busking rules");
    await expect(legal).toContainText("Local busking rules not checked: check with the city before you play.");
    await expect(legal.getByTestId("level-badge")).toHaveText("Not checked");
    await expect(sheet).not.toContainText("General permit");
    await expect(sheet).not.toContainText("City of Melbourne");
  });

  test("Melbourne keeps today's labels: Activity: est., the council's rules, no level words", async ({ page }) => {
    await page.goto("/busks");
    await expect(form(page).getByRole("radio", { name: "Premium permit" })).toBeVisible();
    await page.goto(`/plan?example=${EXAMPLES[0].id}`);
    await waitForPlan(page);
    await expect(page.getByTestId("plan-tags")).toContainText("Activity: est.");
    await expect(page.getByTestId("rules-line")).toHaveText("Busk Map never confirms a pitch is legal. Check your permit conditions on the day.");
    await expect(page.getByText(/ · (General permit|Premium permit|Circle act)$/).first()).toBeVisible();
    await expect(page.getByTestId("rules-not-checked")).toHaveCount(0);
    await expect(page.getByTestId("level-badge")).toHaveCount(0);
    const sheet = await openDetails(page);
    await expect(sheet.getByText(/^(General permit|Council-designated) pitch$/)).toBeVisible();
    await expect(sheet.getByTestId("level-badge")).toHaveCount(0);
  });
});
