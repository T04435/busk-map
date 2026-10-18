import { patchSuggestionSchema } from "@/lib/learn-schema";
import { PLAYLIST_COPY } from "@/lib/playlist-copy";
import { ensureExisting, errorResponse, guardMutation, isResponse, json } from "@/server/playlist/api";
import { learnStore } from "@/server/learn/store";
import { testSwitches } from "@/server/env";

/**
 * PATCH /api/playlist/learn/suggestions/<id> { status } (docs/playlist-architecture.md §1.3, §7.3):
 * - learned: pending → learned, and the song moves into Songs you can sing (the response carries the new row);
 * - dismissed: pending → dismissed ("Not for me");
 * - pending: Undo, from learned (the song leaves Songs you can sing) or dismissed.
 * Anything else is a 400. A suggestion is never deleted by the user: its row is the memory.
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const blocked = await guardMutation(request, "/api/playlist/learn/suggestions/*");
  if (blocked) return blocked;
  const parsed = patchSuggestionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse(400, "invalid_request", PLAYLIST_COPY.learn.errors.badMove);
  const session = await ensureExisting(request);
  if (isResponse(session)) return session;
  const { id } = await context.params;
  const store = learnStore(testSwitches().offline, session.store);
  const result = await store.setStatus(session.playlist.id, id, parsed.data.status);
  if (!result.ok) {
    if (result.reason === "missing") return errorResponse(404, "not_found", PLAYLIST_COPY.learn.errors.suggestionNotFound, undefined, session.cookies);
    return errorResponse(400, "invalid_transition", PLAYLIST_COPY.learn.errors.badMove, undefined, session.cookies);
  }
  return json({ suggestion: result.suggestion, song: result.song, revision: result.revision }, {}, session.cookies);
}
