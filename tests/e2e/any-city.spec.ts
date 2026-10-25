import AxeBuilder from "@axe-core/playwright";
import { EXAMPLES } from "../../src/lib/examples";
import { OFFLINE_TEST_ARTIST } from "../../src/lib/repertoire-research";
import { expect, LOCAL, test, waitForPlan } from "./fixtures";

/**
 * V2 2.1 "Any city": the busk form's city search, a plan in another city (offline mode's second city, Tokyo), and
 * Melbourne exactly as before. Offline server, mock model, synthetic geocoder.
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
    expect(body.place).toEqual({ name: "Tokyo", country: "Japan", countryCode: "JP", lat: 35.6895, lon: 139.6917, timeZone: "Asia/Tokyo" });
    await expect(page).toHaveURL(/\/p\/[0-9A-Za-z]{9}$/);
    await waitForPlan(page);
    // The eyebrow names the city (a second device may get the first one's run as a shared replay).
    await expect(page.getByText(/^(Shared busk · )?Tokyo · /).first()).toBeVisible();
    const pitches = page.getByRole("region", { name: "Pitches", exact: true }).locator("button[data-pitch-name]");
    await expect(pitches).toHaveCount(3);
    for (const name of await pitches.evaluateAll((els) => els.map((el) => el.getAttribute("data-pitch-name") ?? ""))) expect(name).not.toMatch(/Federation|Bourke|Flinders|Degraves/);
    await expect(await mapCentre(page)).toHaveAttribute("data-center", "35.6895,139.6917", { timeout: 15_000 });
    // No City of Melbourne busking layers in Tokyo.
    await expect(page.getByTestId("data-used")).not.toContainText("City of Melbourne");

    // Planning again keeps the city.
    const id = new URL(page.url()).pathname.split("/").pop();
    await page.goto(`/busks?again=${id}`);
    await expect(cityField(page)).toContainText("Tokyo, Japan");
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
