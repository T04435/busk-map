import { describe, expect, it } from "vitest";
import { checkHealth, decideGuard, guardVerdict, type HealthResult } from "../../e2e/guard";

/** A fetch that answers /api/health like a server in the given state. */
function fakeFetch(state: "offline" | "live" | "unreachable" | "no-route" | "bad-json"): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    expect(new URL(String(input)).pathname).toBe("/api/health");
    if (state === "unreachable") throw new TypeError("fetch failed");
    if (state === "no-route") return new Response("Not found", { status: 404 });
    if (state === "bad-json") return new Response("<html>", { status: 200 });
    return Response.json({ ok: true, offline: state === "offline", faults: false });
  }) as typeof fetch;
}

describe("e2e cost guard (B-001, B-008, B-009)", () => {
  const verdicts: [health: HealthResult, allowLive: boolean, verdict: string][] = [
    ["offline", false, "run"],
    ["offline", true, "run"],
    ["live", false, "abort"],
    ["live", true, "warn"],
    ["unreachable", false, "abort"],
    ["unreachable", true, "warn"],
  ];
  it.each(verdicts)("health %s, E2E_ALLOW_LIVE %s → %s", (health, allowLive, verdict) => {
    expect(guardVerdict(health, allowLive)).toBe(verdict);
  });

  it("classifies the health answer", async () => {
    expect(await checkHealth("http://localhost:3100", fakeFetch("offline"))).toBe("offline");
    expect(await checkHealth("http://localhost:3100", fakeFetch("live"))).toBe("live");
    expect(await checkHealth("http://localhost:3100", fakeFetch("unreachable"))).toBe("unreachable");
    expect(await checkHealth("http://localhost:3100", fakeFetch("no-route"))).toBe("unreachable");
    expect(await checkHealth("http://localhost:3100", fakeFetch("bad-json"))).toBe("live");
    expect(await checkHealth("not a url", fakeFetch("offline"))).toBe("unreachable");
  });

  // The hostname no longer matters: every host gets the same decision for the same health and override.
  const hosts = [
    "http://localhost:3100",
    "http://127.0.0.1:3200",
    "http://0.0.0.0:3200",
    "http://127.0.0.2:3200",
    "http://192.168.1.101:3200",
    "http://t04435-mbp.local:3200",
    "https://busk-map.vercel.app",
  ];
  const states = [
    ["offline", false, "run"],
    ["offline", true, "run"],
    ["live", false, "abort"],
    ["live", true, "warn"],
    ["unreachable", false, "abort"],
    ["unreachable", true, "warn"],
    ["no-route", false, "abort"],
    ["no-route", true, "warn"],
  ] as const;
  for (const host of hosts) {
    it.each(states)(`${host}: %s, E2E_ALLOW_LIVE %s → %s`, async (state, allowLive, verdict) => {
      expect((await decideGuard(host, { allowLive }, fakeFetch(state))).verdict).toBe(verdict);
    });
  }
});
