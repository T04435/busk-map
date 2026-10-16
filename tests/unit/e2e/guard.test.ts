import { describe, expect, it } from "vitest";
import { guardMode, guardVerdict, isLocalHost } from "../../e2e/guard";

describe("e2e cost guard (B-008)", () => {
  it("knows local hosts", () => {
    for (const host of ["localhost", "127.0.0.1", "[::1]", "::1", "busk.localhost", "LOCALHOST"]) expect(isLocalHost(host), host).toBe(true);
    for (const host of ["busk-map.vercel.app", "localhost.example.com", "10.0.0.2"]) expect(isLocalHost(host), host).toBe(false);
  });

  const cases: [baseURL: string, external: boolean, allowLive: boolean, offline: boolean | null, verdict: string][] = [
    // Playwright's own or a reused server on the e2e port: checked.
    ["http://localhost:3100", false, false, true, "run"],
    ["http://localhost:3100", false, false, null, "abort"],
    // PLAYWRIGHT_BASE_URL on a local host: checked like a reused server (the B-008 hole).
    ["http://localhost:3200", true, false, null, "abort"],
    ["http://127.0.0.1:3200", true, false, null, "abort"],
    ["http://[::1]:3200", true, false, null, "abort"],
    ["http://busk.localhost:3200", true, false, null, "abort"],
    ["http://localhost:3200", true, false, true, "run"],
    // E2E_ALLOW_LIVE=1: no abort, a loud warning instead.
    ["http://localhost:3200", true, true, null, "warn"],
    ["http://localhost:3100", false, true, null, "warn"],
    ["http://localhost:3200", true, true, true, "run"],
    // A remote deploy: warning only, whatever the health says.
    ["https://busk-map.vercel.app", true, false, null, "warn"],
    ["https://busk-map.vercel.app", true, true, true, "warn"],
  ];
  it.each(cases)("%s (external %s, allow-live %s, offline %s) → %s", (baseURL, external, allowLive, offline, verdict) => {
    expect(guardVerdict(guardMode(baseURL, { external, allowLive }), offline)).toBe(verdict);
  });

  it("modes", () => {
    expect(guardMode("http://localhost:3200", { external: true, allowLive: false })).toBe("check");
    expect(guardMode("http://localhost:3200", { external: true, allowLive: true })).toBe("allow-live");
    expect(guardMode("https://busk-map.vercel.app", { external: true, allowLive: false })).toBe("warn");
    expect(guardMode("not a url", { external: true, allowLive: false })).toBe("check");
  });
});
