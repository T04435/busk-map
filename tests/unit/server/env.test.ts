import { describe, expect, it } from "vitest";
import { parseEnv, providerStatusOf, testSwitchesOf } from "@/server/env";

describe("parseEnv", () => {
  it("treats blank and SET_ME placeholders as missing", () => {
    const env = parseEnv({
      QLOO_API_KEY: "SET_ME",
      LASTFM_API_KEY: "   ",
      TICKETMASTER_API_KEY: "set_me",
      SPOTIFY_CLIENT_ID: "",
    });
    expect(env.QLOO_API_KEY).toBeUndefined();
    expect(env.LASTFM_API_KEY).toBeUndefined();
    expect(env.TICKETMASTER_API_KEY).toBeUndefined();
    expect(env.SPOTIFY_CLIENT_ID).toBeUndefined();
  });

  it("keeps real values, trimmed", () => {
    const env = parseEnv({ QLOO_API_KEY: "  synthetic-key  " });
    expect(env.QLOO_API_KEY).toBe("synthetic-key");
  });

  it("defaults the Qloo host to the hackathon host", () => {
    expect(parseEnv({}).QLOO_API_BASE_URL).toBe("https://hackathon.api.qloo.com");
  });

  it("names the bad variable without echoing its value", () => {
    expect(() => parseEnv({ QLOO_API_BASE_URL: "not a url secret-ish" })).toThrowError(
      /QLOO_API_BASE_URL/,
    );
    try {
      parseEnv({ QLOO_API_BASE_URL: "not a url secret-ish" });
    } catch (error) {
      expect(String(error)).not.toContain("secret-ish");
    }
  });
});

describe("providerStatusOf", () => {
  it("reports nothing available on an empty environment", () => {
    expect(providerStatusOf(parseEnv({}))).toEqual({
      qloo: false,
      ticketmaster: false,
      lastfm: false,
      spotify: false,
      aiGateway: false,
    });
  });

  it("needs both Spotify credentials", () => {
    expect(providerStatusOf(parseEnv({ SPOTIFY_CLIENT_ID: "a" })).spotify).toBe(false);
    expect(
      providerStatusOf(parseEnv({ SPOTIFY_CLIENT_ID: "a", SPOTIFY_CLIENT_SECRET: "b" })).spotify,
    ).toBe(true);
  });

  it("accepts any gateway credential, including the Vercel runtime", () => {
    expect(providerStatusOf(parseEnv({ AI_GATEWAY_API_KEY: "k" })).aiGateway).toBe(true);
    expect(providerStatusOf(parseEnv({ VERCEL_OIDC_TOKEN: "t" })).aiGateway).toBe(true);
    expect(providerStatusOf(parseEnv({ VERCEL: "1" })).aiGateway).toBe(true);
  });

  it("returns booleans only", () => {
    const status = providerStatusOf(
      parseEnv({ QLOO_API_KEY: "q", TICKETMASTER_API_KEY: "t", LASTFM_API_KEY: "l" }),
    );
    for (const value of Object.values(status)) expect(typeof value).toBe("boolean");
  });
});

describe("testSwitchesOf", () => {
  it("honours the switches outside production", () => {
    const env = parseEnv({ BUSKMAP_ALLOW_FAULTS: "1", BUSKMAP_OFFLINE: "true" });
    expect(testSwitchesOf(env)).toEqual({ allowFaults: true, offline: true });
  });

  it("ignores them in production", () => {
    const env = parseEnv({
      BUSKMAP_ALLOW_FAULTS: "1",
      BUSKMAP_OFFLINE: "1",
      VERCEL_ENV: "production",
    });
    expect(testSwitchesOf(env)).toEqual({ allowFaults: false, offline: false });
  });
});
