import "server-only";
import type { LearnLimitBody, LearnListView, LearnRunView, LearnStreamEvent } from "@/lib/learn-schema";
import { PLAYLIST_COPY } from "@/lib/playlist-copy";
import type { LearnGate } from "@/server/rate-limit";
import { repertoireLimitState } from "@/server/rate-limit";
import { testSwitches } from "@/server/env";
import { errorResponse, json } from "@/server/playlist/api";
import { LEARN_MAX_PENDING, LEARN_RUNS_PER_HOUR_PER_PLAYLIST, LEARN_WINDOW_MINUTES } from "@/server/playlist/config";
import type { LearnRun } from "./runs";
import type { LearnStore, RunListItem } from "./store";

/** Shared by the /api/playlist/learn/* handlers: the Learn list (docs §7.3) and the 429 body (§7.2). */

export const runView = (r: RunListItem): LearnRunView => ({
  runId: r.id,
  number: r.number,
  startedAt: new Date(r.startedAt).toISOString(),
  finishedAt: r.finishedAt === null ? null : new Date(r.finishedAt).toISOString(),
  status: r.status,
  // The wire says who ranked: a run that finished from the data alone reads as "template" ("from the data").
  model: r.status === "fallback" ? "template" : r.model,
  inputs: r.inputs,
  newCount: r.newCount,
  skippedCount: r.skippedCount,
  stepsKept: r.stepsKept,
});

/** The Learn list for a Repertoire; sweeps a stuck run first. `unlimited` (offline test mode) reports the full allowance. */
export async function learnListView(store: LearnStore, playlistId: string, now = Date.now(), unlimited = false): Promise<LearnListView> {
  await store.sweepStale(playlistId, now);
  const [{ runs, suggestions, pending }, recent] = await Promise.all([store.list(playlistId), store.recentRuns(playlistId, now - LEARN_WINDOW_MINUTES * 60_000)]);
  // Offline test mode is never limited (the gate lets every run through), so the list doesn't count down either.
  const limit = unlimited ? repertoireLimitState({ count: 0, oldestStartedAt: null }, now) : repertoireLimitState(recent, now);
  const running = runs.find((r) => r.status === "running");
  return {
    running: running ? { runId: running.id, number: running.number, startedAt: new Date(running.startedAt).toISOString() } : null,
    limit: {
      max: LEARN_RUNS_PER_HOUR_PER_PLAYLIST,
      windowMinutes: LEARN_WINDOW_MINUTES,
      remaining: limit.remaining,
      retryInMinutes: limit.remaining === 0 ? Math.max(1, Math.ceil(limit.retryAfterS / 60)) : null,
    },
    runs: runs.map(runView),
    suggestions,
    pending: { count: pending, max: LEARN_MAX_PENDING },
  };
}

/** The empty list a device with no Repertoire gets (GET never creates one). */
export function emptyLearnList(): LearnListView {
  return {
    running: null,
    limit: { max: LEARN_RUNS_PER_HOUR_PER_PLAYLIST, windowMinutes: LEARN_WINDOW_MINUTES, remaining: LEARN_RUNS_PER_HOUR_PER_PLAYLIST, retryInMinutes: null },
    runs: [],
    suggestions: [],
    pending: { count: 0, max: LEARN_MAX_PENDING },
  };
}

/** 429 `limit` with Retry-After, relative message, and the scope that says which limit was hit. */
export function limitResponse(gate: Extract<LearnGate, { ok: false }>, cookies: string[] = []): Response {
  const body: LearnLimitBody = {
    error: {
      code: "limit",
      message: gate.message,
      retryAt: gate.retryAt,
      retryAfterS: gate.retryAfterS,
      limit: { scope: gate.scope, max: gate.max, windowMinutes: gate.windowMinutes, retryInMinutes: gate.retryInMinutes, resetAt: gate.retryAt },
    },
  };
  return json(body, { status: 429, headers: { "Retry-After": String(gate.retryAfterS) } }, cookies);
}

export const offline = () => testSwitches().offline;

export { errorResponse, PLAYLIST_COPY };

/** A refusal before a run starts: a plain JSON error with the contract's extra fields (§7.2), never a stream. */
export function refusal(status: number, code: string, message: string, extra: Record<string, unknown> = {}, cookies: string[] = []): Response {
  return json({ error: { code, message, ...extra } }, { status }, cookies);
}

const encoder = new TextEncoder();
const NDJSON_HEADERS = { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" };

/** A run's events as NDJSON, one object per line: what it has so far, then the rest live, closing at the run's end. */
export function runStream(run: LearnRun, cookies: string[] = []): Response {
  let unfollow = () => {};
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      unfollow = run.follow(
        (event) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`)),
        () => controller.close(),
      );
    },
    cancel() {
      unfollow();
    },
  });
  const headers = new Headers(NDJSON_HEADERS);
  for (const c of cookies) headers.append("Set-Cookie", c);
  return new Response(body, { headers });
}

/** Stored events as NDJSON, all at once (a replay). */
export function eventsStream(events: LearnStreamEvent[], cookies: string[] = []): Response {
  const headers = new Headers(NDJSON_HEADERS);
  for (const c of cookies) headers.append("Set-Cookie", c);
  return new Response(events.map((e) => `${JSON.stringify(e)}\n`).join(""), { headers });
}
