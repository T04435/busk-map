import { expect, test } from "./fixtures";

/** The text inside every shadcn SelectValue in a page's server HTML (before any JavaScript runs). */
async function selectValues(request: import("@playwright/test").APIRequestContext, path: string): Promise<string[]> {
  const response = await request.get(path);
  expect(response.status()).toBe(200);
  const html = await response.text();
  return [...html.matchAll(/<span[^>]*data-slot="select-value"[^>]*>(.*?)<\/span>/g)].map((m) => m[1].replace(/<!--.*?-->/g, "").trim());
}

test.describe("server HTML (B-006)", () => {
  test("the landing selects show their default labels before hydration", async ({ request }) => {
    expect(await selectValues(request, "/")).toEqual(["General"]);
  });
});

test.describe("server HTML (plan inputs)", () => {
  test("the landing time control is on Any time before hydration", async ({ request }) => {
    const response = await request.get("/");
    const html = await response.text();
    expect(html).toContain("Time (optional)");
    expect(html).toMatch(/<button[^>]*role="radio"[^>]*aria-checked="true"[^>]*data-testid="time-any"|<button[^>]*data-testid="time-any"[^>]*aria-checked="true"/);
    expect(html).not.toMatch(/id="(from|to)"/);
  });
});

test.describe("server HTML (B-011)", () => {
  test("the landing search comboboxes are closed before hydration", async ({ request }) => {
    const response = await request.get("/");
    expect(response.status()).toBe(200);
    const html = await response.text();
    const comboboxes = [...html.matchAll(/<input[^>]*role="combobox"[^>]*>/g)].map((m) => m[0]);
    // The song search is inside "Edit for this busk" and is not in the server HTML until it is opened.
    expect(comboboxes.map((tag) => tag.match(/placeholder="([^"]*)"/)?.[1])).toEqual(["Search Spotify, e.g. Paul Kelly"]);
    for (const tag of comboboxes) {
      expect(tag).toContain('aria-expanded="false"');
      expect(tag).not.toContain("aria-controls");
      expect(tag).not.toContain("aria-activedescendant");
    }
  });
});
