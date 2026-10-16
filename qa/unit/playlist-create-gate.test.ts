/**
 * QA: the Repertoire creation limit (b4cf4f1), 10 new Repertoires an hour per IP. The route skips it offline (the e2e
 * tests share one IP), so this calls the gate itself with offline: false and a private limiter.
 */
import { describe, expect, it } from "vitest";
import { PLAYLIST_CREATIONS_PER_HOUR } from "@/server/playlist/config";
import { createRateLimiter, playlistCreateGate } from "@/server/rate-limit";

const NOW = Date.UTC(2026, 9, 17, 4, 0, 0);
const fresh = () => createRateLimiter(PLAYLIST_CREATIONS_PER_HOUR, 60 * 60_000);

describe("QA Repertoire creation gate", () => {
  it("allows 10 an hour per IP; the 11th waits with a retry time within the hour", () => {
    expect(PLAYLIST_CREATIONS_PER_HOUR).toBe(10);
    const limiter = fresh();
    for (let i = 0; i < 10; i++) expect(playlistCreateGate({ offline: false, ip: "203.0.113.9" }, limiter, NOW + i).ok).toBe(true);
    const eleventh = playlistCreateGate({ offline: false, ip: "203.0.113.9" }, limiter, NOW + 20);
    expect(eleventh.ok).toBe(false);
    if (eleventh.ok) throw new Error("expected the limit");
    expect(eleventh.retryAfterS).toBeGreaterThan(0);
    expect(eleventh.retryAfterS).toBeLessThanOrEqual(3600);
  });

  it("each IP has its own allowance, and the window resets after an hour", () => {
    const limiter = fresh();
    for (let i = 0; i < 10; i++) playlistCreateGate({ offline: false, ip: "203.0.113.9" }, limiter, NOW);
    expect(playlistCreateGate({ offline: false, ip: "198.51.100.4" }, limiter, NOW).ok).toBe(true);
    expect(playlistCreateGate({ offline: false, ip: "203.0.113.9" }, limiter, NOW + 60 * 60_000 + 1).ok).toBe(true);
  });

  it("offline is never limited", () => {
    const limiter = fresh();
    for (let i = 0; i < 30; i++) expect(playlistCreateGate({ offline: true, ip: "203.0.113.9" }, limiter, NOW).ok).toBe(true);
  });
});
