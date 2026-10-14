import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AdapterError, errorKindOf, fetchJson, runAdapter } from "@/server/adapters/core";
import { json, LIVE, mockFetch, route } from "../../helpers";

const schema = z.object({ ok: z.boolean() });
const opts = { adapter: "weather" as const, schema, timeoutMs: 1000 };

describe("fetchJson", () => {
  it("validates and returns data", async () => {
    mockFetch([route(() => true, () => json({ ok: true, extra: 1 }))]);
    await expect(fetchJson("https://example.test/a", opts)).resolves.toEqual({ ok: true });
  });

  it.each([
    [429, "rate_limited"],
    [404, "not_found"],
    [500, "http"],
  ])("maps HTTP %i to %s", async (status, kind) => {
    mockFetch([route(() => true, () => json({}, status))]);
    await expect(fetchJson("https://example.test/a", opts)).rejects.toMatchObject({ kind, status });
  });

  it("reports network errors and non-JSON bodies", async () => {
    mockFetch([route(() => true, () => Promise.reject(new TypeError("fetch failed")))]);
    await expect(fetchJson("https://example.test/a", opts)).rejects.toMatchObject({ kind: "network" });
    mockFetch([route(() => true, () => new Response("<html>", { status: 200 }))]);
    await expect(fetchJson("https://example.test/a", opts)).rejects.toMatchObject({ kind: "invalid_response" });
  });

  it("never puts the query string (where keys live) in error messages", async () => {
    mockFetch([route(() => true, () => json({}, 500))]);
    const error = await fetchJson("https://example.test/a?api_key=synthetic-secret", opts).catch((e) => e);
    expect(error).toBeInstanceOf(AdapterError);
    expect(error.message).not.toContain("synthetic-secret");
  });
});

describe("runAdapter", () => {
  const base = {
    adapter: "weather" as const,
    source: "open-meteo" as const,
    synthetic: () => "synthetic",
    fallback: "fallback",
  };

  it("falls back when unconfigured, or serves synthetic data when asked to", async () => {
    const live = async () => "live";
    await expect(runAdapter({ ...base, context: LIVE, configured: false, live })).resolves.toMatchObject({
      mode: "fallback",
      reason: "missing_key",
    });
    await expect(
      runAdapter({ ...base, context: LIVE, configured: false, whenUnconfigured: "synthetic", live }),
    ).resolves.toMatchObject({ mode: "synthetic", data: "synthetic" });
  });

  it("treats non-adapter errors as network failures", async () => {
    const result = await runAdapter({
      ...base,
      context: LIVE,
      live: async () => {
        throw "boom";
      },
    });
    expect(result).toMatchObject({ mode: "fallback", reason: "network", data: "fallback" });
  });

  it("keeps the failure kind when the cache strips the error class", async () => {
    // A cached function's AdapterError arrives as a plain Error with the same message.
    const stripped = (message: string) => async () => {
      throw new Error(message);
    };
    const run = (message: string) => runAdapter({ ...base, context: LIVE, live: stripped(message) });
    await expect(run("api.spotify.com/v1/artists/x/albums returned HTTP 404")).resolves.toMatchObject({ reason: "not_found" });
    await expect(run("api.example.com returned HTTP 429")).resolves.toMatchObject({ reason: "rate_limited" });
    await expect(run("api.example.com returned HTTP 500")).resolves.toMatchObject({ reason: "http" });
    await expect(run("api.example.com timed out after 4000 ms")).resolves.toMatchObject({ reason: "timeout" });
  });
});

describe("errorKindOf", () => {
  it("prefers the AdapterError's own kind", () => {
    expect(errorKindOf(new AdapterError("weather", "rate_limited", "x returned HTTP 404"))).toBe("rate_limited");
    expect(errorKindOf("boom")).toBe("network");
    expect(errorKindOf(new Error("Spotify credentials are not configured"))).toBe("missing_key");
  });
});
