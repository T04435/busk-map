import { describe, expect, it } from "vitest";
import { clearCookieHeader, hashToken, newToken, PLAYLIST_COOKIE, setCookieHeader, tokenFromCookieHeader } from "@/server/playlist/token";

describe("the device cookie token", () => {
  it("is 128 random bits as 22 base64url characters, different every time", () => {
    const tokens = new Set(Array.from({ length: 50 }, newToken));
    expect(tokens.size).toBe(50);
    for (const t of tokens) {
      expect(t).toMatch(/^[A-Za-z0-9_-]{22}$/);
      expect(Buffer.from(t, "base64url")).toHaveLength(16);
    }
  });

  it("is stored as its sha256 hex only", () => {
    const hash = hashToken("abc");
    expect(hash).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(hashToken(newToken())).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is read from a Cookie header, and a malformed or missing value is ignored", () => {
    const token = newToken();
    expect(tokenFromCookieHeader(`a=1; ${PLAYLIST_COOKIE}=${token}; b=2`)).toBe(token);
    expect(tokenFromCookieHeader(`${PLAYLIST_COOKIE}=short`)).toBeNull();
    expect(tokenFromCookieHeader(`${PLAYLIST_COOKIE}=${token}x`)).toBeNull();
    expect(tokenFromCookieHeader(`other=${token}`)).toBeNull();
    expect(tokenFromCookieHeader(null)).toBeNull();
  });

  it("is set HttpOnly, SameSite=Lax, 400 days, Secure only when asked", () => {
    const token = newToken();
    const header = setCookieHeader(token, true);
    expect(header).toBe(`buskmap_playlist=${token}; Max-Age=34560000; Path=/; HttpOnly; SameSite=Lax; Secure`);
    expect(setCookieHeader(token, false)).not.toContain("Secure");
    expect(clearCookieHeader(true)).toContain("Max-Age=0");
  });
});
