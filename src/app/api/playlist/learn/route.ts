import { PLAYLIST_COPY } from "@/lib/playlist-copy";
import { emptyLearnList, learnListView } from "@/server/learn/api";
import { learnStore } from "@/server/learn/store";
import { testSwitches } from "@/server/env";
import { isResponse, json, readSession } from "@/server/playlist/api";

/**
 * GET /api/playlist/learn: the Learn list (docs/playlist-architecture.md §7.3): the running run, the limit state, the runs
 * (newest first) and every suggestion. Never creates a Repertoire. POST (start a run) comes in the next commit.
 */
export async function GET(request: Request) {
  const session = await readSession(request);
  if (isResponse(session)) return session;
  if (!session.playlist) return json(emptyLearnList());
  try {
    return json(await learnListView(learnStore(testSwitches().offline, session.store), session.playlist.id));
  } catch {
    return json({ error: { code: "unavailable", message: PLAYLIST_COPY.learn.errors.unavailable } }, { status: 503 });
  }
}
