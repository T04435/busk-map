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
    expect(hasSharedRun("x")).toBe(false);
    sharedRun("x", 1_000, async (run) => run.push(plan));
    expect(hasSharedRun("x")).toBe(true);
    await new Promise((r) => setTimeout(r, 0));
    expect(hasSharedRun("x")).toBe(true);
    expect(hasSharedRun("x", Date.now() + 2_000)).toBe(false);
  });
});
