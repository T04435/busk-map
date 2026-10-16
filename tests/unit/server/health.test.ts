import { describe, expect, it, vi } from "vitest";

// Route handlers call next/server's connection() (request scope only): a no-op here.
vi.mock("next/server", () => ({ connection: async () => {} }));

async function freshGet() {
  vi.resetModules();
  return (await import("@/app/api/health/route")).GET;
}

describe("GET /api/health", () => {
  it("reports only ok and the two test switches, uncached", async () => {
    vi.stubEnv("QLOO_API_KEY", "secret-key-value");
    const response = await (await freshGet())();
    expect(response.headers.get("cache-control")).toBe("no-store");
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({ ok: true, offline: false, faults: false });
    expect(text).not.toContain("secret-key-value");
  });

  it("reports offline and faults when the switches are on", async () => {
    vi.stubEnv("BUSKMAP_OFFLINE", "1");
    vi.stubEnv("BUSKMAP_ALLOW_FAULTS", "1");
    expect(await (await (await freshGet())()).json()).toEqual({ ok: true, offline: true, faults: true });
  });

  it("reports both off in production, whatever the switches say", async () => {
    vi.stubEnv("BUSKMAP_OFFLINE", "1");
    vi.stubEnv("BUSKMAP_ALLOW_FAULTS", "1");
    vi.stubEnv("VERCEL_ENV", "production");
    expect(await (await (await freshGet())()).json()).toEqual({ ok: true, offline: false, faults: false });
  });
});
