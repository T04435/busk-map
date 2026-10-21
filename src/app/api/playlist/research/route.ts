import { PLAYLIST_COPY } from "@/lib/playlist-copy";
import { researchRequestSchema, researchUsable } from "@/lib/repertoire-research";
import { limitResponse, limitsExempt, refusal, runStream } from "@/server/learn/api";
import { LearnRun, registerLearnRun } from "@/server/learn/runs";
import { learnStore } from "@/server/learn/store";
import { testSwitches } from "@/server/env";
import { log } from "@/server/log";
import { ensurePlaylist, guardMutation, isResponse, readSession } from "@/server/playlist/api";
import { LEARN_MAX_PENDING, LEARN_WINDOW_MINUTES } from "@/server/playlist/config";
import { executeResearchRun } from "@/server/research/run";
import { learnRunGate, refundLearnRun } from "@/server/rate-limit";
import { adapterContextFor, clientIp, FAULTS_HEADER, learnLimitFaultRequested, researchStepDelayMs } from "@/server/request";

/** A run takes well under a minute; the summary call times out at 30 s, then the data's words are used. */
export const maxDuration = 120;

/**
 * POST /api/playlist/research: Repertoire research (docs/repertoire-research.md). Body `{ link, refresh? }` starts a full
 * run for a Spotify artist link (creating the Repertoire on a first visit, behind the creation limit); `{ mode: "more" }`
 * reruns steps 6, 7 and 9 from the saved research. `qlooChoice` ({ id } or { none: true }) answers "Is one of these you?" after a run
 * paused with candidates (end code needs_choice); a run paused for "Artists you sound like" (needs_sounds_like) is resumed with refresh. The answer is the learn stream as NDJSON (run, status, tool-start,
 * tool-end, totals, suggestion, usage, end). Refused before anything is spent, as plain JSON: 400 bad_link, 409 up_to_date
 * (same link, already researched: send refresh), no_research (more without a research), already_running, list_full,
 * 429 limit (the learn-run limiter: 3 an hour per Repertoire, 6 per IP; a run that ended with Qloo or Spotify down is
 * given back), 503. Joining and replaying use /api/playlist/learn/runs/<runId>/events.
 */
export async function POST(request: Request) {
  const blocked = await guardMutation(request, "/api/playlist/research");
  if (blocked) return blocked;
  const parsed = researchRequestSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return refusal(400, "bad_link", PLAYLIST_COPY.research.errors.badLink);
  const body = parsed.data;
  if (body.mode === "full" && !body.link) return refusal(400, "bad_link", PLAYLIST_COPY.research.errors.badLink);

  const faults = request.headers.get(FAULTS_HEADER);
  const offline = testSwitches().offline;
  const forced = learnLimitFaultRequested(faults);
  if (forced) {
    const gate = learnRunGate({ offline: limitsExempt(), ip: clientIp(request.headers), recent: { count: 0, oldestStartedAt: null }, forced });
    if (!gate.ok) return limitResponse(gate);
  }

  const session = await readSession(request);
  if (isResponse(session)) return session;
  let playlist = session.playlist;
  let cookies: string[] = [];
  if (body.mode === "more") {
    if (!playlist) return refusal(404, "no_playlist", PLAYLIST_COPY.errors.notFound);
    const made = await ensurePlaylist(request, session);
    if (isResponse(made)) return made;
    cookies = made.cookies;
    if (!researchUsable(playlist.research)) return refusal(409, "no_research", PLAYLIST_COPY.research.errors.noResearch, {}, cookies);
  } else {
    const made = await ensurePlaylist(request, session);
    if (isResponse(made)) return made;
    playlist = made.playlist;
    cookies = made.cookies;
    const done = playlist.research?.spotifyArtistId === body.link && playlist.research?.steps.profile?.status === "done";
    if (done && !body.refresh) return refusal(409, "up_to_date", PLAYLIST_COPY.research.errors.upToDate, {}, cookies);
  }
  const spotifyId = body.mode === "more" ? playlist.research!.spotifyArtistId : body.link!;

  const learn = learnStore(offline, session.store);
  let started;
  try {
    await learn.sweepStale(playlist.id);
    const list = await learn.list(playlist.id);
    const running = list.runs.find((r) => r.status === "running");
    if (running) return refusal(409, "already_running", PLAYLIST_COPY.learn.errors.alreadyRunning, { runId: running.id }, cookies);
    if (list.pending >= LEARN_MAX_PENDING) return refusal(409, "list_full", PLAYLIST_COPY.learn.errors.listFull(LEARN_MAX_PENDING), { pending: list.pending, max: LEARN_MAX_PENDING }, cookies);
    const recent = await learn.recentRuns(playlist.id, Date.now() - LEARN_WINDOW_MINUTES * 60_000);
    const gate = learnRunGate({ offline: limitsExempt(), ip: clientIp(request.headers), recent });
    if (!gate.ok) return limitResponse(gate, cookies);
    const songs = (await session.store.songs(playlist.id)).length;
    started = await learn.startRun(playlist.id, {
      model: offline ? "mock" : "claude",
      inputs: { songs, soundsLike: playlist.soundsLike.map((a) => a.name), pitches: [], kind: body.mode === "more" ? "more" : "research" },
    });
    if (!started.ok) return refusal(409, "already_running", PLAYLIST_COPY.learn.errors.alreadyRunning, { runId: started.runId }, cookies);
  } catch (error) {
    log.warn("research run not started", { error: error instanceof Error ? error.message : "unknown" });
    return refusal(503, "unavailable", PLAYLIST_COPY.learn.errors.unavailable, {}, cookies);
  }

  const run = new LearnRun(started.run.id, playlist.id);
  registerLearnRun(run);
  const ip = clientIp(request.headers);
  const exempt = limitsExempt();
  void executeResearchRun({ learn, playlists: session.store, playlist, spotifyId, mode: body.mode, adapters: adapterContextFor(faults), record: started.run, run, stepDelayMs: researchStepDelayMs(faults), ...(body.mode === "full" && body.qlooChoice ? { qlooChoice: body.qlooChoice } : {}), ...(body.mode === "full" && body.genre ? { genre: body.genre } : {}) }).then(() => {
    // A run that ended with Qloo or Spotify down didn't count: its network hit is given back.
    const end = run.events.at(-1);
    if (!exempt && end?.type === "end") refundLearnRun(end.code, ip);
  });
  return runStream(run, cookies);
}
