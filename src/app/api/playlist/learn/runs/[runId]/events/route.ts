import { PLAYLIST_COPY } from "@/lib/playlist-copy";
import { eventsStream, refusal, runStream } from "@/server/learn/api";
import { replayEvents } from "@/server/learn/replay";
import { inflightRun } from "@/server/learn/runs";
import { learnStore } from "@/server/learn/store";
import { testSwitches } from "@/server/env";
import { ensureExisting, isResponse } from "@/server/playlist/api";

/**
 * GET /api/playlist/learn/runs/<runId>/events (docs/playlist-architecture.md §2.7, §7.2): join a run going on in this
 * server, or replay a finished one from the store (its stored steps, its suggestions with their current status, the end).
 * A replay never calls a model or Qloo and is never counted against the limit. Only the Repertoire that owns a run can
 * read it. A run still going on another server is a 409 `running_elsewhere`: the client polls the list.
 */
export async function GET(request: Request, context: { params: Promise<{ runId: string }> }) {
  const session = await ensureExisting(request);
  if (isResponse(session)) return session;
  const { runId } = await context.params;
  const live = inflightRun(runId, session.playlist.id);
  if (live) return runStream(live, session.cookies);
  const learn = learnStore(testSwitches().offline, session.store);
  const record = await learn.getRun(session.playlist.id, runId);
  if (!record) return refusal(404, "run_not_found", PLAYLIST_COPY.learn.errors.runNotFound, {}, session.cookies);
  if (record.status === "running") return refusal(409, "running_elsewhere", PLAYLIST_COPY.learn.errors.notHere, {}, session.cookies);
  const suggestions = await learn.runSuggestions(session.playlist.id, runId);
  return eventsStream(replayEvents(record, suggestions), session.cookies);
}
