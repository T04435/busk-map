import { PLAYLIST_COPY } from "@/lib/playlist-copy";
import { addPlanSuggestionSchema } from "@/lib/playlist-schema";
import { ensurePlaylist, errorResponse, guardMutation, isResponse, json, readSession } from "@/server/playlist/api";

/**
 * POST /api/playlist/learn/suggestions: "Add to Repertoire" on a plan's Songs to learn (docs/playlist-architecture.md §3.3).
 * Inserts a pending suggestion with no run ("Added from plans"). The first add creates the Repertoire and sets the cookie.
 * A song already suggested (any status) is 409 `already_suggested`; one you already sing is 409 `in_repertoire`: the
 * unique key on (Repertoire, song key) is the no-repeat rule. R3 adds GET and PATCH next to it.
 */
export async function POST(request: Request) {
  const blocked = await guardMutation(request, "/api/playlist/learn/suggestions");
  if (blocked) return blocked;
  const parsed = addPlanSuggestionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse(400, "invalid_request", PLAYLIST_COPY.errors.invalid);
  const session = await readSession(request);
  if (isResponse(session)) return session;
  const made = await ensurePlaylist(request, session);
  if (isResponse(made)) return made;
  const result = await session.store.addPlanSuggestion(made.playlist.id, parsed.data);
  if (!result.ok) {
    return result.reason === "in_repertoire"
      ? errorResponse(409, "in_repertoire", PLAYLIST_COPY.errors.inRepertoire, undefined, made.cookies)
      : errorResponse(409, "already_suggested", PLAYLIST_COPY.errors.alreadySuggested, undefined, made.cookies);
  }
  return json({ suggestion: result.suggestion }, { status: 201 }, made.cookies);
}
