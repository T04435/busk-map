import { PLAYLIST_COPY } from "@/lib/playlist-copy";
import { emptyLearnList, learnListView, limitResponse, refusal, runStream } from "@/server/learn/api";
import { executeLearnRun } from "@/server/learn/run";
import { LearnRun, registerLearnRun } from "@/server/learn/runs";
import { learnStore } from "@/server/learn/store";
import { testSwitches } from "@/server/env";
import { log } from "@/server/log";
import { ensureExisting, isResponse, json, readSession } from "@/server/playlist/api";
import { LEARN_MAX_PENDING, LEARN_MIN_SONGS, LEARN_WINDOW_MINUTES } from "@/server/playlist/config";
import { learnRunGate } from "@/server/rate-limit";
import { adapterContextFor, clientIp, FAULTS_HEADER, learnLimitFaultRequested } from "@/server/request";
import { guardMutation } from "@/server/playlist/api";

/** A run takes 25–40 s; the agent times out at 75 s, then the data's picks are used. */
export const maxDuration = 120;

/**
 * GET /api/playlist/learn: the Learn list (docs/playlist-architecture.md §7.3): the running run, the limit state, the runs
 * (newest first) and every suggestion. Never creates a Repertoire.
 */
export async function GET(request: Request) {
  const session = await readSession(request);
  if (isResponse(session)) return session;
  if (!session.playlist) return json(emptyLearnList());
  try {
    return json(await learnListView(learnStore(testSwitches().offline, session.store), session.playlist.id, Date.now(), testSwitches().offline));
  } catch {
    return json({ error: { code: "unavailable", message: PLAYLIST_COPY.learn.errors.unavailable } }, { status: 503 });
  }
}

/**
 * POST /api/playlist/learn: start a learn run and stream its steps as NDJSON (§7.2). Refused before spending anything, as
 * plain JSON errors: 404 no_playlist, 409 empty_playlist / already_running / list_full, 429 limit (3 an hour per
 * Repertoire, 6 per IP; `scope` says which), 503. The run carries on if the viewer leaves; its songs land in the list.
 * The test faults `learn-limit` and `learn-limit-ip` (x-buskmap-faults, never in production) force each 429.
 */
export async function POST(request: Request) {
  const blocked = await guardMutation(request, "/api/playlist/learn");
  if (blocked) return blocked;
  const faults = request.headers.get(FAULTS_HEADER);
  const offline = testSwitches().offline;
  const forced = learnLimitFaultRequested(faults);
  if (forced) {
    const gate = learnRunGate({ offline, ip: clientIp(request.headers), recent: { count: 0, oldestStartedAt: null }, forced });
    if (!gate.ok) return limitResponse(gate);
  }
  const session = await ensureExisting(request);
  if (isResponse(session)) return session;
  const playlist = session.playlist;
  const learn = learnStore(offline, session.store);
  let record;
  try {
    await learn.sweepStale(playlist.id);
    const history = await learn.history(playlist.id);
    if (history.songs.length < LEARN_MIN_SONGS) {
      return refusal(409, "empty_playlist", PLAYLIST_COPY.learn.errors.emptyPlaylist(LEARN_MIN_SONGS), { minSongs: LEARN_MIN_SONGS }, session.cookies);
    }
    const list = await learn.list(playlist.id);
    const running = list.runs.find((r) => r.status === "running");
    if (running) return refusal(409, "already_running", PLAYLIST_COPY.learn.errors.alreadyRunning, { runId: running.id }, session.cookies);
    if (list.pending >= LEARN_MAX_PENDING) {
      return refusal(409, "list_full", PLAYLIST_COPY.learn.errors.listFull(LEARN_MAX_PENDING), { pending: list.pending, max: LEARN_MAX_PENDING }, session.cookies);
    }
    const recent = await learn.recentRuns(playlist.id, Date.now() - LEARN_WINDOW_MINUTES * 60_000);
    const gate = learnRunGate({ offline, ip: clientIp(request.headers), recent });
    if (!gate.ok) return limitResponse(gate, session.cookies);
    const started = await learn.startRun(playlist.id, {
      model: offline ? "mock" : "claude",
      inputs: { songs: history.songs.length, soundsLike: playlist.soundsLike.map((a) => a.name), pitches: [...new Set(playlist.usualPitches.map((p) => p.name))] },
    });
    if (!started.ok) return refusal(409, "already_running", PLAYLIST_COPY.learn.errors.alreadyRunning, { runId: started.runId }, session.cookies);
    record = { record: started.run, history };
  } catch (error) {
    log.warn("learn run not started", { error: error instanceof Error ? error.message : "unknown" });
    return refusal(503, "unavailable", PLAYLIST_COPY.learn.errors.unavailable, {}, session.cookies);
  }
  const run = new LearnRun(record.record.id, playlist.id);
  registerLearnRun(run);
  void executeLearnRun({ learn, playlist, history: record.history, adapters: adapterContextFor(faults), record: record.record, run });
  return runStream(run, session.cookies);
}
