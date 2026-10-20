import { PLAYLIST_COPY } from "@/lib/playlist-copy";
import { researchInputSchema } from "@/lib/repertoire-research";
import { limitResponse, limitsExempt, refusal, runStream } from "@/server/learn/api";
import { LearnRun, registerLearnRun } from "@/server/learn/runs";
import { learnStore } from "@/server/learn/store";
import { testSwitches } from "@/server/env";
import { log } from "@/server/log";
import { ensureExisting, guardMutation, isResponse } from "@/server/playlist/api";
import { LEARN_WINDOW_MINUTES } from "@/server/playlist/config";
import { executeResearchRun } from "@/server/research/run";
import { learnRunGate, refundLearnRun } from "@/server/rate-limit";
import { adapterContextFor, clientIp, FAULTS_HEADER, learnLimitFaultRequested, researchStepDelayMs } from "@/server/request";

export const maxDuration = 120;

/** The end code of a research run waiting for input (lib/learn-schema.ts). */
const WAITING = "needs_sounds_like";

/**
 * POST /api/playlist/research/<runId>/input: the answer to a research run that paused for input (end code needs_sounds_like,
 * snapshot `waiting`). Body `{ artists?: [{ name, spotifyId? }] (1 to 3), genre? }`. The artists are saved as the performer's
 * "Artists you sound like", a genre is remembered for this link, and the SAME run carries on from the step it waited on: its
 * earlier steps are sent again from the store (never fetched again), then the rest streams as NDJSON like the research POST. If
 * Qloo still knows none of it, the run asks again (at most three asks in all). BotID-listed and limited like the research POST
 * (the learn-run limiter; a run that pauses again gives its network hit back). Refused as plain JSON: 400 bad_input, 404,
 * 409 not_waiting / already_running, 429 limit, 503.
 */
export async function POST(request: Request, context: { params: Promise<{ runId: string }> }) {
  const blocked = await guardMutation(request, "/api/playlist/research/*/input");
  if (blocked) return blocked;
  const parsed = researchInputSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return refusal(400, "bad_input", PLAYLIST_COPY.research.errors.badInput);
  const { runId } = await context.params;

  const faults = request.headers.get(FAULTS_HEADER);
  const forced = learnLimitFaultRequested(faults);
  if (forced) {
    const gate = learnRunGate({ offline: limitsExempt(), ip: clientIp(request.headers), recent: { count: 0, oldestStartedAt: null }, forced });
    if (!gate.ok) return limitResponse(gate);
  }

  const session = await ensureExisting(request);
  if (isResponse(session)) return session;
  const { playlist, cookies } = session;
  const snapshot = playlist.research ?? null;
  if (!snapshot?.waiting || snapshot.runId !== runId) return refusal(409, "not_waiting", PLAYLIST_COPY.research.errors.notWaiting, {}, cookies);

  const learn = learnStore(testSwitches().offline, session.store);
  let resumed;
  try {
    const recent = await learn.recentRuns(playlist.id, Date.now() - LEARN_WINDOW_MINUTES * 60_000);
    const gate = learnRunGate({ offline: limitsExempt(), ip: clientIp(request.headers), recent });
    if (!gate.ok) return limitResponse(gate, cookies);
    resumed = await learn.resumeRun(playlist.id, runId, WAITING);
    if (!resumed.ok) {
      if (!limitsExempt()) refundLearnRun(WAITING, clientIp(request.headers));
      return resumed.reason === "already_running"
        ? refusal(409, "already_running", PLAYLIST_COPY.learn.errors.alreadyRunning, { runId: resumed.runId }, cookies)
        : refusal(409, "not_waiting", PLAYLIST_COPY.research.errors.notWaiting, {}, cookies);
    }
  } catch (error) {
    log.warn("research run not resumed", { error: error instanceof Error ? error.message : "unknown" });
    return refusal(503, "unavailable", PLAYLIST_COPY.learn.errors.unavailable, {}, cookies);
  }

  const run = new LearnRun(runId, playlist.id);
  registerLearnRun(run);
  const ip = clientIp(request.headers);
  const exempt = limitsExempt();
  void executeResearchRun({
    learn,
    playlists: session.store,
    playlist,
    spotifyId: snapshot.spotifyArtistId,
    mode: "full",
    adapters: adapterContextFor(faults),
    record: resumed.run,
    run,
    stepDelayMs: researchStepDelayMs(faults),
    resume: { input: parsed.data, snapshot, stored: resumed.run.steps ?? [] },
  }).then(() => {
    // A run that paused again (or ended with Qloo or Spotify down) didn't count: its network hit is given back.
    const end = run.events.at(-1);
    if (!exempt && end?.type === "end") refundLearnRun(end.code, ip);
  });
  return runStream(run, cookies);
}
