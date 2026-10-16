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
    expect(await selectValues(request, "/")).toEqual(["6 pm", "9 pm", "General"]);
  });

  test("the week limits show their values before hydration", async ({ request }) => {
    expect(await selectValues(request, "/week?example=folk-duo")).toEqual(["5", "1"]);
  });
});
