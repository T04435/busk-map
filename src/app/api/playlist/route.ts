import { PLAYLIST_COPY } from "@/lib/playlist-copy";
import { patchPlaylistSchema } from "@/lib/playlist-schema";
import { clearCookie, ensurePlaylist, errorResponse, guardMutation, isResponse, json, readSession, viewOf } from "@/server/playlist/api";

/**
 * The device Repertoire (docs/playlist-architecture.md §3.6). The id never leaves the server; the cookie
 * `buskmap_playlist` (httpOnly) is the only handle.
 *
 * GET     my Repertoire, or { playlist: null }. Never creates one.
 * POST    create it (idempotent: an existing one is returned). Sets the cookie. 10 new an hour per IP.
 * PATCH   act name, sounds like, usual pitches. Needs the `revision` last seen: 409 when stale.
 * DELETE  forget: deletes the Repertoire and clears the cookie.
 */
export async function GET(request: Request) {
  const session = await readSession(request);
  if (isResponse(session)) return session;
  if (!session.playlist) return json({ playlist: null });
  return json({ playlist: await viewOf(session.store, session.playlist) });
}

export async function POST(request: Request) {
  const blocked = await guardMutation(request, "/api/playlist");
  if (blocked) return blocked;
  const session = await readSession(request);
  if (isResponse(session)) return session;
  const made = await ensurePlaylist(request, session);
  if (isResponse(made)) return made;
  return json({ playlist: await viewOf(session.store, made.playlist) }, { status: session.playlist ? 200 : 201 }, made.cookies);
}

export async function PATCH(request: Request) {
  const blocked = await guardMutation(request, "/api/playlist");
  if (blocked) return blocked;
  const parsed = patchPlaylistSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse(400, "invalid_request", PLAYLIST_COPY.errors.invalid);
  const session = await readSession(request);
  if (isResponse(session)) return session;
  if (!session.playlist) return errorResponse(404, "no_playlist", PLAYLIST_COPY.errors.notFound);
  const result = await session.store.update(session.playlist.id, parsed.data);
  if (!result.ok) {
    return result.reason === "stale"
      ? errorResponse(409, "stale", PLAYLIST_COPY.errors.stale)
      : errorResponse(404, "no_playlist", PLAYLIST_COPY.errors.notFound);
  }
  return json({ playlist: await viewOf(session.store, result.playlist) });
}

export async function DELETE(request: Request) {
  const blocked = await guardMutation(request, "/api/playlist");
  if (blocked) return blocked;
  const session = await readSession(request);
  if (isResponse(session)) return session;
  if (session.playlist) await session.store.forget(session.playlist.id);
  return json({ playlist: null }, {}, [clearCookie()]);
}
