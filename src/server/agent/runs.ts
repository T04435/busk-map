import "server-only";
import type { PlanStreamEvent } from "@/lib/plan-schema";

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
 * Memory only: one instance's runs. Cross-instance reuse of the examples is
 * left to the engine plan's remote cache (preload.ts).
 */
export const RUN_TTL_MS = 15 * 60_000;
export const EXAMPLE_RUN_TTL_MS = 6 * 60 * 60_000;
const MAX_RUNS = 50;

type Follower = { onEvent: (event: PlanStreamEvent) => void; onDone: () => void };

export class AgentRun {
  readonly events: PlanStreamEvent[] = [];
  readonly startedAt = Date.now();
  finishedAt: number | null = null;
  /** True once finished with a plan and no error. */
  ok = false;
  private readonly followers = new Set<Follower>();

  push(event: PlanStreamEvent) {
    this.events.push(event);
    for (const f of this.followers) f.onEvent(event);
  }

  finish() {
    this.finishedAt = Date.now();
    this.ok = this.events.some((e) => e.type === "plan") && !this.events.some((e) => e.type === "error");
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

const runs = new Map<string, { run: AgentRun; ttl: number }>();

/**
 * The run for this key: an existing one (in flight, or finished and fresh), or
 * a new one started with `start`. `reused` says which.
 */
export function sharedRun(key: string, ttl: number, start: (run: AgentRun) => Promise<void>, now = Date.now()): { run: AgentRun; reused: boolean } {
  const existing = runs.get(key);
  if (existing && (!existing.run.done || (existing.run.ok && now - existing.run.finishedAt! < existing.ttl))) return { run: existing.run, reused: true };
  const run = new AgentRun();
  runs.set(key, { run, ttl });
  if (runs.size > MAX_RUNS) runs.delete(runs.keys().next().value!);
  void start(run)
    .catch(() => run.push({ type: "error", code: "internal", message: "Something went wrong while planning. Please try again." }))
    .finally(() => {
      run.finish();
      if (!run.ok) runs.delete(key);
    });
  return { run, reused: false };
}

export function clearRunsForTests() {
  runs.clear();
}
