import { describe, expect, it, vi } from "vitest";
import { createRateLimiter } from "@/server/rate-limit";

async function freshRequest() {
  vi.resetModules();
  return import("@/server/request");
}

describe("rate limiter", () => {
  it("allows up to the limit per window, then reports when to retry", () => {
    const limiter = createRateLimiter(2, 60_000);
    expect(limiter.check("ip", 0).ok).toBe(true);
    expect(limiter.check("ip", 1000).ok).toBe(true);
    expect(limiter.check("ip", 2000)).toEqual({ ok: false, retryAfterS: 58 });
    expect(limiter.check("other", 2000).ok).toBe(true);
    expect(limiter.check("ip", 61_000).ok).toBe(true);
  });
});

describe("request helpers", () => {
  it("parses known adapter names only", async () => {
    const { parseFaults } = await freshRequest();
    expect(parseFaults("qloo, events,nope")).toEqual(["qloo", "events"]);
    expect(parseFaults(null)).toEqual([]);
  });

  it("honours faults only when allowed, and never in production", async () => {
    vi.stubEnv("BUSKMAP_ALLOW_FAULTS", "1");
    let { adapterContextFor } = await freshRequest();
    expect(adapterContextFor("qloo").faults).toEqual(["qloo"]);

    vi.stubEnv("VERCEL_ENV", "production");
    ({ adapterContextFor } = await freshRequest());
    expect(adapterContextFor("qloo")).toEqual({ offline: false, faults: [] });
  });

  it("reads the client IP from proxy headers", async () => {
    const { clientIp } = await freshRequest();
    expect(clientIp(new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }))).toBe("1.2.3.4");
    expect(clientIp(new Headers({ "x-real-ip": "9.9.9.9" }))).toBe("9.9.9.9");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
