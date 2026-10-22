import { describe, expect, it, vi } from "vitest";
import { PURGE_STEPS, purgeGate, runPurge } from "../../scripts/purge-spotify-lib.mjs";

describe("purgeGate (scripts/purge-spotify-lib.mjs)", () => {
  it("refuses before 10 Nov 2026 UTC", () => {
    expect(purgeGate(new Date("2026-11-09T23:59:59Z")).action).toBe("refuse");
    expect(purgeGate(new Date("2026-10-22T00:00:00Z"), []).action).toBe("refuse");
  });
  it("runs on and after the date", () => {
    expect(purgeGate(new Date("2026-11-10T00:00:00Z")).action).toBe("run");
    expect(purgeGate(new Date("2027-01-01T00:00:00Z")).action).toBe("run");
  });
  it("runs before the date only with --force", () => {
    expect(purgeGate(new Date("2026-10-22T00:00:00Z"), ["--force"]).action).toBe("run");
  });
});

describe("runPurge", () => {
  it("runs every step, each limited to rows that still hold Spotify data, and sums the counts", async () => {
    const query = vi.fn(async () => [{ n: 2 }]);
    const lines: string[] = [];
    const total = await runPurge({ query }, (l: string) => lines.push(l));
    expect(query).toHaveBeenCalledTimes(PURGE_STEPS.length);
    expect(total).toBe(2 * PURGE_STEPS.length);
    expect(lines).toHaveLength(PURGE_STEPS.length);
  });
  it("is idempotent in shape: every statement is a filtered UPDATE or DELETE, and never touches Spotify ids", () => {
    for (const s of PURGE_STEPS) {
      expect(s.sql).toMatch(/^(UPDATE|DELETE FROM) /);
      if (s.sql.startsWith("UPDATE")) expect(s.sql).toContain(" WHERE ");
      expect(s.sql).not.toMatch(/spotify_(track|artist)_id\s*=/);
      expect(s.sql).not.toMatch(/\b(title|artist|song_key)\s*=/);
    }
  });
  it("reports 0 rows on a clean database", async () => {
    expect(await runPurge({ query: async () => [{ n: 0 }] })).toBe(0);
  });
});
