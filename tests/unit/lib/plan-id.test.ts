import { describe, expect, it } from "vitest";
import { isPlanId, newPlanId, PLAN_ID_ALPHABET, PLAN_ID_LENGTH, planPath } from "@/lib/plan-id";

describe("short plan ids", () => {
  it("are 9 base-62 characters", () => {
    expect(PLAN_ID_ALPHABET).toHaveLength(62);
    expect(new Set(PLAN_ID_ALPHABET).size).toBe(62);
    for (let i = 0; i < 200; i++) {
      const id = newPlanId();
      expect(id).toHaveLength(PLAN_ID_LENGTH);
      expect(id).toMatch(/^[0-9A-Za-z]{9}$/);
      expect(isPlanId(id)).toBe(true);
    }
  });

  it("are unique over 10k and use the whole alphabet", () => {
    const ids = Array.from({ length: 10_000 }, () => newPlanId());
    expect(new Set(ids).size).toBe(10_000);
    expect(new Set(ids.join(""))).toEqual(new Set(PLAN_ID_ALPHABET));
  });

  it("drop bytes 248–255 (rejection sampling, no modulo bias)", () => {
    // 248 % 62 == 0 and 255 % 62 == 7: with modulo bias these would map to "0".."7". They must be skipped.
    const batches = [
      [248, 249, 250, 251, 252, 253, 254, 255, 0, 61, 62, 247, 1, 2, 3, 4],
      [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
    ];
    let call = 0;
    const fill = (bytes: Uint8Array) => {
      bytes.set(batches[call++]);
      return bytes;
    };
    // Valid bytes in order: 0, 61, 62, 247, 1, 2, 3, 4, then 5 from the next batch.
    expect(newPlanId(fill)).toBe("0z0z12345");
    expect(call).toBe(2);
  });

  it("are roughly uniform per character", () => {
    const counts = new Map<string, number>();
    for (let i = 0; i < 10_000; i++) for (const c of newPlanId()) counts.set(c, (counts.get(c) ?? 0) + 1);
    const expected = (10_000 * PLAN_ID_LENGTH) / 62;
    for (const c of PLAN_ID_ALPHABET) {
      expect(counts.get(c)).toBeGreaterThan(expected * 0.8);
      expect(counts.get(c)).toBeLessThan(expected * 1.2);
    }
  });

  it("validate strictly", () => {
    for (const bad of ["", "abc", "abcdefghij", "abcd-efgh", "abcd efgh", "abcdéfghi", null, 123456789, "../../etc"]) expect(isPlanId(bad)).toBe(false);
    expect(planPath("Ab3dE6gH9")).toBe("/p/Ab3dE6gH9");
  });
});
