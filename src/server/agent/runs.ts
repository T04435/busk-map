import "server-only";
import type { PlanStreamEvent } from "@/lib/plan-schema";
import { processMap } from "@/server/memo";
import { storeGet, storePut, type PlanStore } from "./plan-store";

/**
 * Agent runs, shared and replayed. The plan page starts the agent on every
 * load, so the same request (an example, a shared link, a reload) must not
 * pay for a second model run:
 * - a run in flight is joined: a new viewer gets the steps so far, then the rest live;
 * - a finished run is replayed from its recorded events for a while: the
 *   examples for EXAMPLE_RUN_TTL_MS (they stay fast all day), others for
 *   RUN_TTL_MS.
 * Failed runs (an error event, or no plan) are dropped at once. A run keeps
 * going if its first viewer leaves, so the result can still be reused; the
 * agent's own timeout and step limit bound it.
 *
 * Finished runs are also stored by plan key (plan-store.ts: Neon, or memory
 * offline), so another server instance replays them instead of paying again.
 */
export const RUN_TTL_MS = 15 * 60_000;
export const EXAMPLE_RUN_TTL_MS = 6 * 60 * 60_000;
const MAX_RUNS = 50;

type Follower = { onEvent: (event: PlanStreamEvent) => void; onDone: () => void };

export class AgentRun {
  readonly events: PlanStreamEvent[] = [];
  startedAt = Date.now();

  /** A finished run rebuilt from the plan store, for replay. */
  static replay(events: PlanStreamEvent[], startedAt: number, finishedAt: number): AgentRun {
    const run = new AgentRun();
    run.events.push(...events);
    run.startedAt = startedAt;
    run.finishedAt = finishedAt;
    run.ok = true;
    return run;
  }
  finishedAt: number | null = null;
  /** True once finished with a plan and no error. */
  ok = false;
  private readonly followers = new Set<Follower>();

  push(event: PlanStreamEvent) {
    this.events.push(event);
    for (const f of this.followers) f.onEvent(event);
  }

  /** Set when the run finished but shouldn't be replayed (e.g. the model failed and the reasons fell back to templates). */
  noReplay = false;

  finish() {
    this.finishedAt = Date.now();
    this.ok = !this.noReplay && this.events.some((e) => e.type === "plan") && !this.events.some((e) => e.type === "error");
    for (const f of this.followers) f.onDone();
    this.followers.clear();
  }

  get done() {
    return this.finishedAt !== null;
  }

  /** Everything so far, then live events until the run finishes. Returns an unfollow function. */
  follow(onEvent: Follower["onEvent"], onDone: Follower["onDone"]): () => void {
    for (const event of this.events) onEvent(event);
    if (this.done) {
      onDone();
      return () => {};
    }
    const follower = { onEvent, onDone };
    this.followers.add(follower);
    return () => this.followers.delete(follower);
  }
}

const runs = processMap<string, { run: AgentRun; ttl: number }>("agent-runs");

const reusable = (entry: { run: AgentRun; ttl: number } | undefined, now: number) =>
  entry !== undefined && (!entry.run.done || (entry.run.ok && now - entry.run.finishedAt! < entry.ttl));

/** Whether a request with this key would join or replay a run (no new model call), in this instance or from the store. */
export async function hasSharedRun(key: string, storeKey?: string, ttl?: number, store?: PlanStore, now = Date.now()): Promise<boolean> {
  if (reusable(runs.get(key), now)) return true;
  if (!store || !storeKey || ttl === undefined) return false;
  return (await storedRun(key, storeKey, ttl, store, now)) !== null;
}

/**
 * The run for this key: an existing one (in flight, or finished and fresh), or
 * a new one started with `start`. `reused` says which.
 */
export function sharedRun(
  key: string,
  ttl: number,
  start: (run: AgentRun) => Promise<void>,
  now = Date.now(),
  onDone?: (run: AgentRun) => void,
): { run: AgentRun; reused: boolean } {
  const existing = runs.get(key);
  if (existing && reusable(existing, now)) return { run: existing.run, reused: true };
  const run = new AgentRun();
  runs.set(key, { run, ttl });
  if (runs.size > MAX_RUNS) runs.delete(runs.keys().next().value!);
  void start(run)
    .catch(() => run.push({ type: "error", code: "internal", message: "Something went wrong while planning. Please try again." }))
    .finally(() => {
      run.finish();
      if (!run.ok) runs.delete(key);
      onDone?.(run);
    });
  return { run, reused: false };
}

export type StoredRun = { events: PlanStreamEvent[]; startedAt: number; finishedAt: number };

/** A finished run of this plan in the plan store (another instance's), put in memory for replay. */
export async function storedRun(key: string, storeKey: string, ttl: number, store: PlanStore, now = Date.now()): Promise<AgentRun | null> {
  if (reusable(runs.get(key), now)) return runs.get(key)!.run;
  const hit = await storeGet<StoredRun>(store, "run", storeKey);
  if (!hit || now - hit.value.finishedAt >= ttl) return null;
  // Another viewer may have started or loaded the run while the store answered.
  if (reusable(runs.get(key), now)) return runs.get(key)!.run;
  const run = AgentRun.replay(hit.value.events, hit.value.startedAt, hit.value.finishedAt);
  runs.set(key, { run, ttl });
  return run;
}

/**
 * The run for this plan: joined or replayed from this instance, replayed from
 * the plan store, or started (and stored once it finishes with a plan).
 */
export async function sharedRunWithStore(
  key: string,
  storeKey: string,
  ttl: number,
  start: (run: AgentRun) => Promise<void>,
  store: PlanStore,
  now = Date.now(),
): Promise<{ run: AgentRun; reused: boolean }> {
  const found = await storedRun(key, storeKey, ttl, store, now);
  if (found) return { run: found, reused: true };
  return sharedRun(key, ttl, start, now, (run) => {
    if (run.ok) void storePut(store, "run", storeKey, { events: run.events, startedAt: run.startedAt, finishedAt: run.finishedAt! } satisfies StoredRun, ttl);
  });
}

export function clearRunsForTests() {
  runs.clear();
}
