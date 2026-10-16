import { expect, LOCAL, test } from "./fixtures";

test("/api/health reports offline fixtures on the local test server", async ({ request }) => {
  test.skip(!LOCAL, "A deploy is not offline");
  const response = await request.get("/api/health");
  expect(response.headers()["cache-control"]).toBe("no-store");
  expect(await response.json()).toEqual({ ok: true, offline: true, faults: true });
});
