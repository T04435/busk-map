import { beforeEach, describe, expect, it } from "vitest";
import type { PlanStreamEvent } from "@/lib/plan-schema";
import { AgentRun, clearRunsForTests, sharedRun } from "@/server/agent/runs";

const plan = { type: "plan" } as unknown as PlanStreamEvent;
const step: PlanStreamEvent = { type: "tool-start", id: "1", tool: "taste_map", label: "Mapping" };

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

describe("shared agent runs", () => {
  beforeEach(() => clearRunsForTests());

  it("lets a second viewer join a run in flight, then replays it once finished, without starting another", async () => {
    const gate = deferred();
    let starts = 0;
    const start = async (run: AgentRun) => {
      starts++;
      run.push(step);
      await gate.promise;
      run.push(plan);
    };
    const first = sharedRun("k", 60_000, start);
    expect(first.reused).toBe(false);
    const joined: PlanStreamEvent[] = [];
    let joinedDone = false;
    const second = sharedRun("k", 60_000, start);
    expect(second.reused).toBe(true);
    second.run.follow((e) => joined.push(e), () => (joinedDone = true));
    expect(joined).toEqual([step]);
    gate.resolve();
    await new Promise((r) => setTimeout(r, 0));
    expect(joined).toEqual([step, plan]);
    expect(joinedDone).toBe(true);
    expect(first.run.ok).toBe(true);

    const replay = sharedRun("k", 60_000, start);
    expect(replay.reused).toBe(true);
    const replayed: PlanStreamEvent[] = [];
    let replayDone = false;
    replay.run.follow((e) => replayed.push(e), () => (replayDone = true));
    expect(replayed).toEqual([step, plan]);
    expect(replayDone).toBe(true);
    expect(starts).toBe(1);

    // After the TTL a new run starts.
    expect(sharedRun("k", 60_000, start, Date.now() + 61_000).reused).toBe(false);
    expect(starts).toBe(2);
  });

  it("drops failed runs at once, so a retry runs again", async () => {
    const failing = sharedRun("bad", 60_000, async () => {
      throw new Error("boom");
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(failing.run.ok).toBe(false);
    expect(failing.run.events.at(-1)).toMatchObject({ type: "error", code: "internal" });
    const errored = sharedRun("err", 60_000, async (run) => run.push({ type: "error", code: "qloo_unavailable", message: "down" }));
    await new Promise((r) => setTimeout(r, 0));
    expect(errored.run.ok).toBe(false);
    expect(sharedRun("bad", 60_000, async (run) => run.push(plan)).reused).toBe(false);
    expect(sharedRun("err", 60_000, async (run) => run.push(plan)).reused).toBe(false);
  });

  it("stops sending to a viewer who left", async () => {
    const gate = deferred();
    const { run } = sharedRun("leave", 60_000, async (r) => {
      await gate.promise;
      r.push(plan);
    });
    const seen: PlanStreamEvent[] = [];
    const unfollow = run.follow((e) => seen.push(e), () => {});
    unfollow();
    gate.resolve();
    await new Promise((r) => setTimeout(r, 0));
    expect(seen).toEqual([]);
    expect(run.ok).toBe(true);
  });
});

describe("hasSharedRun", () => {
  beforeEach(() => clearRunsForTests());
  it("is true while a run is in flight or fresh, so replays aren't rate limited", async () => {
    const { hasSharedRun } = await import("@/server/agent/runs");
    expect(await hasSharedRun("x")).toBe(false);
    sharedRun("x", 1_000, async (run) => run.push(plan));
    expect(await hasSharedRun("x")).toBe(true);
    await new Promise((r) => setTimeout(r, 0));
    expect(await hasSharedRun("x")).toBe(true);
    expect(await hasSharedRun("x", undefined, undefined, undefined, Date.now() + 2_000)).toBe(false);
  });
});

describe("runs that fell back", () => {
  beforeEach(() => clearRunsForTests());
  it("are not replayed", async () => {
    const first = sharedRun("fallback", 60_000, async (run) => {
      run.noReplay = true;
      run.push(plan);
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(first.run.ok).toBe(false);
    expect(sharedRun("fallback", 60_000, async (run) => run.push(plan)).reused).toBe(false);
  });
});

describe("runs in the plan store (another server instance)", () => {
  beforeEach(() => clearRunsForTests());

  it("a finished run is stored with its step data and replayed by an instance that never ran it", async () => {
    const { MemoryPlanStore } = await import("@/server/agent/plan-store");
    const { sharedRunWithStore } = await import("@/server/agent/runs");
    const store = new MemoryPlanStore();
    const withData: PlanStreamEvent = { type: "tool-end", id: "1", tool: "taste_map", ok: true, summary: "s", output: { cells: 3 } };
    let starts = 0;
    const start = async (run: AgentRun) => {
      starts++;
      run.push(step);
      run.push(withData);
      run.push(plan);
    };
    const first = await sharedRunWithStore("k", "hash", 60_000, start, store);
    expect(first.reused).toBe(false);
    await new Promise((r) => setTimeout(r, 0));
    expect(await store.get("run", "hash")).not.toBeNull();

    clearRunsForTests(); // a fresh instance: nothing in memory
    const second = await sharedRunWithStore("k", "hash", 60_000, start, store);
    expect(second.reused).toBe(true);
    expect(second.run.done).toBe(true);
    const replayed: PlanStreamEvent[] = [];
    second.run.follow((e) => replayed.push(e), () => {});
    expect(replayed).toEqual([step, withData, plan]);
    expect(starts).toBe(1);
  });

  it("failed or template runs are not stored; expired rows are not replayed", async () => {
    const { MemoryPlanStore } = await import("@/server/agent/plan-store");
    const { sharedRunWithStore, hasSharedRun } = await import("@/server/agent/runs");
    const store = new MemoryPlanStore();
    await sharedRunWithStore("f", "f", 60_000, async (run) => {
      run.noReplay = true;
      run.push(plan);
    }, store);
    await new Promise((r) => setTimeout(r, 0));
    expect(await store.get("run", "f")).toBeNull();

    await store.put("run", "old", { events: [plan], startedAt: 0, finishedAt: 1 }, 60_000);
    expect(await hasSharedRun("old-key", "old", 60_000, store)).toBe(false);
    await store.put("run", "gone", { events: [plan], startedAt: Date.now(), finishedAt: Date.now() }, 1);
    expect(await store.get("run", "gone", Date.now() + 10)).toBeNull();
  });

  it("a store that fails is a miss, never an error", async () => {
    const { PostgresPlanStore, storeGet, storePut } = await import("@/server/agent/plan-store");
    const sql = { query: async () => Promise.reject(new Error("down")) };
    const store = new PostgresPlanStore(sql as never);
    await expect(storeGet(store, "run", "k")).resolves.toBeNull();
    await expect(storePut(store, "run", "k", {}, 1000)).resolves.toBeUndefined();
  });

  it("Postgres: reads fresh rows, deletes expired ones, upserts with an expiry", async () => {
    const { PostgresPlanStore } = await import("@/server/agent/plan-store");
    const queries: { text: string; params?: unknown[] }[] = [];
    let fresh = true;
    const sql = {
      query: async (text: string, params?: unknown[]) => {
        queries.push({ text, params });
        return text.startsWith("SELECT") ? [{ value: { events: [] }, created_at: new Date(0).toISOString(), fresh }] : [];
      },
    };
    const store = new PostgresPlanStore(sql as never);
    expect(await store.get("baseline", "k")).toEqual({ value: { events: [] }, createdAt: 0 });
    fresh = false;
    expect(await store.get("baseline", "k")).toBeNull();
    expect(queries.at(-1)!.text).toMatch(/^DELETE FROM plan_store/);
    await store.put("run", "k", { a: 1 }, 5000);
    expect(queries.at(-1)!.text).toMatch(/ON CONFLICT \(kind, plan_key\)/);
    expect(queries.at(-1)!.params).toEqual(["run", "k", '{"a":1}', "5000"]);
    expect(queries.some((q) => /CREATE|ALTER/.test(q.text))).toBe(false);
  });

  it("the plan key is a hash: the act's details are not in it", async () => {
    const { planKey } = await import("@/server/agent/plan-store");
    const { planRequestSchema } = await import("@/lib/plan-schema");
    const request = planRequestSchema.parse({ city: "melbourne", slot: { date: "2026-10-17", startHour: 18, endHour: 21 }, performer: { name: "Mara", artists: ["Norah Jones"] } });
    const key = planKey(request, false, "2026-10-16");
    expect(key).toMatch(/^[0-9a-f]{40}$/);
    expect(key).not.toBe(planKey(request, false, "2026-10-17"));
  });
});
