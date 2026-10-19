import { expect, test } from "./fixtures";

/** The text inside every shadcn SelectValue in a page's server HTML (before any JavaScript runs). */
async function selectValues(request: import("@playwright/test").APIRequestContext, path: string): Promise<string[]> {
  const response = await request.get(path);
  expect(response.status()).toBe(200);
  const html = await response.text();
  return [...html.matchAll(/<span[^>]*data-slot="select-value"[^>]*>(.*?)<\/span>/g)].map((m) => m[1].replace(/<!--.*?-->/g, "").trim());
}

test.describe("server HTML (B-006)", () => {
  test("the /busks form has no select left to show a label, and General permit is picked before hydration", async ({ request }) => {
    // The time is the Any time picker (no From and To selects) and the permit is a choice card.
    expect(await selectValues(request, "/busks")).toEqual([]);
    const html = await (await request.get("/busks")).text();
    // The permit is a choice card now: its radio is checked in the server HTML.
    expect(html).toMatch(/<button[^>]*role="radio"[^>]*aria-checked="true"[^>]*value="general"|<button[^>]*value="general"[^>]*aria-checked="true"/);
  });
});

test.describe("server HTML (plan inputs)", () => {
  test("the /busks time control is on Any time before hydration", async ({ request }) => {
    const response = await request.get("/busks");
    const html = await response.text();
    expect(html).toContain("Time (optional)");
    expect(html).toMatch(/<button[^>]*role="radio"[^>]*aria-checked="true"[^>]*data-testid="time-any"|<button[^>]*data-testid="time-any"[^>]*aria-checked="true"/);
    expect(html).not.toMatch(/id="(from|to)"/);
  });
});

test.describe("server HTML (B-011)", () => {
  test("the /busks search comboboxes are closed before hydration", async ({ request }) => {
    const response = await request.get("/busks");
    expect(response.status()).toBe(200);
    const html = await response.text();
    const comboboxes = [...html.matchAll(/<input[^>]*role="combobox"[^>]*>/g)].map((m) => m[0]);
    // /busks has the artist search only: songs are added on /repertoire.
    expect(comboboxes.map((tag) => tag.match(/placeholder="([^"]*)"/)?.[1])).toEqual(["Search Spotify, e.g. Paul Kelly"]);
    for (const tag of comboboxes) {
      expect(tag).toContain('aria-expanded="false"');
      expect(tag).not.toContain("aria-controls");
      expect(tag).not.toContain("aria-activedescendant");
    }
  });
});
