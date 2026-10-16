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

  it("honours the render fault only when faults are allowed, and never in production", async () => {
    let { renderFaultRequested } = await freshRequest();
    expect(renderFaultRequested("render")).toBe(false);

    vi.stubEnv("BUSKMAP_ALLOW_FAULTS", "1");
    ({ renderFaultRequested } = await freshRequest());
    expect(renderFaultRequested("qloo, render")).toBe(true);
    expect(renderFaultRequested("qloo")).toBe(false);
    expect(renderFaultRequested(null)).toBe(false);

    vi.stubEnv("VERCEL_ENV", "production");
    ({ renderFaultRequested } = await freshRequest());
    expect(renderFaultRequested("render")).toBe(false);
  });

  it("honours the fresh-limit fault only when faults are allowed, and never in production", async () => {
    let { freshLimitFaultRequested, pageFaultsFor } = await freshRequest();
    expect(freshLimitFaultRequested("fresh-limit")).toBe(false);
    expect(pageFaultsFor("fresh-limit,qloo")).toEqual([]);

    vi.stubEnv("BUSKMAP_ALLOW_FAULTS", "1");
    ({ freshLimitFaultRequested, pageFaultsFor } = await freshRequest());
    expect(freshLimitFaultRequested("qloo, fresh-limit")).toBe(true);
    expect(freshLimitFaultRequested("qloo")).toBe(false);
    expect(freshLimitFaultRequested(null)).toBe(false);
    // Pages pass the outages and fresh-limit on to their API calls; unknown names are dropped.
    expect(pageFaultsFor("fresh-limit, qloo, nope")).toEqual(["qloo", "fresh-limit"]);
    expect(pageFaultsFor(null)).toEqual([]);
    // fresh-limit is not a provider outage: the adapters never see it.
    const { adapterContextFor } = await freshRequest();
    expect(adapterContextFor("fresh-limit").faults).toEqual([]);

    vi.stubEnv("VERCEL_ENV", "production");
    ({ freshLimitFaultRequested, pageFaultsFor } = await freshRequest());
    expect(freshLimitFaultRequested("fresh-limit")).toBe(false);
    expect(pageFaultsFor("fresh-limit")).toEqual([]);
  });

  it("reads the client IP from proxy headers", async () => {
    const { clientIp } = await freshRequest();
    expect(clientIp(new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }))).toBe("1.2.3.4");
    expect(clientIp(new Headers({ "x-real-ip": "9.9.9.9" }))).toBe("9.9.9.9");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
