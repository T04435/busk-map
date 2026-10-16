import { PLAYLIST_COPY } from "@/lib/playlist-copy";
import { addSongSchema } from "@/lib/playlist-schema";
import { ensurePlaylist, errorResponse, fullMessage, guardMutation, isResponse, json, readSession, viewOf } from "@/server/playlist/api";
import { toSongView } from "@/server/playlist/store";

/**
 * POST /api/playlist/songs: add a song you can sing (picked from search or typed). The first save creates the
 * Repertoire and sets the cookie. A repeat (same song key) is 409 `already_added`; the 61st song is 409 `playlist_full`.
 */
export async function POST(request: Request) {
  const blocked = await guardMutation(request, "/api/playlist/songs");
  if (blocked) return blocked;
  const parsed = addSongSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse(400, "invalid_request", PLAYLIST_COPY.errors.invalid);
  const session = await readSession(request);
  if (isResponse(session)) return session;
  const made = await ensurePlaylist(request, session);
  if (isResponse(made)) return made;
  const result = await session.store.addSong(made.playlist.id, parsed.data);
  if (!result.ok) {
    return result.reason === "duplicate"
      ? errorResponse(409, "already_added", PLAYLIST_COPY.errors.duplicate, undefined, made.cookies)
      : errorResponse(409, "playlist_full", fullMessage(), undefined, made.cookies);
  }
  return json({ song: toSongView(result.song), playlist: await viewOf(session.store, made.playlist) }, { status: 201 }, made.cookies);
}
