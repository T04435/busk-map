// QA (B-028): a learn run that ends with Qloo down or no match counts towards neither limit, so the next run is allowed.
// Independent of DEV's tests: the Repertoire side goes through the memory store's stored runs, the network side through
// the real limiter and refund, and both feed the same gate the route uses.
import { describe, expect, it } from "vitest";
import { ZERO_LEARN_TOTALS } from "@/lib/learn-schema";
import { MemoryLearnStore } from "@/server/learn/store";
import { MemoryPlaylistStore } from "@/server/playlist/store";
import { hashToken, newToken } from "@/server/playlist/token";
import { createRateLimiter, learnRunGate, refundLearnRun } from "@/server/rate-limit";

const HOUR = 3_600_000;
const IP = "203.0.113.7";

async function setup() {
  const playlists = new MemoryPlaylistStore();
  const store = new MemoryLearnStore(playlists);
  const { id } = await playlists.create(hashToken(newToken()));
  return { store, id };
}

describe("QA B-028: uncounted endings", () => {
  it("four Qloo-down / no-match runs in an hour leave both limits untouched; the next real runs are still allowed", async () => {
    const { store, id } = await setup();
    const limiter = createRateLimiter(6, HOUR);
    const t0 = 20 * HOUR;
    const gate = async (now: number) => learnRunGate({ offline: false, ip: IP, recent: await store.recentRuns(id, now - HOUR) }, limiter, now);
    const run = async (now: number, endCode: string | null) => {
      expect(await gate(now), `gate at +${(now - t0) / 60_000} min`).toEqual({ ok: true });
      const started = await store.startRun(id, { model: "mock", inputs: { songs: 4, soundsLike: [], pitches: [] } }, now);
      if (!started.ok) throw new Error("not started");
      await store.finishRun(started.run.id, { status: endCode ? "failed" : "done", endCode, steps: null, totals: ZERO_LEARN_TOTALS, usage: null, newCount: 0, skippedCount: 0 }, now + 1000);
      refundLearnRun(endCode, IP, limiter);
    };
    for (let i = 0; i < 4; i++) await run(t0 + i * 60_000, i % 2 ? "no_match" : "qloo_unavailable");
    expect((await store.recentRuns(id, t0 - 1)).count).toBe(0);
    expect(limiter.peek(IP, t0 + 5 * 60_000).ok).toBe(true);
    // Three counted runs still fit after the four that didn't count; the fourth counted one is refused by the Repertoire limit.
    for (let i = 0; i < 3; i++) await run(t0 + (10 + i) * 60_000, null);
    expect((await store.recentRuns(id, t0 - 1)).count).toBe(3);
    expect(await gate(t0 + 20 * 60_000)).toMatchObject({ ok: false, scope: "repertoire" });
  });

  it("other failures do count (timeout, stopped)", async () => {
    const { store, id } = await setup();
    const t0 = 30 * HOUR;
    for (const [i, code] of ["timeout", "stopped"].entries()) {
      const s = await store.startRun(id, { model: "mock", inputs: { songs: 4, soundsLike: [], pitches: [] } }, t0 + i * 60_000);
      if (s.ok) await store.finishRun(s.run.id, { status: "failed", endCode: code, steps: null, totals: ZERO_LEARN_TOTALS, usage: null, newCount: 0, skippedCount: 0 }, t0 + i * 60_000 + 1);
    }
    expect((await store.recentRuns(id, t0 - 1)).count).toBe(2);
  });
});
