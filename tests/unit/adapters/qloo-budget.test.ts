import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_QLOO_DAILY_BUDGET, parseBudget, qlooBudgetSpent, resetQlooBudgetForTests, takeQlooCall } from "@/server/adapters/qloo/budget";
import { MemoryUsageStore, type UsageStore } from "@/server/adapters/repertoire/pacer";
import { errorKindOf } from "@/server/adapters/core";

const DAY1 = Date.parse("2026-10-22T10:00:00Z");
const DAY2 = Date.parse("2026-10-23T00:00:01Z");

afterEach(() => resetQlooBudgetForTests());

describe("Qloo daily budget", () => {
  it("defaults to 2,000 and reads QLOO_DAILY_BUDGET when it is a positive whole number", () => {
    expect(DEFAULT_QLOO_DAILY_BUDGET).toBe(2000);
    expect(parseBudget(undefined)).toBe(2000);
    expect(parseBudget("")).toBe(2000);
    expect(parseBudget("abc")).toBe(2000);
    expect(parseBudget("-5")).toBe(2000);
    expect(parseBudget("1.5")).toBe(2000);
    expect(parseBudget(" 500 ")).toBe(500);
  });

  it("allows the budget's calls, then fails fast with rate_limited and reports it spent", async () => {
    resetQlooBudgetForTests({ usage: new MemoryUsageStore(), max: 3 });
    for (let i = 0; i < 3; i++) await takeQlooCall(DAY1);
    expect(qlooBudgetSpent(DAY1)).toBe(true);
    const error = await takeQlooCall(DAY1).catch((e) => e);
    expect(error).toMatchObject({ adapter: "qloo", kind: "rate_limited", status: 429 });
    // The kind survives a "use cache" boundary, which keeps only the message.
    expect(errorKindOf(new Error(error.message))).toBe("rate_limited");
  });

  it("is not spent before the last call, and resets at the next UTC day", async () => {
    resetQlooBudgetForTests({ usage: new MemoryUsageStore(), max: 2 });
    await takeQlooCall(DAY1);
    expect(qlooBudgetSpent(DAY1)).toBe(false);
    await takeQlooCall(DAY1);
    await expect(takeQlooCall(DAY1)).rejects.toThrow();
    await expect(takeQlooCall(DAY2)).resolves.toBeUndefined();
    expect(qlooBudgetSpent(DAY2)).toBe(false);
  });

  it("counts across instances through the shared store (adapter qloo, UTC day)", async () => {
    const increments: [string, string][] = [];
    const shared: UsageStore = { increment: async (a, d) => (increments.push([a, d]), 2) };
    resetQlooBudgetForTests({ usage: shared, max: 2 });
    // Another instance already made the first call: this instance's first call is the 2nd, the budget's last.
    await takeQlooCall(DAY1);
    expect(increments).toEqual([["qloo", "2026-10-22"]]);
    expect(qlooBudgetSpent(DAY1)).toBe(true);
  });

  it("a database error is logged and the in-memory count still caps the instance", async () => {
    const broken: UsageStore = { increment: vi.fn().mockRejectedValue(new Error("relation does not exist")) };
    resetQlooBudgetForTests({ usage: broken, max: 2 });
    await takeQlooCall(DAY1);
    await takeQlooCall(DAY1);
    await expect(takeQlooCall(DAY1)).rejects.toThrow();
  });
});
