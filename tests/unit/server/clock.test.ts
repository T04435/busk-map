import { afterEach, describe, expect, it, vi } from "vitest";

describe("server clock", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function clock() {
    vi.resetModules();
    return import("@/server/clock");
  }

  it("is frozen by BUSKMAP_FAKE_NOW only when fault injection is allowed", async () => {
    vi.stubEnv("BUSKMAP_FAKE_NOW", "2026-10-14T12:00:00+11:00");
    vi.stubEnv("BUSKMAP_ALLOW_FAULTS", "1");
    const on = await clock();
    expect(on.serverNow().toISOString()).toBe("2026-10-14T01:00:00.000Z");
    expect(on.serverLocalNow("Australia/Melbourne")).toEqual({ today: "2026-10-14", hour: 12 });
    vi.stubEnv("BUSKMAP_ALLOW_FAULTS", "");
    const off = await clock();
    expect(Math.abs(off.serverNow().getTime() - Date.now())).toBeLessThan(5000);
  });

  it("is never frozen in production, and ignores an unreadable value", async () => {
    vi.stubEnv("BUSKMAP_FAKE_NOW", "2026-10-14T12:00:00+11:00");
    vi.stubEnv("BUSKMAP_ALLOW_FAULTS", "1");
    vi.stubEnv("VERCEL_ENV", "production");
    expect(Math.abs((await clock()).serverNow().getTime() - Date.now())).toBeLessThan(5000);
    vi.unstubAllEnvs();
    vi.stubEnv("BUSKMAP_ALLOW_FAULTS", "1");
    vi.stubEnv("BUSKMAP_FAKE_NOW", "nonsense");
    expect(Math.abs((await clock()).serverNow().getTime() - Date.now())).toBeLessThan(5000);
  });
});
