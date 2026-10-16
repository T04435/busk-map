import "server-only";
import type { LearnStreamEvent } from "@/lib/learn-schema";
import { processMap } from "@/server/memo";

/**
 * Learn runs in flight (docs/playlist-architecture.md §2.7): `AgentRun`'s push/follow pattern for the learn stream, keyed by
 * runId. A reload or a second tab joins the live feed: the steps so far, then the rest as they happen. A run keeps going
 * if the viewer leaves, and its songs land in the list. Only a run still going is kept here; a finished one is replayed
 * from the store (replay.ts). On another server instance the row says `running` and the client polls the list.
 */
type Follower = { onEvent: (event: LearnStreamEvent) => void; onDone: () => void };

export class LearnRun {
  readonly events: LearnStreamEvent[] = [];
  finishedAt: number | null = null;
  private readonly followers = new Set<Follower>();

  constructor(
    readonly runId: string,
    /** The Repertoire that owns the run: a run is only served to its cookie. */
    readonly playlistId: string,
  ) {}

  push(event: LearnStreamEvent) {
    this.events.push(event);
    for (const f of this.followers) f.onEvent(event);
  }

  finish() {
    this.finishedAt = Date.now();
    for (const f of this.followers) f.onDone();
    this.followers.clear();
    inflight.delete(this.runId);
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

const inflight = processMap<string, LearnRun>("learn-runs");

export function registerLearnRun(run: LearnRun) {
  inflight.set(run.runId, run);
}

/** A run going on in this instance, for the Repertoire that owns it. */
export function inflightRun(runId: string, playlistId: string): LearnRun | null {
  const run = inflight.get(runId);
  return run && run.playlistId === playlistId ? run : null;
}

export function clearLearnRunsForTests() {
  inflight.clear();
}
